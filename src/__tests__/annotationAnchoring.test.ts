import { describe, it, expect } from 'vitest';
import { parseCritiqueResponse } from '../prompts/parser';
import { applyQuoteReplacement } from '../utils/diff';
import { extractPlainText, findBestAnchorMatch } from '../utils/textProjection';
import type { LiteraryAnnotation } from '../types';

describe('Annotation Range Anchoring, Disambiguation & Stale Tracking', () => {
  const sampleDoc = `雨停以后，修鞋铺没有开门。

卷帘门下面积着一线黑水，隔壁卖米粉的女人扫了两遍，也没把它扫出去。水里漂着几颗踩烂的花椒和半根烟蒂。

她感到一种无法言说的压抑，好像整个下午的沉闷都随着太阳一起从云后压了下来。

平时这个钟头，老周那台老式补鞋机早该响了。水里漂着几颗踩烂的花椒和半根烟蒂。`;

  it('should compute independent range for each annotation according to its quote', () => {
    const rawLLM = JSON.stringify({
      summary: '发现两处语言与修辞问题',
      annotations: [
        {
          quote: '她感到一种无法言说的压抑',
          category: 'language',
          severity: 'high',
          diagnosis: '直接命名情绪。',
        },
        {
          quote: '扫了两遍，也没把它扫出去',
          category: 'cut',
          severity: 'low',
          diagnosis: '动作可更精炼。',
        },
      ],
    });

    // Pass broad selection range (e.g. 0 to 200)
    const selectionRange = { from: 0, to: 200 };
    const parsed = parseCritiqueResponse(rawLLM, 'critique', sampleDoc, selectionRange);

    expect(parsed.annotations.length).toBe(2);

    const ann1 = parsed.annotations[0];
    const ann2 = parsed.annotations[1];

    // Each annotation must have its OWN calculated range, NOT overwritten by 0..200
    expect(ann1.range).toBeDefined();
    expect(ann2.range).toBeDefined();
    expect(ann1.range).not.toEqual(ann2.range);

    // Verify ann1 range extracts exact quote
    const plain = extractPlainText(sampleDoc);
    expect(plain.slice(ann1.range!.from, ann1.range!.to)).toBe('她感到一种无法言说的压抑');
    expect(plain.slice(ann2.range!.from, ann2.range!.to)).toBe('扫了两遍，也没把它扫出去');
  });

  it('should refuse automatic replacement and return isAmbiguous when duplicate text has no range hint', () => {
    // "水里漂着几颗踩烂的花椒和半根烟蒂。" appears in paragraph 2 AND paragraph 4
    const duplicateQuote = '水里漂着几颗踩烂的花椒和半根烟蒂。';
    const replacement = '死水里浮着杂物。';

    // Call without range hint
    const result = applyQuoteReplacement(sampleDoc, duplicateQuote, replacement);

    // Must STOP replacement, must NOT automatically modify the first occurrence!
    expect(result.success).toBe(false);
    expect(result.isAmbiguous).toBe(true);
    expect(result.newContent).toBe(sampleDoc);
  });

  it('should disambiguate duplicate quotes when a valid range hint is provided', () => {
    const duplicateQuote = '水里漂着几颗踩烂的花椒和半根烟蒂。';
    const replacement = '死水里浮着杂物。';

    const plain = extractPlainText(sampleDoc);
    const firstPos = plain.indexOf(duplicateQuote);
    const secondPos = plain.indexOf(duplicateQuote, firstPos + duplicateQuote.length);

    // 1. Target the second occurrence
    const rangeSecond = { from: secondPos, to: secondPos + duplicateQuote.length };
    const resSecond = applyQuoteReplacement(sampleDoc, duplicateQuote, replacement, rangeSecond);

    expect(resSecond.success).toBe(true);
    expect(resSecond.newContent).toContain('老式补鞋机早该响了。死水里浮着杂物。');
    // First occurrence remains untouched
    expect(resSecond.newContent).toContain('也没把它扫出去。水里漂着几颗踩烂的花椒和半根烟蒂。');

    // 2. Target the first occurrence
    const rangeFirst = { from: firstPos, to: firstPos + duplicateQuote.length };
    const resFirst = applyQuoteReplacement(sampleDoc, duplicateQuote, replacement, rangeFirst);

    expect(resFirst.success).toBe(true);
    expect(resFirst.newContent).toContain('也没把它扫出去。死水里浮着杂物。');
    // Second occurrence remains untouched
    expect(resFirst.newContent).toContain('老式补鞋机早该响了。水里漂着几颗踩烂的花椒和半根烟蒂。');
  });

  it('should detect stale annotations when text has been modified externally', () => {
    const quote = '她感到一种无法言说的压抑';
    const modifiedDoc = '雨停以后，修鞋铺没有开门。阿秀在门口默默扫地。';

    const parsed = parseCritiqueResponse(
      JSON.stringify({
        summary: '审读',
        annotations: [{ quote, diagnosis: '测试' }],
      }),
      'critique',
      modifiedDoc
    );

    expect(parsed.annotations[0].isStale).toBe(true);
    expect(parsed.annotations[0].range).toBeUndefined();
  });

  it('should re-anchor annotations dynamically when text before the quote is edited', () => {
    const initialPlain = extractPlainText(sampleDoc);
    const initialIndex = initialPlain.indexOf('她感到一种无法言说的压抑');

    const annotations: LiteraryAnnotation[] = [
      {
        id: 'ann-1',
        quote: '她感到一种无法言说的压抑',
        range: { from: initialIndex, to: initialIndex + '她感到一种无法言说的压抑'.length },
        category: 'language',
        severity: 'high',
        diagnosis: '情绪命名',
        status: 'pending',
        isStale: false,
        createdAt: Date.now(),
      },
    ];

    const prefix = '【新增前言导语十个字】';
    const updatedContent = prefix + sampleDoc;
    const plain = extractPlainText(updatedContent);

    // Re-anchoring logic check
    const reAnchored = annotations.map((ann) => {
      const idx = plain.indexOf(ann.quote);
      if (idx === -1) {
        return { ...ann, isStale: true };
      }
      return {
        ...ann,
        isStale: false,
        range: { from: idx, to: idx + ann.quote.length },
      };
    });

    expect(reAnchored[0].isStale).toBe(false);
    expect(reAnchored[0].range?.from).toBe(initialIndex + prefix.length);
  });

  it('should maintain anchor to the second occurrence of duplicate sentence when text is inserted before it', () => {
    const duplicateQuote = '水里漂着几颗踩烂的花椒和半根烟蒂。';
    const plain = extractPlainText(sampleDoc);

    const firstPos = plain.indexOf(duplicateQuote);
    const secondPos = plain.indexOf(duplicateQuote, firstPos + duplicateQuote.length);

    // Initial annotation anchors to the SECOND occurrence
    const annotation: LiteraryAnnotation = {
      id: 'ann-dup-2',
      quote: duplicateQuote,
      range: { from: secondPos, to: secondPos + duplicateQuote.length },
      category: 'imagery',
      severity: 'medium',
      diagnosis: '意象重复',
      status: 'pending',
      isStale: false,
      createdAt: Date.now(),
    };

    // User inserts 25 characters at the very beginning of the document
    const insertion = '【这是新插入的开篇引言内容共二十五字】\n\n';
    const modifiedDoc = insertion + sampleDoc;
    const modifiedPlain = extractPlainText(modifiedDoc);

    // Re-anchoring via findBestAnchorMatch (used across useCritique and parser)
    const match = findBestAnchorMatch({
      plainText: modifiedPlain,
      quote: annotation.quote,
      previousRange: annotation.range,
    });

    expect(match.found).toBe(true);
    expect(match.isStale).toBe(false);
    expect(match.isAmbiguous).toBeFalsy();

    // Verify it still points to the SECOND occurrence, NOT falling back to first occurrence!
    const newFirstPos = modifiedPlain.indexOf(duplicateQuote);
    const newSecondPos = modifiedPlain.indexOf(duplicateQuote, newFirstPos + duplicateQuote.length);

    expect(match.range.from).toBe(newSecondPos);
    expect(match.range.from).not.toBe(newFirstPos);
    expect(match.range.from).toBe(secondPos + insertion.length);

    // Verify accepting the replacement modifies the second occurrence, keeping the first untouched
    const replacement = '浮着烂菜叶与塑料袋。';
    const res = applyQuoteReplacement(modifiedDoc, duplicateQuote, replacement, match.range);

    expect(res.success).toBe(true);
    expect(res.newContent).toContain('老式补鞋机早该响了。浮着烂菜叶与塑料袋。');
    // First occurrence remains completely untouched
    expect(res.newContent).toContain('也没把它扫出去。水里漂着几颗踩烂的花椒和半根烟蒂。');
  });
});
