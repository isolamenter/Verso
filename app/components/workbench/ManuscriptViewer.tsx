import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Typography from "@tiptap/extension-typography";
import Highlight from "@tiptap/extension-highlight";
import { useI18n } from "../../i18n";
import { isTipTapDocJson, plainTextToTipTapDoc, extractPlainText } from "../../../shared/manuscript";

export interface ManuscriptViewerProps {
  content: string;
  sceneTitle: string;
  onAttachQuoteToAgent: (quote: string) => void;
  onEnterManualEdit: () => void;
  onOpenImport?: () => void;
}

export function ManuscriptViewer({
  content,
  sceneTitle,
  onAttachQuoteToAgent,
  onEnterManualEdit,
  onOpenImport,
}: ManuscriptViewerProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedText, setSelectedText] = useState("");
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const initialContent = isTipTapDocJson(content)
    ? JSON.parse(content)
    : plainTextToTipTapDoc(content || "");

  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Typography,
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[60vh] prose prose-stone max-w-none text-ink font-serif text-base leading-relaxed select-text",
      },
    },
  });

  // Keep content in sync when props change
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      const parsed = isTipTapDocJson(content)
        ? JSON.parse(content)
        : plainTextToTipTapDoc(content || "");
      editor.commands.setContent(parsed);
    }
  }, [content, editor]);

  // Handle text selection in read-only mode to show quick action floating button
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setSelectedText("");
        setMenuPosition(null);
        return;
      }

      const text = selection.toString().trim();
      if (text.length > 0 && containerRef.current && containerRef.current.contains(selection.anchorNode)) {
        setSelectedText(text);
        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();

          setMenuPosition({
            top: rect.top - containerRect.top - 42,
            left: Math.max(10, rect.left - containerRect.left + rect.width / 2 - 100),
          });
        } catch {
          setMenuPosition(null);
        }
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  const handleAttach = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedText) {
      onAttachQuoteToAgent(selectedText);
      setSelectedText("");
      setMenuPosition(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const plainText = extractPlainText(content);
  const isEmpty = !plainText.trim();

  return (
    <div ref={containerRef} className="relative flex-1 p-8 max-w-3xl mx-auto w-full">
      {/* Scene Title Heading */}
      <div className="mb-6 pb-3 border-b border-ink-muted/15 flex items-baseline justify-between">
        <h2 className="font-serif text-xl font-medium text-ink tracking-tight">
          {sceneTitle || t("workbench.untitledScene")}
        </h2>

        <button
          onClick={onEnterManualEdit}
          className="text-xs font-serif text-ink-muted hover:text-ink px-2.5 py-1 rounded border border-ink-muted/20 hover:border-ink-muted/40 transition-colors"
        >
          ✎ {t("workbench.manualEditMode")}
        </button>
      </div>

      {isEmpty ? (
        <div className="text-center py-16 text-ink-muted font-serif max-w-sm mx-auto">
          <div className="text-3xl mb-2 text-ink-muted/60">🖋️</div>
          <p className="text-sm mb-1 text-ink">{t("workbench.emptyScene")}</p>
          <p className="text-xs text-ink-muted/80 mb-5">{t("workbench.emptySceneImportPrompt")}</p>
          <div className="flex items-center justify-center space-x-3">
            {onOpenImport && (
              <button
                onClick={onOpenImport}
                className="px-4 py-1.5 rounded border border-ink-muted/30 hover:border-cinnabar text-ink text-xs transition-colors flex items-center space-x-1.5"
              >
                <span>📥</span>
                <span>{t("workbench.importOriginal")}</span>
              </button>
            )}
            <button
              onClick={onEnterManualEdit}
              className="px-4 py-1.5 rounded bg-ink text-paper text-xs hover:bg-ink/90 transition-colors"
            >
              {t("workbench.manualEditMode")}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <EditorContent editor={editor} />

          {/* Floating Quote Action Bar on Selection */}
          {menuPosition && selectedText && (
            <div
              style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
              className="absolute z-30 flex items-center space-x-1.5 bg-ink text-paper rounded shadow-lg px-2.5 py-1.5 text-xs font-serif animate-fade-in"
            >
              <button
                onClick={handleAttach}
                className="hover:text-cinnabar transition-colors flex items-center space-x-1"
                title={t("workbench.attachSelectionToAgent")}
              >
                <span>✦</span>
                <span>{t("workbench.attachToChat")}</span>
              </button>
              <span className="text-paper/40">|</span>
              <button
                onClick={onEnterManualEdit}
                className="hover:text-paper/80 transition-colors"
                title={t("workbench.editFromHere")}
              >
                {t("workbench.editManually")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

