import { describe, it, expect } from 'vitest';
import { computeSplitCoverage } from '../textProjection';

describe('computeSplitCoverage', () => {
  it('完整覆盖返回 1', () => {
    const text = '第一章 起首\n\n钟表在黑暗中摆动。\n\n第二章 雨夜';
    const splits = [
      { content: '第一章 起首\n\n钟表在黑暗中摆动。' },
      { content: '第二章 雨夜' },
    ];
    expect(computeSplitCoverage(text, splits)).toBe(1);
  });

  it('空白与换行差异被归一化', () => {
    const text = '第一章 起首\n\n钟表在黑暗中摆动。';
    const splits = [{ content: ' 第一章 起首  钟表在黑暗中摆动。 ' }];
    expect(computeSplitCoverage(text, splits)).toBe(1);
  });

  it('缺失部分内容导致覆盖率下降', () => {
    const text = '甲乙丙丁戊己庚辛壬癸';
    const splits = [{ content: '甲乙丙丁戊' }];
    expect(computeSplitCoverage(text, splits)).toBe(0.5);
  });

  it('AI 改写措辞导致 <1', () => {
    const text = '钟表在黑暗中摆动，发出微弱的滴答声。';
    const splits = [{ content: '钟表在黑暗中摆动。' }];
    expect(computeSplitCoverage(text, splits)).toBe(0.5);
  });

  it('全文为空返回 1', () => {
    expect(computeSplitCoverage('', [{ content: '任意' }])).toBe(1);
  });

  it('空 splits 返回 0（全文非空）', () => {
    expect(computeSplitCoverage('有内容', [])).toBe(0);
  });

  it('覆盖率上限为 1（AI 多写内容不算超覆盖）', () => {
    const text = '甲乙丙';
    const splits = [{ content: '甲乙丙丁戊' }];
    expect(computeSplitCoverage(text, splits)).toBe(1);
  });

  it('TipTap doc JSON 内容可投影为纯文本', () => {
    const doc = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '钟声渐歇。' }] }],
    });
    const splits = [{ content: doc }];
    expect(computeSplitCoverage('钟声渐歇。', splits)).toBe(1);
  });
});
