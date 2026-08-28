import { useState } from "react";
import { useI18n } from "../../../i18n";
import { MediaSegmentViewer } from "./MediaSegmentViewer";
import type {
  KnowledgeAsset,
  KnowledgeArtifact,
  MediaSegment,
} from "../../../../shared/schemas/knowledge";

export interface MediaAssetDetail {
  asset: KnowledgeAsset;
  artifacts: KnowledgeArtifact[];
  segments: MediaSegment[];
}

export interface MediaAssetListProps {
  assets: MediaAssetDetail[];
  onRetry: (assetId: string) => Promise<void>;
  onUploadClick: () => void;
}

export function MediaAssetList({
  assets,
  onRetry,
  onUploadClick,
}: MediaAssetListProps) {
  const { t } = useI18n();
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "pending":
        return <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-700">{t("knowledge.statusQueued")}</span>;
      case "processing":
        return <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-700 animate-pulse">{t("knowledge.statusExtracting")}</span>;
      case "completed":
        return <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-700 font-medium">{t("knowledge.statusReady")}</span>;
      case "failed":
        return <span className="px-2 py-0.5 rounded text-[10px] bg-cinnabar/15 text-cinnabar font-semibold">{t("knowledge.statusFailed")}</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] bg-ink-muted/10 text-ink-muted">{t("knowledge.statusImported")}</span>;
    }
  };

  const getKindIcon = (kind?: string) => {
    switch (kind) {
      case "image":
        return "🖼";
      case "audio":
        return "🎙";
      case "video":
        return "🎬";
      case "document":
        return "📄";
      default:
        return "📁";
    }
  };

  const handleRetry = async (assetId: string) => {
    setRetryingId(assetId);
    try {
      await onRetry(assetId);
    } finally {
      setRetryingId(null);
    }
  };

  if (assets.length === 0) {
    return (
      <div className="text-center py-10 text-ink-muted space-y-3 font-serif">
        <div className="text-3xl">📁</div>
        <p className="text-xs">{t("knowledge.emptyMedia")}</p>
        <button
          onClick={onUploadClick}
          className="px-3 py-1.5 bg-ink text-paper rounded text-xs font-medium hover:bg-ink/90 shadow-xs transition-colors"
        >
          {t("knowledge.uploadMediaFile")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-serif">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-muted font-medium">
          {t("knowledge.mountedMedia", { count: assets.length })}
        </span>
        <button
          onClick={onUploadClick}
          className="px-2.5 py-1 bg-ink text-paper rounded text-xs font-medium hover:bg-ink/90 shadow-xs transition-colors"
        >
          {t("knowledge.uploadMediaFile")}
        </button>
      </div>

      <div className="space-y-3">
        {assets.map(({ asset, segments }) => {
          const isExpanded = expandedAssetId === asset.id;
          const meta = (asset.metadata || {}) as Record<string, any>;
          const kind = (meta.kind as string) || "document";
          const processingStatus = (meta.processingStatus as string) || "pending";

          return (
            <div
              key={asset.id}
              className="bg-paper border border-ink-muted/20 rounded-lg p-4 shadow-2xs space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start space-x-2.5">
                  <span className="text-lg select-none">{getKindIcon(kind)}</span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-semibold text-ink">{asset.originalFileName}</h4>
                      {getStatusBadge(processingStatus)}
                    </div>
                    <div className="text-[10px] text-ink-muted flex items-center space-x-2 mt-0.5 font-mono">
                      <span>{(asset.byteSize / 1024).toFixed(1)} KB</span>
                      <span>•</span>
                      <span>{asset.mimeType}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  {processingStatus === "failed" && (
                    <button
                      onClick={() => handleRetry(asset.id)}
                      disabled={retryingId === asset.id}
                      className="px-2 py-1 bg-paper-light border border-ink-muted/20 rounded text-[11px] text-ink hover:text-cinnabar transition-colors"
                    >
                      {retryingId === asset.id ? t("knowledge.retryInProgress") : t("knowledge.retryButton")}
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedAssetId(isExpanded ? null : asset.id)}
                    className="px-2 py-1 border border-ink-muted/15 rounded text-[11px] text-ink-muted hover:text-ink transition-colors"
                  >
                    {isExpanded ? t("knowledge.collapseSegments") : t("knowledge.viewSegments", { count: segments.length })}
                  </button>
                </div>
              </div>

              {/* Segments disclosure */}
              {isExpanded && <MediaSegmentViewer segments={segments} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

