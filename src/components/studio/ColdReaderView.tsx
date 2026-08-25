import React from 'react';
import type { ColdReaderReport } from '../../types';
import {
  Eye,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Users,
  Compass,
  FileSearch,
  BookOpen
} from 'lucide-react';

interface ColdReaderViewProps {
  report: ColdReaderReport | null;
  onTriggerColdRead: () => void;
  isLoading: boolean;
  currentSceneTitle: string;
}

export const ColdReaderView: React.FC<ColdReaderViewProps> = ({
  report,
  onTriggerColdRead,
  isLoading,
  currentSceneTitle,
}) => {
  return (
    <div className="space-y-4">
      {/* Header & Trigger */}
      <div className="p-3.5 bg-paper-sunken rounded border border-line">
        <div className="flex items-center space-x-2 text-xs font-bold text-ink">
          <BookOpen className="w-4 h-4 text-cinnabar" />
          <span>冷读者 (Cold Reader) 盲审模式</span>
        </div>
        <p className="mt-1.5 text-xs font-serif text-ink-muted leading-relaxed">
          AI 将完全剥离作者设定与备忘录，假装自己是第一次阅读此稿的陌生读者，测试文本在没有作者先验解释的情况下是否能独立成立。
        </p>

        <button
          onClick={onTriggerColdRead}
          disabled={isLoading}
          className="mt-3 w-full py-1.5 px-3 bg-cinnabar hover:bg-cinnabar-strong disabled:bg-ink-faint text-white text-xs font-medium rounded transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>陌生读者正在通读并解码……</span>
            </>
          ) : (
            <>
              <FileSearch className="w-3.5 h-3.5" />
              <span>对当前场景发起冷读 (《{currentSceneTitle}》)</span>
            </>
          )}
        </button>
      </div>

      {/* Report Content */}
      {report && (
        <div className="space-y-3 font-serif text-xs leading-relaxed animate-in fade-in duration-200">
          {/* Section 1: What I Read & What Happened */}
          <div className="p-3 rounded bg-paper border border-line">
            <div className="flex items-center space-x-1.5 pb-1.5 border-b border-line text-ink font-bold">
              <Eye className="w-3.5 h-3.5 text-cinnabar" />
              <span>1. 我实际读到的事实与感知</span>
            </div>
            <p className="mt-2 text-ink-muted">{report.whatIRead}</p>
          </div>

          <div className="p-3 rounded bg-paper border border-line">
            <div className="flex items-center space-x-1.5 pb-1.5 border-b border-line text-ink font-bold">
              <Compass className="w-3.5 h-3.5 text-ink-muted" />
              <span>2. 我认为发生了什么 (情节与动作)</span>
            </div>
            <p className="mt-2 text-ink-muted">{report.whatHappened}</p>
          </div>

          {/* Section 2: Character Dynamics */}
          <div className="p-3 rounded bg-paper border border-line">
            <div className="flex items-center space-x-1.5 pb-1.5 border-b border-line text-ink font-bold">
              <Users className="w-3.5 h-3.5 text-ink-muted" />
              <span>3. 我理解的人物关系与权力流动</span>
            </div>
            <p className="mt-2 text-ink-muted">{report.characterDynamics}</p>
          </div>

          {/* Section 3: Themes & Implications */}
          <div className="p-3 rounded bg-paper border border-line">
            <div className="flex items-center space-x-1.5 pb-1.5 border-b border-line text-ink font-bold">
              <Sparkles className="w-3.5 h-3.5 text-cinnabar" />
              <span>4. 我感受到的主题与隐秘暗示</span>
            </div>
            <div className="mt-2 space-y-1.5">
              <p className="text-ink-muted">
                <strong className="text-ink">主题：</strong>
                {report.sensedThemes}
              </p>
              {report.suspectedImplications && (
                <p className="text-ink-muted">
                  <strong className="text-ink">暗示：</strong>
                  {report.suspectedImplications}
                </p>
              )}
            </div>
          </div>

          {/* Section 4: Confusions & Author-only Blindspots (CRITICAL) */}
          <div className="p-3 rounded bg-warn/10 border border-warn/40">
            <div className="flex items-center space-x-1.5 pb-1.5 border-b border-warn/30 text-warn font-bold">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>5. 我没有理解或感到语义断裂的地方</span>
            </div>
            <p className="mt-2 text-ink-muted">
              {report.confusionAndAmbiguities || '无明显认知障碍。'}
            </p>
          </div>

          <div className="p-3 rounded bg-danger/10 border border-danger/30">
            <div className="flex items-center space-x-1.5 pb-1.5 border-b border-danger/30 text-danger font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>6. 哪些信息似乎只有作者自己知道 (盲区)</span>
            </div>
            <p className="mt-2 text-ink-muted">
              {report.authorOnlyBlindspots || '未发现作者独占信息的严重断裂。'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
