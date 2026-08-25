import { describe, it, expect } from 'vitest';
import { buildManuscriptProfilePrompt } from '../profiler';
import { parseManuscriptProfileResponse } from '../parser';

describe('Manuscript Profiler & Onboarding', () => {
  it('should build profiling prompt with scene split instructions for long text or chapter markers', () => {
    const promptWithChapters = buildManuscriptProfilePrompt(
      '夜巡',
      '第一章：起首\n钟表在黑暗中摆动。\n\n第二章：雨夜\n雨水打在铁皮屋顶上。'
    );
    expect(promptWithChapters).toContain('智能分场切分建议');
    expect(promptWithChapters).toContain('sceneSplits');

    const promptShort = buildManuscriptProfilePrompt('诗歌短章', '一滴水落在玻璃上。', {
      shouldSuggestScenes: false,
    });
    expect(promptShort).not.toContain('sceneSplits');
  });

  it('should include author annotations and directives when userNotes is provided', () => {
    const userNotes = '主角是陈默，修正人物身份为前侦探；重点提炼生锈钥匙与旧皮箱的意象；梗概突出反转。';
    const prompt = buildManuscriptProfilePrompt('雨夜迷局', '正文内容……', {
      userNotes,
    });

    expect(prompt).toContain('作者批注与核心修正要求');
    expect(prompt).toContain(userNotes);
    expect(prompt).toContain('严格遵从作者批注中关于人物身份、关系与性格的修正');
    expect(prompt).toContain('优先覆盖作者批注中指定或强调的核心意象');
  });

  it('should not include author annotations section when userNotes is empty or whitespace', () => {
    const promptEmpty = buildManuscriptProfilePrompt('雨夜迷局', '正文内容……', {
      userNotes: '   ',
    });
    expect(promptEmpty).not.toContain('作者批注与核心修正要求');
  });

  it('should parse complete structured profiling response JSON', () => {
    const raw = JSON.stringify({
      synopsis: '讲述一个修表匠在城市拆迁前夕与盲女相遇的故事。',
      themeAnalysis: '深层矛盾在于物理时间的精确性与个体记忆的流逝感之间的冲突。',
      characters: [
        {
          name: '陈老九',
          alias: '九叔',
          role: '主角',
          notes: '声线沙哑克制，几乎不使用形容词，动作比话语先到。',
        },
        {
          name: '阿清',
          role: '主要配角',
          notes: '盲女，对声音和气味有超常的记忆力。',
        },
      ],
      motifs: [
        {
          name: '停止摆动的座钟',
          description: '象征凝滞不前的停滞时间与未完成的过去。',
          occurrencesCount: 4,
        },
      ],
      sceneSplits: [
        {
          title: '第一场：钟声渐歇',
          summary: '交代修表铺拆迁背景与九叔的日常。',
          content: '第一章：起首\n钟表在黑暗中摆动。',
        },
        {
          title: '第二场：盲女登门',
          summary: '阿清第一次走进店铺询问修表。',
          content: '第二章：雨夜\n雨水打在铁皮屋顶上。',
        },
      ],
    });

    const parsed = parseManuscriptProfileResponse(raw, '夜巡');
    expect(parsed.synopsis).toContain('修表匠');
    expect(parsed.themeAnalysis).toContain('个体记忆');
    expect(parsed.characters.length).toBe(2);
    expect(parsed.characters[0].name).toBe('陈老九');
    expect(parsed.characters[0].role).toBe('主角');
    expect(parsed.motifs.length).toBe(1);
    expect(parsed.motifs[0].name).toBe('停止摆动的座钟');
    expect(parsed.motifs[0].occurrencesCount).toBe(4);
    expect(parsed.sceneSplits?.length).toBe(2);
    expect(parsed.sceneSplits?.[0].title).toBe('第一场：钟声渐歇');
  });

  it('should fallback gracefully when profiling output is unstructured or broken JSON', () => {
    const raw = '这是一篇关于记忆与衰老的小说，主要人物是九叔。';
    const parsed = parseManuscriptProfileResponse(raw, '夜巡');

    expect(parsed.synopsis).toContain('这是一篇关于记忆与衰老的小说');
    expect(parsed.characters).toEqual([]);
    expect(parsed.motifs).toEqual([]);
  });
});
