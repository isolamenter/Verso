import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { useI18n } from "../../i18n";
import { parseUploadedFile, type ParsedFileResult } from "../../utils/fileImporter";
import { calculateEditorStats } from "../../../shared/manuscript";

export interface ImportOriginalModalProps {
  isOpen: boolean;
  onClose: () => void;
  droppedFile?: File | null;
}

export function ImportOriginalModal({
  isOpen,
  onClose,
  droppedFile,
}: ImportOriginalModalProps) {
  const { t } = useI18n();
  const fetcher = useFetcher();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeMode, setActiveMode] = useState<"file" | "paste">("file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [sceneTitle, setSceneTitle] = useState("第一场");

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
      setTitle((prev) => prev.trim() || parsed.title);
      setContent(parsed.content);
      setWordCount(parsed.wordCount);
      setSceneTitle("第一场");
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
      if (droppedFile) {
        setActiveMode("file");
        handleFileProcess(droppedFile);
      } else {
        setTitle("");
        setDescription("");
        setContent("");
        setSelectedFileName(null);
        setParseError(null);
        setWordCount(0);
      }
    }
  }, [isOpen, droppedFile]);

  const handlePasteChange = (text: string) => {
    setContent(text);
    const stats = calculateEditorStats(text);
    setWordCount(stats.chineseCharacters + stats.totalWords);
    if (!title.trim() && text.trim()) {
      // Suggest first line as title if short
      const firstLine = text.trim().split("\n")[0].slice(0, 30);
      if (firstLine && firstLine.length < 25) {
        setTitle(firstLine);
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    fetcher.submit(
      {
        intent: "create_project",
        title: title.trim(),
        description: description.trim() || `导入自文稿《${selectedFileName || title.trim()}》`,
        content: content.trim(),
        sceneTitle: sceneTitle.trim() || "第一场",
      },
      { method: "post" }
    );

    onClose();
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
              {t("workspace.importModalTitle")}
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
                  className="border-2 border-dashed border-ink-muted/25 hover:border-cinnabar/60 rounded-lg p-6 text-center cursor-pointer transition-colors bg-paper-light/50"
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

            {/* Project metadata */}
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {t("workspace.newProjectTitle")} *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("workspace.projectTitlePlaceholder")}
                className="w-full px-3 py-2 text-sm bg-paper-light border border-ink-muted/25 rounded focus:outline-none focus:border-ink"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {t("workspace.newProjectDescription")}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("workspace.projectDescPlaceholder")}
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
              disabled={!title.trim() || isParsing || fetcher.state !== "idle"}
              className="px-5 py-1.5 text-xs bg-ink text-paper hover:bg-ink/90 font-serif font-medium rounded shadow-sm disabled:opacity-50 transition-opacity"
            >
              {t("workspace.importAndCreate")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

