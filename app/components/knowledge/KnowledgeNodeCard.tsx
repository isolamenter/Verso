import { useState } from "react";
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const getAuthorityBadge = (auth: string) => {
    switch (auth) {
      case "user_authored_locked":
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-800 font-medium">作者权威定义</span>;
      case "user_curated_editable":
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-700 font-medium">已人工核定</span>;
      case "agent_derived":
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-700 font-medium">AI 提取推荐</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-ink-muted/10 text-ink-muted">{auth}</span>;
    }
  };

  const getKindLabel = (kind: string) => {
    const map: Record<string, string> = {
      character: "人物",
      world_rule: "世界法则",
      location: "地点",
      theme: "主题",
      timeline: "时间线",
      motif: "母题",
      custom: "其他",
    };
    return map[kind] || kind;
  };

  const handleArchive = async () => {
    const confirm = window.confirm(`确定要归档设定条目 "${node.title}" 吗？`);
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
            title="编辑"
          >
            ✏️
          </button>
          <button
            onClick={handleArchive}
            disabled={isArchiving}
            className="p-1 rounded text-ink-muted hover:text-cinnabar text-xs transition-colors"
            title="归档"
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
              {isExpanded ? "收起全文" : "展开全文"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

