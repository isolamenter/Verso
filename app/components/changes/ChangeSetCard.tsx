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
        return <span className="px-2 py-0.5 rounded text-[11px] bg-amber-500/15 text-amber-700 font-medium">{t("changes.statusProposed")}</span>;
      case "approved":
        return <span className="px-2 py-0.5 rounded text-[11px] bg-blue-500/15 text-blue-700 font-medium">{t("changes.statusApproved")}</span>;
      case "partially_approved":
        return <span className="px-2 py-0.5 rounded text-[11px] bg-purple-500/15 text-purple-700 font-medium">{t("changes.statusPartiallyApplied")}</span>;
      case "applied":
        return <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/15 text-emerald-700 font-medium">{t("changes.statusApplied")}</span>;
      case "needs_rebase":
        return <span className="px-2 py-0.5 rounded text-[11px] bg-cinnabar/15 text-cinnabar font-medium">{t("changes.statusNeedsRebase")}</span>;
      case "rejected":
        return <span className="px-2 py-0.5 rounded text-[11px] bg-ink-muted/15 text-ink-muted font-medium">{t("changes.statusRejected")}</span>;
      case "failed":
        return <span className="px-2 py-0.5 rounded text-[11px] bg-cinnabar/20 text-cinnabar font-bold">{t("changes.statusFailed")}</span>;
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
          <span className="font-semibold text-ink block mb-0.5">{t("changes.tradeoffAnalysis")}</span>
          <p className="italic leading-relaxed">{changeSet.rationale}</p>
        </div>
      )}

      {/* Operation Items */}
      <div className="space-y-3">
        <div className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">
          {t("changes.operationsCount", { count: operations.length })}
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
                  #{idx + 1}{" "}
                  {op.operationType === "split_scene"
                    ? t("changes.targetSplit")
                    : op.targetType === "scene"
                    ? t("changes.targetScene")
                    : t("changes.targetKnowledge")}
                </span>
                {op.status === "conflict" && (
                  <span className="text-[10px] text-cinnabar font-semibold">{t("changes.hasConflict")}</span>
                )}
              </div>
            </div>

            {/* Content: Scene Split Preview vs Standard Diff */}
            {op.operationType === "split_scene" ? (
              <div className="space-y-2 text-xs font-serif">
                <div className="flex items-center justify-between bg-paper-light px-3 py-1.5 rounded border border-ink-muted/15">
                  <span className="font-medium text-ink">
                    {t("changes.splitSceneCount", {
                      count:
                        (op.structuredPayload as any)?.sceneCount ||
                        (op.structuredPayload as any)?.splits?.length ||
                        0,
                    })}
                  </span>
                  <span className="text-[11px] text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded font-mono font-medium">
                    {t("changes.splitCoverage", {
                      pct: Math.round(((op.structuredPayload as any)?.coverage ?? 1) * 100),
                    })}
                  </span>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {Array.isArray((op.structuredPayload as any)?.splits) &&
                    (op.structuredPayload as any).splits.map((sp: any, spIdx: number) => (
                      <div key={spIdx} className="p-2 bg-paper-light/70 border border-ink-muted/10 rounded space-y-1">
                        <div className="flex items-center justify-between text-ink">
                          <span className="font-semibold text-xs">
                            {spIdx + 1}. {sp.title}
                          </span>
                          {sp.characterCount !== undefined && (
                            <span className="text-[10px] text-ink-muted font-mono">
                              约 {sp.characterCount} 字
                            </span>
                          )}
                        </div>
                        {sp.summary && (
                          <p className="text-[11px] text-ink-muted leading-relaxed">
                            {sp.summary}
                          </p>
                        )}
                        {sp.startQuote && (
                          <div className="text-[10px] text-ink-muted/70 italic truncate">
                            {t("changes.startQuoteAnchor")}：「{sp.startQuote}」
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <DiffViewer
                originalText={op.quote}
                replacementText={op.replacementContent}
                prefixAnchor={op.prefixAnchor}
                suffixAnchor={op.suffixAnchor}
              />
            )}

            {/* Conflict reason if any */}
            {op.status === "conflict" && op.validationResult && (
              <div className="text-[11px] text-cinnabar italic bg-cinnabar/5 p-1.5 rounded">
                {t("changes.conflictReason", { reason: (op.validationResult as Record<string, any>).error || t("changes.conflictDefault") })}
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
                {t("changes.rebase")}
              </button>
            )}
            <button
              onClick={handleReject}
              disabled={isProcessing}
              className="px-3 py-1.5 border border-ink-muted/20 rounded text-xs text-ink-muted hover:text-ink transition-colors"
            >
              {t("changes.rejectProposal")}
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
              ? t("changes.applyAll")
              : t("changes.applySelected", { count: selectedOpIds.length })}
          </button>
        </div>
      )}
    </div>
  );
}

