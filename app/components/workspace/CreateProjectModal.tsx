import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { useI18n } from "../../i18n";
import type { ProjectSummary } from "../../../shared/schemas/project";

export interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProject?: ProjectSummary | null;
  onSwitchToImport?: () => void;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  editingProject,
  onSwitchToImport,
}: CreateProjectModalProps) {
  const { t } = useI18n();
  const fetcher = useFetcher();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (editingProject) {
      setTitle(editingProject.title);
      setDescription(editingProject.description || "");
    } else {
      setTitle("");
      setDescription("");
    }
  }, [editingProject, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingProject) {
      fetcher.submit(
        {
          intent: "rename_project",
          projectId: editingProject.id,
          title: title.trim(),
          description: description.trim(),
        },
        { method: "post" }
      );
    } else {
      fetcher.submit(
        {
          intent: "create_project",
          title: title.trim(),
          description: description.trim(),
        },
        { method: "post" }
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4">
      <div
        className="bg-paper border border-ink-muted/30 rounded-lg shadow-xl w-full max-w-md p-6 font-serif"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 border-b border-ink-muted/15 pb-3">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-ink">
              {editingProject ? t("common.edit") : t("workspace.createProject")}
            </h3>
            {!editingProject && onSwitchToImport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToImport();
                }}
                className="text-xs text-cinnabar hover:underline font-serif"
              >
                📥 {t("workspace.importOriginal")}
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink text-sm p-1 rounded"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              {t("workspace.newProjectTitle")} *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("workspace.projectTitlePlaceholder")}
              className="w-full px-3 py-2 text-sm bg-paper-light border border-ink-muted/25 rounded focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              {t("workspace.newProjectDescription")}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("workspace.projectDescPlaceholder")}
              className="w-full px-3 py-2 text-sm bg-paper-light border border-ink-muted/25 rounded focus:outline-none focus:border-ink resize-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-ink-muted/15">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-ink-muted hover:text-ink font-serif rounded border border-ink-muted/20"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={!title.trim() || fetcher.state !== "idle"}
              className="px-5 py-1.5 text-xs bg-ink text-paper hover:bg-ink/90 font-serif font-medium rounded shadow-sm disabled:opacity-50"
            >
              {editingProject ? t("common.save") : t("workspace.createProject")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

