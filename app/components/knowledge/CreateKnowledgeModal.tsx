import { useState } from "react";
import { useI18n } from "../../i18n";
import type { KnowledgeNode, KnowledgeKind } from "../../../shared/schemas/knowledge";

export interface CreateKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    kind: KnowledgeKind;
    title: string;
    content: string;
    summary?: string;
    language?: string;
  }) => Promise<void>;
  initialNode?: KnowledgeNode | null;
}

export function CreateKnowledgeModal({
  isOpen,
  onClose,
  onSubmit,
  initialNode,
}: CreateKnowledgeModalProps) {
  const { t } = useI18n();

  const kinds: Array<{ value: KnowledgeKind; label: string }> = [
    { value: "character", label: t("knowledge.catCharacter") },
    { value: "world_rule", label: t("knowledge.catWorldRule") },
    { value: "location", label: t("knowledge.catLocation") },
    { value: "theme", label: t("knowledge.catTheme") },
    { value: "timeline", label: t("knowledge.catTimeline") },
    { value: "motif", label: t("knowledge.catMotif") },
    { value: "custom", label: t("knowledge.catCustom") },
  ];

  const [kind, setKind] = useState<KnowledgeKind>(
    (initialNode?.kind as KnowledgeKind) || "character"
  );
  const [title, setTitle] = useState(initialNode?.title || "");
  const [summary, setSummary] = useState(initialNode?.summary || "");
  const [content, setContent] = useState(initialNode?.content || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        kind,
        title: title.trim(),
        summary: summary.trim() || undefined,
        content: content.trim(),
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4 font-serif">
      <div className="bg-paper border border-ink-muted/25 rounded-lg shadow-xl max-w-lg w-full p-6 animate-scale-in space-y-4">
        <div className="flex items-center justify-between border-b border-ink-muted/15 pb-3">
          <h3 className="text-sm font-semibold text-ink">
            {initialNode ? t("knowledge.editNodeTitle") : t("knowledge.addNodeTitle")}
          </h3>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink text-xs p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-ink font-medium mb-1">{t("knowledge.nodeCategoryLabel")}</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as KnowledgeKind)}
              className="w-full px-3 py-2 bg-paper-light border border-ink-muted/25 rounded text-ink focus:outline-none focus:border-ink font-serif"
            >
              {kinds.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-ink font-medium mb-1">{t("knowledge.nodeTitleLabel")}</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("knowledge.nodeTitlePlaceholder")}
              className="w-full px-3 py-2 bg-paper-light border border-ink-muted/25 rounded text-ink focus:outline-none focus:border-ink font-serif"
            />
          </div>

          <div>
            <label className="block text-ink font-medium mb-1">{t("knowledge.nodeSummaryLabel")}</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={t("knowledge.nodeSummaryPlaceholder")}
              className="w-full px-3 py-2 bg-paper-light border border-ink-muted/25 rounded text-ink focus:outline-none focus:border-ink font-serif"
            />
          </div>

          <div>
            <label className="block text-ink font-medium mb-1">{t("knowledge.nodeContentLabel")}</label>
            <textarea
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("knowledge.nodeContentPlaceholder")}
              className="w-full px-3 py-2 bg-paper-light border border-ink-muted/25 rounded text-ink focus:outline-none focus:border-ink font-serif leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-ink-muted/15">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-ink-muted/20 rounded text-ink-muted hover:text-ink transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-2 bg-ink text-paper rounded font-medium hover:bg-ink/90 disabled:opacity-40 transition-colors shadow-xs"
            >
              {isSubmitting ? t("common.saving") : initialNode ? t("knowledge.saveChanges") : t("knowledge.confirmAdd")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

