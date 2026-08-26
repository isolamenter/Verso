import { Link } from "react-router";
import { useI18n } from "../../i18n";
import type { ProjectSummary } from "../../../shared/schemas/project";

export interface ResumeRecentCardProps {
  project: ProjectSummary;
}

export function ResumeRecentCard({ project }: ResumeRecentCardProps) {
  const { t, formatRelativeTime } = useI18n();

  return (
    <div className="bg-paper-light border border-ink-muted/20 rounded-md p-6 shadow-sm hover:border-ink-muted/40 transition-all mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center space-x-2.5">
            <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-xs bg-cinnabar/10 text-cinnabar font-serif font-medium">
              {t("workspace.resumeRecent")}
            </span>
            <span className="text-xs text-ink-muted">
              {formatRelativeTime(project.updatedAt)}
            </span>
          </div>

          <h2 className="font-serif text-2xl font-semibold text-ink tracking-tight">
            {project.title}
          </h2>

          {project.description && (
            <p className="text-sm text-ink-muted line-clamp-2 font-serif">
              {project.description}
            </p>
          )}

          <div className="flex items-center space-x-4 pt-1 text-xs text-ink-muted">
            <span>
              {project.manuscriptCount > 0
                ? `${project.manuscriptCount} 卷`
                : "1 卷"}
            </span>
            <span>•</span>
            <span>
              {project.sceneCount > 0
                ? `${project.sceneCount} 场景`
                : "0 场景"}
            </span>
            {project.unresolvedChangesCount > 0 && (
              <>
                <span>•</span>
                <span className="text-cinnabar font-medium">
                  {project.unresolvedChangesCount} 条待审改案
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to={`/projects/${project.id}`}
            className="px-5 py-2.5 rounded-sm bg-ink text-paper hover:bg-ink/90 font-serif text-sm font-medium transition-colors shadow-sm flex items-center space-x-2"
          >
            <span>进入工作台</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
