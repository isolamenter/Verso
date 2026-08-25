import React, { useState } from 'react';
import { computeCharacterDiff } from '../../utils/diff';
import type { CritiqueReplacement } from '../../types';
import { Check, X, Edit3 } from 'lucide-react';

interface DiffViewerProps {
  originalQuote: string;
  replacement?: CritiqueReplacement;
  onAccept: (replacementText: string, type: 'minimal' | 'moderate' | 'radical') => void;
  onReject: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  originalQuote,
  replacement,
  onAccept,
  onReject,
}) => {
  const [selectedType, setSelectedType] = useState<'minimal' | 'moderate' | 'radical'>('minimal');
  const [isEditing, setIsEditing] = useState(false);
  const [customText, setCustomText] = useState(
    replacement?.minimal || replacement?.moderate || replacement?.radical || ''
  );

  if (!replacement) return null;

  const currentReplacementText = isEditing
    ? customText
    : selectedType === 'minimal'
    ? replacement.minimal || ''
    : selectedType === 'moderate'
    ? replacement.moderate || replacement.minimal || ''
    : replacement.radical || replacement.moderate || replacement.minimal || '';

  const diffTokens = computeCharacterDiff(originalQuote, currentReplacementText);

  return (
    <div className="mt-3 rounded border border-line-strong bg-paper-raise p-3 text-sm transition-all">
      {/* Modification Granularity Selector */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-line">
        <div className="flex items-center space-x-1">
          <span className="text-[11px] font-medium tracking-wider text-ink-muted uppercase">
            改写方案:
          </span>
          {replacement.minimal && (
            <button
              onClick={() => { setSelectedType('minimal'); setIsEditing(false); }}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                selectedType === 'minimal' && !isEditing
                  ? 'bg-ink text-paper font-medium'
                  : 'text-ink-muted hover:bg-paper-sunken'
              }`}
            >
              微创 Minimal
            </button>
          )}
          {replacement.moderate && (
            <button
              onClick={() => { setSelectedType('moderate'); setIsEditing(false); }}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                selectedType === 'moderate' && !isEditing
                  ? 'bg-ink text-paper font-medium'
                  : 'text-ink-muted hover:bg-paper-sunken'
              }`}
            >
              中度 Moderate
            </button>
          )}
          {replacement.radical && (
            <button
              onClick={() => { setSelectedType('radical'); setIsEditing(false); }}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                selectedType === 'radical' && !isEditing
                  ? 'bg-ink text-paper font-medium'
                  : 'text-ink-muted hover:bg-paper-sunken'
              }`}
            >
              重构 Radical
            </button>
          )}
        </div>

        <button
          onClick={() => {
            setIsEditing(!isEditing);
            if (!isEditing) setCustomText(currentReplacementText);
          }}
          className={`flex items-center space-x-1 text-xs px-1.5 py-0.5 rounded transition-colors ${
            isEditing
              ? 'bg-paper-sunken text-ink font-medium'
              : 'text-ink-muted hover:text-ink'
          }`}
          title="手动微调改写文本"
        >
          <Edit3 className="w-3 h-3" />
          <span>微调</span>
        </button>
      </div>

      {/* Diff Preview */}
      {isEditing ? (
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          className="w-full p-2 text-xs font-serif bg-paper border border-line-strong rounded focus:outline-none focus:ring-1 focus:ring-cinnabar text-ink leading-relaxed"
          rows={3}
        />
      ) : (
        <div className="p-2.5 font-serif text-[13px] leading-relaxed bg-paper rounded border border-line tracking-wide">
          {diffTokens.map((token, i) => {
            if (token.type === 'delete') {
              return (
                <del
                  key={i}
                  className="bg-danger/10 text-danger px-0.5 line-through mx-0.5 rounded-sm decoration-danger"
                >
                  {token.text}
                </del>
              );
            }
            if (token.type === 'insert') {
              return (
                <ins
                  key={i}
                  className="bg-ok/15 text-ok px-0.5 no-underline mx-0.5 rounded-sm font-medium border-b border-ok"
                >
                  {token.text}
                </ins>
              );
            }
            return <span key={i} className="text-ink">{token.text}</span>;
          })}
        </div>
      )}

      {/* Action Buttons: Accept / Reject / Edit */}
      <div className="flex items-center justify-end space-x-2 mt-2.5 pt-2 border-t border-line">
        <button
          onClick={onReject}
          className="flex items-center space-x-1 px-2.5 py-1 text-xs text-ink-muted hover:text-ink hover:bg-paper-sunken rounded transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>忽略</span>
        </button>

        <button
          onClick={() => onAccept(currentReplacementText, selectedType)}
          className="flex items-center space-x-1 px-3 py-1 text-xs bg-cinnabar hover:bg-cinnabar-strong text-white rounded font-medium shadow-xs transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          <span>采纳修改</span>
        </button>
      </div>
    </div>
  );
};
