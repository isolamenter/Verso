import { useState } from "react";
import { useI18n } from "../../i18n";
import { DiffViewer } from "./DiffViewer";
import type { ChangeSet, ChangeOperation } from "../../../shared/schemas/changeset";

export interface ChangeSetCardProps {
  changeSet: ChangeSet;
  operations: ChangeOperation[];
  onApplyAll: (changeSetId: string) => Promise<void>;
  onApplySelected: (changeSetId: string, operationIds: string[]) => Promise<void>;
  onReject: (changeSetId: string) => Promise<void>;
  onRebase: (changeSetId: string) => Promise<void>;
}

export function ChangeSetCard({
  changeSet,
  operations,
  onApplyAll,
  onApplySelected,
  onReject,
  onRebase,
}: ChangeSetCardProps) {
  const { t } = useI18n();
  const [selectedOpIds, setSelectedOpIds] = useState<string[]>(
    operations.map((o) => o.id)
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleOp = (id: string) => {
    if (selectedOpIds.includes(id)) {
      setSelectedOpIds(selectedOpIds.filter((x) => x !== id));
    } else {
      setSelectedOpIds([...selectedOpIds, id]);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "proposed":
        return <span className="px-2 py-0.5 rounded text-[11px] bg-amber-500/15 text-amber-700 font-medium">待评审</span>;
      case "approved":
        return <span className="px-2 py-0.5 rounded text-[11px] bg-blue-500/15 text-blue-700 font-medium">已批准</span>;
      case "partially_approved":
        return <span className="px-2 py-0.5 rounded text-[11px] bg-purple-500/15 text-purple-700 font-medium">部分采纳</span>;
      case "applied":
        return <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/15 text-emerald-700 font-medium">已采纳</span>;
      case "needs_rebase":
        return <span className="px-2 py-0.5 rounded text-[11px] bg-cinnabar/15 text-cinnabar font-medium">需要校准 (冲突/过期)</span>;
      case "rejected":
        return <span className="px-2 py-0.5 rounded text-[11px] bg-ink-muted/15 text-ink-muted font-medium">已放弃</span>;
      case "failed":
        return <span className="px-2 py-0.5 rounded text-[11px] bg-cinnabar/20 text-cinnabar font-bold">采纳失败</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] bg-ink-muted/10 text-ink-muted">{status}</span>;
    }
  };

  const handleApply = async () => {
    setIsProcessing(true);
    try {
      if (selectedOpIds.length === operations.length) {
        await onApplyAll(changeSet.id);
      } else if (selectedOpIds.length > 0) {
        await onApplySelected(changeSet.id, selectedOpIds);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject(changeSet.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRebase = async () => {
    setIsProcessing(true);
    try {
      await onRebase(changeSet.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const isOpen = changeSet.status === "proposed" || changeSet.status === "needs_rebase";

  return (
    <div className="bg-paper border border-ink-muted/20 rounded-lg p-5 shadow-2xs font-serif space-y-4">
      {/* Docket Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="text-sm font-semibold text-ink">{changeSet.title}</h3>
            {getStatusBadge(changeSet.status)}
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">{changeSet.objective}</p>
        </div>
      </div>

      {/* Literary Tradeoff / Rationale */}
      {changeSet.rationale && (
        <div className="p-3 bg-paper-light border-l-2 border-l-cinnabar text-xs text-ink-muted rounded-r">
          <span className="font-semibold text-ink block mb-0.5">💡 推敲得失分析:</span>
          <p className="italic leading-relaxed">{changeSet.rationale}</p>
        </div>
      )}

      {/* Operation Items */}
      <div className="space-y-3">
        <div className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">
          包含修改项 ({operations.length})
        </div>

        {operations.map((op, idx) => (
          <div key={op.id} className="border border-ink-muted/15 rounded-md p-3 bg-paper/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs">
                {isOpen && (
                  <input
                    type="checkbox"
                    checked={selectedOpIds.includes(op.id)}
                    onChange={() => toggleOp(op.id)}
                    className="rounded border-ink-muted/30 text-ink focus:ring-ink"
                  />
                )}
                <span className="font-medium text-ink">
                  #{idx + 1} {op.targetType === "scene" ? "场景正文" : "设定知识"}
                </span>
                {op.status === "conflict" && (
                  <span className="text-[10px] text-cinnabar font-semibold">⚠️ 存在冲突</span>
                )}
              </div>
            </div>

            {/* Diff content */}
            <DiffViewer
              originalText={op.quote}
              replacementText={op.replacementContent}
              prefixAnchor={op.prefixAnchor}
              suffixAnchor={op.suffixAnchor}
            />

            {/* Conflict reason if any */}
            {op.status === "conflict" && op.validationResult && (
              <div className="text-[11px] text-cinnabar italic bg-cinnabar/5 p-1.5 rounded">
                冲突原因: {(op.validationResult as Record<string, any>).error || "正文已有改动，锚点无法匹配"}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons for Open ChangeSet */}
      {isOpen && (
        <div className="pt-2 border-t border-ink-muted/15 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            {changeSet.status === "needs_rebase" && (
              <button
                onClick={handleRebase}
                disabled={isProcessing}
                className="px-3 py-1.5 bg-paper-light border border-ink-muted/25 rounded text-xs text-ink hover:bg-paper font-medium transition-colors"
              >
                🔄 重新校准
              </button>
            )}
            <button
              onClick={handleReject}
              disabled={isProcessing}
              className="px-3 py-1.5 border border-ink-muted/20 rounded text-xs text-ink-muted hover:text-ink transition-colors"
            >
              放弃提案
            </button>
          </div>

          <button
            onClick={handleApply}
            disabled={isProcessing || selectedOpIds.length === 0 || changeSet.status === "needs_rebase"}
            className="px-4 py-1.5 bg-ink text-paper rounded text-xs font-medium hover:bg-ink/90 disabled:opacity-40 shadow-xs transition-colors"
          >
            {isProcessing
              ? t("common.saving")
              : selectedOpIds.length === operations.length
              ? "一键采纳全部"
              : `采纳所选项 (${selectedOpIds.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

