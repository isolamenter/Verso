import React, { useState } from 'react';
import type { LiteraryAnnotation, CritiqueCategory } from '../../types';
import { DiffViewer } from '../editor/DiffViewer';
import {
  Scissors,
  Feather,
  Activity,
  MessageSquare,
  Compass,
  Eye,
  FileText,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CritiqueViewProps {
  summary?: string;
  annotations: LiteraryAnnotation[];
  onAcceptAnnotation: (annotationId: string, replacementText: string, type: 'minimal' | 'moderate' | 'radical') => void;
  onRejectAnnotation: (annotationId: string) => void;
  onLocateQuote: (quote: string) => void;
  isLoading: boolean;
}

export const CritiqueView: React.FC<CritiqueViewProps> = ({
  summary,
  annotations,
  onAcceptAnnotation,
  onRejectAnnotation,
  onLocateQuote,
  isLoading,
}) => {
  const [expandedDiffId, setExpandedDiffId] = useState<string | null>(null);

  const getCategoryIcon = (category: CritiqueCategory) => {
    switch (category) {
      case 'cut':
        return <Scissors className="w-3.5 h-3.5 text-danger" />;
      case 'language':
        return <Feather className="w-3.5 h-3.5 text-[#5D4037]" />;
      case 'rhythm':
        return <Activity className="w-3.5 h-3.5 text-[#455A64]" />;
      case 'dialogue':
        return <MessageSquare className="w-3.5 h-3.5 text-[#00695C]" />;
      case 'imagery':
        return <Eye className="w-3.5 h-3.5 text-[#6A1B9A]" />;
      case 'distance':
        return <Compass className="w-3.5 h-3.5 text-[#E65100]" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-[#37474F]" />;
    }
  };

  const getCategoryLabel = (category: CritiqueCategory) => {
    switch (category) {
      case 'cut': return '删削';
      case 'language': return '语言质感';
      case 'rhythm': return '节奏呼吸';
      case 'dialogue': return '对白潜台词';
      case 'imagery': return '意象网络';
      case 'distance': return '叙述距离';
      case 'critique':
      default: return '文学审读';
    }
  };

  const getSeverityBadge = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return (
          <span className="text-[10px] font-mono font-semibold tracking-wider text-danger">
            HIGH · 重点
          </span>
        );
      case 'medium':
        return (
          <span className="text-[10px] font-mono font-medium tracking-wider text-warn">
            MEDIUM · 推敲
          </span>
        );
      case 'low':
      default:
        return (
          <span className="text-[10px] font-mono font-medium tracking-wider text-ink-faint">
            LOW · 微调
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <div className="w-6 h-6 border-2 border-ink-muted border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-serif text-ink-muted">
          文学编辑正在审视字句肌理与修辞病灶……
        </p>
      </div>
    );
  }

  if (annotations.length === 0) {
    return (
      <div className="py-12 px-4 text-center">
        <p className="font-serif text-sm text-ink-muted leading-relaxed">
          暂无选区审读批注。
        </p>
        <p className="mt-2 text-xs text-ink-faint leading-relaxed">
          在正文中选择任意字句、对白或段落，呼出浮动工具栏即可发起针对性的文学审读。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="p-3.5 rounded bg-paper-sunken border border-line text-xs font-serif leading-relaxed text-ink">
          <span className="font-bold block mb-1 text-ink">总断语：</span>
          {summary}
        </div>
      )}

      <div className="space-y-3">
        {annotations.map((ann) => {
          const isPending = ann.status === 'pending';
          const isAccepted = ann.status === 'accepted';
          const isRejected = ann.status === 'rejected';
          const isDiffOpen = expandedDiffId === ann.id;
          const severityRule =
            ann.severity === 'high'
              ? 'border-l-danger'
              : ann.severity === 'medium'
              ? 'border-l-warn'
              : 'border-l-ink-faint';

          return (
            <div
              key={ann.id}
              className={`p-3.5 rounded border border-l-2 border-line transition-all ${severityRule} ${
                isAccepted
                  ? 'bg-ok/5 opacity-75 border-line'
                  : isRejected
                  ? 'bg-paper opacity-50 border-line'
                  : 'bg-paper hover:border-line-strong'
              }`}
            >
              {/* Card Header: Category & Severity */}
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <div className="flex items-center space-x-1.5">
                  {getCategoryIcon(ann.category)}
                  <span className="text-xs font-bold text-ink">{getCategoryLabel(ann.category)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {ann.isStale && (
                    <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium tracking-wider rounded bg-warn/15 text-warn">
                      锚点已失效
                    </span>
                  )}
                  {getSeverityBadge(ann.severity)}
                  {isAccepted && (
                    <span className="flex items-center text-[11px] text-ok">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> 已采纳
                    </span>
                  )}
                  {isRejected && (
                    <span className="flex items-center text-[11px] text-ink-faint">
                      <XCircle className="w-3 h-3 mr-1" /> 已忽略
                    </span>
                  )}
                </div>
              </div>

              {/* Quote Anchor */}
              {ann.quote && (
                <div className="mt-2.5 flex items-start justify-between">
                  <div
                    onClick={() => onLocateQuote(ann.quote)}
                    className="cursor-pointer group flex-1"
                  >
                    <blockquote className="pl-2 border-l-2 border-cinnabar text-xs font-serif text-ink-muted group-hover:text-ink transition-colors">
                      “{ann.quote}”
                    </blockquote>
                  </div>
                  <button
                    onClick={() => onLocateQuote(ann.quote)}
                    title="在正文中定位"
                    className="ml-2 p-1 text-ink-muted hover:text-ink transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Diagnosis */}
              <div className="mt-2 text-xs font-serif leading-relaxed text-ink">
                <p className="font-semibold text-ink mb-0.5">病灶剖析：</p>
                {ann.diagnosis}
              </div>

              {/* Literary Trade-off */}
              {ann.literaryTradeoff && (
                <div className="mt-2 p-2 bg-paper-sunken rounded text-[11px] font-serif leading-relaxed text-ink-muted">
                  <span className="font-bold text-ink">文学取舍 (Trade-off)：</span>
                  {ann.literaryTradeoff}
                </div>
              )}

              {/* Suggestion */}
              {ann.suggestion && (
                <div className="mt-2 text-[11px] font-serif text-ink-muted">
                  <span className="font-bold text-ink">思考方向：</span>
                  {ann.suggestion}
                </div>
              )}

              {/* Diff Preview / Action Trigger */}
              {ann.replacement && isPending && (
                <div className="mt-3 pt-2 border-t border-line">
                  <button
                    onClick={() => setExpandedDiffId(isDiffOpen ? null : ann.id)}
                    className="flex items-center space-x-1 text-xs font-medium text-ink hover:text-cinnabar transition-colors"
                  >
                    <span>{isDiffOpen ? '收起改写方案' : '查看改写方案与 Diff'}</span>
                    {isDiffOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isDiffOpen && (
                    <DiffViewer
                      originalQuote={ann.quote}
                      replacement={ann.replacement}
                      onAccept={(newText, type) => {
                        onAcceptAnnotation(ann.id, newText, type);
                        setExpandedDiffId(null);
                      }}
                      onReject={() => {
                        onRejectAnnotation(ann.id);
                        setExpandedDiffId(null);
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
