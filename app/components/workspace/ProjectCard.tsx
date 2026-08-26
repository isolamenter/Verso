import React, { useState } from "react";
import { Link, useFetcher } from "react-router";
import { useI18n } from "../../i18n";
import type { ProjectSummary } from "../../../shared/schemas/project";

export interface ProjectCardProps {
  project: ProjectSummary;
  onRename: (project: ProjectSummary) => void;
}

export function ProjectCard({ project, onRename }: ProjectCardProps) {
  const { t, formatRelativeTime } = useI18n();
  const fetcher = useFetcher();
  const [showMenu, setShowMenu] = useState(false);

  const handleArchive = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fetcher.submit(
      { intent: "archive_project", projectId: project.id, archived: String(!project.archived) },
      { method: "post" }
    );
    setShowMenu(false);
  };

  const handleRenameClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRename(project);
    setShowMenu(false);
  };

  return (
    <div className="relative group bg-paper border border-ink-muted/15 hover:border-ink-muted/35 rounded-md p-5 transition-all shadow-xs flex flex-col justify-between h-48">
      <div>
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/projects/${project.id}`}
            className="font-serif text-lg font-semibold text-ink group-hover:text-cinnabar transition-colors line-clamp-1 flex-1"
          >
            {project.title}
          </Link>

          <div className="relative">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="text-ink-muted hover:text-ink p-1 rounded-sm text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              title={t("common.actions")}
            >
              •••
            </button>

            {showMenu && (
              <div
                className="absolute right-0 top-6 w-32 bg-paper border border-ink-muted/20 rounded shadow-md py-1 z-20 text-xs font-serif"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleRenameClick}
                  className="w-full text-left px-3 py-1.5 text-ink hover:bg-paper-light"
                >
                  {t("common.edit")}
                </button>
                <button
                  onClick={handleArchive}
                  className="w-full text-left px-3 py-1.5 text-ink hover:bg-paper-light"
                >
                  {project.archived ? "取消归档" : t("common.archived")}
                </button>
              </div>
            )}
          </div>
        </div>

        {project.description ? (
          <p className="text-xs text-ink-muted line-clamp-2 mt-1.5 font-serif leading-relaxed">
            {project.description}
          </p>
        ) : (
          <p className="text-xs text-ink-faint mt-1.5 italic font-serif">
            无附注描述
          </p>
        )}
      </div>

      <div className="pt-4 border-t border-ink-muted/10 flex items-center justify-between text-[11px] text-ink-muted">
        <div className="flex items-center space-x-2">
          <span>{project.manuscriptCount > 0 ? `${project.manuscriptCount} 卷` : "1 卷"}</span>
          <span>•</span>
          <span>{project.sceneCount} 场景</span>
          {project.unresolvedChangesCount > 0 && (
            <span className="text-cinnabar font-medium">
              ({project.unresolvedChangesCount} 待审)
            </span>
          )}
        </div>

        <span title={t("common.updated")}>
          {formatRelativeTime(project.updatedAt)}
        </span>
      </div>
    </div>
  );
}

