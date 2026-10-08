import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Check, RefreshCw } from "lucide-react";
import { useI18n } from "../../i18n";
import { api } from "../../utils/api";
import { DiffViewer } from "./DiffViewer";
import type {
  ChangeSet,
  ChangeOperation,
  ChangeReview,
} from "../../../shared/schemas/changeset";
import type { Scene } from "../../../shared/schemas/project";

interface RevisionItem {
  changeSet: ChangeSet;
  operations: ChangeOperation[];
  reviews: ChangeReview[];
}
export function RevisionDesk({
  projectId,
  scenes,
  refreshKey,
  runId,
  blocked,
  onLocate,
  onApplied,
  onReadback,
}: {
  projectId: string;
  scenes: Scene[];
  refreshKey: number;
  runId?: string;
  blocked: boolean;
  onLocate: (sceneId: string, revisionId?: string, quote?: string) => void;
  onApplied: () => void;
  onReadback: () => void;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<RevisionItem[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [showAll, setShowAll] = useState(false),
    [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]),
    [feedback, setFeedback] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    try {
      const data = await api<{ items: RevisionItem[] }>(
        `/api/projects/${projectId}/changesets`,
      );
      setItems(data.items.filter((i) => !i.changeSet.metadata.isDerived));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  useEffect(() => {
    void load();
  }, [load, refreshKey]);
  const mutate = async (values: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/projects/${projectId}/changesets`, values);
      await load();
      onApplied();
      setSelected([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const displayed = items.filter(
    (i) =>
      (showAll ||
        (!i.changeSet.metadata.finished &&
          i.changeSet.status !== "rejected")) &&
      (!runId || showAll || i.changeSet.runId === runId),
  );
  return (
    <section className="studio-revision-desk">
      <div className="studio-pane-heading">
        <div className="studio-actions">
          <button
            className={`studio-button ${!showAll ? "is-active" : ""}`}
            onClick={() => setShowAll(false)}
          >
            {t("studio.thisRound")}
          </button>
          <button
            className={`studio-button ${showAll ? "is-active" : ""}`}
            onClick={() => setShowAll(true)}
          >
            {t("studio.decisionsHistory")}
          </button>
        </div>
        <button
          className="studio-icon-button"
          aria-label={t("common.refresh")}
          onClick={() => void load()}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {error && (
        <p role="alert" className="studio-alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="studio-help">{t("studio.loading")}</p>
      ) : displayed.length === 0 ? (
        <div className="studio-empty">
          <h3>{t("studio.noProposals")}</h3>
          <p>{t("studio.noProposalsHelp")}</p>
        </div>
      ) : (
        displayed.map(({ changeSet: set, operations, reviews }) => (
          <article className="studio-round" key={set.id}>
            <header>
              <h3>{set.title}</h3>
              <p>{set.objective}</p>
              {set.rationale && (
                <p className="studio-round-rationale">{set.rationale}</p>
              )}
            </header>
            {operations.map((op) => {
              const decided =
                op.status === "applied" || op.status === "rejected";
              const stale =
                op.targetType === "scene" &&
                op.baseRevisionId &&
                scenes.find((s) => s.id === op.targetId)?.currentRevisionId !==
                  op.baseRevisionId &&
                !decided;
              const decision = reviews
                .filter((r) => r.operationId === op.id)
                .at(-1);
              return (
                <section
                  className={`studio-proposal ${decided ? "studio-proposal-decided" : ""}`}
                  key={op.id}
                >
                  <div className="studio-proposal-heading">
                    {!decided && (
                      <input
                        type="checkbox"
                        aria-label={t("studio.selectProposal")}
                        checked={selected.includes(op.id)}
                        disabled={blocked || busy || Boolean(stale)}
                        onChange={() => {
                          const group = op.metadata.dependencyGroup;
                          const ids = group
                            ? operations
                                .filter(
                                  (o) =>
                                    o.metadata.dependencyGroup === group &&
                                    !["applied", "rejected"].includes(o.status),
                                )
                                .map((o) => o.id)
                            : [op.id];
                          setSelected((current) =>
                            current.includes(op.id)
                              ? current.filter((id) => !ids.includes(id))
                              : [...new Set([...current, ...ids])],
                          );
                        }}
                      />
                    )}
                    {op.targetType === "scene" ? (
                      <button
                        className="studio-source-link"
                        onClick={() =>
                          onLocate(
                            op.targetId,
                            op.baseRevisionId || undefined,
                            op.quote || undefined,
                          )
                        }
                      >
                        {scenes.find((s) => s.id === op.targetId)?.title ||
                          t("studio.knowledge")}
                        <ArrowUpRight size={14} />
                      </button>
                    ) : (
                      <span className="studio-source-link">
                        {String(
                          op.metadata.targetTitle ||
                            op.structuredPayload.title ||
                            t("studio.knowledge"),
                        )}
                      </span>
                    )}
                    {decided && (
                      <span className="studio-status">
                        {t(
                          op.status === "applied"
                            ? "studio.adopted"
                            : "studio.keptOriginal",
                        )}
                      </span>
                    )}
                  </div>
                  {op.operationType === "split_scene" ? (
                    <div className="studio-split-preview">
                      <p>{t("studio.splitBoundary")}</p>
                      {(
                        op.structuredPayload.splits as
                          Array<{ title: string; summary?: string }> | undefined
                      )?.map((split, i) => (
                        <p key={i}>
                          <strong>
                            {i + 1}. {split.title}
                          </strong>
                          <br />
                          {split.summary}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <DiffViewer
                      originalText={op.quote}
                      replacementText={op.replacementContent}
                      prefixAnchor={op.prefixAnchor}
                      suffixAnchor={op.suffixAnchor}
                    />
                  )}
                  <p className="studio-help">{op.literaryTradeoff}</p>
                  {Boolean(op.metadata.dependencyGroup) && (
                    <p className="studio-note">
                      {t("studio.dependencyGroup")}:{" "}
                      {String(op.metadata.dependencyGroup)}
                    </p>
                  )}
                  {stale && (
                    <p role="alert" className="studio-alert">
                      {t("studio.proposalStale")}
                    </p>
                  )}
                  {op.status === "conflict" && (
                    <p className="studio-alert">
                      {t("studio.proposalConflict")}
                    </p>
                  )}
                  {decision && (
                    <div className="studio-decision">
                      <strong>
                        {t(
                          decision.decision === "deferred"
                            ? "studio.deferred"
                            : decision.decision === "revised"
                              ? "studio.otherWording"
                              : decision.decision === "approved"
                                ? "studio.adopted"
                                : "studio.keptOriginal",
                        )}
                      </strong>
                      <p>{decision.userFeedback}</p>
                    </div>
                  )}
                  {!decided && (
                    <>
                      <input
                        className="studio-decision-note"
                        aria-label={t("studio.decisionReason")}
                        placeholder={t("studio.decisionReason")}
                        value={feedback[op.id] || ""}
                        onChange={(e) =>
                          setFeedback({ ...feedback, [op.id]: e.target.value })
                        }
                      />
                      <div className="studio-proposal-actions">
                        {(
                          [
                            ["retained", "studio.keepOriginal"],
                            ["revised", "studio.otherWording"],
                            ["deferred", "studio.defer"],
                          ] as const
                        ).map(([decision, key]) => (
                          <button
                            key={decision}
                            disabled={blocked || busy}
                            onClick={() =>
                              void mutate({
                                intent: "review",
                                changeSetId: set.id,
                                operationId: op.id,
                                decision,
                                feedback: feedback[op.id] || "",
                              })
                            }
                          >
                            {t(key)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              );
            })}
            <footer className="studio-round-footer">
              <button
                className="studio-button studio-primary"
                disabled={
                  blocked ||
                  busy ||
                  !operations.some((op) => selected.includes(op.id))
                }
                onClick={() =>
                  void mutate({
                    intent: "apply_partial",
                    changeSetId: set.id,
                    operationIds: operations
                      .filter((op) => selected.includes(op.id))
                      .map((op) => op.id),
                    feedback: operations
                      .filter((op) => selected.includes(op.id))
                      .map((op) => feedback[op.id])
                      .filter(Boolean)
                      .join("；"),
                  })
                }
              >
                <Check size={15} />
                {t("studio.adoptSelected")}
              </button>
              <button className="studio-button" onClick={onReadback}>
                {t("studio.readback")}
              </button>
              {!set.metadata.finished && (
                <button
                  className="studio-button"
                  disabled={blocked || busy}
                  onClick={() =>
                    void mutate({ intent: "finish", changeSetId: set.id })
                  }
                >
                  {t("studio.finishRound")}
                </button>
              )}
            </footer>
          </article>
        ))
      )}
    </section>
  );
}
