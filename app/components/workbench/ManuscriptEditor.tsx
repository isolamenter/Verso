import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Typography from "@tiptap/extension-typography";
import Highlight from "@tiptap/extension-highlight";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import { useI18n } from "../../i18n";
import { isTipTapDocJson, plainTextToTipTapDoc, extractPlainText } from "../../../shared/manuscript";
import { parseUploadedFile } from "../../utils/fileImporter";

export interface ManuscriptEditorProps {
  initialContent: string;
  sceneTitle: string;
  baseRevisionId?: string;
  onSave: (contentJson: string, description?: string) => Promise<void>;
  onCancel: () => void;
}

export function ManuscriptEditor({
  initialContent,
  sceneTitle,
  onSave,
  onCancel,
}: ManuscriptEditorProps) {
  const { t } = useI18n();
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isComposingRef = useRef(false);
  const editorFileInputRef = useRef<HTMLInputElement>(null);

  // Search & Replace State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);

  const initialDoc = isTipTapDocJson(initialContent)
    ? JSON.parse(initialContent)
    : plainTextToTipTapDoc(initialContent || "");

  const editor = useEditor({
    editable: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Typography,
      Highlight.configure({
        multicolor: true,
      }),
      CharacterCount,
      Placeholder.configure({
        placeholder: t("workbench.editorPlaceholder"),
      }),
    ],
    content: initialDoc,
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[60vh] prose prose-stone max-w-none text-ink font-serif text-base leading-relaxed p-4",
      },
    },
    onUpdate: () => {
      if (!isComposingRef.current) {
        setIsDirty(true);
      }
    },
  });

  // Track Chinese IME composition
  useEffect(() => {
    const handleCompStart = () => {
      isComposingRef.current = true;
    };
    const handleCompEnd = () => {
      isComposingRef.current = false;
      setIsDirty(true);
    };

    const edEl = document.querySelector(".ProseMirror");
    if (edEl) {
      edEl.addEventListener("compositionstart", handleCompStart);
      edEl.addEventListener("compositionend", handleCompEnd);
    }

    return () => {
      if (edEl) {
        edEl.removeEventListener("compositionstart", handleCompStart);
        edEl.removeEventListener("compositionend", handleCompEnd);
      }
    };
  }, [editor]);

  // Window beforeunload prompt if unsaved edits
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  const handleSave = async () => {
    if (!editor || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const json = JSON.stringify(editor.getJSON());
      await onSave(json, t("workbench.manualEditSaveDescription"));
      setIsDirty(false);
    } catch (err: any) {
      setErrorMessage(err?.message || t("workbench.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      const confirmDiscard = window.confirm(t("workbench.unsavedChangesWarning"));
      if (!confirmDiscard) return;
    }
    onCancel();
  };

  const handleFileImport = async (file: File) => {
    try {
      const parsed = await parseUploadedFile(file);
      if (editor && parsed.content) {
        editor.commands.setContent(plainTextToTipTapDoc(parsed.content));
        setIsDirty(true);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || t("workbench.importError"));
    }
  };

  // Search in editor
  const handleSearch = useCallback(() => {
    if (!editor || !searchQuery) {
      setMatchCount(0);
      return;
    }
    const plain = extractPlainText(editor.getJSON());
    const count = (plain.match(new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    setMatchCount(count);
  }, [editor, searchQuery]);

  useEffect(() => {
    if (isSearchOpen && searchQuery) {
      handleSearch();
    }
  }, [searchQuery, isSearchOpen, handleSearch]);

  const handleReplaceAll = () => {
    if (!editor || !searchQuery) return;
    const plain = extractPlainText(editor.getJSON());
    const updatedPlain = plain.replaceAll(searchQuery, replaceQuery);
    editor.commands.setContent(plainTextToTipTapDoc(updatedPlain));
    setIsDirty(true);
    setMatchCount(0);
  };

  if (!editor) return null;

  return (
    <div className="flex-1 flex flex-col h-full bg-paper">
      {/* Editorial Toolbar */}
      <div className="border-b border-ink-muted/15 bg-paper/95 px-6 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 select-none text-xs font-serif sticky top-0 z-20">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive("bold") ? "bg-ink text-paper" : "text-ink-muted hover:text-ink hover:bg-paper-light"
            }`}
            title={t("workbench.bold")}
          >
            <b>B</b>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive("italic") ? "bg-ink text-paper" : "text-ink-muted hover:text-ink hover:bg-paper-light"
            }`}
            title={t("workbench.italic")}
          >
            <i>I</i>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive("strike") ? "bg-ink text-paper" : "text-ink-muted hover:text-ink hover:bg-paper-light"
            }`}
            title={t("workbench.strike")}
          >
            <s>S</s>
          </button>

          <div className="h-4 w-px bg-ink-muted/20 mx-1" />

          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2 py-1 rounded transition-colors ${
              editor.isActive("heading", { level: 2 })
                ? "bg-ink text-paper"
                : "text-ink-muted hover:text-ink hover:bg-paper-light"
            }`}
            title={t("workbench.h2")}
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-2 py-1 rounded transition-colors ${
              editor.isActive("heading", { level: 3 })
                ? "bg-ink text-paper"
                : "text-ink-muted hover:text-ink hover:bg-paper-light"
            }`}
            title={t("workbench.h3")}
          >
            H3
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`px-2 py-1 rounded transition-colors ${
              editor.isActive("blockquote")
                ? "bg-ink text-paper"
                : "text-ink-muted hover:text-ink hover:bg-paper-light"
            }`}
            title={t("workbench.blockquote")}
          >
            ”
          </button>

          <div className="h-4 w-px bg-ink-muted/20 mx-1" />

          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-2 py-1 rounded transition-colors ${
              editor.isActive("bulletList")
                ? "bg-ink text-paper"
                : "text-ink-muted hover:text-ink hover:bg-paper-light"
            }`}
            title={t("workbench.bulletList")}
          >
            {t("workbench.bulletListLabel")}
          </button>

          <div className="h-4 w-px bg-ink-muted/20 mx-1" />

          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded text-ink-muted hover:text-ink disabled:opacity-30"
            title={t("workbench.undo")}
          >
            ↺
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded text-ink-muted hover:text-ink disabled:opacity-30"
            title={t("workbench.redo")}
          >
            ↻
          </button>

          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-1.5 rounded transition-colors ${
              isSearchOpen ? "bg-cinnabar/10 text-cinnabar" : "text-ink-muted hover:text-ink"
            }`}
            title={t("workbench.findAndReplace")}
          >
            🔍
          </button>

          <input
            ref={editorFileInputRef}
            type="file"
            accept=".docx,.txt,.md,.markdown"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileImport(file);
              if (e.target) e.target.value = "";
            }}
          />

          <button
            onClick={() => editorFileInputRef.current?.click()}
            className="p-1.5 rounded text-ink-muted hover:text-ink transition-colors flex items-center space-x-1"
            title={t("workbench.loadFromFile")}
          >
            <span>📥</span>
            <span className="text-[11px] hidden sm:inline">{t("workbench.loadFromFile")}</span>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          {isDirty && (
            <span className="text-[11px] text-cinnabar italic mr-1">
              {t("workbench.hasUnsavedChanges")}
            </span>
          )}
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-3 py-1 rounded border border-ink-muted/20 text-ink-muted hover:text-ink transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="px-4 py-1 rounded bg-ink text-paper hover:bg-ink/90 font-medium transition-colors shadow-sm disabled:opacity-40"
          >
            {isSaving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </div>

      {/* Search and Replace Bar */}
      {isSearchOpen && (
        <div className="border-b border-ink-muted/15 bg-paper-light px-6 py-2 flex items-center space-x-3 text-xs font-serif">
          <input
            type="text"
            placeholder={t("workbench.findPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-2.5 py-1 bg-paper border border-ink-muted/25 rounded text-ink text-xs focus:outline-none focus:border-ink w-48"
          />
          <input
            type="text"
            placeholder={t("workbench.replacePlaceholder")}
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            className="px-2.5 py-1 bg-paper border border-ink-muted/25 rounded text-ink text-xs focus:outline-none focus:border-ink w-48"
          />
          {searchQuery && (
            <span className="text-[11px] text-ink-muted">
              {t("workbench.matchCount", { count: matchCount })}
            </span>
          )}
          <button
            onClick={handleReplaceAll}
            disabled={matchCount === 0}
            className="px-2.5 py-1 rounded border border-ink-muted/20 text-ink hover:bg-paper disabled:opacity-40"
          >
            {t("workbench.replaceAll")}
          </button>
          <button
            onClick={() => setIsSearchOpen(false)}
            className="text-ink-muted hover:text-ink p-1 ml-auto"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-cinnabar/10 border-b border-cinnabar/20 px-6 py-2 text-xs text-cinnabar font-serif flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Main TipTap Editable Canvas */}
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full">
        <h2 className="font-serif text-xl font-medium text-ink tracking-tight mb-4 pb-2 border-b border-ink-muted/10">
          {sceneTitle || t("workbench.untitledScene")}
        </h2>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

