import type { AnchorMatchResult } from "./types";

/**
 * Deterministic FNV-1a 32-bit checksum for plain text and JSON bodies.
 * Fast, pure, and identical across Node.js and browser environments.
 */
export function computeTextChecksum(text: string): string {
  if (!text) return "00000000";
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export interface FindAnchorOptions {
  plainText: string;
  quote: string;
  prefixAnchor?: string;
  suffixAnchor?: string;
  rangeHint?: { from: number; to: number };
  previousRange?: { from: number; to: number };
}

/**
 * Unified, deterministic anchor matcher used across Change Sets, Annotations, and Re-anchoring.
 * Resolves occurrences with prefix/suffix anchors, range hints, and detects ambiguity.
 */
export function findBestAnchorMatch(options: FindAnchorOptions): AnchorMatchResult {
  const { plainText, quote, prefixAnchor, suffixAnchor } = options;
  const range = options.previousRange || options.rangeHint;
  const cleanQuote = (quote || "").trim();

  if (!plainText || !cleanQuote) {
    return {
      found: false,
      isStale: true,
      isAmbiguous: false,
      range: { from: 0, to: 0 },
      matchedQuote: cleanQuote,
    };
  }

  // 1. Check with prefixAnchor and suffixAnchor context if provided
  if (prefixAnchor || suffixAnchor) {
    const cleanPrefix = (prefixAnchor || "").trim();
    const cleanSuffix = (suffixAnchor || "").trim();

    let searchStart = 0;
    const candidates: number[] = [];

    while (searchStart < plainText.length) {
      const idx = plainText.indexOf(cleanQuote, searchStart);
      if (idx === -1) break;

      let score = 0;
      if (cleanPrefix) {
        const prefixBefore = plainText.slice(Math.max(0, idx - cleanPrefix.length - 20), idx);
        if (prefixBefore.includes(cleanPrefix)) score += 2;
      }
      if (cleanSuffix) {
        const suffixAfter = plainText.slice(idx + cleanQuote.length, idx + cleanQuote.length + cleanSuffix.length + 20);
        if (suffixAfter.includes(cleanSuffix)) score += 2;
      }

      if (score > 0) {
        candidates.push(idx);
      }
      searchStart = idx + cleanQuote.length;
    }

    if (candidates.length === 1) {
      return {
        found: true,
        isStale: false,
        isAmbiguous: false,
        range: { from: candidates[0], to: candidates[0] + cleanQuote.length },
        matchedQuote: cleanQuote,
      };
    }
  }

  // 2. Direct Range Match Check
  if (range && range.from >= 0 && range.to <= plainText.length && range.from < range.to) {
    const directSlice = plainText.slice(range.from, range.to);
    if (directSlice === cleanQuote || directSlice.trim() === cleanQuote) {
      const exactPos = plainText.indexOf(cleanQuote, range.from);
      if (exactPos !== -1 && exactPos <= range.to) {
        return {
          found: true,
          isStale: false,
          isAmbiguous: false,
          range: { from: exactPos, to: exactPos + cleanQuote.length },
          matchedQuote: cleanQuote,
        };
      }
    }
  }

  // 3. Find all exact occurrences
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
      isAmbiguous: false,
      range: { from: occurrences[0], to: occurrences[0] + cleanQuote.length },
      matchedQuote: cleanQuote,
    };
  }

  if (occurrences.length > 1) {
    if (range && typeof range.from === "number") {
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
        isAmbiguous: false,
        range: { from: closest, to: closest + cleanQuote.length },
        matchedQuote: cleanQuote,
      };
    }

    // Multiple occurrences and NO range/anchor hint -> Ambiguous! Must refuse auto-replacement
    return {
      found: false,
      isStale: false,
      isAmbiguous: true,
      range: { from: 0, to: 0 },
      matchedQuote: cleanQuote,
    };
  }

  // 4. Fallback: Stale quote not found
  return {
    found: false,
    isStale: true,
    isAmbiguous: false,
    range: { from: 0, to: 0 },
    matchedQuote: cleanQuote,
  };
}

