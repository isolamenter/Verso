import React, { useState, useEffect } from 'react';
import type {
  Manuscript,
  Scene,
  SceneDraftMode,
  SceneDraftLength,
  SceneDraftParams,
  SceneDraftResult,
} from '../../types';
import {
  PenTool,
  Sparkles,
  StopCircle,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  Users,
  Eye,
  ArrowRight,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Layers,
  History
} from 'lucide-react';

interface DraftViewProps {
  currentScene: Scene | null;
  manuscript: Manuscript | null;
  scenes: Scene[];
  selectedText?: string;
  draftResult: SceneDraftResult | null;
  draftStreamingText: string;
  isLoading: boolean;
  onGenerateDraft: (params: SceneDraftParams) => Promise<SceneDraftResult>;
  onAbortDraft: () => void;
  onApplyDraftToScene: (content: string, mode: 'replace' | 'append') => void;
  onSaveDraftAsRevision: (content: string, description: string) => void;
  onUpdateSceneSummary?: (sceneId: string, summary: string) => void;
}

const QUICK_BEAT_TAGS = [
  '两人对话隐晦试探',
  '物性与天气白描开篇',
  '意外冲突与人际对抗',
  '心理内聚焦与动作停顿',
  '戛然而止留白收尾',
  '核心意象互文呼应',
];

