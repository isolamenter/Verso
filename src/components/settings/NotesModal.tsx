import React, { useState } from 'react';
import type { Manuscript, CharacterItem, MotifItem } from '../../types';
import { X, Users, Eye, Plus, Trash2 } from 'lucide-react';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  manuscript: Manuscript | null;
  onUpdateManuscript: (updates: Partial<Manuscript>) => void;
  defaultTab?: 'characters' | 'motifs';
}

export const NotesModal: React.FC<NotesModalProps> = ({
  isOpen,
  onClose,
  manuscript,
  onUpdateManuscript,
  defaultTab = 'characters',
}) => {
  const [activeTab, setActiveTab] = useState<'characters' | 'motifs'>(defaultTab);
  const [characters, setCharacters] = useState<CharacterItem[]>(manuscript?.characters || []);
  const [motifs, setMotifs] = useState<MotifItem[]>(manuscript?.motifs || []);

  // Sync with prop updates
  React.useEffect(() => {
    if (manuscript) {
      setCharacters(manuscript.characters || []);
      setMotifs(manuscript.motifs || []);
    }
  }, [manuscript]);

  if (!isOpen || !manuscript) return null;

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
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveTab('characters')}
              className={`flex items-center space-x-1.5 text-xs font-bold font-serif pb-0.5 border-b-2 transition-colors ${
                activeTab === 'characters'
                  ? 'border-cinnabar text-ink'
                  : 'border-transparent text-ink-muted'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>人物小传与声线 ({characters.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('motifs')}
              className={`flex items-center space-x-1.5 text-xs font-bold font-serif pb-0.5 border-b-2 transition-colors ${
                activeTab === 'motifs'
                  ? 'border-cinnabar text-ink'
                  : 'border-transparent text-ink-muted'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>核心意象网络 ({motifs.length})</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-ink-muted hover:text-ink rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 font-serif text-xs">
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

              {characters.map((char) => (
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
                        className="text-xs bg-transparent border-b border-line-strong text-ink-muted dark:text-[#BBB2A5] focus:outline-none w-32"
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
              ))}
            </div>
          )}

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

              {motifs.map((motif) => (
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
