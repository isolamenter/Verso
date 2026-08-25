import React from 'react';
import type { CritiqueCategory } from '../../types';
import {
  FileText,
  Feather,
  Activity,
  MessageSquare,
  Scissors,
  Eye,
  Compass,
  HelpCircle,
  PenLine
} from 'lucide-react';

interface FloatingMenuProps {
  position: { top: number; left: number } | null;
  onSelectAction: (category: CritiqueCategory) => void;
  selectedText: string;
}

export const FloatingMenu: React.FC<FloatingMenuProps> = ({
  position,
  onSelectAction,
  selectedText,
}) => {
  if (!position || !selectedText.trim()) return null;

  const actions: { category: CritiqueCategory; label: string; icon: React.ComponentType<any>; tip: string }[] = [
    { category: 'critique', label: '审读', icon: FileText, tip: '综合文学审读（叙述距离、冗余、情绪直接命名）' },
    { category: 'language', label: '语言', icon: Feather, tip: '语言质感（抽象词、陈词滥调、AI腔、动词张力）' },
    { category: 'rhythm', label: '节奏', icon: Activity, tip: '句式节奏与呼吸（长短句交替、停顿、单调重复）' },
    { category: 'dialogue', label: '对白', icon: MessageSquare, tip: '对白真实度（人物声音、潜台词、信息倾倒）' },
    { category: 'cut', label: '删削', icon: Scissors, tip: '克制减法（寻找可剔除的副词、半句、多余段落）' },
    { category: 'imagery', label: '意象', icon: Eye, tip: '意象网络与感官分布（象征露骨度、物态细节）' },
    { category: 'distance', label: '距离', icon: Compass, tip: '叙述距离与视角稳定性（叙述者介入、自由间接引语）' },
    { category: 'ask', label: '发问', icon: HelpCircle, tip: '针对当前选区向文学编辑提问' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: `${Math.max(10, position.top - 48)}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 50,
      }}
      className="flex items-center space-x-0.5 pl-2 pr-1.5 py-1 bg-paper text-ink rounded-md shadow-lg border border-line-strong animate-in fade-in zoom-in-95 duration-150"
    >
      {/* The red pencil marker */}
      <PenLine className="w-3.5 h-3.5 text-cinnabar shrink-0" />
      <div className="h-4 w-px bg-line mx-1" />

      {actions.map(({ category, label, icon: Icon, tip }) => (
        <button
          key={category}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelectAction(category);
          }}
          title={tip}
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
            category === 'cut'
              ? 'text-cinnabar hover:bg-cinnabar-soft hover:text-cinnabar-strong'
              : 'text-ink hover:bg-paper-sunken'
          }`}
        >
          <Icon className="w-3 h-3 opacity-80" />
          <span className="font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
};
