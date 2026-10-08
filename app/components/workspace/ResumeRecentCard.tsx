import { Link } from "react-router";
import { useI18n } from "../../i18n";
import type { ProjectSummary } from "../../../shared/schemas/project";
export function ResumeRecentCard({ project }: { project: ProjectSummary }) {
  const { t } = useI18n();
  return (
    <section className="studio-resume">
      <div className="studio-resume-copy">
        <p>{t("workspace.resumeRecent")}</p>
        <h2>{project.title}</h2>
        {project.description && (
          <p className="studio-resume-description">{project.description}</p>
        )}
        <Link
          className="studio-button studio-primary"
          to={`/projects/${project.id}`}
        >
          {t("studio.keepWriting")}
        </Link>
      </div>
      <div className="studio-resume-spine">
        <span>{t("workspace.sceneCount", { count: project.sceneCount })}</span>
        {project.unresolvedChangesCount > 0 && (
          <span>
            {t("workspace.pendingReviewCount", {
              count: project.unresolvedChangesCount,
            })}
          </span>
        )}
      </div>
    </section>
  );
}
