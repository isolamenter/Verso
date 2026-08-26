import React, { useState, useRef } from 'react';
import {
  Sparkles,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { ProfilingMode, CharacterItem, MotifItem } from '../../types';

// ============================================================
// ProfilingToolbar —— 每个建档模块顶部的 AI 工具条
// ============================================================

interface ProfilingToolbarProps {
  /** 模块名，如「人物小传」，用于文案 */
  moduleLabel: string;
  isLoading: boolean;
  /** 当前值非空时才能精修 */
  canRefine: boolean;
  onRun: (mode: ProfilingMode, userNotes?: string) => Promise<void>;
  /** generate 按钮文案覆盖（分场 tab 用「AI 全篇分场」） */
  generateLabel?: string;
  /** 加载中提示文案 */
  loadingText?: string;
}

const QUICK_TAGS = ['【人物关系】', '【核心意象】', '【梗概侧重】', '【分场指示】'];

export const ProfilingToolbar: React.FC<ProfilingToolbarProps> = ({
  moduleLabel,
  isLoading,
  canRefine,
  onRun,
  generateLabel = 'AI 生成',
  loadingText = '正在通读全篇……',
}) => {
  const [userNotes, setUserNotes] = useState('');
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const lastRunRef = useRef<ProfilingMode>('generate');

  const handleRun = async (mode: ProfilingMode) => {
    setErrorMsg('');
    lastRunRef.current = mode;
    try {
      await onRun(mode, userNotes.trim() || undefined);
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // 被新请求中断，静默
      console.error(`[Verso Profiling: ${moduleLabel} 执行失败]`, err);
      setErrorMsg(err?.message || 'AI 请求失败，请重试。');
    }
  };

  const handleInsertTag = (tag: string) => {
    setUserNotes((prev) => (prev ? `${prev}\n${tag}` : tag));
  };

  return (
    <div className="bg-paper-sunken/70 border border-line rounded-lg p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-cinnabar" />
          <span className="font-bold text-ink text-xs">{moduleLabel} · AI 提取</span>
        </div>
        <button
          type="button"
          onClick={() => setIsNotesExpanded(!isNotesExpanded)}
          className="text-ink-muted hover:text-ink text-[11px] flex items-center space-x-0.5"
        >
          <span>{isNotesExpanded ? '收起批注' : '批注指引（选填）'}</span>
          {isNotesExpanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      </div>

      {isNotesExpanded && (
        <div className="space-y-2 pt-0.5">
          <p className="text-[10px] text-ink-muted leading-tight">
            提前指导 AI 提炼侧重；精修时指出偏差，AI 将严格按批注修订：
          </p>
          <textarea
            value={userNotes}
            onChange={(e) => setUserNotes(e.target.value)}
            rows={3}
            placeholder="例如：主角是陈默，修正旁白里的李医生不是主角；重点提炼生锈怀表与雨水意象……"
            className="w-full p-2 bg-paper border border-line rounded text-ink focus:outline-none text-[11px] leading-relaxed resize-none"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-ink-faint">快捷插入：</span>
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleInsertTag(tag)}
                className="px-2 py-0.5 bg-paper hover:bg-paper-raise border border-line rounded text-[10px] text-ink-muted hover:text-ink transition-colors"
              >
                + {tag.replace(/【|】/g, '')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleRun('generate')}
          disabled={isLoading}
          className="px-3 py-1 bg-cinnabar hover:bg-cinnabar-strong text-white text-[11px] font-medium rounded shadow-xs transition-colors disabled:opacity-50 flex items-center space-x-1"
        >
          <Sparkles className="w-3 h-3" />
          <span>{generateLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => handleRun('refine')}
          disabled={isLoading || !canRefine}
          title={canRefine ? '以当前内容为基线，结合批注精修' : '当前没有可精修的内容'}
          className="px-3 py-1 bg-paper hover:bg-paper-raise text-ink border border-line rounded text-[11px] font-medium transition-colors disabled:opacity-40 flex items-center space-x-1"
        >
          <Sparkles className="w-3 h-3 text-cinnabar" />
          <span>AI 精修</span>
        </button>
        {isLoading && (
          <span className="flex items-center space-x-1.5 text-[11px] text-ink-muted">
            <span className="w-3.5 h-3.5 border-2 border-cinnabar border-t-transparent rounded-full animate-spin" />
            <span>{userNotes.trim() ? '正在结合批注修订……' : loadingText}</span>
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold">{moduleLabel} AI 请求遇到问题</div>
            <div className="mt-1 text-[11px] leading-relaxed">{errorMsg}</div>
            <button
              onClick={() => handleRun(lastRunRef.current)}
              className="mt-2 px-3 py-1 bg-paper text-ink border border-line rounded text-[11px] hover:bg-paper-raise transition-colors inline-flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3 text-cinnabar" />
              <span>重试</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// ItemPreviewPanel —— 人物/意象的 AI 结果预览面板
// ============================================================

export type PreviewEntity =
  | (CharacterItem & { selected?: boolean })
  | (MotifItem & { selected?: boolean });

export interface PreviewEntityPatch {
  name?: string;
  /** 人物: role */
  meta?: string;
  /** 人物: notes；意象: description */
  detail?: string;
}

interface ItemPreviewPanelProps {
  mode: 'generate' | 'refine';
  items: PreviewEntity[];
  kind: 'characters' | 'motifs';
  onToggle?: (idx: number, selected: boolean) => void;
  onUpdate?: (idx: number, patch: PreviewEntityPatch) => void;
  onRemove?: (idx: number) => void;
  onApply: () => void;
  applyLabel: string;
  /** 应用前去重导致的条数变化提示，如「已按名去重：12 → 10 条」 */
  dedupeHint?: string;
}

const isCharacter = (item: PreviewEntity): item is CharacterItem & { selected?: boolean } =>
  'role' in item;

export const ItemPreviewPanel: React.FC<ItemPreviewPanelProps> = ({
  mode,
  items,
  kind,
  onToggle,
  onUpdate,
  onRemove,
  onApply,
  applyLabel,
  dedupeHint,
}) => {
  const detailPlaceholder =
    kind === 'characters' ? '性格质感、声线口吻、核心动机与潜台词习惯……' : '意象承担的叙事功能、感官特征……';

  return (
    <div className="bg-paper-sunken/50 border border-cinnabar/30 rounded-lg p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cinnabar" />
          <span className="font-bold text-ink text-xs">
            {mode === 'generate' ? 'AI 提取结果（勾选后合并）' : 'AI 精修结果（替换当前列表）'}
          </span>
        </div>
        {dedupeHint && (
          <span className="px-1.5 py-0.2 bg-cinnabar/10 text-cinnabar text-[10px] rounded border border-cinnabar/20">
            {dedupeHint}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-6 text-ink-muted text-[11px]">AI 未提取到有效条目</div>
      ) : (
        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {items.map((item, idx) => {
            const char = isCharacter(item);
            const meta = char ? item.role : undefined;
            const detail = char ? item.notes : (item as MotifItem).description;
            const occurrences = char ? undefined : (item as MotifItem).occurrencesCount;
            return (
              <div
                key={item.id}
                className={`p-2.5 rounded border transition-all ${
                  item.selected !== false
                    ? 'bg-paper border-line'
                    : 'bg-paper/50 border-line/60 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 flex-1">
                    {mode === 'generate' && (
                      <input
                        type="checkbox"
                        checked={item.selected !== false}
                        onChange={(e) => onToggle?.(idx, e.target.checked)}
                        className="rounded text-cinnabar focus:ring-0 shrink-0"
                      />
                    )}
                    <input
                      type="text"
                      value={item.name}
                      readOnly={mode === 'refine'}
                      onChange={(e) => onUpdate?.(idx, { name: e.target.value })}
                      className={`font-bold text-ink bg-transparent border-b border-dashed border-line focus:outline-none text-xs ${
                        mode === 'refine' ? 'cursor-default' : ''
                      }`}
                      placeholder="名称"
                    />
                  </div>
                  {kind === 'characters' &&
                    (mode === 'generate' ? (
                      <input
                        type="text"
                        value={meta || ''}
                        onChange={(e) => onUpdate?.(idx, { meta: e.target.value })}
                        className="text-[10px] text-ink-muted bg-paper px-1.5 py-0.5 border border-line rounded focus:outline-none font-mono w-28"
                        placeholder="身份/关系"
                      />
                    ) : (
                      <span className="text-[10px] text-ink-muted bg-paper-sunken px-1.5 py-0.5 border border-line rounded font-mono">
                        {meta || '人物'}
                      </span>
                    ))}
                  {occurrences !== undefined && (
                    <span className="text-[10px] text-ink-faint font-mono ml-2">
                      约 {occurrences} 处
                    </span>
                  )}
                  {mode === 'generate' && (
                    <button
                      onClick={() => onRemove?.(idx)}
                      className="text-ink-faint hover:text-danger p-0.5 ml-1"
                      title="移除此条目"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {mode === 'generate' ? (
                  <textarea
                    value={detail}
                    onChange={(e) => onUpdate?.(idx, { detail: e.target.value })}
                    rows={2}
                    placeholder={detailPlaceholder}
                    className="w-full p-2 bg-paper border border-line rounded text-[11px] text-ink focus:outline-none leading-relaxed mt-2"
                  />
                ) : (
                  <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-3 mt-1.5">
                    {detail}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={onApply}
        disabled={mode === 'generate' && items.every((i) => i.selected === false)}
        className="w-full px-3 py-1.5 bg-cinnabar hover:bg-cinnabar-strong text-white text-[11px] font-medium rounded shadow-xs transition-colors disabled:opacity-50"
      >
        {applyLabel}
      </button>
    </div>
  );
};
