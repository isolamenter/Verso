import { describe, it, expect } from "vitest";
import {
  projectRepository,
  knowledgeRepository,
  memoryRepository,
  agentRepository,
} from "../../../server/domain";
import { readToolsEngine } from "../../../server/agent/tools/read-tools";
import { ContextReceiptBuilder } from "../../../server/agent/context/context-receipt-builder";

describe("E11 — Atomic Read Tools and Context Receipt Skeleton", () => {
  it("executes read tools with strict Project scope protection and caps", async () => {
    // 1. Setup Project A and Project B
    const projA = await projectRepository.createProject({ title: "Project A" });
    const projB = await projectRepository.createProject({ title: "Project B" });

    const msA = await projectRepository.createManuscript({ projectId: projA.id, title: "Book A" });
    const msB = await projectRepository.createManuscript({ projectId: projB.id, title: "Book B" });

    const sceneA = await projectRepository.createScene({
      manuscriptId: msA.id,
      projectId: projA.id,
      title: "Scene in A",
      content: "上海的秋夜很凉，街灯昏暗。",
    });

    const sceneB = await projectRepository.createScene({
      manuscriptId: msB.id,
      projectId: projB.id,
      title: "Scene in B",
      content: "北京的春晨很暖，柳絮纷飞。",
    });

    const threadA = await agentRepository.createThread({ projectId: projA.id, title: "Thread A" });
    const runA = await agentRepository.createRun({ threadId: threadA.id, projectId: projA.id });
    const receiptBuilder = new ContextReceiptBuilder(runA.id, threadA.id, projA.id);

    const ctxA = {
      projectId: projA.id,
      runId: runA.id,
      threadId: threadA.id,
      receiptBuilder,
    };

    // 2. list_resources in Project A only lists scenes in Project A
    const listRes = await readToolsEngine.listResources({ type: "all", limit: 10 }, ctxA);
    expect(listRes.resources.some((r) => r.id === sceneA.id)).toBe(true);
    expect(listRes.resources.some((r) => r.id === sceneB.id)).toBe(false);

    // 3. read_resource: Reading Scene A succeeds
    const readA = await readToolsEngine.readResource({ type: "scene", id: sceneA.id }, ctxA);
    expect((readA as any).content).toContain("上海的秋夜很凉");

    // 4. read_resource: Attempting to read Scene B using Project A context fails!
    const readB = await readToolsEngine.readResource({ type: "scene", id: sceneB.id }, ctxA);
    expect((readB as any).error).toBeDefined();

    // 5. search_manuscript in Project A only matches Scene A
    const searchRes = await readToolsEngine.searchManuscript({ query: "秋夜", limit: 10 }, ctxA);
    expect(searchRes.results.length).toBe(1);
    expect(searchRes.results[0].sceneId).toBe(sceneA.id);

    // Searching for text that only exists in Scene B returns 0 matches in Project A
    const searchB = await readToolsEngine.searchManuscript({ query: "北京", limit: 10 }, ctxA);
    expect(searchB.results.length).toBe(0);

    // 6. Verify Context Receipt captures recorded reads
    const recorded = receiptBuilder.getRecordedItems();
    expect(recorded.length).toBeGreaterThanOrEqual(2);
    expect(recorded.some((item) => item.resourceId === sceneA.id)).toBe(true);

    const { receipt, items } = await receiptBuilder.finalize();
    expect(receipt.id).toBeDefined();
    expect(receipt.projectId).toBe(projA.id);
    expect(items.length).toBe(recorded.length);
  });

  it("enforces Cold Reader isolation policy against knowledge and memory inspection", async () => {
    const project = await projectRepository.createProject({ title: "Cold Reader Project" });
    const node = await knowledgeRepository.createNode({
      projectId: project.id,
      title: "Secret Lore",
      content: "This contains spoiler lore.",
      kind: "character",
    });

    await memoryRepository.createMemoryEntry({
      projectId: project.id,
      scope: "project",
      layer: "project_convention",
      key: "Author Preference",
      content: "The protagonist secretly killed the judge.",
    });

    const thread = await agentRepository.createThread({ projectId: project.id, title: "Thread" });
    const run = await agentRepository.createRun({ threadId: thread.id, projectId: project.id });
    const receiptBuilder = new ContextReceiptBuilder(run.id, thread.id, project.id);

    // Cold Reader Context
    const coldCtx = {
      projectId: project.id,
      runId: run.id,
      threadId: thread.id,
      receiptBuilder,
      isColdReader: true,
    };

    // 1. Reading knowledge node is blocked
    const knRes = await readToolsEngine.readResource({ type: "knowledge", id: node.id }, coldCtx);
    expect((knRes as any).error).toContain("Cold Reader");

    // 2. Searching knowledge is blocked
    const searchKn = await readToolsEngine.searchKnowledge({ query: "Secret", limit: 10 }, coldCtx);
    expect((searchKn as any).error).toContain("Cold Reader");

    // 3. Querying memory is blocked
    const memRes = await readToolsEngine.queryMemory({ scope: "all", limit: 10 }, coldCtx);
    expect((memRes as any).error).toContain("Cold Reader");

    // 4. Context receipt remains clean of blocked items
    const recorded = receiptBuilder.getRecordedItems();
    expect(recorded.length).toBe(0);
  });

  it("supports reading long manuscripts with offset, large limits, and truncation flags", async () => {
    const project = await projectRepository.createProject({ title: "Long Novel Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "全长篇正文" });

    // Construct a ~35,000 character sample novel
    const longText = "甲".repeat(15000) + "【第二阶段】" + "乙".repeat(15000) + "【第三阶段】" + "丙".repeat(5000);
    const scene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "长篇全卷",
      content: longText,
    });

    const thread = await agentRepository.createThread({ projectId: project.id, title: "Thread" });
    const run = await agentRepository.createRun({ threadId: thread.id, projectId: project.id });
    const ctx = { projectId: project.id, runId: run.id, threadId: thread.id };

    // Default read without maxLength should read all 35k chars without truncation
    const fullRead = (await readToolsEngine.readResource({ type: "scene", id: scene.id }, ctx)) as any;
    expect(fullRead.characterCount).toBe(longText.length);
    expect(fullRead.isTruncated).toBe(false);
    expect(fullRead.content.length).toBe(longText.length);
    expect(fullRead.content).toContain("【第二阶段】");
    expect(fullRead.content).toContain("【第三阶段】");

    // Partial read with offset and maxLength
    const partialRead = (await readToolsEngine.readResource(
      { type: "scene", id: scene.id, offset: 15000, maxLength: 100 },
      ctx
    )) as any;
    expect(partialRead.isTruncated).toBe(true);
    expect(partialRead.offset).toBe(15000);
    expect(partialRead.content.startsWith("【第二阶段】")).toBe(true);
    expect(partialRead.content.length).toBe(100);
  });
});
