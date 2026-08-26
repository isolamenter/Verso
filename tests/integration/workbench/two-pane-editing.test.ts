import { describe, it, expect } from "vitest";
import { projectRepository, manuscriptService } from "../../../server/domain";
import { loader as projectLoader, action as projectAction } from "../../../app/routes/projects.$projectId";
import { extractPlainText, type TipTapDoc } from "../../../shared/manuscript";

describe("E09 — Two-Pane Workbench & Explicit Manual Editing", () => {
  it("loads project workbench with manuscripts and scenes in read-only mode by default", async () => {
    const project = await projectRepository.createProject({ title: "Workbench Test Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "Draft 1", order: 1 });
    
    const doc: TipTapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "夜色渐深，灯火微茫。" }],
        },
      ],
    };

    const scene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "第一幕",
      content: JSON.stringify(doc),
      order: 1,
    });

    const loaderData = await projectLoader({ params: { projectId: project.id } });
    expect(loaderData.project.id).toBe(project.id);
    expect(loaderData.manuscripts.length).toBe(1);
    expect(loaderData.scenes.length).toBe(1);
    expect(loaderData.scenes[0].id).toBe(scene.id);
    expect(extractPlainText(loaderData.scenes[0].content)).toBe("夜色渐深，灯火微茫。");
  });

  it("handles save_scene_revision action, creating a new manual_edit revision atomically", async () => {
    const project = await projectRepository.createProject({ title: "Save Revision Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "Draft 1" });
    const scene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "Scene A",
      content: "Original text.",
    });

    const initialRev = await manuscriptService.getLatestSceneRevision(scene.id, project.id);

    const updatedDoc: TipTapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Updated manual text through editor." }],
        },
      ],
    };

    const form = new FormData();
    form.append("intent", "save_scene_revision");
    form.append("sceneId", scene.id);
    form.append("content", JSON.stringify(updatedDoc));
    form.append("expectedBaseRevisionId", initialRev!.id);
    form.append("description", "Refined opening line");

    const req = new Request(`http://127.0.0.1:4173/projects/${project.id}`, {
      method: "POST",
      body: form,
    });

    const res = await projectAction({ request: req, params: { projectId: project.id } });
    expect((res as any).success).toBe(true);

    const updatedScene = await manuscriptService.getSceneById(scene.id, project.id);
    expect(extractPlainText(updatedScene?.content)).toBe("Updated manual text through editor.");

    const latestRev = await manuscriptService.getLatestSceneRevision(scene.id, project.id);
    expect(latestRev?.revisionNumber).toBe(2);
    expect(latestRev?.changeType).toBe("manual_edit");
    expect(latestRev?.description).toBe("Refined opening line");
  });

  it("returns an error in save_scene_revision action when base revision conflicts", async () => {
    const project = await projectRepository.createProject({ title: "Conflict Action Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "Draft 1" });
    const scene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "Scene Conflict",
      content: "Base text",
    });

    // Advance to Rev 2
    await manuscriptService.saveSceneContent(scene.id, project.id, "Rev 2 text");

    // Client attempts to save with stale Rev 1 as base
    const form = new FormData();
    form.append("intent", "save_scene_revision");
    form.append("sceneId", scene.id);
    form.append("content", "Stale update text");
    form.append("expectedBaseRevisionId", "stale-revision-id-from-past");

    const req = new Request(`http://127.0.0.1:4173/projects/${project.id}`, {
      method: "POST",
      body: form,
    });

    const res = await projectAction({ request: req, params: { projectId: project.id } });
    expect((res as any).error).toBeDefined();
    expect((res as any).error).toContain("Revision conflict");
  });
});
