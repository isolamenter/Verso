/**
 * Utilities for TipTap Structured JSON Document Projection, Parsing, and Migration.
 */

export function isTipTapDocJson(content: string | object | null | undefined): boolean {
  if (!content) return false;
  if (typeof content === 'object') {
    const obj = content as any;
    return obj.type === 'doc' && Array.isArray(obj.content);
  }
  if (typeof content !== 'string') return false;
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return Boolean(parsed && parsed.type === 'doc' && Array.isArray(parsed.content));
  } catch {
    return false;
  }
}

/**
 * Checks if a string contains HTML tags.
 */
export function isHtmlString(content: string | null | undefined): boolean {
  if (!content || typeof content !== 'string') return false;
  const trimmed = content.trim();
  return /<(p|h[1-6]|blockquote|ul|ol|li|strong|em|b|i|br|div|span)[\s>]/i.test(trimmed);
}

/**
 * Extracts clean, lossless plain text projection from a TipTap doc JSON string, HTML string, or plain text.
 * Paragraphs and block elements are separated by double newlines (\n\n).
 * List items are separated by single newlines (\n).
 */
export function extractPlainText(content: string | object | null | undefined): string {
  if (!content) return '';
  let docObj: any = null;

  if (typeof content === 'object') {
    docObj = content;
  } else if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && parsed.type === 'doc' && Array.isArray(parsed.content)) {
          docObj = parsed;
        } else {
          return content;
        }
      } catch {
        return content;
      }
    } else if (isHtmlString(content)) {
      // If it's an HTML string, convert block boundaries to newlines and strip remaining tags
      return content
        .replace(/<\/(p|h[1-6]|blockquote|li|div)>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } else {
      return content;
    }
  }

  if (!docObj || docObj.type !== 'doc' || !Array.isArray(docObj.content)) {
    return typeof content === 'string' ? content : '';
  }

  function nodeToText(node: any): string {
    if (!node) return '';
    if (node.type === 'text') {
      return node.text || '';
    }
    if (node.type === 'hardBreak') {
      return '\n';
    }
    if (Array.isArray(node.content)) {
      if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'blockquote') {
        return node.content.map(nodeToText).join('');
      }
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        return node.content.map(nodeToText).join('\n');
      }
      if (node.type === 'listItem') {
        return node.content.map(nodeToText).join('\n');
      }
      return node.content.map(nodeToText).join('');
    }
    return '';
  }

  const blocks: string[] = [];
  for (const block of docObj.content) {
    const text = nodeToText(block);
    if (text.length > 0 || block.type === 'paragraph') {
      blocks.push(text);
    }
  }

  return blocks.join('\n\n');
}

/**
 * Converts a plain text string (with \n\n paragraphs) into a standard TipTap JSON doc.
 */
export function plainTextToTipTapDoc(plainText: string): { type: string; content: any[] } {
  if (!plainText || !plainText.trim()) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
        },
      ],
    };
  }

  const paragraphs = plainText.split(/\n\n+/);
  const content = paragraphs.map((para) => {
    const lines = para.split('\n');
    const paraContent: any[] = [];
    lines.forEach((line, idx) => {
      if (line) {
        paraContent.push({
          type: 'text',
          text: line,
        });
      }
      if (idx < lines.length - 1) {
        paraContent.push({
          type: 'hardBreak',
        });
      }
    });

    return {
      type: 'paragraph',
      content: paraContent.length > 0 ? paraContent : undefined,
    };
  });

  return {
    type: 'doc',
    content,
  };
}

export interface PlainTextSegment {
  plainStart: number;
  plainEnd: number;
  type: 'text' | 'hardBreak' | 'separator';
  text: string;
  node?: any;
  parentNode?: any;
  indexInParent?: number;
  blockNode?: any;
  blockIndex?: number;
}

export interface AnchorMatchResult {
  found: boolean;
  isStale: boolean;
  isAmbiguous?: boolean;
  range: { from: number; to: number };
  matchedQuote: string;
}

