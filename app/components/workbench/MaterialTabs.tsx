import { useI18n } from "../../i18n";

export type MaterialTabType = "manuscript" | "knowledge" | "changes";

export interface MaterialTabsProps {
  activeTab: MaterialTabType;
  onTabChange: (tab: MaterialTabType) => void;
  unresolvedChangesCount?: number;
  isEditing?: boolean;
}

export function MaterialTabs({
  activeTab,
  onTabChange,
  unresolvedChangesCount = 0,
  isEditing = false,
}: MaterialTabsProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between border-b border-ink-muted/15 px-6 py-2.5 bg-paper/95 shrink-0 select-none">
      <div className="flex items-center space-x-6 text-xs font-serif">
        <button
          onClick={() => onTabChange("manuscript")}
          className={`pb-1 transition-colors relative ${
            activeTab === "manuscript"
              ? "text-ink font-semibold border-b-2 border-cinnabar"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          {t("workbench.manuscriptTab")}
        </button>

        <button
          onClick={() => !isEditing && onTabChange("knowledge")}
          disabled={isEditing}
          className={`pb-1 transition-colors relative ${
            activeTab === "knowledge"
              ? "text-ink font-semibold border-b-2 border-cinnabar"
              : isEditing
              ? "text-ink-faint cursor-not-allowed"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          {t("workbench.knowledgeTab")}
        </button>

        <button
          onClick={() => !isEditing && onTabChange("changes")}
          disabled={isEditing}
          className={`pb-1 transition-colors relative flex items-center space-x-1.5 ${
            activeTab === "changes"
              ? "text-ink font-semibold border-b-2 border-cinnabar"
              : isEditing
              ? "text-ink-faint cursor-not-allowed"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          <span>{t("workbench.changesTab")}</span>
          {unresolvedChangesCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-cinnabar/15 text-cinnabar text-[10px] font-mono font-medium">
              {unresolvedChangesCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex items-center space-x-2">
        {isEditing ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-serif bg-cinnabar/10 text-cinnabar font-medium">
            ● {t("workbench.manualEditMode")}
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-serif bg-ink-muted/10 text-ink-muted">
            {t("workbench.readOnlyMode")}
          </span>
        )}
      </div>
    </div>
  );
}

