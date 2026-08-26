import { describe, it, expect, afterEach } from "vitest";
import { projectRepository, changeSetRepository, agentRepository } from "../../../server/domain";

describe("ChangeSetRepository & Atomic Apply Integration", () => {
  const createdProjectIds: string[] = [];

  afterEach(async () => {
    for (const id of createdProjectIds) {
      try {
        await projectRepository.deleteProject(id);
      } catch {
        // ignore cleanup error
      }
    }
    createdProjectIds.length = 0;
  });

  it("creates ChangeSet with ordered operations, reviews, and applies them atomically", async () => {
    // 1. Setup Project, Manuscript, Scene, and Thread
    const proj = await projectRepository.createProject({ title: "ChangeSet Flow Project" });
    createdProjectIds.push(proj.id);

    const manu = await projectRepository.createManuscript({
      projectId: proj.id,
      title: "Flow Manuscript",
    });

    const scene = await projectRepository.createScene({
      manuscriptId: manu.id,
      projectId: proj.id,
      title: "Opening Scene",
      content: "The rain poured heavily outside the old cobblestone street.",
    });

    const thread = await agentRepository.createThread({
      projectId: proj.id,
      title: "Style Refinement Thread",
      currentSceneId: scene.id,
    });

    const run = await agentRepository.createRun({
      threadId: thread.id,
      projectId: proj.id,
      skillId: "critique_cut",
      status: "completed",
    });

    // 2. Create ChangeSet
    const changeSet = await changeSetRepository.createChangeSet({
      projectId: proj.id,
      threadId: thread.id,
      runId: run.id,
      title: "Subtractive Polish on Opening",
      objective: "Remove redundant adverb 'heavily' and sensory cliche",
      baseRevisionMap: { [scene.id]: scene.currentRevisionId! },
      status: "proposed",
    });

    expect(changeSet.id).toBeDefined();
    expect(changeSet.status).toBe("proposed");

    // 3. Create Change Operation
    const op = await changeSetRepository.createOperation({
      changeSetId: changeSet.id,
      projectId: proj.id,
      targetType: "scene",
      targetId: scene.id,
      baseRevisionId: scene.currentRevisionId!,
      operationType: "replace_text_range",
      quote: "The rain poured heavily",
      replacementContent: "Rain washed the cobblestones",
      literaryTradeoff: "Removes unnecessary adverb 'heavily'; accelerates reader immersion.",
      status: "proposed",
    });

    expect(op.sequenceNumber).toBe(1);
    expect(op.status).toBe("proposed");

    // 4. User reviews and approves operation
    const review = await changeSetRepository.createReview({
      changeSetId: changeSet.id,
      projectId: proj.id,
      operationId: op.id,
      decision: "approved",
      userFeedback: "Good cut, sounds much more rhythmic.",
    });

    expect(review.decision).toBe("approved");

    const updatedOps = await changeSetRepository.listOperationsByChangeSet(changeSet.id);
    expect(updatedOps[0].status).toBe("approved");

    // 5. Apply ChangeSet atomically
    const applyAttempt = await changeSetRepository.applyChangeSet(changeSet.id, proj.id);
    expect(applyAttempt.status).toBe("success");
    expect(applyAttempt.resultingRevisionMap[scene.id]).toBeDefined();

    // 6. Verify target scene has updated content and new revision
    const updatedScene = await projectRepository.getSceneById(scene.id);
    expect(updatedScene?.content).toBe("Rain washed the cobblestones");
    expect(updatedScene?.currentRevisionId).toBe(applyAttempt.resultingRevisionMap[scene.id]);

    const latestRev = await projectRepository.getLatestSceneRevision(scene.id);
    expect(latestRev?.revisionNumber).toBe(2);
    expect(latestRev?.changeType).toBe("ai_accepted");
    expect(latestRev?.appliedChangeSetId).toBe(changeSet.id);

    // 7. Verify ChangeSet status is now 'applied'
    const finalChangeSet = await changeSetRepository.getChangeSetById(changeSet.id);
    expect(finalChangeSet?.status).toBe("applied");
    expect(finalChangeSet?.appliedAt).toBeDefined();
  });

  it("handles base revision conflict and rejects stale change set application", async () => {
    const proj = await projectRepository.createProject({ title: "Conflict Test Project" });
    createdProjectIds.push(proj.id);

    const manu = await projectRepository.createManuscript({
      projectId: proj.id,
      title: "Conflict Manuscript",
    });

    const scene = await projectRepository.createScene({
      manuscriptId: manu.id,
      projectId: proj.id,
      title: "Scene with Edit Conflict",
      content: "Original text.",
    });

    const initialRevId = scene.currentRevisionId!;

    // Create a ChangeSet based on initialRevId
    const changeSet = await changeSetRepository.createChangeSet({
      projectId: proj.id,
      title: "Conflicting Proposal",
      objective: "Change text",
      baseRevisionMap: { [scene.id]: initialRevId },
      status: "proposed",
    });

    await changeSetRepository.createOperation({
      changeSetId: changeSet.id,
      projectId: proj.id,
      targetType: "scene",
      targetId: scene.id,
      baseRevisionId: initialRevId,
      operationType: "replace_text_range",
      replacementContent: "Proposed text from old revision",
      status: "approved",
    });

    // In the meantime, user manually edits the scene, advancing the revision!
    await projectRepository.createSceneRevision({
      sceneId: scene.id,
      projectId: proj.id,
      changeType: "manual_edit",
      description: "User intervened and changed text",
      content: "User manual rewrite.",
    });

    // Attempting to apply the stale change set should throw revision conflict error and fail
    await expect(
      changeSetRepository.applyChangeSet(changeSet.id, proj.id)
    ).rejects.toThrow(/Revision conflict/);

    // Verify scene remained at "User manual rewrite."
    const preservedScene = await projectRepository.getSceneById(scene.id);
    expect(preservedScene?.content).toBe("User manual rewrite.");

    // Verify change set status is 'needs_rebase'
    const failedChangeSet = await changeSetRepository.getChangeSetById(changeSet.id);
    expect(failedChangeSet?.status).toBe("needs_rebase");
  });
});
