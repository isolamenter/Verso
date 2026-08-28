import { useState } from "react";
import { useLoaderData, redirect } from "react-router";
import { projectRepository } from "../../server/domain";
import { WorkspaceHeader } from "../components/workspace/WorkspaceHeader";
import { ResumeRecentCard } from "../components/workspace/ResumeRecentCard";
import { ProjectList } from "../components/workspace/ProjectList";
import { CreateProjectModal } from "../components/workspace/CreateProjectModal";
import { ImportOriginalModal } from "../components/workspace/ImportOriginalModal";
import { useI18n } from "../i18n";
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
    const content = ((formData.get("content") as string) || "").replace(/\r\n/g, "\n");
    const sceneTitle = (formData.get("sceneTitle") as string) || "第一场";

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
      title: sceneTitle,
      content,
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

  if (intent === "delete_project") {
    const projectId = formData.get("projectId") as string;
    if (projectId) {
      await projectRepository.deleteProject(projectId);
      const settings = await projectRepository.getWorkspaceSettings();
      if (settings.activeProjectId === projectId) {
        await projectRepository.updateWorkspaceSettings({ activeProjectId: null });
      }
    }
    return { success: true };
  }

  return { error: "Unknown intent" };
}

export default function WorkspaceIndexRoute() {
  const { t } = useI18n();
  const data = useLoaderData() as {
    workspaceSettings: WorkspaceSettings;
    projects: ProjectSummary[];
    recentProject: ProjectSummary | null;
  };

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectSummary | null>(null);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleOpenCreate = () => {
    setEditingProject(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenImport = () => {
    setDroppedFile(null);
    setIsImportModalOpen(true);
  };

  const handleOpenEdit = (project: ProjectSummary) => {
    setEditingProject(project);
    setIsCreateModalOpen(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only unset if leaving the window/wrapper
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setDroppedFile(file);
      setIsImportModalOpen(true);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-paper flex flex-col font-serif relative"
    >
      {/* Fullscreen Drag and Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-40 bg-ink/30 backdrop-blur-xs flex items-center justify-center pointer-events-none">
          <div className="bg-paper border-2 border-dashed border-cinnabar px-8 py-6 rounded-lg shadow-2xl text-center">
            <div className="text-3xl mb-2 text-cinnabar">📥</div>
            <p className="text-sm font-medium text-ink">
              {t("workspace.dropToImport")}
            </p>
            <p className="text-xs text-ink-muted mt-1">
              {t("workspace.supportedFormats")}
            </p>
          </div>
        </div>
      )}

      <WorkspaceHeader
        onOpenCreateModal={handleOpenCreate}
        onOpenImportModal={handleOpenImport}
      />

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
        onSwitchToImport={handleOpenImport}
      />

      <ImportOriginalModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setDroppedFile(null);
        }}
        droppedFile={droppedFile}
      />
    </div>
  );
}