export const DraftView: React.FC<DraftViewProps> = ({
  currentScene,
  manuscript,
  scenes,
  selectedText,
  draftResult,
  draftStreamingText,
  isLoading,
  onGenerateDraft,
  onAbortDraft,
  onApplyDraftToScene,
  onSaveDraftAsRevision,
  onUpdateSceneSummary,
}) => {
  // Form states
  const [mode, setMode] = useState<SceneDraftMode>('draft');
  const [sceneOutline, setSceneOutline] = useState(currentScene?.summary || '');
  const [pov, setPov] = useState(currentScene?.pov || '第三人称内聚焦');
  const [locationAndTime, setLocationAndTime] = useState(
    [currentScene?.timeframe, currentScene?.location].filter(Boolean).join(' ') || ''
  );
  const [targetLength, setTargetLength] = useState<SceneDraftLength>('medium');
  const [userNotes, setUserNotes] = useState('');
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);

  // Sync scene summary when scene changes
  useEffect(() => {
    if (currentScene) {
      setSceneOutline(currentScene.summary || '');
      if (currentScene.pov) setPov(currentScene.pov);
      const loc = [currentScene.timeframe, currentScene.location].filter(Boolean).join(' ');
      if (loc) setLocationAndTime(loc);
    }
  }, [currentScene]);

  // If user selected text in canvas, suggest expand or continuation
  useEffect(() => {
    if (selectedText && selectedText.trim().length > 10) {
      setMode('expand');
    }
  }, [selectedText]);

  const handleRunDraft = async () => {
    if (!currentScene) return;
    setAppliedMsg(null);

    // If author updated outline, persist to scene summary
    if (sceneOutline.trim() && sceneOutline !== currentScene.summary && onUpdateSceneSummary) {
      onUpdateSceneSummary(currentScene.id, sceneOutline.trim());
    }

    try {
      await onGenerateDraft({
        mode,
        sceneTitle: currentScene.title,
        sceneOutline: sceneOutline.trim(),
        pov: pov.trim() || undefined,
        locationAndTime: locationAndTime.trim() || undefined,
        targetLength,
        userNotes: userNotes.trim() || undefined,
        existingContent: currentScene.content,
        selectedText: selectedText?.trim() || undefined,
      });
    } catch {
      // Error handled in hook
    }
  };

  const handleAddTagToOutline = (tag: string) => {
    setSceneOutline((prev) => (prev ? `${prev}；${tag}` : tag));
  };

  const handleCopy = () => {
    const textToCopy = draftResult?.content || draftStreamingText;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApply = (applyMode: 'replace' | 'append') => {
    const textToApply = draftResult?.content || draftStreamingText;
    if (!textToApply) return;

    if (applyMode === 'replace') {
      if (currentScene?.content && currentScene.content.trim().length > 50) {
        if (!confirm('应用后将用新生成的小说正文替换当前场景内容（系统已自动在修订单中为您保留历史快照，随时可还原）。是否继续？')) {
          return;
        }
      }
    }

    onApplyDraftToScene(textToApply, applyMode);
    setAppliedMsg(applyMode === 'replace' ? '✓ 已采纳并填入场景正文' : '✓ 已追加到场景末尾');
    setTimeout(() => setAppliedMsg(null), 3000);
  };

  const handleSaveSnapshot = () => {
    const text = draftResult?.content || draftStreamingText;
    if (!text) return;
    const desc = `AI 场景起草备选 (${mode === 'draft' ? '全新起草' : mode === 'continuation' ? '顺接续写' : '细节扩写'} ~${text.length}字)`;
    onSaveDraftAsRevision(text, desc);
    setAppliedMsg('✓ 已保存为场景备选快照，可在「版本取舍」中对比');
    setTimeout(() => setAppliedMsg(null), 3000);
  };

  const activeDraftContent = draftResult?.content || draftStreamingText;
  const currentWordCount = activeDraftContent.length;

  return (
    <div className="space-y-4 font-serif text-xs">
      {/* Context Awareness Header Banner */}
      <div className="p-3 bg-paper-sunken rounded border border-line space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 font-bold text-ink text-xs">
            <Sparkles className="w-3.5 h-3.5 text-cinnabar" />
            <span>基于大纲与文学设定起草场景</span>
          </div>
          <span className="text-[10px] font-mono text-ink-muted">
            {manuscript ? `《${manuscript.title}》` : '未选书稿'}
          </span>
        </div>

        {/* Linked metadata pills */}
        <div className="flex flex-wrap gap-1.5 text-[10px] text-ink-muted">
          <span className="px-1.5 py-0.5 bg-paper rounded border border-line flex items-center space-x-1">
            <BookOpen className="w-3 h-3 text-cinnabar" />
            <span>梗概: {manuscript?.synopsis ? '已绑定' : '未设'}</span>
          </span>
          <span className="px-1.5 py-0.5 bg-paper rounded border border-line flex items-center space-x-1">
            <Users className="w-3 h-3 text-cinnabar" />
            <span>人物: {manuscript?.characters?.length || 0}</span>
          </span>
          <span className="px-1.5 py-0.5 bg-paper rounded border border-line flex items-center space-x-1">
            <Eye className="w-3 h-3 text-cinnabar" />
            <span>意象: {manuscript?.motifs?.length || 0}</span>
          </span>
          {scenes.length > 1 && (
            <span className="px-1.5 py-0.5 bg-paper rounded border border-line flex items-center space-x-1">
              <Layers className="w-3 h-3 text-cinnabar" />
              <span>前序场景衔接</span>
            </span>
          )}
        </div>
      </div>

      {/* Generation Mode Selector Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-paper-sunken rounded border border-line text-[11px]">
        <button
          onClick={() => setMode('draft')}
          className={`py-1.5 px-2 rounded font-medium transition-colors text-center ${
            mode === 'draft'
              ? 'bg-paper text-ink shadow-xs font-bold border border-line'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          全新起草整场
        </button>
        <button
          onClick={() => setMode('continuation')}
          className={`py-1.5 px-2 rounded font-medium transition-colors text-center ${
            mode === 'continuation'
              ? 'bg-paper text-ink shadow-xs font-bold border border-line'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          承接正文续写
        </button>
        <button
          onClick={() => setMode('expand')}
          className={`py-1.5 px-2 rounded font-medium transition-colors text-center ${
            mode === 'expand'
              ? 'bg-paper text-ink shadow-xs font-bold border border-line'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          骨架细节扩写
        </button>
      </div>

      {/* Scene Outline & Beats Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-ink flex items-center space-x-1">
            <PenTool className="w-3 h-3 text-cinnabar" />
            <span>
              {mode === 'draft'
                ? '本场故事大纲 / 节拍 (Scene Beats)'
                : mode === 'continuation'
                ? '续写情节推进意图 (Continuation Beats)'
                : '扩写侧重点 / 骨架要求 (Expansion Beats)'}
            </span>
          </label>
          <span className="text-[10px] font-mono text-ink-faint">
            {sceneOutline.length} 字
          </span>
        </div>

        <textarea
          value={sceneOutline}
          onChange={(e) => setSceneOutline(e.target.value)}
          rows={3}
          placeholder={
            mode === 'draft'
              ? '例如：暴雨黄昏，林远在修鞋铺整理工具。一个穿雨衣的中年人突然出现在檐下借伞，两人就二十年前的大火展开言语试探……'
              : mode === 'continuation'
              ? '例如：顺接上方男人的沉默，两人在昏暗灯光下就旧钥匙的来历展开交锋，最后神秘人借故离开。'
              : '例如：将选中的骨架情节展开，增加雨水滴落声、皮具霉味等物性描写与人物动作停顿。'
          }
          className="w-full p-2.5 bg-paper border border-line rounded text-xs leading-relaxed text-ink focus:outline-none focus:border-cinnabar resize-y"
        />

        {/* Quick Tag Pills */}
        <div className="flex flex-wrap gap-1 pt-0.5">
          {QUICK_BEAT_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleAddTagToOutline(tag)}
              className="text-[10px] px-1.5 py-0.5 bg-paper hover:bg-paper-sunken rounded border border-line text-ink-muted hover:text-cinnabar transition-colors flex items-center space-x-0.5"
            >
              <PlusCircle className="w-2.5 h-2.5" />
              <span>{tag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Collapsible Setting & POV Options */}
      <div className="border border-line rounded bg-paper overflow-hidden">
        <button
          onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-ink-muted hover:text-ink transition-colors"
        >
          <span>视角、舞台与篇幅设定</span>
          {isSettingsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {isSettingsExpanded && (
          <div className="p-3 pt-0 border-t border-line space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-ink-muted block">叙述视角 (POV)</label>
                <input
                  type="text"
                  value={pov}
                  onChange={(e) => setPov(e.target.value)}
                  placeholder="如: 第三人称限知（林远视角）"
                  className="w-full p-1.5 bg-paper border border-line rounded text-[11px] text-ink focus:outline-none focus:border-cinnabar"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-ink-muted block">时空与舞台</label>
                <input
                  type="text"
                  value={locationAndTime}
                  onChange={(e) => setLocationAndTime(e.target.value)}
                  placeholder="如: 暴雨梅雨季 旧修鞋铺檐下"
                  className="w-full p-1.5 bg-paper border border-line rounded text-[11px] text-ink focus:outline-none focus:border-cinnabar"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-ink-muted block">目标生成篇幅</label>
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setTargetLength('short')}
                  className={`p-1.5 rounded border text-center transition-colors ${
                    targetLength === 'short'
                      ? 'border-cinnabar bg-cinnabar/5 font-bold text-cinnabar'
                      : 'border-line text-ink-muted hover:text-ink'
                  }`}
                >
                  <div>精炼片段</div>
                  <div className="text-[9px] opacity-70">~800-1200 字</div>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetLength('medium')}
                  className={`p-1.5 rounded border text-center transition-colors ${
                    targetLength === 'medium'
                      ? 'border-cinnabar bg-cinnabar/5 font-bold text-cinnabar'
                      : 'border-line text-ink-muted hover:text-ink'
                  }`}
                >
                  <div>标准场景</div>
                  <div className="text-[9px] opacity-70">~1500-2500 字</div>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetLength('long')}
                  className={`p-1.5 rounded border text-center transition-colors ${
                    targetLength === 'long'
                      ? 'border-cinnabar bg-cinnabar/5 font-bold text-cinnabar'
                      : 'border-line text-ink-muted hover:text-ink'
                  }`}
                >
                  <div>详实长章</div>
                  <div className="text-[9px] opacity-70">~2500-4000 字</div>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-ink-muted block">创作者特定要求 (可选)</label>
              <input
                type="text"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="如: 对白尽量短，多用停顿，结尾收在雨水声上"
                className="w-full p-1.5 bg-paper border border-line rounded text-[11px] text-ink focus:outline-none focus:border-cinnabar"
              />
            </div>
          </div>
        )}
      </div>

      {/* Generation Trigger Button */}
      <div className="flex items-center space-x-2">
        {isLoading ? (
          <button
            onClick={onAbortDraft}
            className="flex-1 py-2.5 px-4 bg-danger hover:bg-danger text-white rounded font-medium text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
          >
            <StopCircle className="w-3.5 h-3.5 animate-spin" />
            <span>正在起草生成中 (~{currentWordCount} 字) · 点击停止</span>
          </button>
        ) : (
          <button
            onClick={handleRunDraft}
            disabled={!currentScene}
            className="flex-1 py-2.5 px-4 bg-cinnabar hover:bg-cinnabar-strong text-white rounded font-medium text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-xs disabled:opacity-40 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {mode === 'draft'
                ? '基于大纲生成场景初稿'
                : mode === 'continuation'
                ? '顺接正文续写故事'
                : '扩写指定骨架文段'}
            </span>
          </button>
        )}
      </div>

      {/* Applied / Success Notification Toast */}
      {appliedMsg && (
        <div className="p-2.5 bg-ok/10 border border-ok/30 rounded text-ok text-[11px] font-medium flex items-center space-x-1.5 animate-in fade-in duration-150">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>{appliedMsg}</span>
        </div>
      )}

      {/* Live Generated Draft Preview Console */}
      {activeDraftContent && (
        <div className="space-y-3 pt-2 border-t border-line animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xs text-ink">生成草稿预览</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-paper-sunken rounded text-ink-muted">
                ~{currentWordCount} 字
              </span>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-paper-sunken rounded text-ink-muted hover:text-ink transition-colors flex items-center space-x-1 text-[10px]"
                title="复制生成文本"
              >
                {copied ? <Check className="w-3 h-3 text-ok" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? '已复制' : '复制'}</span>
              </button>
            </div>
          </div>

          {/* Editor Literary Rationale (if available) */}
          {draftResult?.literaryNotes && (
            <div className="p-2.5 bg-paper-sunken rounded border border-line text-[11px] text-ink-muted leading-relaxed space-y-1">
              <div className="font-bold text-ink text-[10px] flex items-center space-x-1">
                <BookOpen className="w-3 h-3 text-cinnabar" />
                <span>文学机理设计说明</span>
              </div>
              <p className="italic text-[11px] text-ink-muted leading-relaxed">
                {draftResult.literaryNotes}
              </p>
            </div>
          )}

          {/* Draft Prose Content Viewer */}
          <div className="p-3 bg-paper rounded border border-line-strong max-h-72 overflow-y-auto font-serif text-xs leading-relaxed text-ink whitespace-pre-wrap select-text">
            {activeDraftContent}
            {isLoading && (
              <span className="inline-block w-1.5 h-3.5 bg-cinnabar ml-0.5 animate-pulse align-middle" />
            )}
          </div>

          {/* Multi-tier Adoption Action Bar */}
          <div className="p-2.5 bg-paper-sunken rounded border border-line space-y-2">
            <div className="text-[10px] font-bold text-ink-muted">采纳到场景正文：</div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleApply('replace')}
                className="py-1.5 px-2 bg-cinnabar hover:bg-cinnabar-strong text-white rounded text-[11px] font-medium transition-colors flex items-center justify-center space-x-1 shadow-xs"
                title="采纳为当前场景正文（自动生成前置防丢快照）"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>替换当前场景</span>
              </button>

              <button
                onClick={() => handleApply('append')}
                className="py-1.5 px-2 bg-paper hover:bg-paper-raise border border-line-strong rounded text-[11px] font-medium text-ink transition-colors flex items-center justify-center space-x-1"
                title="追加到当前场景末尾"
              >
                <ArrowRight className="w-3.5 h-3.5 text-cinnabar" />
                <span>追加到文末</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-line">
              <button
                onClick={handleSaveSnapshot}
                className="text-[10px] text-ink-muted hover:text-ink flex items-center space-x-1 transition-colors"
                title="保存为场景备选快照，供后续在版本取舍中对比"
              >
                <History className="w-3 h-3 text-cinnabar" />
                <span>保存为备选快照 (Compare)</span>
              </button>

              <button
                onClick={handleRunDraft}
                disabled={isLoading}
                className="text-[10px] text-ink-muted hover:text-cinnabar flex items-center space-x-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>重新生成</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
