import DiffMatchPatch from 'diff-match-patch';
import type { EditorStats } from '../types';
import {
  extractPlainText,
  isTipTapDocJson,
  buildPlainTextOffsetMap,
  findBestAnchorMatch,
} from './textProjection';

const dmp = new DiffMatchPatch();

export interface DiffToken {
  type: 'equal' | 'insert' | 'delete';
  text: string;
}

export function computeCharacterDiff(original: string, updated: string): DiffToken[] {
  const origText = extractPlainText(original || '');
  const updatedText = extractPlainText(updated || '');
  const diffs = dmp.diff_main(origText, updatedText);
  dmp.diff_cleanupSemantic(diffs);

  return diffs.map(([op, text]) => {
    let type: DiffToken['type'] = 'equal';
    if (op === DiffMatchPatch.DIFF_INSERT) type = 'insert';
    if (op === DiffMatchPatch.DIFF_DELETE) type = 'delete';
    return { type, text };
  });
}

export function calculateEditorStats(content: string): EditorStats {
  const plainText = extractPlainText(content);
  if (!plainText) {
    return {
      chineseCharacters: 0,
      totalWords: 0,
      paragraphs: 0,
      readingTimeMinutes: 0,
    };
  }

  // Pure Chinese characters (CJK Unified Ideographs + Extension A)
  const chineseMatches = plainText.match(/[\u4e00-\u9fa5\u3400-\u4dbf]/g);
  const chineseCount = chineseMatches ? chineseMatches.length : 0;

  // Non-Chinese words (Latin words / numbers)
  const nonChineseWords = plainText
    .replace(/[\u4e00-\u9fa5\u3400-\u4dbf]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const totalWords = chineseCount + nonChineseWords;

  // Paragraphs (split by non-empty newlines)
  const paragraphs = plainText
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean).length;

  // Serious literary reading pace ~ 350 Chinese characters/min
  const readingTimeMinutes = Math.max(1, Math.ceil(totalWords / 350));

  return {
    chineseCharacters: chineseCount,
    totalWords,
    paragraphs,
    readingTimeMinutes,
  };
}

export interface ReplacementResult {
  success: boolean;
  newContent: string;
  matchedFrom?: number;
  matchedTo?: number;
  isAmbiguous?: boolean;
}

/**
 * Replace quote inside a TipTap JSON document tree safely preserving all formatting, marks, and structure.
 * Never degrades to plain text.
 */
