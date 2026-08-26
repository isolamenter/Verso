export interface Scene {
  id: string;
  manuscriptId: string;
  title: string;
  order: number;
  content: string; // Markdown or HTML/TipTap JSON content
  pov?: string;
  location?: string;
  timeframe?: string;
  summary?: string;
  updatedAt: number;
  createdAt: number;
}

export interface MotifItem {
  id: string;
  name: string;
  description: string;
  occurrencesCount?: number;
}

export interface CharacterItem {
  id: string;
  name: string;
  alias?: string;
  role: string;
  notes: string;
}

export interface Manuscript {
  id: string;
  projectId: string;
  title: string;
  genre: 'novel' | 'novella' | 'short_story' | 'essay' | 'poetry';
  synopsis?: string;
  motifs: MotifItem[];
  characters: CharacterItem[];
  notes: string;
  themeAnalysis?: string; // AI 提炼的深层文学矛盾剖析，与 notes（用户创作备忘）分离
  updatedAt: number;
  createdAt: number;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RevisionSnapshot {
  id: string;
  sceneId: string;
  timestamp: number;
  description: string; // e.g. "采纳语言建议：删减冗余副词" 或 "段落重构 Checkpoint"
  changeType: 'ai_accepted' | 'manual_edit' | 'cut' | 'checkpoint' | 'rollback';
  content: string;
  diffSummary?: string;
  rollbackSourceRevId?: string; // 如果是回滚，记录被回滚的目标版本 ID
  characterCount?: number;
}

export interface MarginNote {
  id: string;
  sceneId: string;
  author: 'human' | 'ai';
  range: {
    from: number;
    to: number;
  };
  quote: string;
  content: string;
  resolved?: boolean;
  createdAt: number;
}
