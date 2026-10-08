import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Undo2,
  Redo2,
  Quote,
  Save,
  Search,
  Pencil,
  X,
} from "lucide-react";
import { DiffViewer } from "../changes/DiffViewer";
import { useI18n } from "../../i18n";
import {
  extractPlainText,
  isTipTapDocJson,
  plainTextToTipTapDoc,
  findBestAnchorMatch,
} from "../../../shared/manuscript";
import type { Scene } from "../../../shared/schemas/project";
import type { TaskRequest } from "../../../shared/schemas/task";

export interface ManuscriptEditorProps {
  scene: Scene;
  editable: boolean;
  poetry?: boolean;
  historical?: boolean;
  locateQuote?: string;
  resumeCursor?: number;
  onSave: (content: string, expectedBaseRevisionId?: string) => Promise<Scene>;
  onDirtyChange: (dirty: boolean) => void;
  onSelection: (selection: TaskRequest["selection"]) => void;
  onCursor: (cursor: number) => void;
  onEnterEdit: () => void;
}
const documentFrom = (content: string) =>
  isTipTapDocJson(content)
    ? JSON.parse(content)
    : plainTextToTipTapDoc(extractPlainText(content));

export function ManuscriptEditor({
  scene,
  editable,
  poetry,
  historical,
  locateQuote,
  resumeCursor,
  onSave,
  onDirtyChange,
  onSelection,
  onCursor,
  onEnterEdit,
}: ManuscriptEditorProps) {
  const { t } = useI18n();
  const [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [recovered, setRecovered] = useState(false),
    [search, setSearch] = useState<string | null>(null);
  const [replacement, setReplacement] = useState("");
  const storageKey = `verso:draft:${scene.projectId}:${scene.id}`;
  const savedRef = useRef(scene.content),
    baseRef = useRef(scene.currentRevisionId);
  const dirtyRef = useRef(false),
    saveRef = useRef<() => Promise<void>>(async () => {});
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Placeholder.configure({ placeholder: t("studio.editorPlaceholder") }),
    ],
    content: documentFrom(scene.content),
    editable,
    editorProps: {
      attributes: {
        class: "studio-prose",
        "aria-label": t("studio.manuscript"),
        role: "textbox",
      },
    },
    onUpdate: ({ editor }) => {
      dirtyRef.current = true;
      setDirty(true);
      onDirtyChange(true);
      if (!historical) {
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              baseRevisionId: baseRef.current,
              content: JSON.stringify(editor.getJSON()),
            }),
          );
        } catch {
          setError(t("studio.localDraftError"));
        }
      }
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      onCursor(from);
      if (from === to) {
        onSelection(undefined);
        return;
      }
      const plain = extractPlainText(editor.getJSON());
      const start = extractPlainText(
        editor.state.doc.cut(0, from).toJSON(),
      ).length;
      const end = extractPlainText(editor.state.doc.cut(0, to).toJSON()).length;
      const text = plain.slice(start, end);
      onSelection(text ? { from: start, to: end, text } : undefined);
    },
  });
  useEffect(() => {
    editor?.setEditable(editable, false);
  }, [editor, editable]);
  useEffect(() => {
    if (!editor) return;
    if (!dirtyRef.current || historical) {
      editor.commands.setContent(documentFrom(scene.content), {
        emitUpdate: false,
      });
      savedRef.current = scene.content;
      baseRef.current = scene.currentRevisionId;
    }
  }, [editor, scene.content, scene.currentRevisionId, historical]);
  useEffect(() => {
    if (!editor || historical || !editable) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draft = JSON.parse(stored);
        if (draft.content !== scene.content) {
          editor.commands.setContent(documentFrom(draft.content), {
            emitUpdate: false,
          });
          setDirty(true);
          dirtyRef.current = true;
          onDirtyChange(true);
          setRecovered(true);
          if (draft.baseRevisionId !== scene.currentRevisionId) {
            baseRef.current = draft.baseRevisionId;
            setError(t("studio.draftConflict"));
          }
        } else localStorage.removeItem(storageKey);
      }
    } catch {
      setError(t("studio.localDraftError"));
    }
    if (resumeCursor)
      editor.commands.setTextSelection(
        Math.min(resumeCursor, editor.state.doc.content.size),
      );
  }, [editor, storageKey, editable]);
  const save = async () => {
    if (!editor || saving || !dirty || !editable) return;
    if (editor.view.composing) return;
    setSaving(true);
    setError("");
    try {
      // The parent uses this editor's original version, never a newly revalidated
      // version, as the optimistic lock for a recovered or concurrent draft.
      const submittedContent = JSON.stringify(editor.getJSON());
      const updated = await onSave(submittedContent, baseRef.current || "");
      savedRef.current = updated.content;
      baseRef.current = updated.currentRevisionId;
      const changedDuringSave =
        JSON.stringify(editor.getJSON()) !== submittedContent;
      setDirty(changedDuringSave);
      dirtyRef.current = changedDuringSave;
      onDirtyChange(changedDuringSave);
      setRecovered(false);
      if (changedDuringSave)
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            baseRevisionId: baseRef.current,
            content: JSON.stringify(editor.getJSON()),
          }),
        );
      else localStorage.removeItem(storageKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("studio.saveFailed"));
    } finally {
      setSaving(false);
    }
  };
  saveRef.current = save;
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const shortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("keydown", shortcut);
    };
  }, []);
  useEffect(() => {
    if (!editor || !locateQuote) return;
    const match = findBestAnchorMatch({
      plainText: extractPlainText(editor.getJSON()),
      quote: locateQuote,
    });
    if (!match.found) return;
    const textNode = Array.from(
      editor.view.dom.querySelectorAll("p, h1, h2, h3"),
    ).find((el) => el.textContent?.includes(locateQuote));
    textNode?.scrollIntoView({ block: "center", behavior: "smooth" });
    textNode?.classList.add("studio-located");
    const timer = window.setTimeout(
      () => textNode?.classList.remove("studio-located"),
      3500,
    );
    return () => window.clearTimeout(timer);
  }, [editor, locateQuote]);
  const discard = () => {
    editor?.commands.setContent(documentFrom(scene.content), {
      emitUpdate: false,
    });
    baseRef.current = scene.currentRevisionId;
    savedRef.current = scene.content;
    localStorage.removeItem(storageKey);
    dirtyRef.current = false;
    setDirty(false);
    onDirtyChange(false);
    setError("");
    setRecovered(false);
  };
  const replace = () => {
    if (!editor || !search) return;
    // Search through text nodes, then replace from the end to preserve all marks,
    // paragraphs and poem line breaks outside the changed text.
    const matches: Array<{ from: number; to: number }> = [];
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      let index = node.text.indexOf(search);
      while (index >= 0) {
        matches.push({ from: pos + index, to: pos + index + search.length });
        index = node.text.indexOf(search, index + search.length);
      }
    });
    const tr = editor.state.tr;
    for (const match of matches.reverse())
      replacement
        ? tr.insertText(replacement, match.from, match.to)
        : tr.delete(match.from, match.to);
    editor.view.dispatch(tr);
  };
  return (
    <section className={`studio-editor ${poetry ? "studio-poetry" : ""}`}>
      <div className="studio-editor-toolbar">
        <span
          role="status"
          aria-live="polite"
          className={dirty ? "text-cinnabar" : "text-ink-muted"}
        >
          {saving
            ? t("common.saving")
            : dirty
              ? t("studio.unsaved")
              : historical
                ? t("studio.historical")
                : t("studio.saved")}
        </span>
        {editable ? (
          <div className="studio-actions">
            <button
              className="studio-icon-button"
              aria-label={t("workbench.bold")}
              aria-pressed={editor?.isActive("bold")}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold size={15} />
            </button>
            <button
              className="studio-icon-button"
              aria-label={t("workbench.italic")}
              aria-pressed={editor?.isActive("italic")}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic size={15} />
            </button>
            <button
              className="studio-icon-button"
              aria-label={t("workbench.blockquote")}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              <Quote size={15} />
            </button>
            <button
              className="studio-icon-button"
              aria-label={t("workbench.undo")}
              onClick={() => editor?.chain().focus().undo().run()}
            >
              <Undo2 size={15} />
            </button>
            <button
              className="studio-icon-button"
              aria-label={t("workbench.redo")}
              onClick={() => editor?.chain().focus().redo().run()}
            >
              <Redo2 size={15} />
            </button>
            <button
              className="studio-icon-button"
              aria-label={t("workbench.findAndReplace")}
              onClick={() => setSearch(search === null ? "" : null)}
            >
              <Search size={15} />
            </button>
            {dirty && (
              <button
                className="studio-button"
                disabled={saving}
                onClick={discard}
              >
                {t("studio.discard")}
              </button>
            )}
            <button
              className="studio-button studio-primary"
              disabled={!dirty || saving}
              onClick={save}
            >
              <Save size={14} />
              {t("common.save")}
            </button>
          </div>
        ) : (
          !historical && (
            <button className="studio-button" onClick={onEnterEdit}>
              <Pencil size={14} />
              {t("studio.write")}
            </button>
          )
        )}
      </div>
      {search !== null && (
        <div className="studio-search">
          <input
            aria-label={t("studio.find")}
            placeholder={t("studio.find")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            aria-label={t("studio.replaceWith")}
            placeholder={t("studio.replaceWith")}
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
          />
          <button className="studio-button" onClick={replace}>
            {t("studio.replaceAll")}
          </button>
          <button
            className="studio-icon-button"
            aria-label={t("common.close")}
            onClick={() => setSearch(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="studio-alert">
          {error}
        </p>
      )}
      {dirty && baseRef.current !== scene.currentRevisionId && (
        <div className="studio-conflict-review">
          <details>
            <summary>{t("studio.compareSavedDraft")}</summary>
            <DiffViewer
              originalText={extractPlainText(scene.content)}
              replacementText={editor ? extractPlainText(editor.getJSON()) : ""}
            />
          </details>
          <button
            className="studio-button"
            disabled={saving}
            onClick={() => {
              if (window.confirm(t("studio.replaceLatestConfirm"))) {
                baseRef.current = scene.currentRevisionId;
                void saveRef.current();
              }
            }}
          >
            {t("studio.saveAgainstLatest")}
          </button>
        </div>
      )}
      {recovered && <p className="studio-note">{t("studio.recovered")}</p>}
      <div className="studio-page">
        <div className="studio-page-heading">
          <h2>{scene.title}</h2>
          <span>{t("studio.chapter")}</span>
        </div>
        <EditorContent editor={editor} />
      </div>
    </section>
  );
}
