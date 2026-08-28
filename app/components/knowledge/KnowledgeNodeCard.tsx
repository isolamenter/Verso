import { useState } from "react";
import { useI18n } from "../../i18n";
import type { KnowledgeNode } from "../../../shared/schemas/knowledge";

export interface KnowledgeNodeCardProps {
  node: KnowledgeNode;
  onEdit: (node: KnowledgeNode) => void;
  onArchive: (nodeId: string) => Promise<void>;
}

export function KnowledgeNodeCard({
  node,
  onEdit,
  onArchive,
}: KnowledgeNodeCardProps) {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const getAuthorityBadge = (auth: string) => {
    switch (auth) {
      case "user_authored_locked":
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-800 font-medium">{t("knowledge.authAuthoritative")}</span>;
      case "user_curated_editable":
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-700 font-medium">{t("knowledge.authVerified")}</span>;
      case "agent_derived":
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-700 font-medium">{t("knowledge.authExtracted")}</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-ink-muted/10 text-ink-muted">{auth}</span>;
    }
  };

  const getKindLabel = (kind: string) => {
    const map: Record<string, string> = {
      character: t("knowledge.catCharacter"),
      world_rule: t("knowledge.catWorldRule"),
      location: t("knowledge.catLocation"),
      theme: t("knowledge.catTheme"),
      timeline: t("knowledge.catTimeline"),
      motif: t("knowledge.catMotif"),
      custom: t("knowledge.catCustom"),
    };
    return map[kind] || kind;
  };

  const handleArchive = async () => {
    const confirm = window.confirm(t("knowledge.archiveConfirm", { title: node.title }));
    if (!confirm) return;

    setIsArchiving(true);
    try {
      await onArchive(node.id);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="bg-paper border border-ink-muted/20 rounded-lg p-4 shadow-2xs font-serif space-y-2.5 transition-shadow hover:shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-ink-muted/15 text-ink font-semibold">
              {getKindLabel(node.kind)}
            </span>
            <h4 className="text-sm font-semibold text-ink">{node.title}</h4>
            {getAuthorityBadge(node.authority)}
          </div>

          {node.summary && (
            <p className="text-xs text-ink-muted italic leading-relaxed">
              {node.summary}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={() => onEdit(node)}
            className="p-1 rounded text-ink-muted hover:text-ink text-xs transition-colors"
            title={t("common.edit")}
          >
            ✏️
          </button>
          <button
            onClick={handleArchive}
            disabled={isArchiving}
            className="p-1 rounded text-ink-muted hover:text-cinnabar text-xs transition-colors"
            title={t("common.archived")}
          >
            🗑
          </button>
        </div>
      </div>

      {node.content && (
        <div>
          <div
            className={`text-xs text-ink/90 leading-relaxed font-serif ${
              isExpanded ? "whitespace-pre-wrap" : "line-clamp-3"
            }`}
          >
            {node.content}
          </div>

          {node.content.length > 120 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[11px] text-cinnabar hover:underline mt-1 block select-none"
            >
              {isExpanded ? t("knowledge.collapseAll") : t("knowledge.expandAll")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

