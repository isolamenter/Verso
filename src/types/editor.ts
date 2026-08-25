export type PaperTheme = 'parchment' | 'frost' | 'ink';
export type TypographyFamily = 'serif' | 'kaiti' | 'sans' | 'mono';

export interface EditorStats {
  chineseCharacters: number; // 纯中文字符数
  totalWords: number;        // 总字数 (含英文单词)
  paragraphs: number;
  readingTimeMinutes: number;
}

export interface SelectionRange {
  from: number;
  to: number;
  text: string;
}

export interface SearchState {
  isOpen: boolean;
  query: string;
  replaceQuery: string;
  caseSensitive: boolean;
  matchIndex: number;
  totalMatches: number;
}
