export interface DiffViewerProps {
  originalText?: string | null;
  replacementText?: string | null;
  prefixAnchor?: string | null;
  suffixAnchor?: string | null;
}

export function DiffViewer({
  originalText = "",
  replacementText = "",
  prefixAnchor,
  suffixAnchor,
}: DiffViewerProps) {
  return (
    <div className="bg-paper-light border border-ink-muted/15 rounded p-3 text-xs font-serif leading-relaxed space-y-2">
      {/* Context Anchors if present */}
      {(prefixAnchor || suffixAnchor) && (
        <div className="text-[10px] text-ink-faint italic font-mono flex items-center space-x-1">
          <span>定位锚点:</span>
          {prefixAnchor && <span className="bg-paper px-1 py-0.5 rounded border border-ink-muted/10">前置: “{prefixAnchor}”</span>}
          {suffixAnchor && <span className="bg-paper px-1 py-0.5 rounded border border-ink-muted/10">后置: “{suffixAnchor}”</span>}
        </div>
      )}

      <div className="space-y-1.5">
        {/* Deleted / Replaced Original */}
        {originalText && (
          <div className="bg-cinnabar/10 border-l-2 border-cinnabar text-cinnabar px-2.5 py-1.5 rounded-r">
            <span className="font-bold mr-1.5 text-[10px] select-none">- 删除:</span>
            <span className="line-through decoration-cinnabar/60">{originalText}</span>
          </div>
        )}

        {/* Added Replacement */}
        {replacementText && (
          <div className="bg-emerald-500/10 border-l-2 border-emerald-600 text-emerald-800 dark:text-emerald-300 px-2.5 py-1.5 rounded-r">
            <span className="font-bold mr-1.5 text-[10px] select-none">+ 替换:</span>
            <span>{replacementText}</span>
          </div>
        )}
      </div>
    </div>
  );
}

