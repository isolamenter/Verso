import React, { useState, useEffect, useRef } from 'react';
import type {
  Manuscript,
  CharacterItem,
  MotifItem,
  Scene,
  NotesTab,
  ProfilingModule,
  ProfilingMode,
  ProfilingRunParams,
  ProfilingModuleResultMap,
  SceneSplitSuggestion,
} from '../../types';
import { X, Users, Eye, BookOpen, Sparkles, Plus, Trash2, Split, Undo2 } from 'lucide-react';
import { ProfilingToolbar, ItemPreviewPanel } from './ProfilingToolbar';
import type { PreviewEntity, PreviewEntityPatch } from './ProfilingToolbar';
import { dedupeByName, mergeByName } from '../../utils/dedupe';
import { computeSplitCoverage } from '../../utils/textProjection';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  manuscript: Manuscript | null;
  onUpdateManuscript: (updates: Partial<Manuscript>) => void;
  /** 全篇拼接正文（建档 AI 输入） */
  manuscriptContent: string;
  scenes: Scene[];
  profilingLoading: Record<ProfilingModule, boolean>;
  onRunProfilingModule: <M extends ProfilingModule>(
    module: M,
    params: ProfilingRunParams
  ) => Promise<ProfilingModuleResultMap[M]>;
  onApplySceneSplits: (splits: SceneSplitSuggestion[]) => Promise<void>;
  defaultTab?: NotesTab;
}

