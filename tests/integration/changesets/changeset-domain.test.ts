import { describe, it, expect } from "vitest";
import {
  projectRepository,
  manuscriptService,
  changeSetService,
  changeSetRepository,
  agentRepository,
} from "../../../server/domain";
import { proposalToolsEngine } from "../../../server/agent/tools/proposal-tools";

describe("E12 — Change Set Domain, Validation, and Transactional Apply", () => {
  it("proposes text changes without direct mutation, validates anchors, and applies atomically", async () => {
    const project = await projectRepository.createProject({ title: "ChangeSet Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "Book" });
    const scene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "Scene 1",
      content: "傍晚时分，窗外的雨落得更急了。他合上书，叹了一口气。",
    });

    const thread = await agentRepository.createThread({ projectId: project.id, title: "Thread" });
    const run = await agentRepository.createRun({ threadId: thread.id, projectId: project.id });

    const ctx = {
      projectId: project.id,
      runId: run.id,
      threadId: thread.id,
    };

    // 1. Propose change via proposal tool
    const proposalRes = await proposalToolsEngine.proposeTextChange(
      {
        sceneId: scene.id,
        quote: "他合上书，叹了一口气。",
        replacementText: "他缓缓合上书卷，眼中泛起一丝波澜。",
        explanation: "增强情绪感染力与动作张力",
      },
      ctx
    );

    expect(proposalRes.success).toBe(true);
    expect(proposalRes.status).toBe("proposed");

    // Verify scene is NOT modified yet
    const sceneBeforeApply = await manuscriptService.getSceneById(scene.id, project.id);
    expect(sceneBeforeApply?.content).toContain("他合上书，叹了一口气。");
    expect(sceneBeforeApply?.content).not.toContain("他缓缓合上书卷");

    // 2. Apply ChangeSet atomically
    const applyRes = await changeSetService.applyChangeSet(proposalRes.changeSetId, project.id);
    expect(applyRes.success).toBe(true);
    expect(applyRes.applyAttempt.status).toBe("success");

    // 3. Verify scene is now updated and has a new revision with changeType 'agent_applied'
    const sceneAfterApply = await manuscriptService.getSceneById(scene.id, project.id);
    expect(sceneAfterApply?.content).toContain("他缓缓合上书卷，眼中泛起一丝波澜。");

    const revisions = await manuscriptService.listSceneRevisions(scene.id, project.id);
    expect(revisions.length).toBeGreaterThanOrEqual(1);
    expect(revisions[0].changeType).toBe("agent_applied");

    // 4. Verify ChangeSet record is marked applied
    const updatedChangeSet = await changeSetRepository.getChangeSetById(proposalRes.changeSetId);
    expect(updatedChangeSet?.status).toBe("applied");
  });

  it("detects stale base revisions and ambiguous quotes during validation", async () => {
    const project = await projectRepository.createProject({ title: "Conflict Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "Book" });
    const scene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "Scene 2",
      content: "街灯亮起。街灯又熄灭了。",
    });

    const thread = await agentRepository.createThread({ projectId: project.id, title: "Thread" });
    const run = await agentRepository.createRun({ threadId: thread.id, projectId: project.id });

    const ctx = {
      projectId: project.id,
      runId: run.id,
      threadId: thread.id,
    };

    // Stale base revision proposal
    const staleProposal = await proposalToolsEngine.proposeTextChange(
      {
        sceneId: scene.id,
        baseRevisionId: "stale-revision-uuid",
        quote: "街灯亮起。",
        replacementText: "路灯明亮。",
      },
      ctx
    );
    expect(staleProposal.status).toBe("needs_rebase");

    // Ambiguous quote proposal ("街灯" appears twice without prefix/suffix)
    const ambiguousProposal = await proposalToolsEngine.proposeTextChange(
      {
        sceneId: scene.id,
        quote: "街灯",
        replacementText: "路灯",
      },
      ctx
    );
    expect(ambiguousProposal.status).toBe("needs_rebase");
  });

  it("supports partial approval via derived ChangeSet", async () => {
    const project = await projectRepository.createProject({ title: "Partial Approval Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "Book" });
    const scene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "Scene 3",
      content: "早晨有雾。中午出太阳。傍晚起风。",
    });

    // Create ChangeSet with 2 operations
    const { changeSet, operations } = await changeSetService.createChangeSetWithOperations(
      {
        projectId: project.id,
        title: "两个修改建议",
        objective: "推敲早晨与傍晚描写",
      },
      [
        {
          targetType: "scene",
          targetId: scene.id,
          operationType: "replace_text_range",
          quote: "早晨有雾。",
          replacementContent: "清晨白雾弥漫。",
        },
        {
          targetType: "scene",
          targetId: scene.id,
          operationType: "replace_text_range",
          quote: "傍晚起风。",
          replacementContent: "黄昏狂风大作。",
        },
      ]
    );

    expect(operations.length).toBe(2);

    // User partially approves ONLY operation 0 (morning fog), rejecting operation 1
    const { derivedChangeSet, operations: derivedOps } = await changeSetService.createDerivedChangeSet(
      changeSet.id,
      [operations[0].id],
      project.id
    );

    expect(derivedChangeSet.status).toBe("approved");
    expect(derivedOps.length).toBe(1);
    expect(derivedOps[0].quote).toBe("早晨有雾。");

    // Parent changeSet is marked partially_approved
    const parent = await changeSetRepository.getChangeSetById(changeSet.id);
    expect(parent?.status).toBe("partially_approved");

    // Apply derived ChangeSet
    await changeSetService.applyChangeSet(derivedChangeSet.id, project.id);

    // Verify scene updated only with approved op 0
    const updatedScene = await manuscriptService.getSceneById(scene.id, project.id);
    expect(updatedScene?.content).toContain("清晨白雾弥漫。");
    expect(updatedScene?.content).toContain("傍晚起风。"); // op 1 was NOT applied!
  });

  it("rolls back all operations if any operation in transaction fails", async () => {
    const project = await projectRepository.createProject({ title: "Atomic Rollback Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "Book" });
    const scene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "Scene 4",
      content: "第一段内容。第二段内容。",
    });

    const originalContent = scene.content;

    // Create ChangeSet with 1 valid op and 1 broken op
    const { changeSet } = await changeSetService.createChangeSetWithOperations(
      {
        projectId: project.id,
        title: "包含错误的变更集",
        objective: "测试原子回滚",
      },
      [
        {
          targetType: "scene",
          targetId: scene.id,
          operationType: "replace_text_range",
          quote: "第一段内容。",
          replacementContent: "修改后的第一段。",
        },
        {
          targetType: "scene",
          targetId: "non-existent-scene-uuid",
          operationType: "replace_text_range",
          quote: "不存在的内容",
          replacementContent: "替换",
        },
      ]
    );

    // Attempting to apply must fail and throw
    await expect(changeSetService.applyChangeSet(changeSet.id, project.id)).rejects.toThrow();

    // Verify scene content was NOT modified at all
    const sceneAfterFailure = await manuscriptService.getSceneById(scene.id, project.id);
    expect(sceneAfterFailure?.content).toBe(originalContent);
  });
});

