import { describe, it, expect, afterEach } from "vitest";
import { projectRepository } from "../../../server/domain";
import { db } from "../../../server/db/client";
import { sceneRevisions } from "../../../server/db/schema";
import crypto from "node:crypto";

describe("ProjectRepository Integration & Scoping", () => {
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

  it("handles workspace settings singleton get and update", async () => {
    const settings = await projectRepository.getWorkspaceSettings();
    expect(settings).toBeDefined();
    expect(settings.defaultLocale).toBe("zh-CN");

    const updated = await projectRepository.updateWorkspaceSettings({
      theme: "dark",
    });
    expect(updated.theme).toBe("dark");

    // Restore to system
    await projectRepository.updateWorkspaceSettings({ theme: "system" });
  });

  it("handles project scoping, preventing cross-project resource leakage", async () => {
    // Project A
    const projA = await projectRepository.createProject({ title: "Project Alpha" });
    createdProjectIds.push(projA.id);
    const manuA = await projectRepository.createManuscript({
      projectId: projA.id,
      title: "Manuscript Alpha 1",
    });
    const sceneA = await projectRepository.createScene({
      manuscriptId: manuA.id,
      projectId: projA.id,
      title: "Scene Alpha 1",
      content: "Alpha Scene Content",
    });

    // Project B
    const projB = await projectRepository.createProject({ title: "Project Beta" });
    createdProjectIds.push(projB.id);
    const manuB = await projectRepository.createManuscript({
      projectId: projB.id,
      title: "Manuscript Beta 1",
    });
    const sceneB = await projectRepository.createScene({
      manuscriptId: manuB.id,
      projectId: projB.id,
      title: "Scene Beta 1",
      content: "Beta Scene Content",
    });

    // Scoped queries
    const projAScenes = await projectRepository.listScenesByProject(projA.id);
    const projBScenes = await projectRepository.listScenesByProject(projB.id);

    expect(projAScenes.length).toBe(1);
    expect(projAScenes[0].id).toBe(sceneA.id);

    expect(projBScenes.length).toBe(1);
    expect(projBScenes[0].id).toBe(sceneB.id);
  });

  it("creates scene revisions atomically and tracks revision numbers", async () => {
    const proj = await projectRepository.createProject({ title: "Revision Project" });
    createdProjectIds.push(proj.id);

    const manu = await projectRepository.createManuscript({
      projectId: proj.id,
      title: "Manuscript 1",
    });

    const scene = await projectRepository.createScene({
      manuscriptId: manu.id,
      projectId: proj.id,
      title: "Scene 1",
      content: "Initial drafted paragraph.",
    });

    expect(scene.currentRevisionId).toBeDefined();
    const initialRev = await projectRepository.getLatestSceneRevision(scene.id);
    expect(initialRev?.revisionNumber).toBe(1);
    expect(initialRev?.changeType).toBe("initial");

    // Create revision 2
    const rev2 = await projectRepository.createSceneRevision({
      sceneId: scene.id,
      projectId: proj.id,
      changeType: "manual_edit",
      description: "Edited opening sentence for tighter rhythm",
      content: "Initial drafted paragraph. Edited opening sentence.",
    });

    expect(rev2.revisionNumber).toBe(2);
    expect(rev2.characterCount).toBe("Initial drafted paragraph. Edited opening sentence.".length);

    // Verify scene's currentRevisionId updated
    const updatedScene = await projectRepository.getSceneById(scene.id);
    expect(updatedScene?.currentRevisionId).toBe(rev2.id);
    expect(updatedScene?.content).toBe("Initial drafted paragraph. Edited opening sentence.");

    // List revisions
    const allRevisions = await projectRepository.listSceneRevisions(scene.id);
    expect(allRevisions.length).toBe(2);
    expect(allRevisions[0].revisionNumber).toBe(2);
    expect(allRevisions[1].revisionNumber).toBe(1);
  });

  it("verifies transaction rollback on revision failure leaves scene intact", async () => {
    const proj = await projectRepository.createProject({ title: "Rollback Test Project" });
    createdProjectIds.push(proj.id);

    const manu = await projectRepository.createManuscript({
      projectId: proj.id,
      title: "Manuscript 1",
    });

    const scene = await projectRepository.createScene({
      manuscriptId: manu.id,
      projectId: proj.id,
      title: "Scene 1",
      content: "Stable baseline content.",
    });

    const baselineRev = await projectRepository.getLatestSceneRevision(scene.id);

    // Attempt revision creation with invalid foreign key in a raw transaction to test rollback
    await expect(
      db.transaction(async (tx) => {
        // Step 1: Insert an invalid revision
        await tx.insert(sceneRevisions).values({
          id: crypto.randomUUID(),
          sceneId: "non-existent-scene-id",
          projectId: proj.id,
          revisionNumber: 999,
          changeType: "manual_edit",
          description: "This should fail and rollback",
          content: "Corrupted content",
        });
      })
    ).rejects.toThrow();

    // Verify baseline scene is completely unchanged
    const afterScene = await projectRepository.getSceneById(scene.id);
    expect(afterScene?.content).toBe("Stable baseline content.");
    expect(afterScene?.currentRevisionId).toBe(baselineRev?.id);
  });

  it("handles literary annotations and margin notes CRUD", async () => {
    const proj = await projectRepository.createProject({ title: "Annotation Project" });
    createdProjectIds.push(proj.id);

    const manu = await projectRepository.createManuscript({
      projectId: proj.id,
      title: "Manuscript 1",
    });

    const scene = await projectRepository.createScene({
      manuscriptId: manu.id,
      projectId: proj.id,
      title: "Scene 1",
      content: "She looked at the sky and felt immensely happy.",
    });

    const anno = await projectRepository.createLiteraryAnnotation({
      sceneId: scene.id,
      projectId: proj.id,
      category: "language",
      severity: "medium",
      rangeFrom: 28,
      rangeTo: 47,
      quote: "felt immensely happy",
      diagnosis: "Premature emotion naming; tell instead of show.",
      literaryTradeoff: "Sacrifices immediate clarification for tactile implication.",
      replacement: { minimal: "smiled faintly", moderate: "let out a slow breath" },
      appliedReplacementType: "minimal",
      status: "pending",
    });

    expect(anno.id).toBeDefined();
    expect(anno.diagnosis).toContain("Premature emotion naming");

    const annotations = await projectRepository.listLiteraryAnnotationsByScene(scene.id);
    expect(annotations.length).toBe(1);

    const note = await projectRepository.createMarginNote({
      sceneId: scene.id,
      projectId: proj.id,
      author: "human",
      rangeFrom: 0,
      rangeTo: 10,
      quote: "She looked",
      content: "Consider switching to first person in chapter 2.",
    });

    expect(note.id).toBeDefined();
    const marginNotes = await projectRepository.listMarginNotesByScene(scene.id);
    expect(marginNotes.length).toBe(1);
    expect(marginNotes[0].author).toBe("human");
  });
});

