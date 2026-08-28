import { useState, useEffect, useCallback } from "react";
import { useI18n } from "../../i18n";
import { ChangeSetCard } from "./ChangeSetCard";
import type { ChangeSet, ChangeOperation } from "../../../shared/schemas/changeset";

export interface ChangeSetWithOps {
  changeSet: ChangeSet;
  operations: ChangeOperation[];
}

export interface ChangesTabContentProps {
  projectId: string;
  onRefreshProject?: () => void;
}

export function ChangesTabContent({
  projectId,
  onRefreshProject,
}: ChangesTabContentProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<ChangeSetWithOps[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"open" | "all">("open");

  const loadChangeSets = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/projects/${projectId}/changesets`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) {
          setItems(data.items);
        }
      }
    } catch (err) {
      console.error("Failed to load change sets:", err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadChangeSets();
  }, [loadChangeSets]);

  const handleApplyAll = async (changeSetId: string) => {
    const formData = new FormData();
    formData.append("intent", "apply_all");
    formData.append("changeSetId", changeSetId);

    const res = await fetch(`/api/projects/${projectId}/changesets`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      await loadChangeSets();
      onRefreshProject?.();
    }
  };

  const handleApplySelected = async (changeSetId: string, operationIds: string[]) => {
    const formData = new FormData();
    formData.append("intent", "apply_partial");
    formData.append("changeSetId", changeSetId);
    formData.append("operationIds", JSON.stringify(operationIds));

    const res = await fetch(`/api/projects/${projectId}/changesets`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      await loadChangeSets();
      onRefreshProject?.();
    }
  };

  const handleReject = async (changeSetId: string) => {
    const formData = new FormData();
    formData.append("intent", "reject");
    formData.append("changeSetId", changeSetId);

    const res = await fetch(`/api/projects/${projectId}/changesets`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      await loadChangeSets();
      onRefreshProject?.();
    }
  };

  const handleRebase = async (changeSetId: string) => {
    const formData = new FormData();
    formData.append("intent", "rebase");
    formData.append("changeSetId", changeSetId);

    const res = await fetch(`/api/projects/${projectId}/changesets`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      await loadChangeSets();
    }
  };

  const openItems = items.filter(
    (it) => it.changeSet.status === "proposed" || it.changeSet.status === "needs_rebase"
  );

  const displayedItems = activeFilter === "open" ? openItems : items;

  if (isLoading) {
    return (
      <div className="flex-1 p-8 text-center text-xs text-ink-muted font-serif animate-pulse">
        {t("changes.loadingChanges")}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-paper font-serif overflow-hidden">
      {/* Top Filter Bar */}
      <div className="p-4 border-b border-ink-muted/15 flex items-center justify-between shrink-0 bg-paper/95 text-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveFilter("open")}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeFilter === "open"
                ? "bg-ink text-paper font-medium"
                : "text-ink-muted hover:text-ink bg-paper-light"
            }`}
          >
            {t("changes.pendingReview", { count: openItems.length })}
          </button>
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeFilter === "all"
                ? "bg-ink text-paper font-medium"
                : "text-ink-muted hover:text-ink bg-paper-light"
            }`}
          >
            {t("changes.allHistory", { count: items.length })}
          </button>
        </div>

        <button
          onClick={loadChangeSets}
          className="text-ink-muted hover:text-ink text-xs p-1"
          title={t("common.refresh")}
        >
          🔄
        </button>
      </div>

      {/* List of ChangeSet Cards */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {displayedItems.length === 0 ? (
          <div className="text-center py-12 text-ink-muted space-y-2">
            <div className="text-2xl">📋</div>
            <p className="text-xs">
              {activeFilter === "open" ? t("changes.noPendingChanges") : t("changes.noHistory")}
            </p>
          </div>
        ) : (
          displayedItems.map(({ changeSet, operations }) => (
            <ChangeSetCard
              key={changeSet.id}
              changeSet={changeSet}
              operations={operations}
              onApplyAll={handleApplyAll}
              onApplySelected={handleApplySelected}
              onReject={handleReject}
              onRebase={handleRebase}
            />
          ))
        )}
      </div>
    </div>
  );
}

