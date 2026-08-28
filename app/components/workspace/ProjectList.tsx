import { useI18n } from "../../i18n";
import { ProjectCard } from "./ProjectCard";
import type { ProjectSummary } from "../../../shared/schemas/project";

export interface ProjectListProps {
  projects: ProjectSummary[];
  onRename: (project: ProjectSummary) => void;
  onOpenCreateModal: () => void;
}

export function ProjectList({ projects, onRename, onOpenCreateModal }: ProjectListProps) {
  const { t } = useI18n();

  if (!projects || projects.length === 0) {
    return (
      <div className="text-center py-16 px-4 border border-dashed border-ink-muted/30 rounded-lg bg-paper-light/50 max-w-xl mx-auto my-8">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-ink-muted/10 flex items-center justify-center text-ink-muted text-xl font-serif">
          ✦
        </div>
        <h3 className="font-serif text-lg font-medium text-ink mb-2">
          {t("workspace.emptyProjects")}
        </h3>
        <p className="text-xs text-ink-muted mb-6 max-w-md mx-auto leading-relaxed font-serif">
          {t("workspace.platformIntro")}
        </p>
        <button
          onClick={onOpenCreateModal}
          className="px-5 py-2 rounded-sm bg-ink text-paper hover:bg-ink/90 font-serif text-xs font-medium shadow-sm transition-colors"
        >
          + {t("workspace.createProject")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-sm font-semibold tracking-wide text-ink uppercase">
          {t("workspace.allProjects")} ({projects.length})
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} onRename={onRename} />
        ))}
      </div>
    </div>
  );
}
