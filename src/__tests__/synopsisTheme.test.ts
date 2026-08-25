import { describe, it, expect } from 'vitest';
import type { Manuscript } from '../types';

describe('Literary Memo: Synopsis and Notes', () => {
  it('should initialize manuscript with synopsis and notes fields matching database schema', () => {
    const manuscript: Manuscript = {
      id: 'manu-1',
      projectId: 'proj-1',
      title: '夜行货车',
      genre: 'short_story',
      synopsis: '南方暴雨之夜，林远与陆舟在旧车站的意外相遇。',
      motifs: [{ id: 'm1', name: '车灯', description: '穿透雨幕的苍白光束' }],
      characters: [{ id: 'c1', name: '林远', role: '主角', notes: '声线低沉冷硬' }],
      notes: '表层是离别危机，实质是两代人在城市化浪潮下的道德焦虑；保持克制客观的叙事距离。',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(manuscript.synopsis).toBe('南方暴雨之夜，林远与陆舟在旧车站的意外相遇。');
    expect(manuscript.notes).toBe('表层是离别危机，实质是两代人在城市化浪潮下的道德焦虑；保持克制客观的叙事距离。');
    expect(manuscript.genre).toBe('short_story');
  });

  it('should allow updating synopsis, notes, title, and genre independently', () => {
    let manuscript: Manuscript = {
      id: 'manu-1',
      projectId: 'proj-1',
      title: '夜行货车',
      genre: 'short_story',
      synopsis: '',
      motifs: [],
      characters: [],
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updateManuscript = (updates: Partial<Manuscript>) => {
      manuscript = { ...manuscript, ...updates, updatedAt: Date.now() };
    };

    updateManuscript({ synopsis: '新梗概：雨夜疾驰' });
    expect(manuscript.synopsis).toBe('新梗概：雨夜疾驰');

    updateManuscript({ notes: '新主题与备忘：记忆的不可靠性' });
    expect(manuscript.notes).toBe('新主题与备忘：记忆的不可靠性');

    updateManuscript({ genre: 'novella' });
    expect(manuscript.genre).toBe('novella');
  });
});

