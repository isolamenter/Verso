import React from 'react';
import type { PaperTheme, TypographyFamily, EditorStats } from '../../types';
import {
  PanelLeft,
  PanelRight,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { VersoLogo } from './VersoLogo';

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isStudioOpen: boolean;
  onToggleStudio: () => void;
  sceneTitle: string;
  stats: EditorStats;
  paperTheme: PaperTheme;
  onThemeChange: (theme: PaperTheme) => void;
  typography: TypographyFamily;
  onTypographyChange: (typo: TypographyFamily) => void;
  typewriterMode: boolean;
  onToggleTypewriter: () => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  activeProfileName: string;
  onOpenSettings: () => void;
}

const THEMES: { id: PaperTheme; label: string; hint: string }[] = [
  { id: 'parchment', label: '纸', hint: '羊皮纸 · 温润' },
  { id: 'frost', label: '霜', hint: '霜白 · 冷调' },
  { id: 'ink', label: '墨', hint: '水墨 · 暗室' },
];

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  isStudioOpen,
  onToggleStudio,
  sceneTitle,
  stats,
  paperTheme,
  onThemeChange,
  typography,
  onTypographyChange,
  typewriterMode,
  onToggleTypewriter,
  focusMode,
  onToggleFocus,
  activeProfileName,
  onOpenSettings,
}) => {
  return (
    <header className="h-12 border-b border-line bg-paper px-3.5 flex items-center justify-between select-none z-10">
      {/* Left controls */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onToggleSidebar}
          className={`p-1.5 rounded transition-colors ${
            isSidebarOpen
              ? 'bg-ink text-paper'
              : 'text-ink-muted hover:text-ink hover:bg-paper-sunken'
          }`}
          title="文稿与场景 (Cmd/Ctrl + B)"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-line mx-1" />

        <div className="flex items-center space-x-1.5 text-xs font-serif text-ink">
          <VersoLogo size={16} />
          <span className="font-semibold tracking-wide">{sceneTitle || 'Verso'}</span>
        </div>
      </div>

      {/* Center Stats (literary counts) */}
      <div className="hidden md:flex items-center space-x-3 text-[11px] font-serif text-ink-muted">
        <span>
          汉字{' '}
          <strong className="text-ink font-mono font-medium">{stats?.chineseCharacters ?? 0}</strong>
        </span>
        <span className="text-ink-faint">·</span>
        <span>
          段落{' '}
          <strong className="text-ink font-mono font-medium">{stats?.paragraphs ?? 0}</strong>
        </span>
        <span className="text-ink-faint">·</span>
        <span>
          阅读 约{' '}
          <strong className="text-ink font-mono font-medium">{stats?.readingTimeMinutes ?? 0}</strong>{' '}
          分钟
        </span>
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-1.5">
        {/* Typewriter Scroll Toggle */}
        <button
          onClick={onToggleTypewriter}
          className={`px-2 py-1 text-xs rounded font-serif transition-colors ${
            typewriterMode
              ? 'bg-ink text-paper'
              : 'text-ink-muted hover:text-ink hover:bg-paper-sunken'
          }`}
          title="打字机视口居中滚动"
        >
          打字机
        </button>

        {/* Focus Mode Toggle */}
        <button
          onClick={onToggleFocus}
          className={`p-1.5 rounded transition-colors ${
            focusMode
              ? 'bg-ink text-paper'
              : 'text-ink-muted hover:text-ink hover:bg-paper-sunken'
          }`}
          title="全屏专注模式 (Esc / Cmd/Ctrl + Shift + F)"
        >
          {focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Paper Theme Switcher — text, not icons */}
        <div className="flex items-center bg-paper-sunken rounded p-0.5 space-x-0.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => onThemeChange(t.id)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-serif leading-none transition-colors ${
                paperTheme === t.id
                  ? 'bg-paper text-ink shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
              title={t.hint}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Typography Switcher */}
        <button
          onClick={() => {
            const list: TypographyFamily[] = ['serif', 'kaiti', 'sans', 'mono'];
            const next = list[(list.indexOf(typography) + 1) % list.length];
            onTypographyChange(next);
          }}
          className="px-2 py-1 text-xs text-ink-muted hover:text-ink hover:bg-paper-sunken rounded font-serif transition-colors"
          title={`切换字体 (当前: ${typography})`}
        >
          {typography === 'serif' ? '宋体' : typography === 'kaiti' ? '楷体' : typography === 'sans' ? '黑体' : '等宽'}
        </button>

        {/* BYOK & Privacy Settings Trigger */}
        <button
          onClick={onOpenSettings}
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
            !activeProfileName || activeProfileName === '未配置' || activeProfileName === '默认引擎'
              ? 'bg-cinnabar/10 text-cinnabar hover:bg-cinnabar/20'
              : 'text-ink-muted hover:text-ink hover:bg-paper-sunken'
          }`}
          title="模型与 BYOK 密钥配置"
        >
          {!activeProfileName || activeProfileName === '未配置' || activeProfileName === '默认引擎' ? (
            <ShieldAlert className="w-3.5 h-3.5 text-cinnabar" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-ok" />
          )}
          <span className="hidden sm:inline font-serif text-[11px] truncate max-w-[110px]">
            {activeProfileName && activeProfileName !== '默认引擎' ? activeProfileName : '配置 API Key'}
          </span>
          <SlidersHorizontal className="w-3 h-3 ml-0.5 opacity-60" />
        </button>

        {/* Studio Toggle */}
        <button
          onClick={onToggleStudio}
          className={`p-1.5 rounded transition-colors ${
            isStudioOpen
              ? 'bg-ink text-paper'
              : 'text-ink-muted hover:text-ink hover:bg-paper-sunken'
          }`}
          title="文学编辑室 (Cmd/Ctrl + J)"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