/**
 * Builds a deterministic 1-to-1 offset mapping between plain text projection and TipTap JSON nodes.
 * The concatenation of all segment texts is guaranteed to match extractPlainText(content).
 */
export function buildPlainTextOffsetMap(content: string | object | null | undefined): PlainTextSegment[] {
  if (!content) return [];
  let docObj: any = null;
  if (typeof content === 'object') {
    docObj = content;
  } else if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && parsed.type === 'doc' && Array.isArray(parsed.content)) {
          docObj = parsed;
        }
      } catch {}
    }
  }

  const segments: PlainTextSegment[] = [];
  let currentPlainOffset = 0;

  if (!docObj || docObj.type !== 'doc' || !Array.isArray(docObj.content)) {
    const plain = typeof content === 'string' ? content : '';
    if (plain) {
      segments.push({
        plainStart: 0,
        plainEnd: plain.length,
        type: 'text',
        text: plain,
      });
    }
    return segments;
  }

  const validBlocks = docObj.content.filter(
    (block: any) => block && (block.type === 'paragraph' || (block.content && block.content.length > 0))
  );

  function traverseNode(
    node: any,
    parent: any,
    idxInParent: number,
    blockNode: any,
    blockIdx: number
  ) {
    if (!node) return;
    if (node.type === 'text') {
      const text = node.text || '';
      if (text.length > 0) {
        segments.push({
          plainStart: currentPlainOffset,
          plainEnd: currentPlainOffset + text.length,
          type: 'text',
          text,
          node,
          parentNode: parent,
          indexInParent: idxInParent,
          blockNode,
          blockIndex: blockIdx,
        });
        currentPlainOffset += text.length;
      }
    } else if (node.type === 'hardBreak') {
      segments.push({
        plainStart: currentPlainOffset,
        plainEnd: currentPlainOffset + 1,
        type: 'hardBreak',
        text: '\n',
        node,
        parentNode: parent,
        indexInParent: idxInParent,
        blockNode,
        blockIndex: blockIdx,
      });
      currentPlainOffset += 1;
    } else if (Array.isArray(node.content)) {
      if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'listItem') {
        node.content.forEach((child: any, cIdx: number) => {
          traverseNode(child, node, cIdx, blockNode, blockIdx);
          if (cIdx < node.content.length - 1) {
            segments.push({
              plainStart: currentPlainOffset,
              plainEnd: currentPlainOffset + 1,
              type: 'separator',
              text: '\n',
              parentNode: node,
              blockNode,
              blockIndex: blockIdx,
            });
            currentPlainOffset += 1;
          }
        });
      } else {
        node.content.forEach((child: any, cIdx: number) => {
          traverseNode(child, node, cIdx, blockNode, blockIdx);
        });
      }
    }
  }

  validBlocks.forEach((block: any, bIdx: number) => {
    traverseNode(block, docObj, bIdx, block, bIdx);
    if (bIdx < validBlocks.length - 1) {
      segments.push({
        plainStart: currentPlainOffset,
        plainEnd: currentPlainOffset + 2,
        type: 'separator',
        text: '\n\n',
        parentNode: docObj,
        blockNode: block,
        blockIndex: bIdx,
      });
      currentPlainOffset += 2;
    }
  });

  return segments;
}

/**
 * Unified, deterministic anchor matcher used across Parser, Diff, and dynamic Re-anchoring.
 * Resolves occurrences with distance and context awareness, preventing inadvertent reversion to first occurrence.
 */
