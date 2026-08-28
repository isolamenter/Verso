import { Link } from "react-router";
import { useI18n } from "../../i18n";
import { calculateEditorStats } from "../../../shared/manuscript";
import type { Project, Manuscript, Scene } from "../../../shared/schemas/project";

export interface WorkbenchHeaderProps {
  project: Project;
  manuscripts: Manuscript[];
  scenes: Scene[];
  activeSceneId: string;
  onSelectScene: (sceneId: string) => void;
  isEditing: boolean;
  onToggleEditMode: () => void;
  onOpenImportModal?: () => void;
  currentContent?: string;
}

export function WorkbenchHeader({
  project,
  manuscripts,
  scenes,
  activeSceneId,
  onSelectScene,
  isEditing,
  onToggleEditMode,
  onOpenImportModal,
  currentContent = "",
}: WorkbenchHeaderProps) {
  const { t, locale } = useI18n();
  const stats = calculateEditorStats(currentContent);

  const toggleLocale = async () => {
    const next = locale === "zh-CN" ? "en-US" : "zh-CN";
    const formData = new FormData();
    formData.append("locale", next);
    await fetch("/api/preferences/locale", { method: "POST", body: formData });
    window.location.reload();
  };

  return (
    <header className="h-12 border-b border-ink-muted/20 bg-paper/90 backdrop-blur px-4 flex items-center justify-between shrink-0 select-none z-10 font-serif">
      <div className="flex items-center space-x-3">
        <Link
          to="/"
          className="text-xs text-ink-muted hover:text-ink flex items-center space-x-1 transition-colors group"
        >
          <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
          <span>{t("common.back")}</span>
        </Link>

        <span className="text-ink-muted/30">|</span>

        {/* Project Title */}
        <h1 className="text-sm font-semibold text-ink tracking-tight truncate max-w-xs">
          {project.title}
        </h1>

        {/* Scene Selector */}
        {scenes.length > 0 && (
          <select
            value={activeSceneId}
            onChange={(e) => onSelectScene(e.target.value)}
            disabled={isEditing}
            className="text-xs bg-paper-light border border-ink-muted/25 rounded px-2 py-1 text-ink focus:outline-none focus:border-ink disabled:opacity-50 font-serif"
          >
            {scenes.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.title || t("workbench.untitledScene")}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center space-x-4 text-xs text-ink-muted">
        {/* Character & Reading Time Stats */}
        <div className="hidden sm:flex items-center space-x-2 text-[11px] font-mono">
          <span>{t("workbench.wordCount", { count: stats.chineseCharacters + stats.totalWords })}</span>
          <span>·</span>
          <span>{t("workbench.readingTime", { count: stats.readingTimeMinutes })}</span>
          {manuscripts.length > 1 && (
            <>
              <span>·</span>
              <span>{t("workbench.manuscriptCount", { count: manuscripts.length })}</span>
            </>
          )}
        </div>

        {/* Import Original Text button */}
        {onOpenImportModal && (
          <button
            onClick={onOpenImportModal}
            className="px-2.5 py-1 text-xs font-serif rounded border border-ink-muted/25 text-ink hover:bg-paper-light transition-colors shadow-2xs flex items-center space-x-1"
            title={t("workbench.importOriginal")}
          >
            <span>📥</span>
            <span>{t("workbench.importOriginal")}</span>
          </button>
        )}

        {/* Edit mode toggle button */}
        <button
          onClick={onToggleEditMode}
          className={`px-3 py-1 text-xs font-serif rounded transition-colors shadow-2xs ${
            isEditing
              ? "bg-cinnabar text-paper hover:bg-cinnabar/90"
              : "bg-paper border border-ink-muted/25 text-ink hover:bg-paper-light"
          }`}
        >
          {isEditing ? t("workbench.readOnlyMode") : t("workbench.manualEditMode")}
        </button>

        {/* Language switch */}
        <button
          onClick={toggleLocale}
          className="p-1 rounded text-ink-muted hover:text-ink text-xs transition-colors"
          title={t("workspace.switchLanguage")}
        >
          {locale === "zh-CN" ? "EN" : "中"}
        </button>
      </div>
    </header>
  );
}
