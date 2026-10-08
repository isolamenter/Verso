import { useI18n } from "../../i18n";
export interface DiffViewerProps {
  originalText?: string | null;
  replacementText?: string | null;
  prefixAnchor?: string | null;
  suffixAnchor?: string | null;
}
export function DiffViewer({
  originalText,
  replacementText,
  prefixAnchor,
  suffixAnchor,
}: DiffViewerProps) {
  const { t } = useI18n();
  return (
    <div className="studio-diff">
      {(prefixAnchor || suffixAnchor) && (
        <p className="studio-help">
          {prefixAnchor} … {suffixAnchor}
        </p>
      )}
      <section>
        <h4>{t("studio.original")}</h4>
        <p>{originalText || t("studio.emptyText")}</p>
      </section>
      <section>
        <h4>{t("studio.proposedText")}</h4>
        <p>{replacementText || t("studio.emptyText")}</p>
      </section>
    </div>
  );
}
