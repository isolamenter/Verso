import { describe, it, expect, vi, afterEach } from "vitest";
import {
  agentRepository,
  projectRepository,
  manuscriptService,
  knowledgeRepository,
  memoryService,
  memoryRepository,
  changeSetRepository,
  changeSetService,
} from "../../../server/domain";
import { TaskRequestSchema } from "../../../shared/schemas/task";
import { resolveTask } from "../../../server/agent/context/task-context";
import { readToolsEngine } from "../../../server/agent/tools/read-tools";
import { proposalToolsEngine } from "../../../server/agent/tools/proposal-tools";
import { agentRuntime } from "../../../server/agent/runtime/agent-runtime";
import { reasoningModel } from "../../../server/models";
import { action as sceneAction } from "../../../app/routes/api.projects.$projectId.scenes.$sceneId";
import { action as changesAction } from "../../../app/routes/api.projects.$projectId.changesets";
import { selectDraft } from "../../../server/domain/writing-service";
import { exportCleanDocx } from "../../../server/domain/manuscripts/export-docx";
import {
  extractPlainText,
  plainTextToTipTapDoc,
} from "../../../shared/manuscript";
import mammoth from "mammoth";

async function fixture() {
  const project = await projectRepository.createProject({
    title: "作者控制验收",
  });
  const manuscript = await projectRepository.createManuscript({
    projectId: project.id,
    title: "诗集",
    genre: "poetry",
  });
  const scene = await projectRepository.createScene({
    projectId: project.id,
    manuscriptId: manuscript.id,
    title: "一",
    content: "雨落在窗上。\n雨落在窗上。",
  });
  const other = await projectRepository.createScene({
    projectId: project.id,
    manuscriptId: manuscript.id,
    title: "二",
    content: "隐藏章节的秘密。",
  });
  const thread = await agentRepository.createThread({
    projectId: project.id,
    title: "写作",
  });
  return { project, manuscript, scene, other, thread };
}
async function complete(id: string) {
  for (let i = 0; i < 200; i++) {
    const run = await agentRepository.getRunById(id);
    if (
      run &&
      ["completed", "partial", "failed", "cancelled"].includes(run.status)
    )
      return run;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Run did not terminate");
}
const request = (values: unknown) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
afterEach(() => vi.restoreAllMocks());

describe("Author workbench end-to-end domain boundaries", () => {
  it("pins source versions, separates background from modification, and rejects stale selection", async () => {
    const { project, scene, other, thread } = await fixture();
    const task = TaskRequestSchema.parse({
      mode: "review",
      scope: "selection",
      sceneId: scene.id,
      selection: { from: 7, to: 13, text: scene.content.slice(7, 13) },
      revisionMap: { [scene.id]: scene.currentRevisionId },
      background: "none",
      participation: "suggest",
    });
    const snapshot = await resolveTask(project.id, thread.id, task);
    const ctx = {
      projectId: project.id,
      runId: "test",
      threadId: thread.id,
      task: snapshot,
    };
    const selectedRead = await readToolsEngine.readResource(
      { type: "scene", id: scene.id },
      ctx,
    );
    expect(selectedRead.isTruncated).toBe(false);
    expect(selectedRead.nextOffset).toBe(13);
    const selectedSearch = await readToolsEngine.searchManuscript(
      { query: "落", limit: 10 },
      ctx,
    );
    expect(selectedSearch.results[0].offset).toBe(8);
    expect(
      await readToolsEngine.getRevision({ sceneId: scene.id }, ctx),
    ).toHaveProperty("error");
    expect(
      await readToolsEngine.compareRevisions(
        { sceneId: scene.id, baseRevisionNumber: 1, targetRevisionNumber: 1 },
        ctx,
      ),
    ).toHaveProperty("error");
    await expect(
      resolveTask(project.id, thread.id, {
        ...task,
        selection: { ...task.selection!, to: 15 },
      }),
    ).rejects.toThrow("选区");
    expect(
      await readToolsEngine.readResource({ type: "scene", id: other.id }, ctx),
    ).toHaveProperty("error");
    expect(
      (await readToolsEngine.readResource({ type: "scene", id: scene.id }, ctx))
        .content,
    ).toBe(task.selection!.text);
    await expect(
      proposalToolsEngine.proposeTextChange(
        {
          sceneId: scene.id,
          quote: "雨落在窗上。",
          prefixAnchor: "",
          replacementText: "雨停了。",
        },
        ctx,
      ),
    ).rejects.toThrow("选定段落");
    await manuscriptService.saveSceneContent(scene.id, project.id, "更新文本", {
      expectedBaseRevisionId: scene.currentRevisionId!,
    });
    expect(
      (await readToolsEngine.readResource({ type: "scene", id: scene.id }, ctx))
        .content,
    ).toBe(task.selection!.text);
    await expect(resolveTask(project.id, thread.id, task)).rejects.toThrow(
      "版本已变化",
    );
  });

  it("cold reading excludes hidden notes and preferences even when the model tries generic tools", async () => {
    const { project, scene, thread } = await fixture();
    const note = await knowledgeRepository.createNode({
      projectId: project.id,
      title: "隐藏动机",
      kind: "character",
      content: "不可泄露的设定",
    });
    const taste = await memoryRepository.createMemoryEntry({
      projectId: project.id,
      scope: "project",
      scopeId: project.id,
      layer: "explicit_profile",
      key: "秘密",
      content: "作者秘密",
    });
    const task = await resolveTask(
      project.id,
      thread.id,
      TaskRequestSchema.parse({
        mode: "review",
        scope: "scene",
        sceneId: scene.id,
        revisionMap: { [scene.id]: scene.currentRevisionId },
        coldRead: true,
        useKnowledge: true,
        useMemory: true,
      }),
    );
    const ctx = {
      projectId: project.id,
      threadId: thread.id,
      runId: "test",
      task,
    };
    expect(task.scenes[0].genre).toBeUndefined();
    expect(task.scenes[0].planned).toBeUndefined();
    expect(task.scenes[0].structureStale).toBeUndefined();
    // Execution engines enforce the resolved task even without a separate cold flag.
    expect(
      await readToolsEngine.readResource(
        { type: "knowledge", id: note.id },
        ctx,
      ),
    ).toHaveProperty("error");
    expect(
      await readToolsEngine.readResource({ type: "memory", id: taste.id }, ctx),
    ).toHaveProperty("error");
    expect(
      (
        await readToolsEngine.listResources({ type: "all", limit: 20 }, ctx)
      ).resources.every((r) => r.type === "scene"),
    ).toBe(true);
    expect(
      await readToolsEngine.searchKnowledge({ query: "秘密", limit: 5 }, ctx),
    ).toHaveProperty("error");
  });

  it("persists partial whole-work coverage with exact source revisions", async () => {
    const { project, scene, other, thread } = await fixture();
    let turn = 0;
    vi.spyOn(reasoningModel, "stream").mockImplementation(async function* () {
      if (turn++ === 0)
        yield {
          type: "tool_call_complete",
          index: 0,
          toolCall: {
            id: "read-1",
            type: "function",
            function: {
              name: "read_resource",
              arguments: JSON.stringify({ type: "scene", id: scene.id }),
            },
          },
        };
      else yield { type: "text_delta", delta: "已讨论第一章。" };
    });
    const { run } = await agentRuntime.startRun({
      projectId: project.id,
      threadId: thread.id,
      userPrompt: "全文审读",
      task: TaskRequestSchema.parse({
        mode: "review",
        scope: "project",
        revisionMap: {
          [scene.id]: scene.currentRevisionId,
          [other.id]: other.currentRevisionId,
        },
        background: "project",
      }),
    });
    expect((await complete(run.id)).status).toBe("partial");
    const receipt = await agentRepository.getContextReceiptByRunId(run.id);
    const coverage = receipt!.metadata.coverage as {
      scenes: Array<{ id: string; read: number; revisionId: string }>;
    };
    expect(coverage.scenes.find((s) => s.id === scene.id)?.read).toBe(
      scene.content.length,
    );
    expect(coverage.scenes.find((s) => s.id === other.id)?.read).toBe(0);
    expect(coverage.scenes.find((s) => s.id === scene.id)?.revisionId).toBe(
      scene.currentRevisionId,
    );
  });

  it("reports incomplete long-chapter reading instead of declaring the task complete", async () => {
    const { project, scene, thread } = await fixture();
    const saved = await manuscriptService.saveSceneContent(
      scene.id,
      project.id,
      "雨".repeat(13000),
      { expectedBaseRevisionId: scene.currentRevisionId! },
    );
    vi.spyOn(reasoningModel, "stream").mockImplementation(async function* () {
      yield { type: "text_delta", delta: "已讨论开头部分。" };
    });
    const { run } = await agentRuntime.startRun({
      projectId: project.id,
      threadId: thread.id,
      userPrompt: "审读当前章",
      task: TaskRequestSchema.parse({
        mode: "review",
        scope: "scene",
        sceneId: scene.id,
        revisionMap: { [scene.id]: saved.revision.id },
        background: "none",
      }),
    });
    expect((await complete(run.id)).status).toBe("partial");
    const receipt = await agentRepository.getContextReceiptByRunId(run.id);
    expect(receipt!.metadata.coverage).toMatchObject({
      scenes: [{ read: 12000, total: 13000 }],
      complete: false,
    });
  });

  it("exposes character-setting proposals while keeping adoption under author control", async () => {
    const { project, scene, thread } = await fixture();
    let turn = 0;
    vi.spyOn(reasoningModel, "stream").mockImplementation(
      async function* (input) {
        expect(
          input.tools?.some(
            (t) => t.function.name === "propose_knowledge_create",
          ),
        ).toBe(true);
        if (turn++ === 0)
          yield {
            type: "tool_call_complete",
            index: 0,
            toolCall: {
              id: "setting",
              type: "function",
              function: {
                name: "propose_knowledge_create",
                arguments: JSON.stringify({
                  kind: "character",
                  title: "等待者",
                  content: "雨中的等待者",
                  explanation: "这是对正文的暂时解释，需由作者确认。",
                }),
              },
            },
          };
        else yield { type: "text_delta", delta: "待作者确认的人物解释。" };
      },
    );
    const { run } = await agentRuntime.startRun({
      projectId: project.id,
      threadId: thread.id,
      skillId: "character_profiler",
      userPrompt: "提取人物设定供我确认",
      task: TaskRequestSchema.parse({
        mode: "structure",
        scope: "scene",
        sceneId: scene.id,
        revisionMap: { [scene.id]: scene.currentRevisionId },
        participation: "suggest",
        useKnowledge: true,
        background: "none",
      }),
    });
    expect((await complete(run.id)).status).toBe("completed");
    expect(
      await knowledgeRepository.listNodesByProject(project.id),
    ).toHaveLength(0);
    const set = (
      await changeSetRepository.listChangeSetsByProject(project.id)
    )[0];
    const result = await changeSetService.applyChangeSet(set.id, project.id);
    expect(result.success).toBe(true);
    const node = (await knowledgeRepository.listNodesByProject(project.id))[0];
    expect(node).toMatchObject({
      title: "等待者",
      authority: "agent_approved",
      sceneId: scene.id,
    });
    const revisions = await knowledgeRepository.listRevisionsByNode(node.id);
    expect(revisions).toHaveLength(1);
    const ctx = {
      projectId: project.id,
      threadId: thread.id,
      runId: run.id,
      task: await resolveTask(
        project.id,
        thread.id,
        TaskRequestSchema.parse({
          mode: "structure",
          scope: "scene",
          sceneId: scene.id,
          revisionMap: { [scene.id]: scene.currentRevisionId },
          participation: "suggest",
          useKnowledge: true,
        }),
      ),
    };
    const update = await proposalToolsEngine.proposeKnowledgeUpdate(
      { nodeId: node.id, content: "另一解释" },
      ctx,
    );
    await knowledgeRepository.updateNode(node.id, {
      content: "作者刚更新的解释",
    });
    await expect(
      changeSetService.applyChangeSet(update.changeSetId, project.id),
    ).rejects.toThrow("设定内容已变化");
    expect((await knowledgeRepository.getNodeById(node.id))!.content).toBe(
      "作者刚更新的解释",
    );
  });

  it("discussion cannot produce a revision proposal even with an unexpected tool call", async () => {
    const { project, scene, thread } = await fixture();
    let turn = 0;
    vi.spyOn(reasoningModel, "stream").mockImplementation(
      async function* (input) {
        expect(
          input.tools?.some((tool) =>
            tool.function.name.startsWith("propose_"),
          ),
        ).toBe(false);
        if (turn++ === 0)
          yield {
            type: "tool_call_complete",
            index: 0,
            toolCall: {
              id: "bad",
              type: "function",
              function: {
                name: "propose_text_change",
                arguments: JSON.stringify({
                  sceneId: scene.id,
                  quote: "雨落在窗上。",
                  replacementText: "雨停了。",
                }),
              },
            },
          };
        else
          yield { type: "text_delta", delta: "重复可能表达执念，建议保留。" };
      },
    );
    const { run } = await agentRuntime.startRun({
      projectId: project.id,
      threadId: thread.id,
      userPrompt: "保留重复，只讨论",
      task: TaskRequestSchema.parse({
        mode: "review",
        scope: "scene",
        sceneId: scene.id,
        revisionMap: { [scene.id]: scene.currentRevisionId },
        preserve: "重复",
      }),
    });
    expect((await complete(run.id)).status).toBe("completed");
    expect(
      await changeSetRepository.listChangeSetsByProject(project.id),
    ).toHaveLength(0);
    expect(
      (await manuscriptService.getSceneById(scene.id, project.id))?.content,
    ).toBe(scene.content);
  });

  it("adopts only the chosen draft passage, preserves poem line breaks, and refuses duplicate adoption", async () => {
    const { project, scene, thread } = await fixture();
    const run = await agentRepository.createRun({
      projectId: project.id,
      threadId: thread.id,
    });
    const draft = await agentRepository.createArtifact({
      projectId: project.id,
      threadId: thread.id,
      runId: run.id,
      type: "scene_draft",
      title: "试写",
      content: "未选入\n\n风穿过\n一扇窗\n\n另一备选",
    });
    await selectDraft(
      project.id,
      draft.id,
      "adopted",
      scene.id,
      scene.currentRevisionId!,
      "风穿过\n一扇窗",
    );
    const updated = await manuscriptService.getSceneById(scene.id, project.id);
    expect(extractPlainText(updated?.content)).toBe(
      `${scene.content}\n\n风穿过\n一扇窗`,
    );
    await expect(
      selectDraft(
        project.id,
        draft.id,
        "adopted",
        scene.id,
        updated?.currentRevisionId!,
        "风穿过\n一扇窗",
      ),
    ).rejects.toThrow("已处理");
    expect(
      await knowledgeRepository.listNodesByProject(project.id),
    ).toHaveLength(0);
  });

  it("keeps unselected drafts out of confirmed knowledge", async () => {
    const { project, thread } = await fixture();
    const run = await agentRepository.createRun({
      projectId: project.id,
      threadId: thread.id,
    });
    const draft = await agentRepository.createArtifact({
      projectId: project.id,
      threadId: thread.id,
      runId: run.id,
      type: "scene_draft",
      title: "备选",
      content: "尚未成立的情节",
    });
    await selectDraft(project.id, draft.id, "material");
    const notes = await knowledgeRepository.listNodesByProject(project.id);
    expect(notes[0].status).toBe("draft");
    const task = await resolveTask(
      project.id,
      thread.id,
      TaskRequestSchema.parse({
        mode: "write",
        scope: "project",
        revisionMap: Object.fromEntries(
          (await projectRepository.listScenesByProject(project.id)).map((s) => [
            s.id,
            s.currentRevisionId,
          ]),
        ),
        background: "project",
        useKnowledge: true,
      }),
    );
    expect(
      await readToolsEngine.readResource(
        { type: "knowledge", id: notes[0].id },
        { task, projectId: project.id, threadId: thread.id, runId: run.id },
      ),
    ).toHaveProperty("error");
  });

  it("creates inferred preference candidates and keeps preferences scoped to their work", async () => {
    const { project } = await fixture();
    const candidate = await memoryService.recordTasteEvidence({
      projectId: project.id,
      scope: "project",
      dimension: "rhythm",
      preference: "保留重复",
      sourceType: "conversation",
    });
    expect(candidate.taste.status).toBe("candidate");
    expect(
      (await memoryService.getScopedMemories({ projectId: project.id })).tastes,
    ).toHaveLength(0);
    await memoryRepository.updateTasteEntry(candidate.taste.id, {
      status: "active",
      lastConfirmedAt: new Date().toISOString(),
    });
    expect(
      (await memoryService.getScopedMemories({ projectId: project.id })).tastes,
    ).toHaveLength(1);
    const another = await projectRepository.createProject({
      title: "另一种风格",
    });
    expect(
      (
        await memoryService.getScopedMemories({ projectId: another.id })
      ).tastes.some((t) => t.id === candidate.taste.id),
    ).toBe(false);
  });

  it("rejects stale saves and restores text as a new version without changing structure", async () => {
    const { project, scene } = await fixture();
    const saved = await manuscriptService.saveSceneContent(
      scene.id,
      project.id,
      "较新正文",
      { expectedBaseRevisionId: scene.currentRevisionId! },
    );
    const failed = await sceneAction({
      params: { projectId: project.id, sceneId: scene.id },
      request: request({
        intent: "save",
        content: "不能覆盖",
        expectedBaseRevisionId: scene.currentRevisionId,
      }),
    });
    expect((failed as Response).status).toBe(409);
    const restored = await sceneAction({
      params: { projectId: project.id, sceneId: scene.id },
      request: request({
        intent: "restore",
        revisionId: scene.currentRevisionId,
        expectedBaseRevisionId: saved.revision.id,
      }),
    });
    expect(restored).toHaveProperty("success", true);
    const current = await manuscriptService.getSceneById(scene.id, project.id);
    expect(current?.title).toBe(scene.title);
    expect(current?.content).toBe(scene.content);
    expect(current?.currentRevisionId).not.toBe(scene.currentRevisionId);
  });

  it("records a reason for preserving text without modifying the manuscript", async () => {
    const { project, scene, thread } = await fixture();
    const run = await agentRepository.createRun({
      projectId: project.id,
      threadId: thread.id,
    });
    const task = await resolveTask(
      project.id,
      thread.id,
      TaskRequestSchema.parse({
        mode: "review",
        scope: "scene",
        sceneId: scene.id,
        revisionMap: { [scene.id]: scene.currentRevisionId },
        participation: "suggest",
      }),
    );
    const set = await proposalToolsEngine.proposeTextChange(
      {
        sceneId: scene.id,
        quote: "雨落在窗上。",
        prefixAnchor: "",
        suffixAnchor: "\n雨落",
        replacementText: "雨停了。",
      },
      { projectId: project.id, threadId: thread.id, runId: run.id, task },
    );
    const ops = await changeSetRepository.listOperationsByChangeSet(
      set.changeSetId,
    );
    await changesAction({
      params: { projectId: project.id },
      request: request({
        intent: "review",
        changeSetId: set.changeSetId,
        operationId: ops[0].id,
        decision: "retained",
        feedback: "重复表达执念",
      }),
    });
    expect(
      (await changeSetRepository.listReviewsByChangeSet(set.changeSetId))[0]
        .userFeedback,
    ).toBe("重复表达执念");
    expect(
      (await manuscriptService.getSceneById(scene.id, project.id))?.content,
    ).toBe(scene.content);
  });

  it("exports only established manuscript text, preserving poetry and excluding pending chapters", async () => {
    const { project, manuscript, scene, other } = await fixture();
    await projectRepository.updateScene(other.id, {
      metadata: { planned: true },
    });
    const buffer = await exportCleanDocx(
      project.title,
      await manuscriptService.listManuscriptsWithScenes(project.id),
    );
    const text = (await mammoth.extractRawText({ buffer })).value;
    expect(
      extractPlainText((await mammoth.convertToHtml({ buffer })).value),
    ).toContain(scene.content);
    expect(text).not.toContain(other.content);
    const formatted = JSON.stringify(plainTextToTipTapDoc("诗行甲\n诗行乙"));
    const result = (
      await mammoth.convertToHtml({
        buffer: await exportCleanDocx("诗", [
          { ...manuscript, scenes: [{ ...scene, content: formatted }] },
        ]),
      })
    ).value;
    expect(extractPlainText(result)).toContain("诗行甲\n诗行乙");
  });
});
