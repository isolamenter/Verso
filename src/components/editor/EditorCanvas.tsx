import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { FloatingMenu } from './FloatingMenu';
import type { CritiqueCategory, PaperTheme, TypographyFamily } from '../../types';
import { isTipTapDocJson, plainTextToHtml, extractPlainText, isHtmlString } from '../../utils/textProjection';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Quote,
  List,
  ListOrdered,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Replace,
  Undo,
  Redo
} from 'lucide-react';

interface EditorCanvasProps {
  content: string;
  onChange: (newContent: string) => void;
  onSelectionAction: (
    category: CritiqueCategory,
    selectedText: string,
    range: { from: number; to: number }
  ) => void;
  activeAnnotationQuote?: string | null;
  paperTheme: PaperTheme;
  typography: TypographyFamily;
  fontSize: number;
  lineHeight: number;
  typewriterMode: boolean;
  focusMode: boolean;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  content,
  onChange,
  onSelectionAction,
  activeAnnotationQuote,
  paperTheme,
  typography,
  fontSize,
  lineHeight,
  typewriterMode,
  focusMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [floatingMenuPos, setFloatingMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [currentSelectedText, setCurrentSelectedText] = useState('');
  const [currentSelectionRange, setCurrentSelectionRange] = useState<{ from: number; to: number }>({
    from: 0,
    to: 0,
  });

  // In-editor Search & Replace State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      CharacterCount,
      Placeholder.configure({
        placeholder: '在此落笔。文字如积水，静候推敲……',
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Typography,
    ],
    content: isTipTapDocJson(content)
      ? JSON.parse(content)
      : content
      ? plainTextToHtml(content)
      : '',
    editorProps: {
      attributes: {
        class:
          'focus:outline-none min-h-[70vh] prose prose-stone max-w-none text-ink',
      },
    },
    onUpdate: ({ editor }) => {
      // Save structured TipTap JSON doc
      const jsonStr = JSON.stringify(editor.getJSON());
      onChange(jsonStr);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        setFloatingMenuPos(null);
        setCurrentSelectedText('');
        return;
      }

      const selected = editor.state.doc.textBetween(from, to, ' ');
      if (!selected.trim()) {
        setFloatingMenuPos(null);
        setCurrentSelectedText('');
        return;
      }

      setCurrentSelectedText(selected);

      // Compute plain text offset corresponding to selection in plain text projection
      const prefixText = editor.state.doc.textBetween(0, from, '\n\n');
      const plainFrom = prefixText.length;
      const plainTo = plainFrom + selected.length;
      setCurrentSelectionRange({ from: plainFrom, to: plainTo });

      // Calculate coordinates for floating toolbar
      const { view } = editor;
      const startPos = view.coordsAtPos(from);
      const endPos = view.coordsAtPos(to);

      setFloatingMenuPos({
        top: Math.min(startPos.top, endPos.top),
        left: (startPos.left + endPos.right) / 2,
      });

      // Typewriter scrolling if enabled
      if (typewriterMode && containerRef.current) {
        const cursorCoords = view.coordsAtPos(from);
        const containerRect = containerRef.current.getBoundingClientRect();
        const targetScrollTop =
          containerRef.current.scrollTop +
          (cursorCoords.top - containerRect.top) -
          containerRect.height / 2;

        containerRef.current.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      }
    },
  });

  // Sync external content update if changed from outside (e.g. scene switch or accepted diff)
  useEffect(() => {
    if (editor) {
      const currentJson = JSON.stringify(editor.getJSON());
      if (content !== currentJson) {
        if (isTipTapDocJson(content)) {
          try {
            editor.commands.setContent(JSON.parse(content));
          } catch {
            editor.commands.setContent(content);
          }
        } else if (isHtmlString(content)) {
          const currentHtml = editor.getHTML();
          if (content !== currentHtml) {
            editor.commands.setContent(content);
          }
        } else {
          const currentPlain = extractPlainText(currentJson);
          if (content !== currentPlain) {
            editor.commands.setContent(plainTextToHtml(content));
          }
        }
      }
    }
  }, [content, editor]);

  // Jump to and highlight active annotation quote
  useEffect(() => {
    if (!editor || !activeAnnotationQuote) return;

    const fullDocText = editor.getText({ blockSeparator: '\n\n' });
    const targetQuote = activeAnnotationQuote.trim();
    const index = fullDocText.indexOf(targetQuote);

    if (index !== -1) {
      let targetFrom = -1;
      let targetTo = -1;

      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text) {
          const foundIdx = node.text.indexOf(targetQuote);
          if (foundIdx !== -1) {
            targetFrom = pos + foundIdx;
            targetTo = targetFrom + targetQuote.length;
            return false;
          }
        }
      });

      if (targetFrom !== -1 && targetTo !== -1) {
        editor.commands.setTextSelection({ from: targetFrom, to: targetTo });
        editor.commands.scrollIntoView();
      }
    }
  }, [activeAnnotationQuote, editor]);

  // Search in document
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!editor || !query.trim()) {
        setSearchMatches([]);
        setCurrentMatchIndex(0);
        return;
      }

      const matches: number[] = [];
      const lowerQuery = query.toLowerCase();
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text) {
          const lowerText = node.text.toLowerCase();
          let idx = lowerText.indexOf(lowerQuery);
          while (idx !== -1) {
            matches.push(pos + idx);
            idx = lowerText.indexOf(lowerQuery, idx + lowerQuery.length);
          }
        }
      });

      setSearchMatches(matches);
      if (matches.length > 0) {
        setCurrentMatchIndex(0);
        const from = matches[0];
        const to = from + query.length;
        editor.commands.setTextSelection({ from, to });
        editor.commands.scrollIntoView();
      }
    },
    [editor]
  );

  const goToNextMatch = useCallback(() => {
    if (!editor || searchMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIdx);
    const from = searchMatches[nextIdx];
    const to = from + searchQuery.length;
    editor.commands.setTextSelection({ from, to });
    editor.commands.scrollIntoView();
  }, [editor, searchMatches, currentMatchIndex, searchQuery]);

  const goToPrevMatch = useCallback(() => {
    if (!editor || searchMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIdx);
    const from = searchMatches[prevIdx];
    const to = from + searchQuery.length;
    editor.commands.setTextSelection({ from, to });
    editor.commands.scrollIntoView();
  }, [editor, searchMatches, currentMatchIndex, searchQuery]);

  const handleReplaceCurrent = useCallback(() => {
    if (!editor || searchMatches.length === 0 || !searchQuery) return;
    const from = searchMatches[currentMatchIndex];
    const to = from + searchQuery.length;
    editor.chain().focus().setTextSelection({ from, to }).insertContent(replaceQuery).run();
    handleSearch(searchQuery);
  }, [editor, searchMatches, currentMatchIndex, searchQuery, replaceQuery, handleSearch]);

  const handleReplaceAll = useCallback(() => {
    if (!editor || !searchQuery) return;
    let keepSearching = true;
    while (keepSearching) {
      let matchPos = -1;
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text && matchPos === -1) {
          const idx = node.text.indexOf(searchQuery);
          if (idx !== -1) {
            matchPos = pos + idx;
            return false;
          }
        }
      });
      if (matchPos !== -1) {
        editor
          .chain()
          .setTextSelection({ from: matchPos, to: matchPos + searchQuery.length })
          .insertContent(replaceQuery)
          .run();
      } else {
        keepSearching = false;
      }
    }
    const jsonStr = JSON.stringify(editor.getJSON());
    onChange(jsonStr);
    setIsSearchOpen(false);
  }, [editor, searchQuery, replaceQuery, onChange]);

  // Global keydown handler for search (Cmd/Ctrl + F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey && e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  const handleActionClick = useCallback(
    (category: CritiqueCategory) => {
      if (currentSelectedText.trim()) {
        onSelectionAction(category, currentSelectedText, currentSelectionRange);
        setFloatingMenuPos(null);
      }
    },
    [currentSelectedText, currentSelectionRange, onSelectionAction]
  );

  const getFontFamilyClass = () => {
    switch (typography) {
      case 'kaiti':
        return 'font-kaiti';
      case 'sans':
        return 'font-sans';
      case 'mono':
        return 'font-mono';
      case 'serif':
      default:
        return 'font-serif';
    }
  };

  const getPaperThemeClass = () => {
    switch (paperTheme) {
      case 'frost':
        return 'bg-[#f8fafb] text-[#202428]';
      case 'ink':
      case 'parchment':
      default:
        return 'bg-paper text-ink';
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 overflow-y-auto px-6 md:px-16 lg:px-24 py-10 transition-colors duration-200 ${getPaperThemeClass()}`}
      style={{
        fontSize: `${fontSize}px`,
        lineHeight: `${lineHeight}`,
      }}
    >
      {/* In-Editor Search & Replace floating bar */}
      {isSearchOpen && (
        <div className="fixed top-14 right-8 z-40 p-3 bg-paper rounded-lg shadow-xl border border-line-strong flex flex-col space-y-2 animate-in fade-in duration-150 font-serif text-xs min-w-[320px]">
          <div className="flex items-center justify-between pb-1 border-b border-line">
            <div className="flex items-center space-x-1.5 font-bold text-ink">
              <Search className="w-3.5 h-3.5 text-cinnabar" />
              <span>场景内检索与替换</span>
            </div>
            <button
              onClick={() => setIsSearchOpen(false)}
              className="text-ink-muted hover:text-ink p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center space-x-1.5">
            <input
              type="text"
              placeholder="查找内容……"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1 p-1.5 bg-paper border border-line-strong rounded focus:outline-none focus:border-cinnabar text-ink"
              autoFocus
            />
            <span className="text-[11px] text-ink-muted whitespace-nowrap font-mono">
              {searchMatches.length > 0
                ? `${currentMatchIndex + 1}/${searchMatches.length}`
                : '无匹配'}
            </span>
            <button
              onClick={goToPrevMatch}
              disabled={searchMatches.length === 0}
              className="p-1 text-ink-muted hover:text-ink disabled:opacity-30"
              title="上一处"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={goToNextMatch}
              disabled={searchMatches.length === 0}
              className="p-1 text-ink-muted hover:text-ink disabled:opacity-30"
              title="下一处"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center space-x-1.5">
            <input
              type="text"
              placeholder="替换为……"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              className="flex-1 p-1.5 bg-paper border border-line-strong rounded focus:outline-none focus:border-cinnabar text-ink"
            />
            <button
              onClick={handleReplaceCurrent}
              disabled={searchMatches.length === 0}
              className="px-2 py-1 bg-paper-sunken hover:bg-line text-ink rounded transition-colors text-[11px] disabled:opacity-30 flex items-center space-x-1"
            >
              <Replace className="w-3 h-3" />
              <span>替换</span>
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={searchMatches.length === 0}
              className="px-2 py-1 bg-cinnabar hover:bg-cinnabar-strong text-white rounded transition-colors text-[11px] disabled:opacity-30"
            >
              全换
            </button>
          </div>
        </div>
      )}

      {/* Floating Literary Action Menu */}
      <FloatingMenu
        position={floatingMenuPos}
        onSelectAction={handleActionClick}
        selectedText={currentSelectedText}
      />

      {/* Top Inline Formatting Toolbar (Discreet literary toolbar) */}
      {!focusMode && editor && (
        <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between pb-2 border-b border-line text-xs font-serif select-none text-ink-muted">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded transition-colors ${
                editor.isActive('bold') ? 'bg-ink text-paper' : 'hover:bg-paper-sunken hover:text-ink'
              }`}
              title="粗体 (Bold)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded transition-colors ${
                editor.isActive('italic') ? 'bg-ink text-paper' : 'hover:bg-paper-sunken hover:text-ink'
              }`}
              title="斜体 (Italic)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`p-1.5 rounded transition-colors ${
                editor.isActive('strike') ? 'bg-ink text-paper' : 'hover:bg-paper-sunken hover:text-ink'
              }`}
              title="删除线 (Strike)"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>

            <div className="h-3 w-px bg-line-strong mx-1" />

            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-1.5 rounded transition-colors ${
                editor.isActive('heading', { level: 1 }) ? 'bg-ink text-paper' : 'hover:bg-paper-sunken hover:text-ink'
              }`}
              title="一级小标题 (H1)"
            >
              <Heading1 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded transition-colors ${
                editor.isActive('heading', { level: 2 }) ? 'bg-ink text-paper' : 'hover:bg-paper-sunken hover:text-ink'
              }`}
              title="二级小标题 (H2)"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`p-1.5 rounded transition-colors ${
                editor.isActive('blockquote') ? 'bg-ink text-paper' : 'hover:bg-paper-sunken hover:text-ink'
              }`}
              title="引文块 (Blockquote)"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded transition-colors ${
                editor.isActive('bulletList') ? 'bg-ink text-paper' : 'hover:bg-paper-sunken hover:text-ink'
              }`}
              title="无序列表"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded transition-colors ${
                editor.isActive('orderedList') ? 'bg-ink text-paper' : 'hover:bg-paper-sunken hover:text-ink'
              }`}
              title="有序列表"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="p-1.5 hover:bg-paper-sunken rounded transition-colors disabled:opacity-30"
              title="撤销 (Cmd/Ctrl + Z)"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="p-1.5 hover:bg-paper-sunken rounded transition-colors disabled:opacity-30"
              title="重做 (Cmd/Ctrl + Shift + Z)"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-1.5 hover:bg-paper-sunken rounded transition-colors ml-1 text-cinnabar"
              title="场景内检索 (Cmd/Ctrl + F)"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Prose Canvas */}
      <div
        className={`max-w-3xl mx-auto ${getFontFamilyClass()} tracking-wide ${
          focusMode ? 'focus-mode-active' : ''
        }`}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
