import React, { useState } from 'react';
import type { LiteraryLens } from '../../types';
import { X, Sliders, Plus, Trash2 } from 'lucide-react';

interface LensEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  lenses: LiteraryLens[];
  onSaveLenses: (lenses: LiteraryLens[]) => void;
}

export const LensEditorModal: React.FC<LensEditorModalProps> = ({
  isOpen,
  onClose,
  lenses,
  onSaveLenses,
}) => {
  const [lensList, setLensList] = useState<LiteraryLens[]>(lenses);
  const [selectedLensId, setSelectedLensId] = useState<string>(lenses[0]?.id || '');

  if (!isOpen) return null;

  const currentLens = lensList.find((l) => l.id === selectedLensId) || lensList[0];

  const handleUpdate = (updates: Partial<LiteraryLens>) => {
    setLensList((prev) =>
      prev.map((l) => (l.id === selectedLensId ? { ...l, ...updates } : l))
    );
  };

  const handleAddNew = () => {
    const newLens: LiteraryLens = {
      id: `lens-custom-${Date.now()}`,
      name: '新文学透镜',
      description: '针对特定风格或美学维度的定制化文学审读视角。',
      promptInstruction: '作为文学编辑，重点审查该段落中……',
      icon: 'Sliders',
      isBuiltIn: false,
    };
    setLensList((prev) => [...prev, newLens]);
    setSelectedLensId(newLens.id);
  };

  const handleDelete = (id: string) => {
    const next = lensList.filter((l) => l.id !== id);
    setLensList(next);
    if (selectedLensId === id && next.length > 0) {
      setSelectedLensId(next[0].id);
    }
  };

  const handleSave = () => {
    onSaveLenses(lensList);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-paper rounded-lg shadow-xl border border-line flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-cinnabar" />
            <h2 className="font-serif text-sm font-bold text-ink">
              文学透镜管理 (Literary Lenses)
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
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-3 gap-4 font-serif text-xs">
          {/* Lens List */}
          <div className="border-r border-line pr-3 space-y-1.5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-ink-muted uppercase text-[10px] tracking-wider">
                所有透镜
              </span>
              <button
                onClick={handleAddNew}
                className="flex items-center space-x-1 text-cinnabar hover:text-ink text-[11px]"
              >
                <Plus className="w-3 h-3" />
                <span>新建</span>
              </button>
            </div>

            {lensList.map((lens) => (
              <div
                key={lens.id}
                onClick={() => setSelectedLensId(lens.id)}
                className={`p-2 rounded cursor-pointer transition-colors flex items-center justify-between ${
                  lens.id === selectedLensId
                    ? 'bg-paper-sunken text-ink font-semibold'
                    : 'hover:bg-paper-sunken text-ink-muted'
                }`}
              >
                <span className="truncate">{lens.name}</span>
                {lens.isBuiltIn && (
                  <span className="text-[9px] px-1 py-0.2 bg-line-strong/50 rounded text-ink-muted">
                    内置
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Lens Form */}
          <div className="md:col-span-2 space-y-3">
            {currentLens ? (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <h3 className="font-bold text-ink">
                    编辑透镜: {currentLens.name}
                  </h3>
                  {!currentLens.isBuiltIn && (
                    <button
                      onClick={() => handleDelete(currentLens.id)}
                      className="text-danger hover:text-danger text-[11px] flex items-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>删除</span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-ink-muted mb-1">
                    透镜名称 (Lens Name)
                  </label>
                  <input
                    type="text"
                    value={currentLens.name}
                    onChange={(e) => handleUpdate({ name: e.target.value })}
                    className="w-full p-2 bg-paper border border-line-strong rounded text-ink focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-ink-muted mb-1">
                    简要说明 (Description)
                  </label>
                  <input
                    type="text"
                    value={currentLens.description}
                    onChange={(e) => handleUpdate({ description: e.target.value })}
                    className="w-full p-2 bg-paper border border-line-strong rounded text-ink focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-ink-muted mb-1">
                    审读指令要求 (Prompt Directive)
                  </label>
                  <textarea
                    value={currentLens.promptInstruction}
                    onChange={(e) => handleUpdate({ promptInstruction: e.target.value })}
                    rows={5}
                    className="w-full p-2.5 bg-paper border border-line-strong rounded text-ink focus:outline-none leading-relaxed"
                  />
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-ink-muted">请选择或新建一个透镜</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-line space-x-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-ink-muted hover:text-ink"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs bg-cinnabar hover:bg-cinnabar-strong text-white font-medium rounded shadow-xs"
          >
            保存透镜配置
          </button>
        </div>
      </div>
    </div>
  );
};
