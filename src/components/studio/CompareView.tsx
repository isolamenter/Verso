import React, { useState } from 'react';
import type { VersionCompareReport, RevisionSnapshot } from '../../types';
import { Columns, ArrowRightLeft, Scale, PlusCircle, MinusCircle } from 'lucide-react';

interface CompareViewProps {
  report: VersionCompareReport | null;
  onCompareVersions: (nameA: string, textA: string, nameB: string, textB: string) => void;
  isLoading: boolean;
  revisions?: RevisionSnapshot[];
  currentContent?: string;
}

export const CompareView: React.FC<CompareViewProps> = ({
  report,
  onCompareVersions,
  isLoading,
  revisions = [],
  currentContent = '',
}) => {
  const [versionAName, setVersionAName] = useState('版本 A (原稿)');
  const [versionAContent, setVersionAContent] = useState(
    '她感到一种无法言说的压抑，好像整个下午的沉闷都随着太阳一起从云后压了下来。'
  );
  const [versionBName, setVersionBName] = useState('版本 B (精修稿)');
  const [versionBContent, setVersionBContent] = useState(
    '太阳出来的时候，水泥路面泛出一层白花花的反光。水滴正正砸在卷帘门的锁孔上。'
  );

  const handleSelectRevA = (revId: string) => {
    if (revId === 'current') {
      setVersionAName('当前正文');
      setVersionAContent(currentContent);
      return;
    }
    const rev = revisions.find((r) => r.id === revId);
    if (rev) {
      setVersionAName(rev.description || '历史快照 A');
      setVersionAContent(rev.content);
    }
  };

  const handleSelectRevB = (revId: string) => {
    if (revId === 'current') {
      setVersionBName('当前正文');
      setVersionBContent(currentContent);
      return;
    }
    const rev = revisions.find((r) => r.id === revId);
    if (rev) {
      setVersionBName(rev.description || '历史快照 B');
      setVersionBContent(rev.content);
    }
  };

  return (
    <div className="space-y-4">
      {/* Input Form */}
      <div className="p-3.5 bg-paper-sunken rounded border border-line">
        <div className="flex items-center space-x-2 text-xs font-bold text-ink">
          <Scale className="w-4 h-4 text-cinnabar" />
          <span>版本推敲与文学取舍 (Trade-off Compare)</span>
        </div>
        <p className="mt-1 text-xs font-serif text-ink-muted leading-relaxed">
          从版本快照中选取或直接粘贴两个方案，AI 将深度剖析两者各自赢得与牺牲了什么文学特质。
        </p>

        <div className="mt-3 space-y-2.5">
          {/* Version A */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <input
                type="text"
                value={versionAName}
                onChange={(e) => setVersionAName(e.target.value)}
                className="text-xs font-semibold bg-transparent border-b border-line-strong text-ink focus:outline-none w-32"
              />
              {revisions.length > 0 && (
                <select
                  onChange={(e) => handleSelectRevA(e.target.value)}
                  className="text-[10px] bg-paper border border-line-strong rounded px-1.5 py-0.5 text-ink-muted"
                  defaultValue=""
                >
                  <option value="" disabled>从历史版本导入...</option>
                  <option value="current">当前正文</option>
                  {revisions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.description.slice(0, 20)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <textarea
              value={versionAContent}
              onChange={(e) => setVersionAContent(e.target.value)}
              rows={2}
              className="w-full p-2 text-xs font-serif bg-paper border border-line-strong rounded text-ink focus:outline-none"
            />
          </div>

          <div className="flex justify-center my-1">
            <ArrowRightLeft className="w-3.5 h-3.5 text-ink-faint" />
          </div>

          {/* Version B */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <input
                type="text"
                value={versionBName}
                onChange={(e) => setVersionBName(e.target.value)}
                className="text-xs font-semibold bg-transparent border-b border-line-strong text-ink focus:outline-none w-32"
              />
              {revisions.length > 0 && (
                <select
                  onChange={(e) => handleSelectRevB(e.target.value)}
                  className="text-[10px] bg-paper border border-line-strong rounded px-1.5 py-0.5 text-ink-muted"
                  defaultValue=""
                >
                  <option value="" disabled>从历史版本导入...</option>
                  <option value="current">当前正文</option>
                  {revisions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.description.slice(0, 20)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <textarea
              value={versionBContent}
              onChange={(e) => setVersionBContent(e.target.value)}
              rows={2}
              className="w-full p-2 text-xs font-serif bg-paper border border-line-strong rounded text-ink focus:outline-none"
            />
          </div>
        </div>

        <button
          onClick={() =>
            onCompareVersions(versionAName, versionAContent, versionBName, versionBContent)
          }
          disabled={isLoading || !versionAContent.trim() || !versionBContent.trim()}
          className="mt-3 w-full py-1.5 px-3 bg-cinnabar hover:bg-cinnabar-strong disabled:bg-ink-faint text-white text-xs font-medium rounded transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>正在权衡两版文学得失……</span>
            </>
          ) : (
            <>
              <Columns className="w-3.5 h-3.5" />
              <span>评估两版文学 Trade-off</span>
            </>
          )}
        </button>
      </div>

      {/* Compare Results */}
      {report && (
        <div className="space-y-3 font-serif text-xs leading-relaxed animate-in fade-in duration-200">
          {/* Summary */}
          <div className="p-3.5 rounded bg-paper border border-line">
            <div className="font-bold text-ink pb-1.5 border-b border-line">
              核心文学取舍总结：
            </div>
            <p className="mt-2 text-ink-muted leading-relaxed">
              {report.literaryTradeoffSummary}
            </p>
          </div>

          {/* Version A Breakdown */}
          <div className="p-3 rounded bg-paper border border-line">
            <div className="font-bold text-ink pb-1.5 border-b border-line">
              {report.versionAName}
            </div>
            <div className="mt-2 space-y-2">
              <div className="flex items-start space-x-1.5">
                <PlusCircle className="w-3.5 h-3.5 text-ok shrink-0 mt-0.5" />
                <p className="text-ink-muted">
                  <strong className="text-ink">获得：</strong>
                  {report.versionAGains}
                </p>
              </div>
              <div className="flex items-start space-x-1.5">
                <MinusCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
                <p className="text-ink-muted">
                  <strong className="text-ink">失去：</strong>
                  {report.versionALosses}
                </p>
              </div>
            </div>
          </div>

          {/* Version B Breakdown */}
          <div className="p-3 rounded bg-paper border border-line">
            <div className="font-bold text-ink pb-1.5 border-b border-line">
              {report.versionBName}
            </div>
            <div className="mt-2 space-y-2">
              <div className="flex items-start space-x-1.5">
                <PlusCircle className="w-3.5 h-3.5 text-ok shrink-0 mt-0.5" />
                <p className="text-ink-muted">
                  <strong className="text-ink">获得：</strong>
                  {report.versionBGains}
                </p>
              </div>
              <div className="flex items-start space-x-1.5">
                <MinusCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
                <p className="text-ink-muted">
                  <strong className="text-ink">失去：</strong>
                  {report.versionBLosses}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
