import { useI18n, type Locale } from "../../i18n";
import { Link, useFetcher } from "react-router";

export interface WorkspaceHeaderProps {
  onOpenCreateModal: () => void;
  onOpenImportModal?: () => void;
}

export function WorkspaceHeader({ onOpenCreateModal, onOpenImportModal }: WorkspaceHeaderProps) {
  const { t, locale, setLocale } = useI18n();
  const fetcher = useFetcher();

  const handleToggleLocale = () => {
    const nextLocale: Locale = locale === "zh-CN" ? "en-US" : "zh-CN";
    setLocale(nextLocale);
    fetcher.submit({ locale: nextLocale }, { method: "post", action: "/api/preferences/locale" });
  };

  return (
    <header className="border-b border-ink-muted/15 bg-paper/80 backdrop-blur sticky top-0 z-30 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-8 h-8 rounded-sm bg-cinnabar/90 text-paper font-serif font-bold text-lg flex items-center justify-center shadow-sm group-hover:bg-cinnabar transition-colors">
              V
            </div>
            <div>
              <h1 className="font-serif text-xl font-medium tracking-wide text-ink">
                {t("workspace.title")}
              </h1>
              <p className="text-xs text-ink-muted hidden sm:block">
                {t("workspace.subtitle")}
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center space-x-3 text-sm">
          <button
            onClick={handleToggleLocale}
            className="px-3 py-1.5 rounded-sm border border-ink-muted/20 text-ink-muted hover:text-ink hover:border-ink-muted/40 transition-colors text-xs font-serif"
            title={t("workspace.switchLanguage")}
          >
            {locale === "zh-CN" ? "EN / 中文" : "中文 / EN"}
          </button>

          {onOpenImportModal && (
            <button
              onClick={onOpenImportModal}
              className="px-3.5 py-1.5 rounded-sm border border-ink-muted/25 text-ink hover:bg-paper-light transition-colors text-xs font-serif font-medium shadow-2xs flex items-center space-x-1.5"
            >
              <span>📥</span>
              <span>{t("workspace.importOriginal")}</span>
            </button>
          )}

          <button
            onClick={onOpenCreateModal}
            className="px-4 py-1.5 rounded-sm bg-ink text-paper hover:bg-ink/90 transition-colors text-xs font-serif font-medium shadow-sm flex items-center space-x-1.5"
          >
            <span>+</span>
            <span>{t("workspace.createProject")}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
