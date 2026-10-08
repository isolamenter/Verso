import { Link, useFetcher } from "react-router";
import { Pencil, Archive, Trash2 } from "lucide-react";
import { useI18n } from "../../i18n";
import type { ProjectSummary } from "../../../shared/schemas/project";
export function ProjectCard({
  project,
  renderedAt,
  onRename,
}: {
  project: ProjectSummary;
  renderedAt: string;
  onRename: (project: ProjectSummary) => void;
}) {
  const { t, formatRelativeTime } = useI18n();
  const fetcher = useFetcher();
  return (
    <article className="studio-project-row">
      <div>
        <Link to={`/projects/${project.id}`}>{project.title}</Link>
        <p>{project.description || t("workspace.noDescription")}</p>
        <small>
          {t("workspace.volumeCount", { count: project.manuscriptCount })} /{" "}
          {t("workspace.sceneCount", { count: project.sceneCount })}
        </small>
      </div>
      <div className="studio-project-row-end">
        <span>
          {formatRelativeTime(project.updatedAt, new Date(renderedAt))}
        </span>
        <div className="studio-actions">
          <button
            className="studio-icon-button"
            aria-label={t("common.edit")}
            onClick={() => onRename(project)}
          >
            <Pencil size={15} />
          </button>
          <button
            className="studio-icon-button"
            disabled={fetcher.state !== "idle"}
            aria-label={t("common.archived")}
            onClick={() =>
              fetcher.submit(
                {
                  intent: "archive_project",
                  projectId: project.id,
                  archived: "true",
                },
                { method: "post" },
              )
            }
          >
            <Archive size={15} />
          </button>
          <button
            className="studio-icon-button"
            disabled={fetcher.state !== "idle"}
            aria-label={t("common.delete")}
            onClick={() => {
              if (
                window.confirm(
                  t("workspace.confirmDeleteProject", { title: project.title }),
                )
              )
                fetcher.submit(
                  { intent: "delete_project", projectId: project.id },
                  { method: "post" },
                );
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}
