import React from 'react';
import type { ContextSelectionConfig, Manuscript, Scene } from '../../types';
import { ShieldCheck, Info } from 'lucide-react';
import { buildLiteraryContext } from '../../utils/contextBuilder';

interface ContextInspectorProps {
  config: ContextSelectionConfig;
  onChange: (config: ContextSelectionConfig) => void;
  manuscript: Manuscript | null;
  scenes: Scene[];
  currentScene: Scene | null;
  selectedText: string;
  isColdReadTab?: boolean;
}

export const ContextInspector: React.FC<ContextInspectorProps> = ({
  config,
  onChange,
  manuscript,
  scenes,
  currentScene,
  selectedText,
  isColdReadTab = false,
}) => {
  // Use ContextBuilder to accurately compute tokens matching the REAL payload
  const builtContext = buildLiteraryContext(
    config,
    manuscript,
    scenes,
    currentScene,
    selectedText
  );

  if (isColdReadTab) {
    return (
      <div className="p-3 bg-ok/10 rounded border border-ok/30 text-xs font-serif">
        <div className="flex items-center space-x-1.5 font-bold text-ok">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>冷读盲审严格隔离保证</span>
        </div>
        <p className="mt-1.5 text-[11px] text-ok leading-relaxed">
          已自动剥离所有人物设定、核心意象、文学透镜及作者创作意图。发送内容仅包含《{currentScene?.title || '未命名场景'}》的纯文本正文 (~{builtContext.sections.find(s => s.id === 'current_scene')?.tokenCount || 0} Tokens)。
        </p>
      </div>
    );
  }


  const selectedSection = builtContext.sections.find((s) => s.id === 'selected_text');
  const currentSceneSection = builtContext.sections.find((s) => s.id === 'current_scene');
  const prevSceneSection = builtContext.sections.find((s) => s.id === 'previous_scene');
  const charNotesSection = builtContext.sections.find((s) => s.id === 'character_notes');
  const motifsSection = builtContext.sections.find((s) => s.id === 'motifs');
  const entireManuSection = builtContext.sections.find((s) => s.id === 'entire_manuscript');

  return (
    <div className="p-3 bg-paper-sunken rounded border border-line text-xs font-serif">
      <div className="flex items-center justify-between pb-2 border-b border-line">
        <div className="flex items-center space-x-1.5 font-bold text-ink">
          <ShieldCheck className="w-3.5 h-3.5 text-ok" />
          <span>Context 上下文透视与精确预算</span>
        </div>
        <span className="text-[11px] text-ink-faint font-mono">
          预估发送: ~{builtContext.totalTokens} Tokens
        </span>
      </div>

      <div className="mt-2.5 space-y-1.5 text-ink-muted">
        {/* Selected text */}
        <label className="flex items-center justify-between cursor-pointer hover:text-ink">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.includeSelectedText}
              onChange={(e) => onChange({ ...config, includeSelectedText: e.target.checked })}
              className="rounded border-line-strong accent-cinnabar focus:ring-0"
            />
            <span>当前选中文段 (Target Selection)</span>
          </div>
          <span className="text-[10px] text-ink-faint font-mono">
            {selectedSection?.tokenCount || 0} t
          </span>
        </label>

        {/* Current scene */}
        <label className="flex items-center justify-between cursor-pointer hover:text-ink">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.includeCurrentScene}
              onChange={(e) => onChange({ ...config, includeCurrentScene: e.target.checked })}
              className="rounded border-line-strong accent-cinnabar focus:ring-0"
            />
            <span>当前所属场景正文 (Current Scene)</span>
          </div>
          <span className="text-[10px] text-ink-faint font-mono">
            {currentSceneSection?.tokenCount || 0} t
          </span>
        </label>

        {/* Previous scene */}
        <label className="flex items-center justify-between cursor-pointer hover:text-ink">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.includePreviousScene}
              onChange={(e) => onChange({ ...config, includePreviousScene: e.target.checked })}
              className="rounded border-line-strong accent-cinnabar focus:ring-0"
            />
            <span>前一场景衔接 (Previous Scene)</span>
          </div>
          <span className="text-[10px] text-ink-faint font-mono">
            {prevSceneSection?.tokenCount || 0} t
          </span>
        </label>

        {/* Character Notes */}
        <label className="flex items-center justify-between cursor-pointer hover:text-ink">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.includeCharacterNotes}
              onChange={(e) => onChange({ ...config, includeCharacterNotes: e.target.checked })}
              className="rounded border-line-strong accent-cinnabar focus:ring-0"
            />
            <span>人物小传与声线设定 (Character notes)</span>
          </div>
          <span className="text-[10px] text-ink-faint font-mono">
            {charNotesSection?.tokenCount || 0} t
          </span>
        </label>

        {/* Motifs */}
        <label className="flex items-center justify-between cursor-pointer hover:text-ink">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.includeMotifs}
              onChange={(e) => onChange({ ...config, includeMotifs: e.target.checked })}
              className="rounded border-line-strong accent-cinnabar focus:ring-0"
            />
            <span>核心意象网络备忘 (Motifs)</span>
          </div>
          <span className="text-[10px] text-ink-faint font-mono">
            {motifsSection?.tokenCount || 0} t
          </span>
        </label>

        {/* Entire Manuscript */}
        <label className="flex items-center justify-between cursor-pointer opacity-70 hover:opacity-100">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.includeEntireManuscript}
              onChange={(e) => onChange({ ...config, includeEntireManuscript: e.target.checked })}
              className="rounded border-line-strong accent-cinnabar focus:ring-0"
            />
            <span className="text-danger">全书文稿 (Entire manuscript — 慎用)</span>
          </div>
          <span className="text-[10px] text-ink-faint font-mono">
            {entireManuSection?.tokenCount || 0} t
          </span>
        </label>
      </div>

      <div className="mt-2.5 pt-2 border-t border-line flex items-center space-x-1 text-[11px] text-ink-faint">
        <Info className="w-3 h-3 shrink-0" />
        <span>Verso 默认仅发送所选文本与场景，严禁未经授权全书上传。</span>
      </div>
    </div>
  );
};
