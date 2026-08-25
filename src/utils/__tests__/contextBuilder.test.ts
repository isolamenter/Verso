import { describe, it, expect } from 'vitest';
import {
  buildLiteraryContext,
  buildColdReaderIsolatedContext,
  resolveEffectiveContextConfig,
  getPreviousScene,
  formatCharacterNotes,
  formatMotifs,
  formatEntireManuscript,
} from '../contextBuilder';
import type { Manuscript, Scene, ContextSelectionConfig } from '../../types';

const mockManuscript: Manuscript = {
  id: 'manu-test',
  projectId: 'proj-test',
  title: '南方纪事',
  genre: 'short_story',
  synopsis: '暴雨停歇后的老街',
  characters: [
    { id: 'c1', name: '老周', role: '修鞋匠', notes: '右腿微跛，极少主动开口。' },
    { id: 'c2', name: '阿秀', role: '老板娘', notes: '习惯清扫门前积水。' },
  ],
  motifs: [
    { id: 'm1', name: '卷帘门', description: '锈蚀铁皮与外界隔绝' },
    { id: 'm2', name: '一线黑水', description: '低洼处的死水' },
  ],
  notes: '尽量避免直接心理描写',
  createdAt: 1000,
  updatedAt: 1000,
};

const mockScenes: Scene[] = [
  {
    id: 's1',
    manuscriptId: 'manu-test',
    title: '第一场：黑水',
    order: 1,
    content: '雨停以后，修鞋铺没有开门。门下积着黑水。',
    createdAt: 1000,
    updatedAt: 1000,
  },
  {
    id: 's2',
    manuscriptId: 'manu-test',
    title: '第二场：锁孔',
    order: 2,
    content: '铁皮很薄，敲上去哗啦响了一声。鞋在里面。',
    createdAt: 2000,
    updatedAt: 2000,
  },
];

describe('ContextBuilder', () => {
  it('should find the immediately previous scene correctly', () => {
    expect(getPreviousScene(mockScenes, 's2')?.id).toBe('s1');
    expect(getPreviousScene(mockScenes, 's1')).toBeNull();
  });

  it('should format character notes and motifs properly', () => {
    const charNotes = formatCharacterNotes(mockManuscript);
    expect(charNotes).toContain('• 老周 (修鞋匠): 右腿微跛');
    expect(charNotes).toContain('• 阿秀 (老板娘): 习惯清扫');

    const motifs = formatMotifs(mockManuscript);
    expect(motifs).toContain('• 卷帘门: 锈蚀铁皮');
    expect(motifs).toContain('• 一线黑水: 低洼处的死水');
  });

  it('should format entire manuscript with scenes in order', () => {
    const full = formatEntireManuscript(mockScenes, 's2');
    expect(full).toContain('=== 第 1 场：第一场：黑水 ===');
    expect(full).toContain('=== 第 2 场：第二场：锁孔 [当前所在场景] ===');
  });

  it('should build context string respecting selection config', () => {
    const config: ContextSelectionConfig = {
      includeSelectedText: true,
      includeCurrentScene: true,
      includePreviousScene: true,
      includeCharacterNotes: true,
      includeMotifs: true,
      includeEntireManuscript: false,
    };

    const selectedText = '门下积着黑水。';
    const built = buildLiteraryContext(config, mockManuscript, mockScenes, mockScenes[1], selectedText);

    expect(built.formattedPromptString).toContain('【目标选中文段');
    expect(built.formattedPromptString).toContain('【所属场景上下文');
    expect(built.formattedPromptString).toContain('【前一场景衔接');
    expect(built.formattedPromptString).toContain('【登场人物与声线设定');
    expect(built.formattedPromptString).toContain('【核心意象与物象网络');
    expect(built.formattedPromptString).not.toContain('【全书文稿');
    expect(built.totalTokens).toBeGreaterThan(0);
    expect(built.sections.length).toBe(6);
  });

  it('should strictly isolate Cold Reader context (Zero-Context Isolation Guarantee)', () => {
    const coldContext = buildColdReaderIsolatedContext(mockScenes[0]);

    expect(coldContext.isColdReadIsolated).toBe(true);
    expect(coldContext.formattedPromptString).toBe(mockScenes[0].content);
    expect(coldContext.formattedPromptString).not.toContain('老周');
    expect(coldContext.formattedPromptString).not.toContain('修鞋匠');
    expect(coldContext.formattedPromptString).not.toContain('卷帘门');
    expect(coldContext.sections.length).toBe(1);
    expect(coldContext.sections[0].id).toBe('cold_read_scene');
  });

  describe('resolveEffectiveContextConfig', () => {
    const baseConfig: ContextSelectionConfig = {
      includeSelectedText: true,
      includeCurrentScene: true,
      includePreviousScene: false,
      includeCharacterNotes: true,
      includeMotifs: false,
      includeEntireManuscript: false,
    };

    it('should return baseConfig when policy is ui_default or undefined', () => {
      expect(resolveEffectiveContextConfig(baseConfig, 'ui_default')).toEqual(baseConfig);
      expect(resolveEffectiveContextConfig(baseConfig, undefined)).toEqual(baseConfig);
    });

    it('should return selection_only config when policy is selection_only', () => {
      expect(resolveEffectiveContextConfig(baseConfig, 'selection_only')).toEqual({
        includeSelectedText: true,
        includeCurrentScene: false,
        includePreviousScene: false,
        includeCharacterNotes: false,
        includeMotifs: false,
        includeEntireManuscript: false,
      });
    });

    it('should return current_scene_only config when policy is current_scene_only', () => {
      expect(resolveEffectiveContextConfig(baseConfig, 'current_scene_only')).toEqual({
        includeSelectedText: true,
        includeCurrentScene: true,
        includePreviousScene: false,
        includeCharacterNotes: false,
        includeMotifs: false,
        includeEntireManuscript: false,
      });
    });

    it('should return scene_and_notes config when policy is scene_and_notes', () => {
      expect(resolveEffectiveContextConfig(baseConfig, 'scene_and_notes')).toEqual({
        includeSelectedText: true,
        includeCurrentScene: true,
        includePreviousScene: false,
        includeCharacterNotes: true,
        includeMotifs: true,
        includeEntireManuscript: false,
      });
    });

    it('should return scene_and_preceding config when policy is scene_and_preceding', () => {
      expect(resolveEffectiveContextConfig(baseConfig, 'scene_and_preceding')).toEqual({
        includeSelectedText: true,
        includeCurrentScene: true,
        includePreviousScene: true,
        includeCharacterNotes: true,
        includeMotifs: true,
        includeEntireManuscript: false,
      });
    });

    it('should return full_manuscript config when policy is full_manuscript', () => {
      expect(resolveEffectiveContextConfig(baseConfig, 'full_manuscript')).toEqual({
        includeSelectedText: true,
        includeCurrentScene: true,
        includePreviousScene: true,
        includeCharacterNotes: true,
        includeMotifs: true,
        includeEntireManuscript: true,
      });
    });
  });
});

