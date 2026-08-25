import React, { useState } from 'react';
import type { PromptTemplate, CritiqueCategory } from '../../types';
import { X, Sparkles, Plus, Trash2 } from 'lucide-react';

interface PromptLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: PromptTemplate[];
  onSaveTemplates: (templates: PromptTemplate[]) => void;
}

export const PromptLibraryModal: React.FC<PromptLibraryModalProps> = ({
  isOpen,
  onClose,
  templates,
  onSaveTemplates,
}) => {
  const [templateList, setTemplateList] = useState<PromptTemplate[]>(templates);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  if (!isOpen) return null;

  const filteredTemplates = templateList.filter((t) => {
    if (categoryFilter === 'all') return true;
    return t.category === categoryFilter;
  });

  const currentTemplate =
    filteredTemplates.find((t) => t.id === selectedTemplateId) ||
    filteredTemplates[0] ||
    templateList[0];

  const handleUpdate = (updates: Partial<PromptTemplate>) => {
    if (!currentTemplate) return;
    setTemplateList((prev) =>
      prev.map((t) => (t.id === currentTemplate.id ? { ...t, ...updates } : t))
    );
  };

  const handleAddNew = () => {
    const newTmpl: PromptTemplate = {
      id: `tmpl-custom-${Date.now()}`,
      name: '新文学审读提示词',
      description: '针对特定修辞维度或美学偏好的审读指令。',
      category: 'critique',
      promptTemplate: '作为文学编辑，重点审查选中文段中的……',
      isBuiltIn: false,
      createdAt: Date.now(),
    };
    setTemplateList((prev) => [...prev, newTmpl]);
    setSelectedTemplateId(newTmpl.id);
  };

  const handleDelete = (id: string) => {
    const next = templateList.filter((t) => t.id !== id);
    setTemplateList(next);
    if (selectedTemplateId === id && next.length > 0) {
      setSelectedTemplateId(next[0].id);
    }
  };

  const handleSave = () => {
    onSaveTemplates(templateList);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-paper rounded-lg shadow-xl border border-line flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-cinnabar" />
            <h2 className="font-serif text-sm font-bold text-ink">
              文学审读提示词库 (Prompt Library)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-ink-muted hover:text-ink rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-5 py-2 bg-paper-sunken/50 border-b border-line flex items-center justify-between text-xs font-serif">
          <div className="flex items-center space-x-2">
            <span className="text-ink-muted text-[11px]">分类:</span>
            {['all', 'critique', 'language', 'rhythm', 'dialogue', 'cut'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  categoryFilter === cat
                    ? 'bg-ink text-paper'
                    : 'text-ink-muted hover:bg-paper-sunken'
                }`}
              >
                {cat === 'all'
                  ? '全部'
                  : cat === 'critique'
                  ? '综合'
                  : cat === 'language'
                  ? '语言'
                  : cat === 'rhythm'
                  ? '节奏'
                  : cat === 'dialogue'
                  ? '对白'
                  : '删削'}
              </button>
            ))}
          </div>

          <button
            onClick={handleAddNew}
            className="flex items-center space-x-1 text-cinnabar hover:text-ink text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建模板</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-3 gap-4 font-serif text-xs">
          {/* Template List */}
          <div className="border-r border-line pr-3 space-y-1.5 max-h-[55vh] overflow-y-auto">
            {filteredTemplates.map((tmpl) => (
              <div
                key={tmpl.id}
                onClick={() => setSelectedTemplateId(tmpl.id)}
                className={`p-2 rounded cursor-pointer transition-colors flex items-center justify-between ${
                  tmpl.id === (currentTemplate?.id || '')
                    ? 'bg-paper-sunken text-ink font-semibold'
                    : 'hover:bg-paper-sunken text-ink-muted'
                }`}
              >
                <span className="truncate">{tmpl.name}</span>
                {tmpl.isBuiltIn && (
                  <span className="text-[9px] px-1 py-0.2 bg-line-strong/50 rounded text-ink-muted">
                    内置
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="md:col-span-2 space-y-3">
            {currentTemplate ? (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <h3 className="font-bold text-ink">
                    编辑提示词: {currentTemplate.name}
                  </h3>
                  {!currentTemplate.isBuiltIn && (
                    <button
                      onClick={() => handleDelete(currentTemplate.id)}
                      className="text-danger hover:text-danger text-[11px] flex items-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>删除</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-ink-muted mb-1">
                      模板名称
                    </label>
                    <input
                      type="text"
                      value={currentTemplate.name}
                      onChange={(e) => handleUpdate({ name: e.target.value })}
                      className="w-full p-2 bg-paper border border-line-strong rounded text-ink focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-ink-muted mb-1">
                      适用审读分类
                    </label>
                    <select
                      value={currentTemplate.category}
                      onChange={(e) =>
                        handleUpdate({ category: e.target.value as CritiqueCategory })
                      }
                      className="w-full p-2 bg-paper border border-line-strong rounded text-ink focus:outline-none"
                    >
                      <option value="critique">综合审读 (Critique)</option>
                      <option value="language">语言质感 (Language)</option>
                      <option value="rhythm">节奏呼吸 (Rhythm)</option>
                      <option value="dialogue">对白潜台词 (Dialogue)</option>
                      <option value="cut">删削减法 (Cut)</option>
                      <option value="imagery">意象网络 (Imagery)</option>
                      <option value="distance">叙述距离 (Distance)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-ink-muted mb-1">
                    简要说明 (Description)
                  </label>
                  <input
                    type="text"
                    value={currentTemplate.description}
                    onChange={(e) => handleUpdate({ description: e.target.value })}
                    className="w-full p-2 bg-paper border border-line-strong rounded text-ink focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-ink-muted mb-1">
                    审读提示词指令 (Prompt Directive)
                  </label>
                  <textarea
                    value={currentTemplate.promptTemplate}
                    onChange={(e) => handleUpdate({ promptTemplate: e.target.value })}
                    rows={6}
                    className="w-full p-2.5 bg-paper border border-line-strong rounded text-ink focus:outline-none leading-relaxed"
                  />
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-ink-muted">请选择或新建一个提示词模板</div>
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
            保存提示词库
          </button>
        </div>
      </div>
    </div>
  );
};
