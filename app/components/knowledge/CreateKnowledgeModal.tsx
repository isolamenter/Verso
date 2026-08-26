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

const KINDS: Array<{ value: KnowledgeKind; label: string }> = [
  { value: "character", label: "人物角色" },
  { value: "world_rule", label: "世界法则 / 设定" },
  { value: "location", label: "地点背景" },
  { value: "theme", label: "主题意象" },
  { value: "timeline", label: "历史 / 时间线" },
  { value: "motif", label: "叙事母题" },
  { value: "custom", label: "通用 / 其他" },
];

export function CreateKnowledgeModal({
  isOpen,
  onClose,
  onSubmit,
  initialNode,
}: CreateKnowledgeModalProps) {
  const { t } = useI18n();
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
            {initialNode ? "编辑设定素材条目" : "新增设定素材条目"}
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
            <label className="block text-ink font-medium mb-1">素材类别</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as KnowledgeKind)}
              className="w-full px-3 py-2 bg-paper-light border border-ink-muted/25 rounded text-ink focus:outline-none focus:border-ink font-serif"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-ink font-medium mb-1">条目标题 / 称谓 *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：林晚风（主角）、九霄剑阵、北境雪原"
              className="w-full px-3 py-2 bg-paper-light border border-ink-muted/25 rounded text-ink focus:outline-none focus:border-ink font-serif"
            />
          </div>

          <div>
            <label className="block text-ink font-medium mb-1">一句话摘要</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="简要概括核心特征或设定要点"
              className="w-full px-3 py-2 bg-paper-light border border-ink-muted/25 rounded text-ink focus:outline-none focus:border-ink font-serif"
            />
          </div>

          <div>
            <label className="block text-ink font-medium mb-1">详细设定与背景说明</label>
            <textarea
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入完整的人物小传、性格口癖、法术规则、地理环境或叙事背景..."
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
              {isSubmitting ? t("common.saving") : initialNode ? "保存修改" : "确认添加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

