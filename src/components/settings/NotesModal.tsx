import React, { useState } from 'react';
import type { Manuscript, CharacterItem, MotifItem } from '../../types';
import { X, Users, Eye, BookOpen, Plus, Trash2, Sparkles } from 'lucide-react';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  manuscript: Manuscript | null;
  onUpdateManuscript: (updates: Partial<Manuscript>) => void;
  defaultTab?: 'synopsis' | 'characters' | 'motifs';
}

export const NotesModal: React.FC<NotesModalProps> = ({
  isOpen,
  onClose,
  manuscript,
  onUpdateManuscript,
  defaultTab = 'synopsis',
}) => {
  const [activeTab, setActiveTab] = useState<'synopsis' | 'characters' | 'motifs'>(defaultTab);
  const [title, setTitle] = useState(manuscript?.title || '');
  const [genre, setGenre] = useState<Manuscript['genre']>(manuscript?.genre || 'short_story');
  const [synopsis, setSynopsis] = useState(manuscript?.synopsis || '');
  const [notes, setNotes] = useState(manuscript?.notes || '');
  const [characters, setCharacters] = useState<CharacterItem[]>(manuscript?.characters || []);
  const [motifs, setMotifs] = useState<MotifItem[]>(manuscript?.motifs || []);

  // Sync with prop updates
  React.useEffect(() => {
    if (manuscript) {
      setTitle(manuscript.title || '');
      setGenre(manuscript.genre || 'short_story');
      setSynopsis(manuscript.synopsis || '');
      setNotes(manuscript.notes || '');
      setCharacters(manuscript.characters || []);
      setMotifs(manuscript.motifs || []);
    }
  }, [manuscript]);

  React.useEffect(() => {
    if (isOpen && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-paper rounded-lg shadow-xl border border-line flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <div className="flex items-center space-x-3 overflow-x-auto">
            <button
              onClick={() => setActiveTab('synopsis')}
              className={`flex items-center space-x-1.5 text-xs font-bold font-serif pb-0.5 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'synopsis'
                  ? 'border-cinnabar text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>故事梗概与主题</span>
            </button>

            <button
              onClick={() => setActiveTab('characters')}
              className={`flex items-center space-x-1.5 text-xs font-bold font-serif pb-0.5 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'characters'
                  ? 'border-cinnabar text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>人物小传与声线 ({characters.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('motifs')}
              className={`flex items-center space-x-1.5 text-xs font-bold font-serif pb-0.5 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'motifs'
                  ? 'border-cinnabar text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>核心意象网络 ({motifs.length})</span>
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
          {/* Tab 1: Synopsis & Themes */}
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
                  <span className="text-[10px] text-ink-faint font-mono">
                    {synopsis.length} 字
                  </span>
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

              {/* Deep Theme & Notes */}
              <div className="p-3.5 bg-paper rounded border border-line space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-bold text-ink text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-cinnabar" />
                    <span>主题与创作备忘 (Notes)</span>
                  </div>
                  <span className="text-[10px] text-ink-faint font-mono">
                    {notes.length} 字
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  提炼深层隐秘矛盾、叙事意图与全局写作备忘（如叙述视角、修辞风格、立意深度）：
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => handleUpdateNotes(e.target.value)}
                  rows={4}
                  placeholder="例如：表面是关于老街拆迁的伦理纠纷，深层实质是关于消逝故土的抵抗；全篇保持第三人称内聚焦，尽量避免直接心理描写……"
                  className="w-full p-2 text-xs bg-paper border border-line rounded text-ink focus:outline-none focus:border-cinnabar leading-relaxed resize-y"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Characters */}
          {activeTab === 'characters' && (
            <div className="space-y-3">
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
                  暂无人物设定，点击右上角「添加人物」或在侧栏使用「AI 建档」一键提取
                </div>
              ) : (
                characters.map((char) => (
                  <div
                    key={char.id}
                    className="p-3 bg-paper rounded border border-line space-y-2"
                  >
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

          {/* Tab 3: Motifs */}
          {activeTab === 'motifs' && (
            <div className="space-y-3">
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
                  暂无意象网络，点击右上角「添加意象」或使用「AI 建档」一键提取
                </div>
              ) : (
                motifs.map((motif) => (
                  <div
                    key={motif.id}
                    className="p-3 bg-paper rounded border border-line space-y-2"
                  >
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
        </div>
      </div>
    </div>
  );
};
