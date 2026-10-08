import { Upload, Plus } from "lucide-react";
import { useI18n } from "../../i18n";
import { Link } from "react-router";
export interface WorkspaceHeaderProps {
  onOpenCreateModal: () => void;
  onOpenImportModal?: () => void;
}
export function WorkspaceHeader({
  onOpenCreateModal,
  onOpenImportModal,
}: WorkspaceHeaderProps) {
  const { t, locale, setLocale } = useI18n();
  return (
    <header className="studio-library-header">
      <Link to="/" className="studio-logo">
        Verso
      </Link>
      <div className="studio-actions">
        <button
          className="studio-button"
          onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}
        >
          {locale === "zh-CN" ? "EN" : "中"}
        </button>
        {onOpenImportModal && (
          <button className="studio-button" onClick={onOpenImportModal}>
            <Upload size={15} />
            {t("workspace.importOriginal")}
          </button>
        )}
        <button
          className="studio-button studio-primary"
          onClick={onOpenCreateModal}
        >
          <Plus size={15} />
          {t("workspace.createProject")}
        </button>
      </div>
    </header>
  );
}
