import { describe, it, expect, beforeEach } from "vitest";
import { projectRepository } from "../../../server/domain";
import { loader as projectLoader } from "../../../app/routes/projects.$projectId";
import { loader as indexLoader, action as indexAction } from "../../../app/routes/_index";

describe("E07 — Workspace Home & Project Isolation", () => {
  beforeEach(async () => {
    // Reset workspace active project
    await projectRepository.updateWorkspaceSettings({ activeProjectId: null });
  });

  it(
    "lists projects with summary counts (manuscripts, scenes, unresolved changes)",
    async () => {
    // Create Project A
    const projA = await projectRepository.createProject({
      title: "Project A - Novel",
      description: "A sweeping historical saga",
    });

    const msA = await projectRepository.createManuscript({
      projectId: projA.id,
      title: "Volume 1",
      order: 1,
    });

    await projectRepository.createScene({
      manuscriptId: msA.id,
      projectId: projA.id,
      title: "Scene 1",
      content: "Opening text in Shanghai.",
      order: 1,
    });

    await projectRepository.createScene({
      manuscriptId: msA.id,
      projectId: projA.id,
      title: "Scene 2",
      content: "Nightfall text.",
      order: 2,
    });

    const summaries = await projectRepository.listProjectsWithSummary();
    const foundA = summaries.find((p) => p.id === projA.id);

    expect(foundA).toBeDefined();
    expect(foundA?.title).toBe("Project A - Novel");
    expect(foundA?.manuscriptCount).toBe(1);
    expect(foundA?.sceneCount).toBe(2);
    expect(foundA?.latestManuscriptTitle).toBe("Volume 1");
    expect(foundA?.unresolvedChangesCount).toBe(0);
  }, 15000);

  it("enforces strict Project isolation between Project A and Project B", async () => {
    const projA = await projectRepository.createProject({ title: "Isolated Project A" });
    const projB = await projectRepository.createProject({ title: "Isolated Project B" });

    const msA = await projectRepository.createManuscript({ projectId: projA.id, title: "Book A", order: 1 });
    const msB = await projectRepository.createManuscript({ projectId: projB.id, title: "Book B", order: 1 });

    await projectRepository.createScene({
      manuscriptId: msA.id,
      projectId: projA.id,
      title: "Scene in A",
      content: "Secret content in A",
      order: 1,
    });

    await projectRepository.createScene({
      manuscriptId: msB.id,
      projectId: projB.id,
      title: "Scene in B",
      content: "Different content in B",
      order: 1,
    });

    // Verify Project A queries never leak Project B records
    const scenesInA = await projectRepository.listScenesByProject(projA.id);
    const msInA = await projectRepository.listManuscriptsByProject(projA.id);

    expect(scenesInA.length).toBe(1);
    expect(scenesInA[0].title).toBe("Scene in A");
    expect(scenesInA[0].projectId).toBe(projA.id);
    expect(scenesInA.some((s) => s.projectId === projB.id)).toBe(false);

    expect(msInA.length).toBe(1);
    expect(msInA[0].title).toBe("Book A");
    expect(msInA[0].projectId).toBe(projA.id);

    // Verify Project B queries never leak Project A records
    const scenesInB = await projectRepository.listScenesByProject(projB.id);
    expect(scenesInB.length).toBe(1);
    expect(scenesInB[0].title).toBe("Scene in B");
    expect(scenesInB.some((s) => s.projectId === projA.id)).toBe(false);
  });

  it("rejects invalid or archived project IDs with a 404 Response in project route loader", async () => {
    // Non-existent ID
    await expect(
      projectLoader({ params: { projectId: "non-existent-uuid-123" } })
    ).rejects.toSatisfy((res: any) => {
      return res instanceof Response && res.status === 404;
    });

    // Archived project
    const archivedProj = await projectRepository.createProject({
      title: "Old Archived Work",
    });
    await projectRepository.updateProject(archivedProj.id, { archived: true });

    await expect(
      projectLoader({ params: { projectId: archivedProj.id } })
    ).rejects.toSatisfy((res: any) => {
      return res instanceof Response && res.status === 404;
    });
  });

  it("updates activeProjectId and loads project workbench data in project route loader", async () => {
    const proj = await projectRepository.createProject({ title: "Active Project Test" });
    const ms = await projectRepository.createManuscript({ projectId: proj.id, title: "Draft", order: 1 });
    await projectRepository.createScene({ manuscriptId: ms.id, projectId: proj.id, title: "Act 1", order: 1 });

    const loaderResult = await projectLoader({ params: { projectId: proj.id } });
    expect(loaderResult.project.id).toBe(proj.id);
    expect(loaderResult.manuscripts.length).toBe(1);
    expect(loaderResult.scenes.length).toBe(1);

    const workspaceSettings = await projectRepository.getWorkspaceSettings();
    expect(workspaceSettings.activeProjectId).toBe(proj.id);
  });

  it("handles Workspace index actions: create_project, rename_project, archive_project", async () => {
    // 1. Create project via action
    const createForm = new FormData();
    createForm.append("intent", "create_project");
    createForm.append("title", "New Masterpiece");
    createForm.append("description", "A novel about memory and time.");

    const createReq = new Request("http://127.0.0.1:4173", {
      method: "POST",
      body: createForm,
    });

    const createRes = (await indexAction({ request: createReq })) as Response;
    // Action redirects to /projects/:id
    expect(createRes.status).toBe(302);
    const location = createRes.headers.get("Location");
    expect(location).toMatch(/^\/projects\/[a-zA-Z0-9_-]+$/);

    const createdId = location!.split("/")[2];

    // 2. Rename project via action
    const renameForm = new FormData();
    renameForm.append("intent", "rename_project");
    renameForm.append("projectId", createdId);
    renameForm.append("title", "Renamed Masterpiece");
    renameForm.append("description", "Updated description.");

    const renameReq = new Request("http://127.0.0.1:4173", {
      method: "POST",
      body: renameForm,
    });

    const renameRes = await indexAction({ request: renameReq });
    expect(renameRes).toEqual({ success: true });

    const updated = await projectRepository.getProjectById(createdId);
    expect(updated?.title).toBe("Renamed Masterpiece");
    expect(updated?.description).toBe("Updated description.");

    // 3. Archive project via action
    const archiveForm = new FormData();
    archiveForm.append("intent", "archive_project");
    archiveForm.append("projectId", createdId);
    archiveForm.append("archived", "true");

    const archiveReq = new Request("http://127.0.0.1:4173", {
      method: "POST",
      body: archiveForm,
    });

    const archiveRes = await indexAction({ request: archiveReq });
    expect(archiveRes).toEqual({ success: true });

    const archived = await projectRepository.getProjectById(createdId);
    expect(archived?.archived).toBe(true);
  });

  it("loads Workspace index data with recentProject and project list", async () => {
    const indexData = await indexLoader();
    expect(Array.isArray(indexData.projects)).toBe(true);
    expect(indexData.workspaceSettings).toBeDefined();
  });
});