function replaceQuoteInTipTapDoc(
  docJsonString: string,
  targetQuote: string,
  newText: string,
  range?: { from: number; to: number }
): ReplacementResult {
  let docObj: any;
  try {
    docObj = JSON.parse(docJsonString);
  } catch {
    return { success: false, newContent: docJsonString };
  }

  if (!docObj || docObj.type !== 'doc' || !Array.isArray(docObj.content)) {
    return { success: false, newContent: docJsonString };
  }

  const plainText = extractPlainText(docObj);
  const match = findBestAnchorMatch({
    plainText,
    quote: targetQuote,
    previousRange: range,
  });

  if (!match.found) {
    return {
      success: false,
      newContent: docJsonString,
      isAmbiguous: match.isAmbiguous,
    };
  }

  const targetFrom = match.range.from;
  const targetTo = match.range.to;

  const segments = buildPlainTextOffsetMap(docObj);
  const overlapSegments = segments.filter(
    (seg) => Math.max(seg.plainStart, targetFrom) < Math.min(seg.plainEnd, targetTo)
  );

  if (overlapSegments.length === 0) {
    return { success: false, newContent: docJsonString };
  }

  const nodeSegments = overlapSegments.filter((seg) => seg.node || seg.type === 'text');
  if (nodeSegments.length === 0) {
    return { success: false, newContent: docJsonString };
  }

  // Case 1: Single text node replacement
  if (nodeSegments.length === 1 && nodeSegments[0].type === 'text' && nodeSegments[0].node) {
    const seg = nodeSegments[0];
    const origText = seg.node.text || '';
    const startInNode = Math.max(0, targetFrom - seg.plainStart);
    const endInNode = Math.min(origText.length, targetTo - seg.plainStart);

    seg.node.text = origText.slice(0, startInNode) + newText + origText.slice(endInNode);

    return {
      success: true,
      newContent: JSON.stringify(docObj),
      matchedFrom: targetFrom,
      matchedTo: targetFrom + newText.length,
    };
  }

  // Case 2: Multi-node replacement within the same block (e.g. bold + regular text, or across hardBreaks)
  const firstBlock = nodeSegments[0].blockNode;
  const isSameBlock = nodeSegments.every((s) => s.blockNode === firstBlock);

  if (isSameBlock) {
    const firstSeg = nodeSegments[0];
    const lastSeg = nodeSegments[nodeSegments.length - 1];

    if (firstSeg.type === 'text' && firstSeg.node) {
      const origText = firstSeg.node.text || '';
      const startInNode = Math.max(0, targetFrom - firstSeg.plainStart);
      firstSeg.node.text = origText.slice(0, startInNode) + newText;
    }

    if (lastSeg !== firstSeg && lastSeg.type === 'text' && lastSeg.node) {
      const origText = lastSeg.node.text || '';
      const endInNode = Math.min(origText.length, targetTo - lastSeg.plainStart);
      lastSeg.node.text = origText.slice(endInNode);
    }

    for (let i = 1; i < nodeSegments.length - 1; i++) {
      const midSeg = nodeSegments[i];
      if (midSeg.node && midSeg.node.type === 'text') {
        midSeg.node.text = '';
      }
    }

    // Clean up empty text nodes in parent block
    if (firstSeg.parentNode && Array.isArray(firstSeg.parentNode.content)) {
      firstSeg.parentNode.content = firstSeg.parentNode.content.filter(
        (child: any) => !(child.type === 'text' && child.text === '')
      );
      if (firstSeg.parentNode.content.length === 0) {
        firstSeg.parentNode.content = [{ type: 'text', text: '' }];
      }
    }

    return {
      success: true,
      newContent: JSON.stringify(docObj),
      matchedFrom: targetFrom,
      matchedTo: targetFrom + newText.length,
    };
  }

  // Case 3: Cross-block replacement (spans across paragraphs / headings / blockquotes)
  const startSeg = nodeSegments[0];
  const endSeg = nodeSegments[nodeSegments.length - 1];

  if (startSeg.type === 'text' && startSeg.node) {
    const origText = startSeg.node.text || '';
    const startInNode = Math.max(0, targetFrom - startSeg.plainStart);
    startSeg.node.text = origText.slice(0, startInNode);
  }

  if (endSeg.type === 'text' && endSeg.node) {
    const origText = endSeg.node.text || '';
    const endInNode = Math.min(origText.length, targetTo - endSeg.plainStart);
    endSeg.node.text = origText.slice(endInNode);
  }

  for (let i = 1; i < nodeSegments.length - 1; i++) {
    const mid = nodeSegments[i];
    if (mid.node && mid.node.type === 'text') {
      mid.node.text = '';
    }
  }

  const newParagraphs = newText.split(/\n\n+/);
  if (newParagraphs.length === 1) {
    if (startSeg.type === 'text' && startSeg.node) {
      startSeg.node.text = (startSeg.node.text || '') + newText;
    }
    if (startSeg.blockNode && endSeg.blockNode && startSeg.blockNode !== endSeg.blockNode) {
      if (Array.isArray(endSeg.blockNode.content)) {
        startSeg.blockNode.content = [
          ...(startSeg.blockNode.content || []),
          ...endSeg.blockNode.content,
        ];
      }
      const startBlockIdx = docObj.content.indexOf(startSeg.blockNode);
      const endBlockIdx = docObj.content.indexOf(endSeg.blockNode);
      if (startBlockIdx !== -1 && endBlockIdx !== -1 && endBlockIdx > startBlockIdx) {
        docObj.content.splice(startBlockIdx + 1, endBlockIdx - startBlockIdx);
      }
    }
  } else {
    if (startSeg.type === 'text' && startSeg.node) {
      startSeg.node.text = (startSeg.node.text || '') + newParagraphs[0];
    }
    if (endSeg.type === 'text' && endSeg.node) {
      endSeg.node.text = newParagraphs[newParagraphs.length - 1] + (endSeg.node.text || '');
    }

    const startBlockIdx = docObj.content.indexOf(startSeg.blockNode);
    const endBlockIdx = docObj.content.indexOf(endSeg.blockNode);

    const midBlocks = newParagraphs.slice(1, -1).map((pText) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: pText }],
    }));

    if (startBlockIdx !== -1 && endBlockIdx !== -1 && endBlockIdx > startBlockIdx) {
      docObj.content.splice(startBlockIdx + 1, endBlockIdx - startBlockIdx - 1, ...midBlocks);
    } else if (startBlockIdx !== -1) {
      docObj.content.splice(startBlockIdx + 1, 0, ...midBlocks);
    }
  }

  // Cleanup empty text nodes inside blocks
  docObj.content.forEach((block: any) => {
    if (Array.isArray(block.content)) {
      block.content = block.content.filter(
        (c: any) => !(c.type === 'text' && c.text === '')
      );
      if (block.content.length === 0) {
        block.content = [{ type: 'text', text: '' }];
      }
    }
  });

  return {
    success: true,
    newContent: JSON.stringify(docObj),
    matchedFrom: targetFrom,
    matchedTo: targetFrom + newText.length,
  };
}

/**
 * Range-aware quote replacement on plain text using unified anchor matcher.
 */
function applyQuoteReplacementToPlainText(
  fullContent: string,
  targetQuote: string,
  newText: string,
  range?: { from: number; to: number }
): ReplacementResult {
  if (!fullContent || !targetQuote) {
    return { success: false, newContent: fullContent };
  }

  const match = findBestAnchorMatch({
    plainText: fullContent,
    quote: targetQuote,
    previousRange: range,
  });

  if (!match.found) {
    return {
      success: false,
      newContent: fullContent,
      isAmbiguous: match.isAmbiguous,
    };
  }

  const from = match.range.from;
  const to = match.range.to;
  const updated = fullContent.slice(0, from) + newText + fullContent.slice(to);

  return {
    success: true,
    newContent: updated,
    matchedFrom: from,
    matchedTo: from + newText.length,
  };
}

/**
 * Universal Quote Replacement: Works seamlessly with TipTap JSON docs and plain text.
 */
export function applyQuoteReplacement(
  fullContent: string,
  targetQuote: string,
  newText: string,
  range?: { from: number; to: number }
): ReplacementResult {
  if (isTipTapDocJson(fullContent)) {
    return replaceQuoteInTipTapDoc(fullContent, targetQuote, newText, range);
  }
  return applyQuoteReplacementToPlainText(fullContent, targetQuote, newText, range);
}
