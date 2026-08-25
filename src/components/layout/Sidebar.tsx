import React, { useState, useRef } from 'react';
import type { Project, Manuscript, Scene } from '../../types';
import {
  Book,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Users,
  Eye,
  History,
  PanelLeftClose,
  Sparkles,
  Edit2,
  Check,
  Upload
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  manuscripts: Manuscript[];
  manuscript: Manuscript | null;
  onSwitchManuscript: (manuId: string) => void;
  onCreateManuscript: (title: string, genre: Manuscript['genre'], synopsis: string) => void;
  onImportManuscriptFile?: (file: File) => void;
  onImportSceneFile?: (file: File) => void;
  scenes: Scene[];
  activeSceneId: string;
  onSelectScene: (sceneId: string) => void;
  onAddScene: () => void;
  onDeleteScene: (sceneId: string) => void;
  onRenameScene: (sceneId: string, newTitle: string) => void;
  onOpenRevisions: () => void;
  onOpenCharacterNotes: () => void;
  onOpenMotifs: () => void;
  onOpenPromptLibrary: () => void;
  onOpenImportAssistant?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  project,
  manuscripts,
  manuscript,
  onSwitchManuscript,
  onCreateManuscript,
  onImportManuscriptFile,
  onImportSceneFile,
  scenes,
  activeSceneId,
  onSelectScene,
  onAddScene,
  onDeleteScene,
  onRenameScene,
  onOpenRevisions,
  onOpenCharacterNotes,
  onOpenMotifs,
  onOpenPromptLibrary,
  onOpenImportAssistant,
}) => {
  const [isScenesExpanded, setIsScenesExpanded] = useState(true);
  const [isNotesExpanded, setIsNotesExpanded] = useState(true);
  const [isManuscriptsDropdownOpen, setIsManuscriptsDropdownOpen] = useState(false);
  const [showCreateManuscript, setShowCreateManuscript] = useState(false);
  const [newManuTitle, setNewManuTitle] = useState('');
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editingSceneTitle, setEditingSceneTitle] = useState('');

  const fileInputManuscriptRef = useRef<HTMLInputElement>(null);
  const fileInputSceneRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCreateManuscript = () => {
    if (!newManuTitle.trim()) return;
    onCreateManuscript(newManuTitle.trim(), 'short_story', '');
    setNewManuTitle('');
    setShowCreateManuscript(false);
  };

  const handleStartRenameScene = (e: React.MouseEvent, s: Scene) => {
    e.stopPropagation();
    setEditingSceneId(s.id);
    setEditingSceneTitle(s.title);
  };

  const handleSaveRenameScene = (e: React.MouseEvent, sceneId: string) => {
    e.stopPropagation();
    if (editingSceneTitle.trim()) {
      onRenameScene(sceneId, editingSceneTitle.trim());
    }
    setEditingSceneId(null);
  };

  const handleManuscriptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportManuscriptFile) {
      onImportManuscriptFile(file);
      setIsManuscriptsDropdownOpen(false);
    }
    if (e.target) e.target.value = '';
  };

  const handleSceneFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportSceneFile) {
      onImportSceneFile(file);
    }
    if (e.target) e.target.value = '';
  };

  return (
    <aside className="w-64 border-r border-line bg-paper-raise flex flex-col h-full overflow-hidden select-none">
      {/* Hidden File Inputs for Local Import */}
      <input
        ref={fileInputManuscriptRef}
        type="file"
        accept=".txt,.md,.docx"
        className="hidden"
        onChange={handleManuscriptFileChange}
      />
      <input
        ref={fileInputSceneRef}
        type="file"
        accept=".txt,.md,.docx"
        className="hidden"
        onChange={handleSceneFileChange}
      />

      {/* Project & Manuscript Header */}
      <div className="p-3.5 border-b border-line flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div
            onClick={() => setIsManuscriptsDropdownOpen(!isManuscriptsDropdownOpen)}
            className="flex items-center space-x-2 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity flex-1"
          >
            <Book className="w-4 h-4 text-cinnabar shrink-0" />
            <div className="overflow-hidden">
              <div className="flex items-center space-x-1">
                <h1 className="text-xs font-bold font-serif text-ink truncate">
                  {manuscript ? manuscript.title : '点击新建或导入书稿'}
                </h1>
                <ChevronDown className="w-3 h-3 text-ink-muted shrink-0" />
              </div>
              <p className="text-[10px] font-mono text-ink-faint truncate">
                {project ? project.title : '未选择项目'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-ink-muted hover:text-ink rounded transition-colors ml-1"
            title="收起侧栏 (Cmd/Ctrl + B)"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Manuscript Switcher & Creator Dropdown */}
        {isManuscriptsDropdownOpen && (
          <div className="p-2 bg-paper rounded border border-line space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between pb-1 border-b border-line text-[10px] font-bold text-ink-muted">
              <span>书稿 · {manuscripts.length}</span>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => fileInputManuscriptRef.current?.click()}
                  className="text-ink-muted hover:text-ink flex items-center space-x-0.5"
                  title="导入本地 .txt 或 .md 文件"
                >
                  <Upload className="w-3 h-3" />
                  <span>导入</span>
                </button>
                <button
                  onClick={() => setShowCreateManuscript(true)}
                  className="text-cinnabar hover:text-cinnabar-strong flex items-center space-x-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>新建</span>
                </button>
              </div>
            </div>

            {showCreateManuscript && (
              <div className="p-1.5 bg-paper-sunken rounded border border-line space-y-1">
                <input
                  type="text"
                  placeholder="书稿篇名 (如: 《夜行货车》)"
                  value={newManuTitle}
                  onChange={(e) => setNewManuTitle(e.target.value)}
                  className="w-full p-1 text-xs bg-paper border border-line-strong rounded focus:outline-none focus:border-cinnabar"
                  autoFocus
                />
                <div className="flex justify-end space-x-1">
                  <button
                    onClick={() => setShowCreateManuscript(false)}
                    className="px-1.5 py-0.5 text-[10px] text-ink-muted"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateManuscript}
                    className="px-2 py-0.5 text-[10px] bg-cinnabar hover:bg-cinnabar-strong text-white rounded"
                  >
                    创建
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-36 overflow-y-auto space-y-0.5">
              {manuscripts.length === 0 ? (
                <div className="py-2 text-center text-[11px] text-ink-faint">暂无书稿</div>
              ) : (
                manuscripts.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      onSwitchManuscript(m.id);
                      setIsManuscriptsDropdownOpen(false);
                    }}
                    className={`p-1.5 rounded cursor-pointer text-xs flex items-center justify-between ${
                      m.id === manuscript?.id
                        ? 'bg-paper-sunken font-bold text-ink'
                        : 'hover:bg-paper-sunken/50 text-ink-muted'
                    }`}
                  >
                    <span className="truncate">{m.title}</span>
                    <span className="text-[10px] font-mono text-ink-faint">{m.genre}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4 font-serif text-xs">
        {/* Scenes / Outline */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-ink-muted">
            <button
              onClick={() => setIsScenesExpanded(!isScenesExpanded)}
              className="flex items-center space-x-1 hover:text-ink"
            >
              {isScenesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>场景 · {scenes.length}</span>
            </button>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => fileInputSceneRef.current?.click()}
                disabled={!manuscript}
                className="p-0.5 hover:bg-paper-sunken rounded text-ink-muted hover:text-ink disabled:opacity-30"
                title="导入场景 (.txt/.md)"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onAddScene}
                disabled={!manuscript}
                className="p-0.5 hover:bg-paper-sunken rounded text-cinnabar disabled:opacity-30"
                title="添加新场景"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isScenesExpanded && (
            <div className="mt-1 space-y-0.5">
              {scenes.length === 0 ? (
                <div className="px-2.5 py-3 text-center text-[11px] text-ink-faint border border-dashed border-line rounded">
                  {manuscript ? '点击右上角 + 或导入添加场景' : '请先新建或选择书稿'}
                </div>
              ) : (
                scenes.map((scene, idx) => {
                  const isActive = scene.id === activeSceneId;
                  const isEditing = editingSceneId === scene.id;

                  return (
                    <div
                      key={scene.id}
                      onClick={() => onSelectScene(scene.id)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-paper-sunken text-ink font-medium'
                          : 'text-ink-muted hover:bg-paper-sunken/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2 overflow-hidden flex-1">
                        <span
                          className={`text-[10px] shrink-0 font-mono ${
                            isActive ? 'text-cinnabar' : 'text-ink-faint'
                          }`}
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </span>

                        {isEditing ? (
                          <div
                            className="flex items-center space-x-1 flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editingSceneTitle}
                              onChange={(e) => setEditingSceneTitle(e.target.value)}
                              className="w-full p-0.5 text-xs bg-paper border border-line-strong rounded focus:outline-none focus:border-cinnabar"
                              autoFocus
                            />
                            <button
                              onClick={(e) => handleSaveRenameScene(e, scene.id)}
                              className="p-0.5 text-ok"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="truncate">{scene.title}</span>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity">
                          <button
                            onClick={(e) => handleStartRenameScene(e, scene)}
                            className="p-0.5 text-ink-faint hover:text-ink"
                            title="重命名场景"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {scenes.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`确认删除场景《${scene.title}》吗？`)) {
                                  onDeleteScene(scene.id);
                                }
                              }}
                              className="p-0.5 text-ink-faint hover:text-danger"
                              title="删除场景"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Project Notes & Literary Elements */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-ink-muted">
            <button
              onClick={() => setIsNotesExpanded(!isNotesExpanded)}
              className="flex items-center space-x-1 hover:text-ink"
            >
              {isNotesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>文学备忘</span>
            </button>
            {onOpenImportAssistant && (
              <button
                onClick={onOpenImportAssistant}
                disabled={!manuscript}
                className="text-[10px] text-cinnabar hover:text-cinnabar-strong flex items-center space-x-0.5 disabled:opacity-30"
                title="通过 AI 一键提取人物、意象与分场建议"
              >
                <Sparkles className="w-3 h-3" />
                <span>AI 建档</span>
              </button>
            )}
          </div>

          {isNotesExpanded && (
            <div className="mt-1 space-y-0.5">
              <button
                onClick={onOpenCharacterNotes}
                disabled={!manuscript}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-left text-ink-muted hover:bg-paper-sunken/50 rounded transition-colors disabled:opacity-40"
              >
                <Users className="w-3.5 h-3.5 text-cinnabar" />
                <span>人物小传与声线</span>
                <span className="ml-auto text-[10px] font-mono text-ink-faint">
                  {manuscript?.characters?.length || 0}
                </span>
              </button>

              <button
                onClick={onOpenMotifs}
                disabled={!manuscript}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-left text-ink-muted hover:bg-paper-sunken/50 rounded transition-colors disabled:opacity-40"
              >
                <Eye className="w-3.5 h-3.5 text-cinnabar" />
                <span>核心意象网络</span>
                <span className="ml-auto text-[10px] font-mono text-ink-faint">
                  {manuscript?.motifs?.length || 0}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Prompt Library & History */}
        <div className="space-y-1 pt-1 border-t border-line">
          <button
            onClick={onOpenPromptLibrary}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-ink-muted hover:bg-paper-sunken/50 rounded transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-cinnabar" />
              <span>提示词库</span>
            </div>
            <span className="text-[9px] font-mono px-1 py-0.2 bg-paper-sunken rounded text-ink-faint">
              库
            </span>
          </button>

          <button
            onClick={onOpenRevisions}
            disabled={!activeSceneId}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-ink-muted hover:bg-paper-sunken/50 rounded transition-colors disabled:opacity-40"
          >
            <div className="flex items-center space-x-2">
              <History className="w-3.5 h-3.5 text-cinnabar" />
              <span>修订单与版本快照</span>
            </div>
            <span className="text-[10px] font-mono text-ink-faint">修订</span>
          </button>
        </div>
      </div>

      {/* Footer Info — a privacy stamp, not a paragraph */}
      <div className="p-3 border-t border-line text-[10px] text-ink-faint font-serif">
        <p className="leading-relaxed">
          本地存储沙箱 · 修改由创作者完全主导。
        </p>
      </div>
    </aside>
  );
};
