import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { useI18n } from "../../i18n";
import { parseUploadedFile, type ParsedFileResult } from "../../utils/fileImporter";
import { calculateEditorStats } from "../../../shared/manuscript";
import type { Manuscript, Scene } from "../../../shared/schemas/project";

export interface ImportSceneModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  manuscripts: Manuscript[];
  activeScene?: Scene | null;
  scenesCount: number;
  onImportComplete?: () => void;
}

export function ImportSceneModal({
  isOpen,
  onClose,
  projectId,
  manuscripts,
  activeScene,
  scenesCount,
  onImportComplete,
}: ImportSceneModalProps) {
  const { t } = useI18n();
  const fetcher = useFetcher();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeMode, setActiveMode] = useState<"file" | "paste">("file");
  const [importTarget, setImportTarget] = useState<"replace_current" | "new_scene">(
    activeScene && activeScene.content.trim() === "" ? "replace_current" : "new_scene"
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);

  const handleFileProcess = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setSelectedFileName(file.name);

    try {
      const parsed: ParsedFileResult = await parseUploadedFile(file);
      setTitle(parsed.title);
      setContent(parsed.content);
      setWordCount(parsed.wordCount);
    } catch (err: any) {
      setParseError(err?.message || t("workbench.importError"));
      setContent("");
      setWordCount(0);
    } finally {
      setIsParsing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setContent("");
      setSelectedFileName(null);
      setParseError(null);
      setWordCount(0);
      setImportTarget(activeScene && activeScene.content.trim() === "" ? "replace_current" : "new_scene");
    }
  }, [isOpen, activeScene]);

  const handlePasteChange = (text: string) => {
    setContent(text);
    const stats = calculateEditorStats(text);
    setWordCount(stats.chineseCharacters + stats.totalWords);
    if (!title.trim() && text.trim()) {
      const firstLine = text.trim().split("\n")[0].slice(0, 30);
      if (firstLine && firstLine.length < 25) {
        setTitle(firstLine);
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (importTarget === "replace_current" && activeScene) {
      if (activeScene.content.trim() !== "") {
        const confirm = window.confirm(t("workbench.replaceSceneConfirm"));
        if (!confirm) return;
      }

      fetcher.submit(
        {
          intent: "save_scene_revision",
          projectId,
          sceneId: activeScene.id,
          content: content.trim(),
          title: title.trim() || activeScene.title,
          description: `导入原文: ${title.trim() || selectedFileName || "文稿"}`,
        },
        { method: "post" }
      );
    } else {
      const targetManuscriptId = activeScene?.manuscriptId || manuscripts[0]?.id;
      if (!targetManuscriptId) return;

      fetcher.submit(
        {
          intent: "create_scene",
          projectId,
          manuscriptId: targetManuscriptId,
          title: title.trim() || `第 ${scenesCount + 1} 场`,
          content: content.trim(),
          order: String(scenesCount + 1),
        },
        { method: "post" }
      );
    }

    onClose();
    if (onImportComplete) {
      onImportComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4">
      <div
        className="bg-paper border border-ink-muted/30 rounded-lg shadow-xl w-full max-w-xl p-6 font-serif max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 border-b border-ink-muted/15 pb-3 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-ink">
              {t("workbench.importSceneModalTitle")}
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              {t("workspace.importOriginalDesc")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink text-sm p-1 rounded transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab switch: File upload vs Direct paste */}
        <div className="flex border-b border-ink-muted/20 mb-4 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveMode("file")}
            className={`pb-2 px-3 border-b-2 font-medium transition-colors ${
              activeMode === "file"
                ? "border-cinnabar text-cinnabar"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {t("workspace.dragFileHint")}
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("paste")}
            className={`pb-2 px-3 border-b-2 font-medium transition-colors ${
              activeMode === "paste"
                ? "border-cinnabar text-cinnabar"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {t("workspace.pasteOrType")}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden space-y-4">
          <div className="overflow-y-auto pr-1 space-y-4 flex-1">
            {/* Import Target Choice */}
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">
                {t("workbench.importTargetLabel")}
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {activeScene && (
                  <button
                    type="button"
                    onClick={() => setImportTarget("replace_current")}
                    className={`p-2.5 rounded border text-left transition-colors ${
                      importTarget === "replace_current"
                        ? "border-cinnabar bg-cinnabar/5 text-ink font-medium"
                        : "border-ink-muted/25 text-ink-muted hover:border-ink-muted/40"
                    }`}
                  >
                    <div className="font-medium text-ink">
                      {t("workbench.importToCurrentScene")}
                    </div>
                    <div className="text-[11px] text-ink-muted mt-0.5 truncate">
                      {activeScene.title}
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setImportTarget("new_scene")}
                  className={`p-2.5 rounded border text-left transition-colors ${
                    importTarget === "new_scene"
                      ? "border-cinnabar bg-cinnabar/5 text-ink font-medium"
                      : "border-ink-muted/25 text-ink-muted hover:border-ink-muted/40"
                  }`}
                >
                  <div className="font-medium text-ink">
                    {t("workbench.importAsNewScene")}
                  </div>
                  <div className="text-[11px] text-ink-muted mt-0.5">
                    第 {scenesCount + 1} 场
                  </div>
                </button>
              </div>
            </div>

            {activeMode === "file" ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.txt,.md,.markdown"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileProcess(file);
                    if (e.target) e.target.value = "";
                  }}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileProcess(file);
                  }}
                  className="border-2 border-dashed border-ink-muted/25 hover:border-cinnabar/60 rounded-lg p-5 text-center cursor-pointer transition-colors bg-paper-light/50"
                >
                  <div className="text-2xl mb-1 text-ink-muted">📄</div>
                  <div className="text-xs font-medium text-ink mb-1">
                    {selectedFileName || t("workspace.dragFileHint")}
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    {t("workspace.supportedFormats")}
                  </div>
                </div>

                {isParsing && (
                  <div className="text-xs text-ink-muted mt-2 text-center animate-pulse">
                    {t("workspace.parsingFile")}
                  </div>
                )}

                {parseError && (
                  <div className="mt-2 p-2.5 rounded bg-cinnabar/10 border border-cinnabar/20 text-cinnabar text-xs">
                    {parseError}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  {t("workspace.pasteOrType")}
                </label>
                <textarea
                  rows={6}
                  value={content}
                  onChange={(e) => handlePasteChange(e.target.value)}
                  placeholder={t("workspace.pastePlaceholder")}
                  className="w-full px-3 py-2 text-xs bg-paper-light border border-ink-muted/25 rounded focus:outline-none focus:border-ink font-serif leading-relaxed"
                />
              </div>
            )}

            {/* Word Count Indicator */}
            {wordCount > 0 && (
              <div className="text-xs text-ink-muted bg-paper-light px-3 py-1.5 rounded border border-ink-muted/15 flex items-center justify-between">
                <span>{t("workspace.parsedStats", { words: wordCount })}</span>
                <span className="text-[10px] text-ink-muted/70 font-mono">
                  {content.length} 字符
                </span>
              </div>
            )}

            {/* Scene title */}
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {t("workbench.newSceneTitleLabel")}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("workbench.newSceneTitlePlaceholder")}
                className="w-full px-3 py-2 text-xs bg-paper-light border border-ink-muted/25 rounded focus:outline-none focus:border-ink"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-ink-muted/15 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-ink-muted hover:text-ink font-serif rounded border border-ink-muted/20"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={!content.trim() || isParsing || fetcher.state !== "idle"}
              className="px-5 py-1.5 text-xs bg-ink text-paper hover:bg-ink/90 font-serif font-medium rounded shadow-sm disabled:opacity-50 transition-opacity"
            >
              {t("workbench.confirmImport")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

