import { useLoaderData } from "react-router";
import { projectRepository, agentRepository } from "../../server/domain";
import { modelProcessingInfo } from "../../server/agent/context/task-context";
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
  await projectRepository.updateWorkspaceSettings({
    activeProjectId: projectId,
  });

  const manuscripts =
    await projectRepository.listManuscriptsByProject(projectId);
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
    settings: await projectRepository.getProjectSettings(projectId),
    processing: modelProcessingInfo(),
  };
}

export default function ProjectWorkbenchRoute() {
  const data = useLoaderData() as {
    project: Project;
    manuscripts: Manuscript[];
    scenes: Scene[];
    activeThread: AgentThread;
    settings: import("../../shared/schemas/project").ProjectSettings | null;
    processing: ReturnType<typeof modelProcessingInfo>;
  };

  return (
    <WorkbenchShell
      project={data.project}
      manuscripts={data.manuscripts}
      scenes={data.scenes}
      activeThread={data.activeThread}
      settings={data.settings}
      processing={data.processing}
    />
  );
}
