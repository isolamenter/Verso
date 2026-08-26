import { describe, it, expect } from 'vitest';
import {
  buildSynopsisPrompt,
  buildThemePrompt,
  buildCharactersPrompt,
  buildMotifsPrompt,
  buildSceneSplitsPrompt,
} from '../profiler';
import type { CharacterItem, MotifItem, Scene } from '../../types';

// ---- 建档五模块独立 builder ----

const TITLE = '夜巡';
const CONTENT = '第一章：起首\n钟表在黑暗中摆动。\n\n第二章：雨夜\n雨水打在铁皮屋顶上。';

const char = (name: string, alias?: string): CharacterItem => ({
  id: `char-${name}`,
  name,
  alias,
  role: '主角',
  notes: '声线沙哑克制。',
});

const motif = (name: string): MotifItem => ({
  id: `motif-${name}`,
  name,
  description: '象征凝滞的时间。',
  occurrencesCount: 3,
});

const scene = (title: string, content: string): Scene => ({
  id: `scene-${title}`,
  manuscriptId: 'm1',
  title,
  order: 1,
  content,
  createdAt: 0,
  updatedAt: 0,
});

describe('建档五模块 builder（generate 模式）', () => {
  it('synopsis: 含正文与 synopsis JSON 键，不含其他模块字段', () => {
    const prompt = buildSynopsisPrompt({ title: TITLE, content: CONTENT, mode: 'generate' });
    expect(prompt).toContain('文稿正文');
    expect(prompt).toContain('钟表在黑暗中摆动');
    expect(prompt).toContain('"synopsis"');
    expect(prompt).not.toContain('themeAnalysis');
    expect(prompt).not.toContain('characters');
    expect(prompt).not.toContain('sceneSplits');
  });

  it('theme: 含深层矛盾要求与 themeAnalysis JSON 键', () => {
    const prompt = buildThemePrompt({ title: TITLE, content: CONTENT, mode: 'generate' });
    expect(prompt).toContain('深层隐秘矛盾');
    expect(prompt).toContain('"themeAnalysis"');
  });

  it('characters: 含四档 role 与 alias 说明', () => {
    const prompt = buildCharactersPrompt({ title: TITLE, content: CONTENT, mode: 'generate' });
    expect(prompt).toContain('"characters"');
    expect(prompt).toContain('"主角"');
    expect(prompt).toContain('别名');
  });

  it('motifs: 含 occurrencesCount 频次要求', () => {
    const prompt = buildMotifsPrompt({ title: TITLE, content: CONTENT, mode: 'generate' });
    expect(prompt).toContain('"motifs"');
    expect(prompt).toContain('occurrencesCount');
  });

  it('scene_splits: 含全量切分与 startQuote 锚点要求', () => {
    const prompt = buildSceneSplitsPrompt({ title: TITLE, content: CONTENT, mode: 'generate' });
    expect(prompt).toContain('"sceneSplits"');
    expect(prompt).toContain('全量切分');
    expect(prompt).toContain('startQuote');
    expect(prompt).toContain('严禁回吐大段正文内容');
  });

  it('userNotes 注入【作者批注与核心修正要求】段，空白批注不出现', () => {
    const withNotes = buildSynopsisPrompt({
      title: TITLE,
      content: CONTENT,
      mode: 'generate',
      userNotes: '梗概突出反转。',
    });
    expect(withNotes).toContain('作者批注与核心修正要求');
    expect(withNotes).toContain('梗概突出反转。');

    const emptyNotes = buildSynopsisPrompt({
      title: TITLE,
      content: CONTENT,
      mode: 'generate',
      userNotes: '   ',
    });
    expect(emptyNotes).not.toContain('作者批注与核心修正要求');
  });
});

describe('建档五模块 builder（refine 模式）', () => {
  it('synopsis refine 注入当前梗概修订基线', () => {
    const prompt = buildSynopsisPrompt({
      title: TITLE,
      content: CONTENT,
      mode: 'refine',
      currentValue: '旧梗概：一个修表匠的故事。',
    });
    expect(prompt).toContain('当前梗概（修订基线）');
    expect(prompt).toContain('旧梗概：一个修表匠的故事。');
    expect(prompt).toContain('保留未受批注影响的部分');
  });

  it('theme refine 注入当前主题剖析', () => {
    const prompt = buildThemePrompt({
      title: TITLE,
      content: CONTENT,
      mode: 'refine',
      currentValue: '旧剖析：时间与记忆的冲突。',
    });
    expect(prompt).toContain('当前主题剖析（修订基线）');
    expect(prompt).toContain('旧剖析：时间与记忆的冲突。');
  });

  it('characters refine 注入当前列表并要求合并重复条目', () => {
    const prompt = buildCharactersPrompt({
      title: TITLE,
      content: CONTENT,
      mode: 'refine',
      currentValue: [char('陈老九', '九叔'), char('九叔')],
    });
    expect(prompt).toContain('当前人物列表（修订基线）');
    expect(prompt).toContain('姓名：陈老九 | 别名：九叔');
    expect(prompt).toContain('合并重复条目');
  });

  it('motifs refine 注入当前意象列表', () => {
    const prompt = buildMotifsPrompt({
      title: TITLE,
      content: CONTENT,
      mode: 'refine',
      currentValue: [motif('停止摆动的座钟')],
    });
    expect(prompt).toContain('当前意象列表（修订基线）');
    expect(prompt).toContain('停止摆动的座钟');
  });

  it('scene_splits refine 注入当前分场边界锚点', () => {
    const prompt = buildSceneSplitsPrompt({
      title: TITLE,
      content: CONTENT,
      mode: 'refine',
      currentValue: [
        scene('第一场：钟声渐歇', '第一章：起首\n钟表在黑暗中摆动。'),
        scene('第二场：盲女登门', '第二章：雨夜\n雨水打在铁皮屋顶上。'),
      ],
    });
    expect(prompt).toContain('当前分场结构（参考切分粒度与边界）');
    expect(prompt).toContain('《第一场：钟声渐歇》');
    expect(prompt).toContain('钟表在黑暗中摆动');
    expect(prompt).toContain('可参考现有分场边界');
  });

  it('refine 模式空当前值时退化为纯生成（无基线段）', () => {
    const prompt = buildSynopsisPrompt({ title: TITLE, content: CONTENT, mode: 'refine', currentValue: '' });
    expect(prompt).not.toContain('修订基线');
  });
});
