import { useLoaderData } from "react-router";
import { projectRepository, manuscriptService, agentRepository } from "../../server/domain";
import { WorkbenchShell } from "../components/workbench/WorkbenchShell";
import type { Project, Manuscript, Scene } from "../../shared/schemas/project";
import type { AgentThread } from "../../shared/schemas/agent";

export async function loader({ params }: { params: { projectId: string } }) {
  const projectId = params.projectId;
  if (!projectId) {
    throw new Response("Project ID required", { status: 400 });
  }

  const project = await projectRepository.getProjectById(projectId);
  if (!project || project.archived) {
    throw new Response("Project Not Found", { status: 404 });
  }

  // Update active project in workspace
  await projectRepository.updateWorkspaceSettings({ activeProjectId: projectId });

  const manuscripts = await projectRepository.listManuscriptsByProject(projectId);
  const scenes = await projectRepository.listScenesByProject(projectId);

  // Ensure default active thread
  const threads = await agentRepository.listThreadsByProject(projectId);
  let activeThread = threads[0];
  if (!activeThread) {
    activeThread = await agentRepository.createThread({
      projectId,
      title: "主线创作对话",
    });
  }

  return {
    project,
    manuscripts,
    scenes,
    activeThread,
  };
}

export async function action({ request, params }: { request: Request; params: { projectId: string } }) {
  const projectId = params.projectId;
  if (!projectId) {
    throw new Response("Project ID required", { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save_scene_revision") {
    const sceneId = formData.get("sceneId") as string;
    const content = formData.get("content") as string;
    const expectedBaseRevisionId = (formData.get("expectedBaseRevisionId") as string) || undefined;
    const description = (formData.get("description") as string) || "手动编辑修改";

    if (!sceneId || content === undefined) {
      return { error: "Missing sceneId or content" };
    }

    try {
      const result = await manuscriptService.saveSceneContent(
        sceneId,
        projectId,
        content,
        {
          expectedBaseRevisionId,
          changeType: "manual_edit",
          description,
        }
      );

      return { success: true, scene: result.scene, revision: result.revision };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  return { error: "Unknown action intent" };
}

export default function ProjectWorkbenchRoute() {
  const data = useLoaderData() as {
    project: Project;
    manuscripts: Manuscript[];
    scenes: Scene[];
    activeThread: AgentThread;
  };

  return (
    <WorkbenchShell
      project={data.project}
      manuscripts={data.manuscripts}
      scenes={data.scenes}
      activeThread={data.activeThread}
    />
  );
}

