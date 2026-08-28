import { describe, it, expect, beforeEach } from "vitest";
import { projectRepository, manuscriptService } from "../../../server/domain";
import { action as indexAction } from "../../../app/routes/_index";
import { action as projectAction, loader as projectLoader } from "../../../app/routes/projects.$projectId";
import { parseUploadedFile } from "../../../app/utils/fileImporter";
import { extractPlainText } from "../../../shared/manuscript";

describe("E16 — Import Original Text (导入原文) Across Workspace and Workbench", () => {
  beforeEach(async () => {
    await projectRepository.updateWorkspaceSettings({ activeProjectId: null });
  });

  it("creates a new project with imported original content and baseline revision via workspace action", async () => {
    const rawManuscript = "雪落无声。庭院里的老槐树已落尽了叶子。\n\n他推开木门，寒气扑面而来。";
    const form = new FormData();
    form.append("intent", "create_project");
    form.append("title", "冬日纪事");
    form.append("description", "从本地文稿导入");
    form.append("content", rawManuscript);
    form.append("sceneTitle", "第一幕：雪落");

    const req = new Request("http://127.0.0.1:4173/", {
      method: "POST",
      body: form,
    });

    const response = await indexAction({ request: req });
    // In React Router, create_project returns a redirect to /projects/:id
    expect(response).toBeInstanceOf(Response);
    const redirectUrl = (response as Response).headers.get("Location");
    expect(redirectUrl).toMatch(/\/projects\/[a-zA-Z0-9_-]+/);

    const projectId = redirectUrl!.replace("/projects/", "");
    const project = await projectRepository.getProjectById(projectId);
    expect(project).toBeDefined();
    expect(project?.title).toBe("冬日纪事");

    const scenes = await projectRepository.listScenesByProject(projectId);
    expect(scenes.length).toBe(1);
    expect(scenes[0].title).toBe("第一幕：雪落");
    expect(scenes[0].content).toBe(rawManuscript);
    expect(scenes[0].characterCount).toBe(rawManuscript.length);

    const rev = await manuscriptService.getLatestSceneRevision(scenes[0].id, projectId);
    expect(rev).toBeDefined();
    expect(rev?.revisionNumber).toBe(1);
    expect(rev?.content).toBe(rawManuscript);
  });

  it("imports original content to overwrite/fill existing scene in workbench action", async () => {
    const project = await projectRepository.createProject({ title: "Workbench Import Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "正文卷" });
    const scene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "待导入场景",
      content: "",
    });

    const importedText = "夜色渐浓，城市在雨雾中模糊了轮廓。\n\n钟声自远方传来。";
    const form = new FormData();
    form.append("intent", "save_scene_revision");
    form.append("sceneId", scene.id);
    form.append("title", "第一章：夜色");
    form.append("content", importedText);
    form.append("description", "导入原文: 夜色");

    const req = new Request(`http://127.0.0.1:4173/projects/${project.id}`, {
      method: "POST",
      body: form,
    });

    const res = await projectAction({ request: req, params: { projectId: project.id } });
    expect((res as any).success).toBe(true);

    const updatedScene = await manuscriptService.getSceneById(scene.id, project.id);
    expect(updatedScene?.title).toBe("第一章：夜色");
    expect(updatedScene?.content).toBe(importedText);
    expect(updatedScene?.characterCount).toBe(importedText.length);

    const latestRev = await manuscriptService.getLatestSceneRevision(scene.id, project.id);
    expect(latestRev?.revisionNumber).toBe(2);
    expect(latestRev?.description).toBe("导入原文: 夜色");
  });

  it("imports original content as a new scene in workbench action", async () => {
    const project = await projectRepository.createProject({ title: "Multi Scene Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "正文第一卷" });
    await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "第一场",
      content: "既有内容",
      order: 1,
    });

    const newSceneText = "第二场的正文内容。晨光熹微。";
    const form = new FormData();
    form.append("intent", "create_scene");
    form.append("manuscriptId", manuscript.id);
    form.append("title", "第二场：破晓");
    form.append("content", newSceneText);
    form.append("order", "2");

    const req = new Request(`http://127.0.0.1:4173/projects/${project.id}`, {
      method: "POST",
      body: form,
    });

    const res = await projectAction({ request: req, params: { projectId: project.id } });
    expect((res as any).success).toBe(true);
    expect((res as any).scene.title).toBe("第二场：破晓");
    expect((res as any).scene.content).toBe(newSceneText);

    const allScenes = await projectRepository.listScenesByProject(project.id);
    expect(allScenes.length).toBe(2);
    expect(allScenes[1].title).toBe("第二场：破晓");
  });

  it("handles parseUploadedFile and creates a project with the parsed manuscript", async () => {
    const file = new File(
      ["《边城》\n\n由四川过湖南去，靠东有一条官路。这官路将到湖南边境，走到一个名唤“茶峒”的小山城时，有一小溪。"],
      "边城.txt",
      { type: "text/plain" }
    );

    const parsed = await parseUploadedFile(file);
    expect(parsed.title).toBe("边城");
    expect(parsed.wordCount).toBeGreaterThan(20);

    const form = new FormData();
    form.append("intent", "create_project");
    form.append("title", parsed.title);
    form.append("description", `从文稿《${file.name}》导入`);
    form.append("content", parsed.content);
    form.append("sceneTitle", "第一场");

    const req = new Request("http://127.0.0.1:4173/", {
      method: "POST",
      body: form,
    });

    const response = await indexAction({ request: req });
    const redirectUrl = (response as Response).headers.get("Location");
    const projectId = redirectUrl!.replace("/projects/", "");

    const loaderData = await projectLoader({ params: { projectId } });
    expect(loaderData.project.title).toBe("边城");
    expect(loaderData.scenes[0].content).toContain("由四川过湖南去");
    expect(extractPlainText(loaderData.scenes[0].content)).toContain("茶峒");
  });
});

