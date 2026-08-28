import { useI18n } from "../../../i18n";
import type { MediaSegment } from "../../../../shared/schemas/knowledge";

export interface MediaSegmentViewerProps {
  segments: MediaSegment[];
}

function formatMs(ms?: number | null): string {
  if (ms == null) return "--:--";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function MediaSegmentViewer({ segments }: MediaSegmentViewerProps) {
  const { t } = useI18n();

  if (segments.length === 0) {
    return (
      <div className="text-[11px] text-ink-muted italic py-2">
        {t("knowledge.noSegments")}
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-2 font-serif">
      <div className="text-[11px] font-semibold text-ink-muted">
        {t("knowledge.segmentsCount", { count: segments.length })}
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
        {segments.map((seg, idx) => {
          const hasTime = seg.startTimeMs != null || seg.endTimeMs != null;
          const hasPage = seg.pageNumber != null;

          return (
            <div
              key={seg.id || idx}
              className="bg-paper-light border border-ink-muted/15 rounded p-2 text-xs space-y-1"
            >
              <div className="flex items-center justify-between text-[10px] text-ink-muted font-mono">
                {hasTime && (
                  <span className="bg-ink-muted/10 px-1.5 py-0.5 rounded text-ink font-medium">
                    ⏱ {formatMs(seg.startTimeMs)} - {formatMs(seg.endTimeMs)}
                  </span>
                )}
                {hasPage && (
                  <span className="bg-ink-muted/10 px-1.5 py-0.5 rounded text-ink font-medium">
                    {t("knowledge.pageNumber", { page: seg.pageNumber! })}
                  </span>
                )}
                {seg.speakers && seg.speakers.length > 0 && (
                  <span className="text-ink font-serif">🗣 {seg.speakers.join(", ")}</span>
                )}
              </div>

              {seg.transcript && (
                <div className="text-ink text-[11px] leading-relaxed">
                  <span className="text-ink-muted mr-1">{t("knowledge.transcription")}</span>
                  {seg.transcript}
                </div>
              )}

              {seg.visualDescription && (
                <div className="text-ink-muted text-[10px] italic leading-relaxed">
                  <span className="not-italic mr-1">{t("knowledge.visualDescription")}</span>
                  {seg.visualDescription}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

