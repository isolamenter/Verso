export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: TipTapMark[];
  content?: TipTapNode[];
}

export interface TipTapDoc {
  type: "doc";
  content: TipTapNode[];
}

export interface PlainTextSegment {
  plainStart: number;
  plainEnd: number;
  type: "text" | "hardBreak" | "separator";
  text: string;
  node?: TipTapNode;
  parentNode?: TipTapNode;
  indexInParent?: number;
  blockNode?: TipTapNode;
  blockIndex?: number;
}

export interface AnchorMatchResult {
  found: boolean;
  isStale: boolean;
  isAmbiguous?: boolean;
  range: { from: number; to: number };
  matchedQuote: string;
  score?: number;
}

export interface EditorStats {
  chineseCharacters: number;
  totalWords: number;
  paragraphs: number;
  readingTimeMinutes: number;
}

export interface PatchOperation {
  quote?: string;
  prefixAnchor?: string;
  suffixAnchor?: string;
  rangeFrom?: number;
  rangeTo?: number;
  replacementContent: string;
  originalChecksum?: string;
}

export interface PatchResult {
  success: boolean;
  newDoc: TipTapDoc;
  newDocJson: string;
  newPlainText: string;
  matchedFrom?: number;
  matchedTo?: number;
  isStale?: boolean;
  isAmbiguous?: boolean;
  error?: string;
}

