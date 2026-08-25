import React, { useState, useCallback } from 'react';
import type {
  Manuscript,
  ManuscriptProfileResult,
  CharacterItem,
  MotifItem,
  SceneSplitSuggestion
} from '../../types';
import {
  X,
  Sparkles,
  Check,
  Users,
  Eye,
  BookOpen,
  Split,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface ImportAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  manuscript: Manuscript | null;
  sceneContent: string;
  isLoading: boolean;
  onRunProfile: (title: string, content: string) => Promise<ManuscriptProfileResult>;
  onApplyProfile: (
    manuscriptId: string,
    data: {
      synopsis?: string;
      characters?: CharacterItem[];
      motifs?: MotifItem[];
      sceneSplits?: SceneSplitSuggestion[];
    }
  ) => Promise<void>;
}

export const ImportAssistantModal: React.FC<ImportAssistantModalProps> = ({
  isOpen,
  onClose,
  manuscript,
  sceneContent,
  isLoading,
  onRunProfile,
  onApplyProfile,
}) => {
  const [profileResult, setProfileResult] = useState<ManuscriptProfileResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editable local state
  const [synopsis, setSynopsis] = useState('');
  const [applySynopsis, setApplySynopsis] = useState(true);

  const [characters, setCharacters] = useState<(CharacterItem & { selected: boolean })[]>([]);
  const [motifs, setMotifs] = useState<(MotifItem & { selected: boolean })[]>([]);

  const [sceneSplits, setSceneSplits] = useState<SceneSplitSuggestion[]>([]);
  const [applySplits, setApplySplits] = useState(false);

  const [activeTab, setActiveTab] = useState<'overview' | 'characters' | 'motifs' | 'splits'>('overview');

  const handleTriggerProfiling = useCallback(async () => {
    if (!manuscript) return;
    setErrorMsg(null);
    try {
      const result = await onRunProfile(manuscript.title, sceneContent);
      setProfileResult(result);
      setSynopsis(result.synopsis || '');
      setApplySynopsis(Boolean(result.synopsis));

      setCharacters(
        (result.characters || []).map((c) => ({
          ...c,
          selected: true,
        }))
      );

      setMotifs(
        (result.motifs || []).map((m) => ({
          ...m,
          selected: true,
        }))
      );

      const splits = result.sceneSplits || [];
      setSceneSplits(splits);
      setApplySplits(splits.length > 1);
    } catch (err: any) {
      setErrorMsg(err.message || 'AI 文学建档分析失败，请检查模型与 API Key 配置。');
    }
  }, [manuscript, sceneContent, onRunProfile]);

  if (!isOpen || !manuscript) return null;

  const handleApply = async () => {
    if (!manuscript) return;

    const selectedChars = characters.filter((c) => c.selected);
    const selectedMotifs = motifs.filter((m) => m.selected);

    await onApplyProfile(manuscript.id, {
      synopsis: applySynopsis ? synopsis : undefined,
      characters: selectedChars,
      motifs: selectedMotifs,
      sceneSplits: applySplits && sceneSplits.length > 1 ? sceneSplits : undefined,
    });

    onClose();
  };

  const handleAddCharacter = () => {
    const newChar: CharacterItem & { selected: boolean } = {
      id: `char-custom-${Date.now()}`,
      name: '新人物',
      role: '主要人物',
      notes: '',
      selected: true,
    };
    setCharacters((prev) => [...prev, newChar]);
  };

  const handleAddMotif = () => {
    const newMotif: MotifItem & { selected: boolean } = {
      id: `motif-custom-${Date.now()}`,
      name: '新意象',
      description: '',
      selected: true,
    };
    setMotifs((prev) => [...prev, newMotif]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-paper rounded-lg shadow-xl border border-line flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-cinnabar" />
            <h2 className="font-serif text-sm font-bold text-ink">
              文稿文学建档与智能解构助手 (Manuscript Onboarding)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-ink-muted hover:text-ink rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-serif text-xs">
          {/* Top Info Banner */}
          <div className="p-3 bg-paper-sunken rounded border border-line flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-cinnabar shrink-0" />
              <div>
                <span className="font-bold text-ink">《{manuscript.title}》</span>
                <span className="text-ink-muted ml-2 font-mono text-[11px]">
                  正文字数: ~{sceneContent.length} 字
                </span>
              </div>
            </div>
            <button
              onClick={handleTriggerProfiling}
              disabled={isLoading}
              className="px-2.5 py-1 bg-paper hover:bg-paper-raise border border-line-strong text-ink text-[11px] rounded transition-colors disabled:opacity-50 flex items-center space-x-1"
            >
              <Sparkles className="w-3 h-3 text-cinnabar" />
              <span>{isLoading ? '正在分析……' : '重新分析'}</span>
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-7 h-7 border-2 border-cinnabar border-t-transparent rounded-full animate-spin"></div>
              <p className="text-ink-muted font-serif text-xs">
                正在通读全篇，提炼故事梗概、人物声线、核心意象与分场结构……
              </p>
            </div>
          )}

          {/* Error State */}
          {errorMsg && !isLoading && (
            <div className="p-4 bg-danger/10 border border-danger/30 rounded text-danger text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">建档分析遇到问题</div>
                <div className="mt-1 text-[11px] leading-relaxed">{errorMsg}</div>
                <button
                  onClick={handleTriggerProfiling}
                  className="mt-2 px-3 py-1 bg-paper text-ink border border-line rounded text-[11px]"
                >
                  重试
                </button>
              </div>
            </div>
          )}

          {/* Initial Pre-analysis Callout */}
          {!profileResult && !isLoading && !errorMsg && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-paper-sunken flex items-center justify-center border border-line">
                <Sparkles className="w-6 h-6 text-cinnabar" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-ink text-sm">启动 AI 严肃文学建档</h3>
                <p className="text-ink-muted text-[11px] leading-relaxed">
                  AI 将通读文稿《{manuscript.title}》（共 ~{sceneContent.length} 字），提炼出【故事梗概与深层矛盾】、【人物小传与对白声线】、【核心意象网络】以及【长文智能分场建议】。
                </p>
              </div>
              <button
                onClick={handleTriggerProfiling}
                className="px-4 py-2 bg-cinnabar hover:bg-cinnabar-strong text-white font-medium rounded shadow-xs text-xs flex items-center space-x-1.5 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>开始深度建档与解构</span>
              </button>
            </div>
          )}

          {/* Result Content */}
          {profileResult && !isLoading && (
            <>
              {/* Tab navigation */}
              <div className="flex items-center space-x-1 border-b border-line pb-1 text-xs">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 py-1 rounded transition-colors flex items-center space-x-1.5 ${
                    activeTab === 'overview'
                      ? 'bg-paper-sunken font-bold text-ink'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>故事梗概与深层主题</span>
                </button>

                <button
                  onClick={() => setActiveTab('characters')}
                  className={`px-3 py-1 rounded transition-colors flex items-center space-x-1.5 ${
                    activeTab === 'characters'
                      ? 'bg-paper-sunken font-bold text-ink'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>人物小传与声线 ({characters.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('motifs')}
                  className={`px-3 py-1 rounded transition-colors flex items-center space-x-1.5 ${
                    activeTab === 'motifs'
                      ? 'bg-paper-sunken font-bold text-ink'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>核心意象网络 ({motifs.length})</span>
                </button>

                {sceneSplits.length > 1 && (
                  <button
                    onClick={() => setActiveTab('splits')}
                    className={`px-3 py-1 rounded transition-colors flex items-center space-x-1.5 ${
                      activeTab === 'splits'
                        ? 'bg-paper-sunken font-bold text-ink'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <Split className="w-3.5 h-3.5" />
                    <span>智能分场建议 ({sceneSplits.length})</span>
                  </button>
                )}
              </div>

              {/* Tab 1: Overview & Synopsis */}
              {activeTab === 'overview' && (
                <div className="space-y-4 pt-1">
                  {profileResult.themeAnalysis && (
                    <div className="p-3 bg-paper-sunken rounded border border-line space-y-1">
                      <div className="text-[11px] font-bold text-cinnabar">
                        深层文学矛盾与主题剖析 (Subtext)
                      </div>
                      <p className="text-xs text-ink leading-relaxed">
                        {profileResult.themeAnalysis}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applySynopsis}
                          onChange={(e) => setApplySynopsis(e.target.checked)}
                          className="rounded text-cinnabar focus:ring-0"
                        />
                        <span className="font-bold text-ink">
                          采纳并写入书稿故事梗概 (Synopsis)
                        </span>
                      </label>
                      <span className="text-[10px] text-ink-muted font-mono">
                        {synopsis.length} 字
                      </span>
                    </div>

                    <textarea
                      value={synopsis}
                      onChange={(e) => setSynopsis(e.target.value)}
                      rows={5}
                      className="w-full p-2.5 bg-paper border border-line-strong rounded text-ink focus:outline-none leading-relaxed text-xs"
                      placeholder="故事梗概与核心行动线……"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Characters */}
              {activeTab === 'characters' && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-ink-muted">
                      勾选需要保留并导入至「文学备忘」的人物角色：
                    </p>
                    <button
                      onClick={handleAddCharacter}
                      className="flex items-center space-x-1 text-cinnabar hover:text-ink text-[11px]"
                    >
                      <Plus className="w-3 h-3" />
                      <span>添加人物</span>
                    </button>
                  </div>

                  {characters.length === 0 ? (
                    <div className="text-center py-8 text-ink-muted">未提取到明显的人物设定</div>
                  ) : (
                    <div className="space-y-2.5 max-h-[48vh] overflow-y-auto pr-1">
                      {characters.map((char, idx) => (
                        <div
                          key={char.id}
                          className={`p-3 rounded border transition-all ${
                            char.selected
                              ? 'bg-paper-sunken border-line'
                              : 'bg-paper/50 border-line/60 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={char.selected}
                                onChange={(e) =>
                                  setCharacters((prev) =>
                                    prev.map((c, i) =>
                                      i === idx ? { ...c, selected: e.target.checked } : c
                                    )
                                  )
                                }
                                className="rounded text-cinnabar focus:ring-0"
                              />
                              <input
                                type="text"
                                value={char.name}
                                onChange={(e) =>
                                  setCharacters((prev) =>
                                    prev.map((c, i) =>
                                      i === idx ? { ...c, name: e.target.value } : c
                                    )
                                  )
                                }
                                className="font-bold text-ink bg-transparent border-b border-dashed border-line focus:outline-none text-xs"
                                placeholder="角色名称"
                              />
                            </label>

                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={char.role}
                                onChange={(e) =>
                                  setCharacters((prev) =>
                                    prev.map((c, i) =>
                                      i === idx ? { ...c, role: e.target.value } : c
                                    )
                                  )
                                }
                                className="text-[10px] text-ink-muted bg-paper px-1.5 py-0.5 border border-line rounded focus:outline-none font-mono"
                                placeholder="角色定位"
                              />
                              <button
                                onClick={() =>
                                  setCharacters((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="text-ink-faint hover:text-danger p-0.5"
                                title="删除此人物"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <textarea
                            value={char.notes}
                            onChange={(e) =>
                              setCharacters((prev) =>
                                prev.map((c, i) =>
                                  i === idx ? { ...c, notes: e.target.value } : c
                                )
                              )
                            }
                            rows={2}
                            placeholder="性格质感、声线口吻、核心动机与潜台词习惯……"
                            className="w-full p-2 bg-paper border border-line rounded text-[11px] text-ink focus:outline-none leading-relaxed"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Motifs */}
              {activeTab === 'motifs' && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-ink-muted">
                      勾选需要保留并导入至「意象网络」的文学意象：
                    </p>
                    <button
                      onClick={handleAddMotif}
                      className="flex items-center space-x-1 text-cinnabar hover:text-ink text-[11px]"
                    >
                      <Plus className="w-3 h-3" />
                      <span>添加意象</span>
                    </button>
                  </div>

                  {motifs.length === 0 ? (
                    <div className="text-center py-8 text-ink-muted">未提取到明显的反复意象</div>
                  ) : (
                    <div className="space-y-2.5 max-h-[48vh] overflow-y-auto pr-1">
                      {motifs.map((motif, idx) => (
                        <div
                          key={motif.id}
                          className={`p-3 rounded border transition-all ${
                            motif.selected
                              ? 'bg-paper-sunken border-line'
                              : 'bg-paper/50 border-line/60 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={motif.selected}
                                onChange={(e) =>
                                  setMotifs((prev) =>
                                    prev.map((m, i) =>
                                      i === idx ? { ...m, selected: e.target.checked } : m
                                    )
                                  )
                                }
                                className="rounded text-cinnabar focus:ring-0"
                              />
                              <input
                                type="text"
                                value={motif.name}
                                onChange={(e) =>
                                  setMotifs((prev) =>
                                    prev.map((m, i) =>
                                      i === idx ? { ...m, name: e.target.value } : m
                                    )
                                  )
                                }
                                className="font-bold text-ink bg-transparent border-b border-dashed border-line focus:outline-none text-xs"
                                placeholder="意象名称"
                              />
                            </label>

                            <div className="flex items-center space-x-2">
                              {motif.occurrencesCount !== undefined && (
                                <span className="text-[10px] text-ink-faint font-mono">
                                  约 {motif.occurrencesCount} 处互文
                                </span>
                              )}
                              <button
                                onClick={() =>
                                  setMotifs((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="text-ink-faint hover:text-danger p-0.5"
                                title="删除此意象"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <textarea
                            value={motif.description}
                            onChange={(e) =>
                              setMotifs((prev) =>
                                prev.map((m, i) =>
                                  i === idx ? { ...m, description: e.target.value } : m
                                )
                              )
                            }
                            rows={2}
                            placeholder="意象的文学象征机理与出现情境……"
                            className="w-full p-2 bg-paper border border-line rounded text-[11px] text-ink focus:outline-none leading-relaxed"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Scene Splits */}
              {activeTab === 'splits' && sceneSplits.length > 1 && (
                <div className="space-y-3 pt-1">
                  <div className="p-3 bg-paper-sunken rounded border border-line space-y-2">
                    <label className="flex items-start space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applySplits}
                        onChange={(e) => setApplySplits(e.target.checked)}
                        className="rounded text-cinnabar focus:ring-0 mt-0.5"
                      />
                      <div>
                        <div className="font-bold text-ink">
                          采用智能分场重构（将文稿切分为 {sceneSplits.length} 个独立场景）
                        </div>
                        <p className="text-[11px] text-ink-muted leading-relaxed mt-0.5">
                          适合多章节长文。勾选后将自动按以下切分创建场景，并保留各场段落完整性。
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                    {sceneSplits.map((split, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded border border-line bg-paper space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono text-cinnabar">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="font-bold text-ink">{split.title}</span>
                          </div>
                          <span className="text-[10px] font-mono text-ink-faint">
                            ~{split.content.length} 字
                          </span>
                        </div>
                        {split.summary && (
                          <p className="text-[11px] text-ink-muted leading-tight">
                            {split.summary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-line">
          <div className="text-[11px] text-ink-muted font-serif flex items-center space-x-1">
            <HelpCircle className="w-3.5 h-3.5 text-cinnabar" />
            <span>所有建档数据将保存在浏览器本地 IndexedDB，随时可修改。</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-ink-muted hover:text-ink"
            >
              稍后自行填写
            </button>
            <button
              onClick={handleApply}
              disabled={isLoading || !profileResult}
              className="px-4 py-1.5 text-xs bg-cinnabar hover:bg-cinnabar-strong text-white font-medium rounded shadow-xs disabled:opacity-40 flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>一键写入书稿备忘</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
