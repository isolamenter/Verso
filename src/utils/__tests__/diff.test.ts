import { describe, it, expect } from 'vitest';
import {
  computeCharacterDiff,
  calculateEditorStats,
  applyQuoteReplacement,
} from '../diff';

describe('Diff & Stats Utilities', () => {
  it('should compute character-level diffs correctly', () => {
    const orig = '修鞋铺没有开门。';
    const updated = '修鞋铺早晨没有开门。';
    const diffs = computeCharacterDiff(orig, updated);

    expect(diffs).toEqual([
      { type: 'equal', text: '修鞋铺' },
      { type: 'insert', text: '早晨' },
      { type: 'equal', text: '没有开门。' },
    ]);
  });

  it('should calculate editor stats with pure CJK counting', () => {
    const text = '雨停以后，修鞋铺没有开门。\n\n隔壁卖米粉的女人扫了两遍。Hello world 123';
    const stats = calculateEditorStats(text);

    // '雨停以后' (4) + '修鞋铺没有开门' (7) + '隔壁卖米粉的女人扫了两遍' (12) = 23
    expect(stats.chineseCharacters).toBe(23);
    expect(stats.paragraphs).toBe(2);
    expect(stats.totalWords).toBe(26); // 23 CJK + 3 Latin words/numbers
    expect(stats.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it('should apply quote replacement with exact range match', () => {
    const full = '第一段文字。第二段待修改文字。第三段文字。';
    const quote = '第二段待修改文字。';
    const replacement = '第二段精修后文字。';
    const range = { from: 6, to: 15 };

    const res = applyQuoteReplacement(full, quote, replacement, range);
    expect(res.success).toBe(true);
    expect(res.newContent).toBe('第一段文字。第二段精修后文字。第三段文字。');
  });

  it('should replace the correct occurrence when identical sentence appears multiple times', () => {
    // Both paragraphs have "雨停了。"
    const full = '第一段开头。雨停了。第一段结尾。\n\n第二段开头。雨停了。第二段结尾。';
    const quote = '雨停了。';
    const replacement = '暴雨终于止歇。';

    // Target is the second occurrence (around position 22)
    const rangeSecond = { from: 22, to: 26 };
    const resSecond = applyQuoteReplacement(full, quote, replacement, rangeSecond);

    expect(resSecond.success).toBe(true);
    expect(resSecond.newContent).toBe('第一段开头。雨停了。第一段结尾。\n\n第二段开头。暴雨终于止歇。第二段结尾。');

    // Target is the first occurrence (around position 6)
    const rangeFirst = { from: 6, to: 10 };
    const resFirst = applyQuoteReplacement(full, quote, replacement, rangeFirst);

    expect(resFirst.success).toBe(true);
    expect(resFirst.newContent).toBe('第一段开头。暴雨终于止歇。第一段结尾。\n\n第二段开头。雨停了。第二段结尾。');
  });

  it('should refuse automatic replacement and report isAmbiguous when duplicate text has no range hint', () => {
    const full = '第一段开头。雨停了。第一段结尾。\n\n第二段开头。雨停了。第二段结尾。';
    const quote = '雨停了。';
    const replacement = '暴雨终于止歇。';

    const res = applyQuoteReplacement(full, quote, replacement);
    expect(res.success).toBe(false);
    expect(res.isAmbiguous).toBe(true);
    expect(res.newContent).toBe(full); // Unmodified!
  });

  it('should replace quote inside TipTap JSON doc structure accurately', () => {
    const tipTapDoc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: '第一章：雨后' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '卷帘门下面积着一线黑水，' },
            { type: 'text', marks: [{ type: 'bold' }], text: '她感到一种无法言说的压抑。' },
          ],
        },
      ],
    });

    const quote = '她感到一种无法言说的压抑。';
    const replacement = '太阳从云后钻出来。';

    const res = applyQuoteReplacement(tipTapDoc, quote, replacement);
    expect(res.success).toBe(true);
    const parsed = JSON.parse(res.newContent);
    expect(parsed.content[1].content[1].text).toBe('太阳从云后钻出来。');
    expect(parsed.content[1].content[1].marks).toEqual([{ type: 'bold' }]);
  });

  it('should safely replace quote spanning across bold and plain text nodes without degrading document to plain text', () => {
    const tipTapDoc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '场景一：门市' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '雨停以后，' },
            { type: 'text', marks: [{ type: 'bold' }], text: '修鞋铺' },
            { type: 'text', text: '没有开门。' },
          ],
        },
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: '“老周从不把钥匙留给别人。”' }],
            },
          ],
        },
      ],
    });

    // Quote spans bold "修鞋铺" AND plain "没有开门。"
    const quote = '修鞋铺没有开门。';
    const replacement = '工坊大门紧闭。';

    const res = applyQuoteReplacement(tipTapDoc, quote, replacement);
    expect(res.success).toBe(true);

    // Verify it is still valid TipTap JSON, NEVER downgraded to plain text!
    expect(res.newContent.startsWith('{')).toBe(true);
    const parsed = JSON.parse(res.newContent);
    expect(parsed.type).toBe('doc');

    // Verify heading and blockquote are preserved 100%
    expect(parsed.content[0].type).toBe('heading');
    expect(parsed.content[0].content[0].text).toBe('场景一：门市');
    expect(parsed.content[2].type).toBe('blockquote');

    // Verify paragraph text
    expect(parsed.content[1].type).toBe('paragraph');
    const p1Texts = parsed.content[1].content.map((c: any) => c.text).join('');
    expect(p1Texts).toBe('雨停以后，工坊大门紧闭。');
  });

  it('should safely replace quote spanning across paragraph boundaries without losing document format', () => {
    const tipTapDoc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: '序章' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '第一段末尾句子。' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '第二段开头句子。' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '第三段独立句子保持完好。' }],
        },
      ],
    });

    // Quote spans across paragraph 1 and paragraph 2
    const quote = '末尾句子。\n\n第二段开头';
    const replacement = '终结句。\n\n下一阶段起始';

    const res = applyQuoteReplacement(tipTapDoc, quote, replacement);
    expect(res.success).toBe(true);

    // Ensure it remains structured JSON
    const parsed = JSON.parse(res.newContent);
    expect(parsed.type).toBe('doc');
    expect(parsed.content[0].type).toBe('heading');
    expect(parsed.content[0].content[0].text).toBe('序章');

    // Ensure third paragraph is intact
    const lastP = parsed.content[parsed.content.length - 1];
    expect(lastP.content[0].text).toBe('第三段独立句子保持完好。');
  });
});