export function findBestAnchorMatch(options: {
  plainText: string;
  quote: string;
  previousRange?: { from: number; to: number };
  rangeHint?: { from: number; to: number };
}): AnchorMatchResult {
  const { plainText, quote } = options;
  const range = options.previousRange || options.rangeHint;
  const cleanQuote = (quote || '').trim();

  if (!plainText || !cleanQuote) {
    return {
      found: false,
      isStale: true,
      isAmbiguous: false,
      range: { from: 0, to: 0 },
      matchedQuote: cleanQuote,
    };
  }

  // 1. Direct Range Match Check
  if (range && range.from >= 0 && range.to <= plainText.length && range.from < range.to) {
    const directSlice = plainText.slice(range.from, range.to);
    if (directSlice === cleanQuote || directSlice.trim() === cleanQuote) {
      const exactPos = plainText.indexOf(cleanQuote, range.from);
      if (exactPos !== -1 && exactPos <= range.to) {
        return {
          found: true,
          isStale: false,
          range: { from: exactPos, to: exactPos + cleanQuote.length },
          matchedQuote: cleanQuote,
        };
      }
    }
  }

  // 2. Find all exact occurrences
  const occurrences: number[] = [];
  let pos = plainText.indexOf(cleanQuote);
  while (pos !== -1) {
    occurrences.push(pos);
    pos = plainText.indexOf(cleanQuote, pos + cleanQuote.length);
  }

  if (occurrences.length === 1) {
    return {
      found: true,
      isStale: false,
      range: { from: occurrences[0], to: occurrences[0] + cleanQuote.length },
      matchedQuote: cleanQuote,
    };
  }

  if (occurrences.length > 1) {
    if (range && typeof range.from === 'number') {
      let closest = occurrences[0];
      let minDist = Math.abs(occurrences[0] - range.from);
      for (let i = 1; i < occurrences.length; i++) {
        const dist = Math.abs(occurrences[i] - range.from);
        if (dist < minDist) {
          minDist = dist;
          closest = occurrences[i];
        }
      }

      return {
        found: true,
        isStale: false,
        range: { from: closest, to: closest + cleanQuote.length },
        matchedQuote: cleanQuote,
      };
    }

    // Multiple occurrences and NO range hint -> Ambiguous! Must refuse auto-replacement
    return {
      found: false,
      isStale: false,
      isAmbiguous: true,
      range: { from: 0, to: 0 },
      matchedQuote: cleanQuote,
    };
  }

  // 3. Fallback: Normalized Whitespace / Regex Search
  const escaped = cleanQuote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const regex = new RegExp(escaped, 'g');
  const matches = [...plainText.matchAll(regex)];

  if (matches.length === 1) {
    const matchIdx = matches[0].index || 0;
    const matchLen = matches[0][0].length;
    return {
      found: true,
      isStale: false,
      range: { from: matchIdx, to: matchIdx + matchLen },
      matchedQuote: matches[0][0],
    };
  }

  if (matches.length > 1) {
    if (range && typeof range.from === 'number') {
      let chosen = matches[0];
      let minDist = Math.abs((chosen.index || 0) - range.from);
      for (const m of matches) {
        const dist = Math.abs((m.index || 0) - range.from);
        if (dist < minDist) {
          minDist = dist;
          chosen = m;
        }
      }
      const matchIdx = chosen.index || 0;
      const matchLen = chosen[0].length;
      return {
        found: true,
        isStale: false,
        range: { from: matchIdx, to: matchIdx + matchLen },
        matchedQuote: chosen[0],
      };
    }

    return {
      found: false,
      isStale: false,
      isAmbiguous: true,
      range: { from: 0, to: 0 },
      matchedQuote: cleanQuote,
    };
  }

  // Not found in document
  return {
    found: false,
    isStale: true,
    isAmbiguous: false,
    range: { from: 0, to: 0 },
    matchedQuote: cleanQuote,
  };
}

/**
 * Converts plain text to HTML paragraphs for safe TipTap ingestion.
 * If the input is already a formatted HTML string (e.g. from Word import), returns it untouched.
 */
export function plainTextToHtml(plainText: string): string {
  if (!plainText) return '<p></p>';
  if (isHtmlString(plainText)) {
    return plainText;
  }
  return plainText
    .split(/\n\n+/)
    .map((para) => {
      const escaped = para
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');
      return `<p>${escaped}</p>`;
    })
    .join('');
}

