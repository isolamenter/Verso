import { useI18n } from "../../i18n";
import { ProjectCard } from "./ProjectCard";
import type { ProjectSummary } from "../../../shared/schemas/project";
export interface ProjectListProps {
  projects: ProjectSummary[];
  renderedAt: string;
  onRename: (project: ProjectSummary) => void;
  onOpenCreateModal: () => void;
}
export function ProjectList({
  projects,
  renderedAt,
  onRename,
  onOpenCreateModal,
}: ProjectListProps) {
  const { t } = useI18n();
  return (
    <section className="studio-project-list">
      <h2>
        {t("workspace.allProjects")} <span>{projects.length}</span>
      </h2>
      {projects.length ? (
        projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            renderedAt={renderedAt}
            onRename={onRename}
          />
        ))
      ) : (
        <div className="studio-empty">
          <h3>{t("studio.startSmall")}</h3>
          <p>{t("studio.startSmallHelp")}</p>
          <button
            className="studio-button studio-primary"
            onClick={onOpenCreateModal}
          >
            {t("workspace.createProject")}
          </button>
        </div>
      )}
    </section>
  );
}
