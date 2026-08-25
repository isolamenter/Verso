import React from 'react';
import type { LiteraryLens } from '../../types';
import { Sliders, Plus, Scissors, Feather, Compass, MessageSquare, Check } from 'lucide-react';

interface LensSelectorProps {
  lenses: LiteraryLens[];
  activeLensId: string | null;
  onSelectLens: (lensId: string | null) => void;
  onOpenLensEditor: () => void;
}

export const LensSelector: React.FC<LensSelectorProps> = ({
  lenses,
  activeLensId,
  onSelectLens,
  onOpenLensEditor,
}) => {
  const getLensIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Scissors': return <Scissors className="w-3 h-3" />;
      case 'Feather': return <Feather className="w-3 h-3" />;
      case 'Compass': return <Compass className="w-3 h-3" />;
      case 'MessageSquare': return <MessageSquare className="w-3 h-3" />;
      default: return <Sliders className="w-3 h-3" />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-ink-muted">
          文学透镜 (Critic Lens):
        </span>
        <button
          onClick={onOpenLensEditor}
          className="flex items-center space-x-1 text-[11px] text-cinnabar hover:text-cinnabar-strong transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>新建透镜</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onSelectLens(null)}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs transition-colors font-serif ${
            activeLensId === null
              ? 'bg-ink text-paper font-medium'
              : 'bg-paper-sunken hover:bg-line text-ink-muted'
          }`}
        >
          <span>标准审读</span>
          {activeLensId === null && <Check className="w-3 h-3 ml-0.5" />}
        </button>

        {lenses.map((lens) => {
          const isSelected = activeLensId === lens.id;
          return (
            <button
              key={lens.id}
              onClick={() => onSelectLens(isSelected ? null : lens.id)}
              title={lens.description}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs transition-colors font-serif ${
                isSelected
                  ? 'bg-ink text-paper font-medium'
                  : 'bg-paper-sunken hover:bg-line text-ink-muted'
              }`}
            >
              {getLensIcon(lens.icon)}
              <span>{lens.name}</span>
              {isSelected && <Check className="w-3 h-3 ml-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
