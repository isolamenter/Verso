import { extractPlainText } from "./text-projection";
import { findBestAnchorMatch } from "./anchoring";

export interface SceneSplitItem {
  title: string;
  summary?: string;
  startQuote: string;
  pov?: string;
  timeframe?: string;
}

export interface SceneSplitResult {
  title: string;
  summary?: string;
  content: string;
  startQuote: string;
  range: { from: number; to: number };
  characterCount: number;
  pov?: string;
  timeframe?: string;
}

/**
 * Computes non-whitespace text coverage of the splits against the full original text.
 * Returns a number between 0 and 1.
 */
export function computeSplitCoverage(
  fullText: string,
  splits: Array<{ content: string }>
): number {
  if (!fullText) return 1;
  const norm = (s: string) => (extractPlainText(s) || "").replace(/\s+/g, "");
  const fullNorm = norm(fullText);
  if (!fullNorm) return 1;
  const joinedNorm = splits.map((s) => norm(s.content || "")).join("");
  return Math.min(1, joinedNorm.length / fullNorm.length);
}

/**
 * Splits plain or rich manuscript text into gapless, non-overlapping scene segments
 * by locating startQuote anchors monotonically from start to finish.
 */
export function splitManuscriptTextByAnchors(
  sourceText: string,
  splits: SceneSplitItem[]
): SceneSplitResult[] {
  const plainSource = extractPlainText(sourceText || "");
  if (!plainSource.trim() || !splits || splits.length === 0) {
    return [];
  }

  // If only 1 scene, the whole sourceText belongs to scene 1
  if (splits.length === 1) {
    const s0 = splits[0];
    return [
      {
        title: s0.title?.trim() || "第一场",
        summary: s0.summary?.trim(),
        content: plainSource,
        startQuote: s0.startQuote?.trim() || plainSource.slice(0, 30),
        range: { from: 0, to: plainSource.length },
        characterCount: plainSource.length,
        pov: s0.pov,
        timeframe: s0.timeframe,
      },
    ];
  }

  interface SplitAnchor {
    title: string;
    summary?: string;
    startQuote: string;
    offset: number;
    pov?: string;
    timeframe?: string;
  }

  const anchors: SplitAnchor[] = [];
  let searchStartPos = 0;

  for (let i = 0; i < splits.length; i++) {
    const item = splits[i];
    const title = item.title?.trim() || `第 ${i + 1} 场`;
    const summary = item.summary?.trim();
    const startQuote = item.startQuote?.trim() || "";

    if (i === 0) {
      anchors.push({
        title,
        summary,
        startQuote: startQuote || plainSource.slice(0, 30),
        offset: 0,
        pov: item.pov,
        timeframe: item.timeframe,
      });
      continue;
    }

    if (!startQuote) continue;

    // 1. Exact match from searchStartPos
    let matchedPos = plainSource.indexOf(startQuote, searchStartPos);

    // 2. Fuzzy anchor match in remaining text
    if (matchedPos === -1) {
      const remaining = plainSource.slice(searchStartPos);
      const match = findBestAnchorMatch({
        plainText: remaining,
        quote: startQuote,
      });
      if (match.found && match.range.from >= 0) {
        matchedPos = searchStartPos + match.range.from;
      }
    }

    // 3. Shorter prefix match fallback
    if (matchedPos === -1 && startQuote.length > 8) {
      const shortQuote = startQuote.slice(0, 8);
      matchedPos = plainSource.indexOf(shortQuote, searchStartPos);
    }

    if (matchedPos !== -1 && matchedPos > searchStartPos) {
      anchors.push({
        title,
        summary,
        startQuote,
        offset: matchedPos,
        pov: item.pov,
        timeframe: item.timeframe,
      });
      searchStartPos = matchedPos;
    }
  }

  // If no secondary split anchors could be matched, fallback to single scene covering full text
  if (anchors.length <= 1) {
    const s0 = splits[0];
    return [
      {
        title: s0.title?.trim() || "第一场",
        summary: s0.summary?.trim(),
        content: plainSource,
        startQuote: s0.startQuote?.trim() || plainSource.slice(0, 30),
        range: { from: 0, to: plainSource.length },
        characterCount: plainSource.length,
        pov: s0.pov,
        timeframe: s0.timeframe,
      },
    ];
  }

  // Slice plainSource into non-overlapping, gapless segments
  const results: SceneSplitResult[] = [];
  for (let i = 0; i < anchors.length; i++) {
    const current = anchors[i];
    const nextOffset = i + 1 < anchors.length ? anchors[i + 1].offset : plainSource.length;
    const content = plainSource.slice(current.offset, nextOffset);

    results.push({
      title: current.title,
      summary: current.summary,
      content,
      startQuote: current.startQuote,
      range: { from: current.offset, to: nextOffset },
      characterCount: content.length,
      pov: current.pov,
      timeframe: current.timeframe,
    });
  }

  return results;
}

