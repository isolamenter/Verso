import { useState } from "react";
import { useLoaderData, redirect } from "react-router";
import { projectRepository } from "../../server/domain";
import { WorkspaceHeader } from "../components/workspace/WorkspaceHeader";
import { ResumeRecentCard } from "../components/workspace/ResumeRecentCard";
import { ProjectList } from "../components/workspace/ProjectList";
import { CreateProjectModal } from "../components/workspace/CreateProjectModal";
import type { ProjectSummary, WorkspaceSettings } from "../../shared/schemas/project";

export async function loader() {
  const workspaceSettings = await projectRepository.getWorkspaceSettings();
  const projects = await projectRepository.listProjectsWithSummary({ includeArchived: false });
  
  const recentProject = (workspaceSettings.activeProjectId
    ? projects.find((p) => p.id === workspaceSettings.activeProjectId)
    : null) || projects[0] || null;

  return {
    workspaceSettings,
    projects,
    recentProject,
  };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create_project") {
    const title = (formData.get("title") as string) || "未命名作品";
    const description = (formData.get("description") as string) || undefined;

    const project = await projectRepository.createProject({
      title,
      description,
    });

    // Create default initial manuscript and scene
    const manuscript = await projectRepository.createManuscript({
      projectId: project.id,
      title: "正文第一卷",
      order: 1,
    });

    await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "第一场",
      content: "",
      order: 1,
    });

    await projectRepository.updateWorkspaceSettings({
      activeProjectId: project.id,
    });

    return redirect(`/projects/${project.id}`);
  }

  if (intent === "archive_project") {
    const projectId = formData.get("projectId") as string;
    const archived = formData.get("archived") === "true";
    if (projectId) {
      await projectRepository.updateProject(projectId, { archived });
    }
    return { success: true };
  }

  if (intent === "rename_project") {
    const projectId = formData.get("projectId") as string;
    const title = (formData.get("title") as string) || "";
    const description = (formData.get("description") as string) || undefined;
    if (projectId && title) {
      await projectRepository.updateProject(projectId, { title, description });
    }
    return { success: true };
  }

  return { error: "Unknown intent" };
}

export default function WorkspaceIndexRoute() {
  const data = useLoaderData() as {
    workspaceSettings: WorkspaceSettings;
    projects: ProjectSummary[];
    recentProject: ProjectSummary | null;
  };

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectSummary | null>(null);

  const handleOpenCreate = () => {
    setEditingProject(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (project: ProjectSummary) => {
    setEditingProject(project);
    setIsCreateModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-serif">
      <WorkspaceHeader onOpenCreateModal={handleOpenCreate} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {data.recentProject && (
          <ResumeRecentCard project={data.recentProject} />
        )}

        <ProjectList
          projects={data.projects}
          onRename={handleOpenEdit}
          onOpenCreateModal={handleOpenCreate}
        />
      </main>

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        editingProject={editingProject}
      />
    </div>
  );
}
