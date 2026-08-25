import type { ContextSelectionConfig, Manuscript, Scene } from '../types';
import { estimateTokenCount } from '../providers/base';
import { extractPlainText } from './textProjection';

export interface ContextSection {
  id: string;
  name: string;
  content: string;
  tokenCount: number;
  included: boolean;
}

export interface BuiltContext {
  formattedPromptString: string;
  totalTokens: number;
  sections: ContextSection[];
  isColdReadIsolated?: boolean;
}

/**
 * Finds the immediately preceding scene in order.
 */
export function getPreviousScene(scenes?: Scene[] | null, currentSceneId?: string): Scene | null {
  if (!scenes || scenes.length <= 1 || !currentSceneId) return null;
  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  const currentIndex = sorted.findIndex((s) => s.id === currentSceneId);
  if (currentIndex > 0) {
    return sorted[currentIndex - 1];
  }
  return null;
}

/**
 * Formats character notes into a clean textual representation.
 */
export function formatCharacterNotes(manuscript?: Manuscript | null): string {
  if (!manuscript || !manuscript.characters || manuscript.characters.length === 0) return '';
  return manuscript.characters
    .map((c) => `• ${c.name} (${c.role || '角色'}): ${c.notes || '暂无声线与动机备忘'}`)
    .join('\n');
}

/**
 * Formats motif items into a clean textual representation.
 */
export function formatMotifs(manuscript?: Manuscript | null): string {
  if (!manuscript || !manuscript.motifs || manuscript.motifs.length === 0) return '';
  return manuscript.motifs
    .map((m) => `• ${m.name}: ${m.description || '核心意象与物象载体'}`)
    .join('\n');
}

/**
 * Formats entire manuscript (concatenating all scenes in order).
 */
export function formatEntireManuscript(scenes?: Scene[] | null, currentSceneId?: string): string {
  if (!scenes || scenes.length === 0) return '';
  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  return sorted
    .map((s, idx) => {
      const isCurrent = s.id === currentSceneId ? ' [当前所在场景]' : '';
      const text = extractPlainText(s.content);
      return `=== 第 ${idx + 1} 场：${s.title}${isCurrent} ===\n${text}\n`;
    })
    .join('\n\n');
}

/**
 * Builds the complete literary context according to configuration.
 */
export function buildLiteraryContext(
  config: ContextSelectionConfig,
  manuscript?: Manuscript | null,
  scenes?: Scene[] | null,
  currentScene?: Scene | null,
  selectedText?: string
): BuiltContext {
  const safeScenes = scenes || [];
  const sections: ContextSection[] = [];

  // 1. Selected text
  const rawSelected = (selectedText || '').trim();
  const selectedTokenCount = estimateTokenCount(rawSelected);
  sections.push({
    id: 'selected_text',
    name: '当前选中文段',
    content: rawSelected,
    tokenCount: selectedTokenCount,
    included: config.includeSelectedText && rawSelected.length > 0,
  });

  // 2. Current scene
  const rawScene = extractPlainText(currentScene?.content || '').trim();
  const sceneTokenCount = estimateTokenCount(rawScene);
  sections.push({
    id: 'current_scene',
    name: `当前场景 (《${currentScene?.title || '未命名场景'}》)`,
    content: rawScene,
    tokenCount: sceneTokenCount,
    included: config.includeCurrentScene && rawScene.length > 0,
  });

  // 3. Previous scene
  const prevScene = getPreviousScene(safeScenes, currentScene?.id);
  const rawPrevScene = extractPlainText(prevScene?.content || '').trim();
  const prevSceneTokenCount = estimateTokenCount(rawPrevScene);
  sections.push({
    id: 'previous_scene',
    name: prevScene ? `前一场景 (《${prevScene.title}》)` : '前一场景 (无)',
    content: rawPrevScene,
    tokenCount: prevSceneTokenCount,
    included: config.includePreviousScene && rawPrevScene.length > 0,
  });

  // 4. Character notes
  const rawCharNotes = formatCharacterNotes(manuscript).trim();
  const charNotesTokenCount = estimateTokenCount(rawCharNotes);
  sections.push({
    id: 'character_notes',
    name: `人物小传与声线 (${manuscript?.characters?.length || 0})`,
    content: rawCharNotes,
    tokenCount: charNotesTokenCount,
    included: config.includeCharacterNotes && rawCharNotes.length > 0,
  });

  // 5. Motifs
  const rawMotifs = formatMotifs(manuscript).trim();
  const motifsTokenCount = estimateTokenCount(rawMotifs);
  sections.push({
    id: 'motifs',
    name: `核心意象网络 (${manuscript?.motifs?.length || 0})`,
    content: rawMotifs,
    tokenCount: motifsTokenCount,
    included: config.includeMotifs && rawMotifs.length > 0,
  });

  // 6. Entire manuscript
  const rawEntire = config.includeEntireManuscript ? formatEntireManuscript(safeScenes, currentScene?.id) : '';
  const entireTokenCount = estimateTokenCount(rawEntire);
  sections.push({
    id: 'entire_manuscript',
    name: `全书稿 (${safeScenes.length} 场景)`,
    content: rawEntire,
    tokenCount: entireTokenCount,
    included: config.includeEntireManuscript && rawEntire.length > 0,
  });

  // Assemble formatted string
  const promptParts: string[] = [];

  const includedSections = sections.filter((s) => s.included && s.content);
  let totalTokens = 0;

  for (const sec of includedSections) {
    totalTokens += sec.tokenCount;
    switch (sec.id) {
      case 'selected_text':
        promptParts.push(`【目标选中文段 (Target Text for Review)】\n"""\n${sec.content}\n"""`);
        break;
      case 'current_scene':
        promptParts.push(`【所属场景上下文 (Current Scene Context: 《${currentScene?.title || '未命名场景'}》)】\n"""\n${sec.content}\n"""`);
        break;
      case 'previous_scene':
        promptParts.push(`【前一场景衔接 (Previous Scene Context)】\n"""\n${sec.content}\n"""`);
        break;
      case 'character_notes':
        promptParts.push(`【登场人物与声线设定 (Character Notes)】\n${sec.content}`);
        break;
      case 'motifs':
        promptParts.push(`【核心意象与物象网络 (Motifs)】\n${sec.content}`);
        break;
      case 'entire_manuscript':
        promptParts.push(`【全书文稿 (Full Manuscript Context)】\n"""\n${sec.content}\n"""`);
        break;
    }
  }

  return {
    formattedPromptString: promptParts.join('\n\n'),
    totalTokens,
    sections,
  };
}

/**
 * Builds Strict Zero-Context payload specifically for Cold Reader.
 * Guaranteed to strip all background, notes, author intent, and lenses!
 */
export function buildColdReaderIsolatedContext(
  currentScene?: Scene | null
): BuiltContext {
  const cleanContent = extractPlainText(currentScene?.content || '').trim();
  const tokenCount = estimateTokenCount(cleanContent);

  const section: ContextSection = {
    id: 'cold_read_scene',
    name: `冷读盲审纯正文 (《${currentScene?.title || '未命名场景'}》)`,
    content: cleanContent,
    tokenCount,
    included: true,
  };

  return {
    formattedPromptString: cleanContent,
    totalTokens: tokenCount,
    sections: [section],
    isColdReadIsolated: true,
  };
}