export const NotesModal: React.FC<NotesModalProps> = ({
  isOpen,
  onClose,
  manuscript,
  onUpdateManuscript,
  manuscriptContent,
  scenes,
  profilingLoading,
  onRunProfilingModule,
  onApplySceneSplits,
  defaultTab = 'synopsis',
}) => {
  const [activeTab, setActiveTab] = useState<NotesTab>(defaultTab);
  const [title, setTitle] = useState(manuscript?.title || '');
  const [genre, setGenre] = useState<Manuscript['genre']>(manuscript?.genre || 'short_story');
  const [synopsis, setSynopsis] = useState(manuscript?.synopsis || '');
  const [themeAnalysis, setThemeAnalysis] = useState(manuscript?.themeAnalysis || '');
  const [notes, setNotes] = useState(manuscript?.notes || '');
  const [characters, setCharacters] = useState<CharacterItem[]>(manuscript?.characters || []);
  const [motifs, setMotifs] = useState<MotifItem[]>(manuscript?.motifs || []);

  // AI 单文本模块的撤销快照
  const synopsisPreAiRef = useRef<string | null>(null);
  const themePreAiRef = useRef<string | null>(null);
  const [hasSynopsisUndo, setHasSynopsisUndo] = useState(false);
  const [hasThemeUndo, setHasThemeUndo] = useState(false);

  // AI 列表模块预览
  const [charPreview, setCharPreview] = useState<PreviewEntity[] | null>(null);
  const [charPreviewMode, setCharPreviewMode] = useState<ProfilingMode>('generate');
  const [charDedupeHint, setCharDedupeHint] = useState<string | null>(null);
  const [motifPreview, setMotifPreview] = useState<PreviewEntity[] | null>(null);
  const [motifPreviewMode, setMotifPreviewMode] = useState<ProfilingMode>('generate');
  const [motifDedupeHint, setMotifDedupeHint] = useState<string | null>(null);

  // AI 分场预览
  const [splitsPreview, setSplitsPreview] = useState<SceneSplitSuggestion[] | null>(null);
  const [splitsSuccessMsg, setSplitsSuccessMsg] = useState<string | null>(null);
  const [expandedSplitIdx, setExpandedSplitIdx] = useState<number | null>(null);

  // Sync with prop updates
  useEffect(() => {
    if (manuscript) {
      setTitle(manuscript.title || '');
      setGenre(manuscript.genre || 'short_story');
      setSynopsis(manuscript.synopsis || '');
      setThemeAnalysis(manuscript.themeAnalysis || '');
      setNotes(manuscript.notes || '');
      setCharacters(manuscript.characters || []);
      setMotifs(manuscript.motifs || []);
    }
  }, [manuscript]);

  useEffect(() => {
    if (isOpen && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // 防串稿：切换书稿时清空全部 AI 预览与撤销快照
  useEffect(() => {
    setCharPreview(null);
    setCharDedupeHint(null);
    setMotifPreview(null);
    setMotifDedupeHint(null);
    setSplitsPreview(null);
    setSplitsSuccessMsg(null);
    setExpandedSplitIdx(null);
    setHasSynopsisUndo(false);
    setHasThemeUndo(false);
    synopsisPreAiRef.current = null;
    themePreAiRef.current = null;
  }, [manuscript?.id]);

  if (!isOpen || !manuscript) return null;

  const handleUpdateTitle = (newTitle: string) => {
    setTitle(newTitle);
    onUpdateManuscript({ title: newTitle });
  };

  const handleUpdateGenre = (newGenre: Manuscript['genre']) => {
    setGenre(newGenre);
    onUpdateManuscript({ genre: newGenre });
  };

  const handleUpdateSynopsis = (newSynopsis: string) => {
    setSynopsis(newSynopsis);
    onUpdateManuscript({ synopsis: newSynopsis });
  };

  const handleUpdateThemeAnalysis = (newTheme: string) => {
    setThemeAnalysis(newTheme);
    onUpdateManuscript({ themeAnalysis: newTheme });
  };

  const handleUpdateNotes = (newNotes: string) => {
    setNotes(newNotes);
    onUpdateManuscript({ notes: newNotes });
  };

  const handleAddCharacter = () => {
    const newChar: CharacterItem = {
      id: `char-${Date.now()}`,
      name: '新人物',
      role: '身份',
      notes: '声线、动作习惯与性格特征……',
    };
    const updated = [...characters, newChar];
    setCharacters(updated);
    onUpdateManuscript({ characters: updated });
  };

  const handleUpdateCharacter = (id: string, updates: Partial<CharacterItem>) => {
    const updated = characters.map((c) => (c.id === id ? { ...c, ...updates } : c));
    setCharacters(updated);
    onUpdateManuscript({ characters: updated });
  };

  const handleDeleteCharacter = (id: string) => {
    const updated = characters.filter((c) => c.id !== id);
    setCharacters(updated);
    onUpdateManuscript({ characters: updated });
  };

  const handleAddMotif = () => {
    const newMotif: MotifItem = {
      id: `motif-${Date.now()}`,
      name: '新意象',
      description: '意象载体与象征意义……',
    };
    const updated = [...motifs, newMotif];
    setMotifs(updated);
    onUpdateManuscript({ motifs: updated });
  };

  const handleUpdateMotif = (id: string, updates: Partial<MotifItem>) => {
    const updated = motifs.map((m) => (m.id === id ? { ...m, ...updates } : m));
    setMotifs(updated);
    onUpdateManuscript({ motifs: updated });
  };

  const handleDeleteMotif = (id: string) => {
    const updated = motifs.filter((m) => m.id !== id);
    setMotifs(updated);
    onUpdateManuscript({ motifs: updated });
  };

  // ---- AI：梗概模块 ----
  const handleRunSynopsis = async (mode: ProfilingMode, userNotes?: string) => {
    const result = await onRunProfilingModule('synopsis', {
      mode,
      currentValue: mode === 'refine' ? synopsis : undefined,
      userNotes,
    });
    synopsisPreAiRef.current = synopsis;
    setHasSynopsisUndo(true);
    setSynopsis(result.text);
    onUpdateManuscript({ synopsis: result.text });
  };

  const handleUndoSynopsis = () => {
    if (synopsisPreAiRef.current === null) return;
    const prev = synopsisPreAiRef.current;
    synopsisPreAiRef.current = null;
    setHasSynopsisUndo(false);
    setSynopsis(prev);
    onUpdateManuscript({ synopsis: prev });
  };

  // ---- AI：主题剖析模块 ----
  const handleRunTheme = async (mode: ProfilingMode, userNotes?: string) => {
    const result = await onRunProfilingModule('theme', {
      mode,
      currentValue: mode === 'refine' ? themeAnalysis : undefined,
      userNotes,
    });
    themePreAiRef.current = themeAnalysis;
    setHasThemeUndo(true);
    setThemeAnalysis(result.text);
    onUpdateManuscript({ themeAnalysis: result.text });
  };

  const handleUndoTheme = () => {
    if (themePreAiRef.current === null) return;
    const prev = themePreAiRef.current;
    themePreAiRef.current = null;
    setHasThemeUndo(false);
    setThemeAnalysis(prev);
    onUpdateManuscript({ themeAnalysis: prev });
  };

  // ---- AI：人物模块 ----
  const handleRunCharacters = async (mode: ProfilingMode, userNotes?: string) => {
    const result = await onRunProfilingModule('characters', {
      mode,
      currentValue: mode === 'refine' ? characters : undefined,
      userNotes,
    });
    const preview: PreviewEntity[] = result.items.map((c) => ({ ...c, selected: true }));
    setCharPreview(preview);
    setCharPreviewMode(mode);
    if (mode === 'generate') {
      const merged = mergeByName(characters, result.items, { matchAlias: true });
      const added = merged.length - characters.length;
      setCharDedupeHint(
        result.items.length > 0 && added < result.items.length
          ? `合并时将按名去重，预计新增 ${added} 条`
          : null
      );
    } else {
      setCharDedupeHint(null);
    }
  };

  const handleUpdateCharPreview = (idx: number, patch: PreviewEntityPatch) => {
    setCharPreview((prev) =>
      prev
        ? prev.map((item, i) => {
            if (i !== idx) return item;
            const updated: PreviewEntity = { ...item } as PreviewEntity;
            if (patch.name !== undefined) updated.name = patch.name;
            if ('role' in updated && patch.meta !== undefined) {
              (updated as CharacterItem).role = patch.meta;
            }
            if ('role' in updated && patch.detail !== undefined) {
              (updated as CharacterItem).notes = patch.detail;
            }
            return updated;
          })
        : prev
    );
  };

  const handleApplyCharPreview = () => {
    if (!charPreview) return;
    if (charPreviewMode === 'generate') {
      const selected = charPreview.filter((i) => i.selected !== false) as CharacterItem[];
      const merged = mergeByName(characters, selected, { matchAlias: true });
      setCharacters(merged);
      onUpdateManuscript({ characters: merged });
    } else {
      const revised = dedupeByName(charPreview as CharacterItem[], { matchAlias: true });
      setCharacters(revised);
      onUpdateManuscript({ characters: revised });
    }
    setCharPreview(null);
    setCharDedupeHint(null);
  };

  // ---- AI：意象模块 ----
  const handleRunMotifs = async (mode: ProfilingMode, userNotes?: string) => {
    const result = await onRunProfilingModule('motifs', {
      mode,
      currentValue: mode === 'refine' ? motifs : undefined,
      userNotes,
    });
    const preview: PreviewEntity[] = result.items.map((m) => ({ ...m, selected: true }));
    setMotifPreview(preview);
    setMotifPreviewMode(mode);
    if (mode === 'generate') {
      const merged = mergeByName(motifs, result.items);
      const added = merged.length - motifs.length;
      setMotifDedupeHint(
        result.items.length > 0 && added < result.items.length
          ? `合并时将按名去重，预计新增 ${added} 条`
          : null
      );
    } else {
      setMotifDedupeHint(null);
    }
  };

  const handleUpdateMotifPreview = (idx: number, patch: PreviewEntityPatch) => {
    setMotifPreview((prev) =>
      prev
        ? prev.map((item, i) => {
            if (i !== idx) return item;
            const updated: PreviewEntity = { ...item } as PreviewEntity;
            if (patch.name !== undefined) updated.name = patch.name;
            if (!('role' in updated) && patch.detail !== undefined) {
              (updated as MotifItem).description = patch.detail;
            }
            return updated;
          })
        : prev
    );
  };

  const handleApplyMotifPreview = () => {
    if (!motifPreview) return;
    if (motifPreviewMode === 'generate') {
      const selected = motifPreview.filter((i) => i.selected !== false) as MotifItem[];
      const merged = mergeByName(motifs, selected);
      setMotifs(merged);
      onUpdateManuscript({ motifs: merged });
    } else {
      const revised = dedupeByName(motifPreview as MotifItem[]);
      setMotifs(revised);
      onUpdateManuscript({ motifs: revised });
    }
    setMotifPreview(null);
    setMotifDedupeHint(null);
  };

  // ---- AI：分场模块 ----
  const handleRunSplits = async (mode: ProfilingMode, userNotes?: string) => {
    const result = await onRunProfilingModule('scene_splits', {
      mode,
      currentValue: mode === 'refine' ? scenes : undefined,
      userNotes,
    });
    setSplitsPreview(result.splits);
    setSplitsSuccessMsg(null);
    setExpandedSplitIdx(null);
  };

  const splitsCoverage = splitsPreview
    ? computeSplitCoverage(manuscriptContent, splitsPreview)
    : 1;

  const handleApplySplits = async () => {
    if (!splitsPreview || splitsPreview.length <= 1) return;
    const pct = Math.round(splitsCoverage * 100);
    let msg = `将删除现有 ${scenes.length} 个场景，替换为 AI 切分的 ${splitsPreview.length} 个场景。此操作不可撤销`;
    if (splitsCoverage < 0.95) {
      msg += `（当前切分仅覆盖全文约 ${pct}%）`;
    }
    if (!confirm(`${msg}，确认继续吗？`)) return;

    await onApplySceneSplits(splitsPreview);
    setSplitsSuccessMsg(`已替换为 ${splitsPreview.length} 场，可在左侧场景列表查看`);
    setSplitsPreview(null);
    setExpandedSplitIdx(null);
  };

  const tabClass = (tab: NotesTab) =>
    `flex items-center space-x-1.5 text-xs font-bold font-serif pb-0.5 border-b-2 transition-colors whitespace-nowrap ${
      activeTab === tab ? 'border-cinnabar text-ink' : 'border-transparent text-ink-muted hover:text-ink'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-paper rounded-lg shadow-xl border border-line flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <div className="flex items-center space-x-3 overflow-x-auto">
            <button onClick={() => setActiveTab('synopsis')} className={tabClass('synopsis')}>
              <BookOpen className="w-3.5 h-3.5" />
              <span>故事梗概</span>
            </button>

            <button onClick={() => setActiveTab('theme')} className={tabClass('theme')}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>主题剖析</span>
            </button>

            <button onClick={() => setActiveTab('characters')} className={tabClass('characters')}>
              <Users className="w-3.5 h-3.5" />
              <span>人物小传与声线 ({characters.length})</span>
            </button>

            <button onClick={() => setActiveTab('motifs')} className={tabClass('motifs')}>
              <Eye className="w-3.5 h-3.5" />
              <span>核心意象网络 ({motifs.length})</span>
            </button>

            <button onClick={() => setActiveTab('scene_splits')} className={tabClass('scene_splits')}>
              <Split className="w-3.5 h-3.5" />
              <span>分场 ({scenes.length})</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-ink-muted hover:text-ink rounded transition-colors shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-serif text-xs">
          {/* Tab 1: Synopsis */}
          {activeTab === 'synopsis' && (
            <div className="space-y-4">
              {/* Basic metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-paper-sunken rounded border border-line">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-[11px] font-bold text-ink-muted">书稿篇名</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => handleUpdateTitle(e.target.value)}
                    placeholder="如：《夜行货车》"
                    className="w-full p-1.5 text-xs bg-paper border border-line rounded text-ink focus:outline-none focus:border-cinnabar"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-ink-muted">体裁类型</label>
                  <select
                    value={genre}
                    onChange={(e) => handleUpdateGenre(e.target.value as Manuscript['genre'])}
                    className="w-full p-1.5 text-xs bg-paper border border-line rounded text-ink focus:outline-none focus:border-cinnabar"
                  >
                    <option value="novel">长篇小说 (Novel)</option>
                    <option value="novella">中篇小说 (Novella)</option>
                    <option value="short_story">短篇小说 (Short Story)</option>
                    <option value="essay">散文随笔 (Essay)</option>
                    <option value="poetry">诗歌/剧本 (Poetry)</option>
                  </select>
                </div>
              </div>

              {/* Story Synopsis */}
              <div className="p-3.5 bg-paper rounded border border-line space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-bold text-ink text-xs">
                    <BookOpen className="w-3.5 h-3.5 text-cinnabar" />
                    <span>故事梗概与时空舞台 (Synopsis)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {hasSynopsisUndo && (
                      <button
                        onClick={handleUndoSynopsis}
                        className="flex items-center space-x-1 text-[10px] text-ink-muted hover:text-danger transition-colors"
                        title="回滚到 AI 修改前的梗概"
                      >
                        <Undo2 className="w-3 h-3" />
                        <span>撤销 AI 修改</span>
                      </button>
                    )}
                    <span className="text-[10px] text-ink-faint font-mono">{synopsis.length} 字</span>
                  </div>
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  客观、克制、具有文学密度的梗概，交代时空舞台、核心行动与人物处境脉络，为后续审读提供全书叙事基底：
                </p>
                <textarea
                  value={synopsis}
                  onChange={(e) => handleUpdateSynopsis(e.target.value)}
                  rows={4}
                  placeholder="例如：20世纪80年代末南方沿海小城，暴雨连绵的梅雨季。老修鞋匠林远在一次拆迁动员中意外发现了一把二十年前的旧钥匙……"
                  className="w-full p-2 text-xs bg-paper border border-line rounded text-ink focus:outline-none focus:border-cinnabar leading-relaxed resize-y"
                />
              </div>

              <ProfilingToolbar
                moduleLabel="故事梗概"
                isLoading={profilingLoading.synopsis}
                canRefine={Boolean(synopsis.trim())}
                onRun={handleRunSynopsis}
                loadingText="正在通读全篇，提炼故事梗概……"
              />
            </div>
          )}

          {/* Tab 2: Theme */}
          {activeTab === 'theme' && (
            <div className="space-y-4">
              {/* AI Theme Analysis */}
              <div className="p-3.5 bg-paper rounded border border-line space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-bold text-ink text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-cinnabar" />
                    <span>深层主题剖析 (Theme Analysis)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {hasThemeUndo && (
                      <button
                        onClick={handleUndoTheme}
                        className="flex items-center space-x-1 text-[10px] text-ink-muted hover:text-danger transition-colors"
                        title="回滚到 AI 修改前的主题剖析"
                      >
                        <Undo2 className="w-3 h-3" />
                        <span>撤销 AI 修改</span>
                      </button>
                    )}
                    <span className="text-[10px] text-ink-faint font-mono">{themeAnalysis.length} 字</span>
                  </div>
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  提炼深层隐秘矛盾（例如"表面是代际隔阂，实质是对消逝故土的抵抗与无力"）。AI 提炼，可手改：
                </p>
                <textarea
                  value={themeAnalysis}
                  onChange={(e) => handleUpdateThemeAnalysis(e.target.value)}
                  rows={4}
                  placeholder="尚未提炼。可点击下方「AI 生成」通读全篇提炼深层主题……"
                  className="w-full p-2 text-xs bg-paper border border-line rounded text-ink focus:outline-none focus:border-cinnabar leading-relaxed resize-y"
                />
              </div>

              <ProfilingToolbar
                moduleLabel="主题剖析"
                isLoading={profilingLoading.theme}
                canRefine={Boolean(themeAnalysis.trim())}
                onRun={handleRunTheme}
                loadingText="正在通读全篇，提炼深层矛盾……"
              />

              {/* User Notes (kept manual, separate from themeAnalysis) */}
              <div className="p-3.5 bg-paper rounded border border-line space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-bold text-ink text-xs">
                    <Users className="w-3.5 h-3.5 text-cinnabar" />
                    <span>创作备忘 (Notes)</span>
                  </div>
                  <span className="text-[10px] text-ink-faint font-mono">{notes.length} 字</span>
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  你的全局写作备忘（叙述视角、修辞风格、立意深度等），纯手动维护，AI 不会写入：
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => handleUpdateNotes(e.target.value)}
                  rows={4}
                  placeholder="例如：全篇保持第三人称内聚焦，尽量避免直接心理描写……"
                  className="w-full p-2 text-xs bg-paper border border-line rounded text-ink focus:outline-none focus:border-cinnabar leading-relaxed resize-y"
                />
              </div>
            </div>
          )}

          {/* Tab 3: Characters */}
          {activeTab === 'characters' && (
            <div className="space-y-3">
              <ProfilingToolbar
                moduleLabel="人物小传"
                isLoading={profilingLoading.characters}
                canRefine={characters.length > 0}
                onRun={handleRunCharacters}
                loadingText="正在通读全篇，提取人物声线……"
              />

              {charPreview && (
                <ItemPreviewPanel
                  mode={charPreviewMode}
                  items={charPreview}
                  kind="characters"
                  onToggle={(idx, selected) =>
                    setCharPreview((prev) =>
                      prev ? prev.map((c, i) => (i === idx ? { ...c, selected } : c)) : prev
                    )
                  }
                  onUpdate={handleUpdateCharPreview}
                  onRemove={(idx) => setCharPreview((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev))}
                  onApply={handleApplyCharPreview}
                  applyLabel={charPreviewMode === 'generate' ? '合并入列表' : '替换列表'}
                  dedupeHint={charDedupeHint || undefined}
                />
              )}

              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] text-ink-muted">
                  轻量人物小传（主要用于 AI 审视对白声线与动机一致性）：
                </span>
                <button
                  onClick={handleAddCharacter}
                  className="flex items-center space-x-1 text-cinnabar hover:text-ink text-xs font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>添加人物</span>
                </button>
              </div>

              {characters.length === 0 ? (
                <div className="py-8 text-center text-ink-faint border border-dashed border-line rounded">
                  暂无人物设定，点击右上角「添加人物」或上方「AI 生成」一键提取
                </div>
              ) : (
                characters.map((char) => (
                  <div key={char.id} className="p-3 bg-paper rounded border border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={char.name}
                          onChange={(e) => handleUpdateCharacter(char.id, { name: e.target.value })}
                          placeholder="姓名"
                          className="font-bold text-xs bg-transparent border-b border-line-strong text-ink focus:outline-none w-24"
                        />
                        <input
                          type="text"
                          value={char.role}
                          onChange={(e) => handleUpdateCharacter(char.id, { role: e.target.value })}
                          placeholder="身份/关系"
                          className="text-xs bg-transparent border-b border-line-strong text-ink-muted focus:outline-none w-32"
                        />
                      </div>
                      <button
                        onClick={() => handleDeleteCharacter(char.id)}
                        className="text-danger hover:text-danger p-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <textarea
                      value={char.notes}
                      onChange={(e) => handleUpdateCharacter(char.id, { notes: e.target.value })}
                      rows={2}
                      placeholder="声线特点、动作习惯、内心动机……"
                      className="w-full p-2 text-xs bg-paper border border-line rounded focus:outline-none"
                    />
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 4: Motifs */}
          {activeTab === 'motifs' && (
            <div className="space-y-3">
              <ProfilingToolbar
                moduleLabel="意象网络"
                isLoading={profilingLoading.motifs}
                canRefine={motifs.length > 0}
                onRun={handleRunMotifs}
                loadingText="正在通读全篇，提取核心意象……"
              />

              {motifPreview && (
                <ItemPreviewPanel
                  mode={motifPreviewMode}
                  items={motifPreview}
                  kind="motifs"
                  onToggle={(idx, selected) =>
                    setMotifPreview((prev) =>
                      prev ? prev.map((m, i) => (i === idx ? { ...m, selected } : m)) : prev
                    )
                  }
                  onUpdate={handleUpdateMotifPreview}
                  onRemove={(idx) =>
                    setMotifPreview((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev))
                  }
                  onApply={handleApplyMotifPreview}
                  applyLabel={motifPreviewMode === 'generate' ? '合并入列表' : '替换列表'}
                  dedupeHint={motifDedupeHint || undefined}
                />
              )}

              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] text-ink-muted">
                  记录反复出现的核心意象与物性载体：
                </span>
                <button
                  onClick={handleAddMotif}
                  className="flex items-center space-x-1 text-cinnabar hover:text-ink text-xs font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>添加意象</span>
                </button>
              </div>

              {motifs.length === 0 ? (
                <div className="py-8 text-center text-ink-faint border border-dashed border-line rounded">
                  暂无意象网络，点击右上角「添加意象」或上方「AI 生成」一键提取
                </div>
              ) : (
                motifs.map((motif) => (
                  <div key={motif.id} className="p-3 bg-paper rounded border border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={motif.name}
                        onChange={(e) => handleUpdateMotif(motif.id, { name: e.target.value })}
                        placeholder="意象名称 (如: 卷帘门、雨水)"
                        className="font-bold text-xs bg-transparent border-b border-line-strong text-ink focus:outline-none w-36"
                      />
                      <button
                        onClick={() => handleDeleteMotif(motif.id)}
                        className="text-danger hover:text-danger p-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <textarea
                      value={motif.description}
                      onChange={(e) => handleUpdateMotif(motif.id, { description: e.target.value })}
                      rows={2}
                      placeholder="意象承担的叙事功能、感官特征……"
                      className="w-full p-2 text-xs bg-paper border border-line rounded focus:outline-none"
                    />
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 5: Scene Splits */}
          {activeTab === 'scene_splits' && (
            <div className="space-y-3">
              <div className="p-3 bg-paper-sunken rounded border border-line text-[11px] text-ink-muted leading-relaxed">
                AI 智能识别转折锚点，并在本地对全篇正文（约 {manuscriptContent.length} 字）进行高保真无损切分，保证 100% 零丢字、零改写。
                当前书稿共有 {scenes.length} 场——应用切分将替换现有分场结构。随时可在全篇基础上重新切分。
              </div>

              <ProfilingToolbar
                moduleLabel="智能分场"
                isLoading={profilingLoading.scene_splits}
                canRefine={scenes.length > 0}
                onRun={handleRunSplits}
                generateLabel="AI 全篇分场"
                loadingText="正在通读全篇提炼分场锚点……"
              />

              {splitsSuccessMsg && (
                <div className="p-3 bg-ok/10 border border-ok/30 rounded text-ok text-xs">{splitsSuccessMsg}</div>
              )}

              {splitsPreview && (
                <div className="bg-paper-sunken/50 border border-cinnabar/30 rounded-lg p-3 space-y-3">
                  {/* Coverage check */}
                  {(() => {
                    const pct = Math.round(splitsCoverage * 100);
                    const ok = splitsCoverage >= 0.95;
                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={`font-bold ${ok ? 'text-ok' : 'text-danger'}`}>
                            {ok ? `本地高保真切分 · 完整覆盖全文 ${pct}%` : `警告：拼接后仅覆盖全文约 ${pct}%，建议检查`}
                          </span>
                          <span className="text-ink-faint font-mono text-[10px]">
                            {splitsPreview.length} 场
                          </span>
                        </div>
                        <div className="h-1.5 bg-paper-sunken rounded overflow-hidden">
                          <div
                            className={`h-full ${ok ? 'bg-ok' : 'bg-danger'}`}
                            style={{ width: `${Math.max(4, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
                    {splitsPreview.map((split, idx) => (
                      <div key={idx} className="p-2.5 bg-paper rounded border border-line">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 flex-1 overflow-hidden">
                            <span className="text-[10px] shrink-0 font-mono text-cinnabar">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="font-bold text-xs truncate">{split.title}</span>
                          </div>
                          <button
                            onClick={() =>
                              setExpandedSplitIdx(expandedSplitIdx === idx ? null : idx)
                            }
                            className="text-[10px] text-ink-muted hover:text-ink flex items-center space-x-1 shrink-0 ml-2"
                          >
                            <span>{expandedSplitIdx === idx ? '收起正文' : '展开正文'}</span>
                          </button>
                        </div>
                        {split.summary && (
                          <p className="text-[11px] text-ink-muted leading-relaxed mt-1 line-clamp-2">
                            {split.summary}
                          </p>
                        )}
                        <div className="text-[10px] text-ink-faint font-mono mt-1">
                          ~{(split.content || '').length} 字
                        </div>
                        {expandedSplitIdx === idx && (
                          <pre className="mt-2 p-2 bg-paper-sunken rounded border border-line text-[11px] font-serif text-ink whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                            {split.content}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleApplySplits}
                    disabled={splitsPreview.length <= 1}
                    title={splitsPreview.length <= 1 ? '至少需要 2 场才能替换' : undefined}
                    className="w-full px-3 py-1.5 bg-cinnabar hover:bg-cinnabar-strong text-white text-[11px] font-medium rounded shadow-xs transition-colors disabled:opacity-50"
                  >
                    替换现有分场（删除 {scenes.length} 场，新建 {splitsPreview.length} 场）
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
