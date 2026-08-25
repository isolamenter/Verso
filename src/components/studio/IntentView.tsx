import React, { useState } from 'react';
import type { IntentEvaluation } from '../../types';
import { Target, CheckCircle, AlertCircle, XCircle, Search, HelpCircle } from 'lucide-react';

interface IntentViewProps {
  evaluation: IntentEvaluation | null;
  onEvaluateIntent: (intentText: string) => void;
  isLoading: boolean;
}

export const IntentView: React.FC<IntentViewProps> = ({
  evaluation,
  onEvaluateIntent,
  isLoading,
}) => {
  const [intentInput, setIntentInput] = useState('');

  const getVerdictBadge = (verdict: IntentEvaluation['overallVerdict']) => {
    switch (verdict) {
      case 'clearly_present':
        return (
          <span className="flex items-center px-2 py-0.5 rounded text-xs font-bold bg-ok/15 text-ok">
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> 充分呈现 Clearly Present
          </span>
        );
      case 'partially_present':
        return (
          <span className="flex items-center px-2 py-0.5 rounded text-xs font-bold bg-warn/15 text-warn">
            <HelpCircle className="w-3.5 h-3.5 mr-1" /> 部分呈现 Partially Present
          </span>
        );
      case 'not_present':
        return (
          <span className="flex items-center px-2 py-0.5 rounded text-xs font-bold bg-danger/15 text-danger">
            <XCircle className="w-3.5 h-3.5 mr-1" /> 未能传达 Not Present
          </span>
        );
      case 'over_explained':
        return (
          <span className="flex items-center px-2 py-0.5 rounded text-xs font-bold bg-warn/15 text-warn">
            <AlertCircle className="w-3.5 h-3.5 mr-1" /> 过度解释 Over-explained
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Intent Input Form */}
      <div className="p-3.5 bg-paper-sunken rounded border border-line">
        <div className="flex items-center space-x-2 text-xs font-bold text-ink">
          <Target className="w-4 h-4 text-cinnabar" />
          <span>意图 vs 文本传达 (Intent vs. Text)</span>
        </div>
        <p className="mt-1 text-xs font-serif text-ink-muted leading-relaxed">
          输入你期望在当前场景或段落中传达的深层意图，AI 将逐句检索文本证据，判断该意图是否真正被写了出来，还是停留在作者的脑海中或被过度解释。
        </p>

        <textarea
          value={intentInput}
          onChange={(e) => setIntentInput(e.target.value)}
          rows={3}
          placeholder="例如：我希望这一段表现两个人虽然在平静对话，但内心的权力关系已经彻底逆转……"
          className="mt-2.5 w-full p-2.5 text-xs font-serif bg-paper border border-line-strong rounded focus:outline-none focus:ring-1 focus:ring-cinnabar text-ink"
        />

        <button
          onClick={() => onEvaluateIntent(intentInput)}
          disabled={isLoading || !intentInput.trim()}
          className="mt-2.5 w-full py-1.5 px-3 bg-cinnabar hover:bg-cinnabar-strong disabled:bg-ink-faint text-white text-xs font-medium rounded transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>正在比对意图与文本证据……</span>
            </>
          ) : (
            <>
              <Search className="w-3.5 h-3.5" />
              <span>检验意图与文本匹配度</span>
            </>
          )}
        </button>
      </div>

      {/* Evaluation Results */}
      {evaluation && (
        <div className="space-y-3 font-serif text-xs leading-relaxed animate-in fade-in duration-200">
          <div className="p-3.5 rounded bg-paper border border-line">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="font-bold text-ink">综合传达判定：</span>
              {getVerdictBadge(evaluation.overallVerdict)}
            </div>
            <p className="mt-2.5 text-ink-muted">{evaluation.detailedAnalysis}</p>
          </div>

          {/* Evidence Items */}
          {evaluation.evidenceItems.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-ink block">文本证据剖析：</span>
              {evaluation.evidenceItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded bg-paper border border-line"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-line">
                    <blockquote className="text-xs text-ink-muted">
                      “{item.quote}”
                    </blockquote>
                    {getVerdictBadge(item.status)}
                  </div>
                  <p className="mt-2 text-ink-muted">{item.explanation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
