import { describe, it, expect } from 'vitest';
import {
  extractPlainText,
  isTipTapDocJson,
  plainTextToTipTapDoc,
  plainTextToHtml,
} from '../utils/textProjection';
import { calculateEditorStats, computeCharacterDiff } from '../utils/diff';

describe('Rich Text Structured Document Persistence & Projection', () => {
  const formattedSampleDoc = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: '第一场：卷帘门与黑水' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '雨停以后，' },
          { type: 'text', marks: [{ type: 'bold' }], text: '修鞋铺' },
          { type: 'text', text: '没有开门。' },
          { type: 'text', marks: [{ type: 'italic' }], text: '水珠慢吞吞地往下滴。' },
          { type: 'text', marks: [{ type: 'strike' }], text: '多余的形容词。' },
        ],
      },
      {
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '“他那个人，从来不留钥匙给别人。”' }],
          },
        ],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '修鞋铺的铸铁机' }],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '隔壁米粉店的骨汤' }],
              },
            ],
          },
        ],
      },
      {
        type: 'orderedList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '第一步：清扫积水' }],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '第二步：点烟等待' }],
              },
            ],
          },
        ],
      },
    ],
  };

  const jsonString = JSON.stringify(formattedSampleDoc);

  it('should correctly identify TipTap doc JSON string vs plain text', () => {
    expect(isTipTapDocJson(jsonString)).toBe(true);
    expect(isTipTapDocJson(formattedSampleDoc)).toBe(true);
    expect(isTipTapDocJson('纯文本段落')).toBe(false);
    expect(isTipTapDocJson('{"other":"json"}')).toBe(false);
    expect(isTipTapDocJson('')).toBe(false);
  });

  it('should preserve all formatting marks (bold, italic, strike, heading, quote, list) when saving and reloading', () => {
    // 1. Simulate saving to DB
    const savedInDb = jsonString;

    // 2. Simulate reading from DB
    const reloaded = JSON.parse(savedInDb);

    expect(reloaded.type).toBe('doc');
    expect(reloaded.content.length).toBe(5);

    // Verify Heading
    expect(reloaded.content[0].type).toBe('heading');
    expect(reloaded.content[0].attrs.level).toBe(1);
    expect(reloaded.content[0].content[0].text).toBe('第一场：卷帘门与黑水');

    // Verify Bold, Italic, Strike marks in paragraph
    const pNodes = reloaded.content[1].content;
    expect(pNodes[1].marks).toEqual([{ type: 'bold' }]);
    expect(pNodes[1].text).toBe('修鞋铺');
    expect(pNodes[3].marks).toEqual([{ type: 'italic' }]);
    expect(pNodes[4].marks).toEqual([{ type: 'strike' }]);

    // Verify Blockquote
    expect(reloaded.content[2].type).toBe('blockquote');
    expect(reloaded.content[2].content[0].content[0].text).toContain('不留钥匙给别人');

    // Verify BulletList
    expect(reloaded.content[3].type).toBe('bulletList');
    expect(reloaded.content[3].content.length).toBe(2);

    // Verify OrderedList
    expect(reloaded.content[4].type).toBe('orderedList');
    expect(reloaded.content[4].content.length).toBe(2);
  });

  it('should project rich text JSON into clean plain text for AI ContextBuilder', () => {
    const plainText = extractPlainText(jsonString);

    // Heading block
    expect(plainText).toContain('第一场：卷帘门与黑水');
    // Paragraph text with bold/italic combined
    expect(plainText).toContain('雨停以后，修鞋铺没有开门。水珠慢吞吞地往下滴。多余的形容词。');
    // Blockquote
    expect(plainText).toContain('“他那个人，从来不留钥匙给别人。”');
    // Lists
    expect(plainText).toContain('修鞋铺的铸铁机');
    expect(plainText).toContain('隔壁米粉店的骨汤');
    expect(plainText).toContain('第一步：清扫积水');
  });

  it('should calculate accurate editor stats from structured JSON content', () => {
    const stats = calculateEditorStats(jsonString);
    expect(stats.chineseCharacters).toBeGreaterThan(30);
    expect(stats.paragraphs).toBeGreaterThanOrEqual(4);
    expect(stats.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it('should migrate legacy plain text to structured TipTap doc seamlessly', () => {
    const legacyText = '第一段文字。\n\n第二段文字，包含折行。\n第二行。';
    const migrated = plainTextToTipTapDoc(legacyText);

    expect(migrated.type).toBe('doc');
    expect(migrated.content.length).toBe(2);
    expect(migrated.content[0].type).toBe('paragraph');
    expect(migrated.content[0].content[0].text).toBe('第一段文字。');

    // Second paragraph has hardBreak
    expect(migrated.content[1].content.length).toBe(3);
    expect(migrated.content[1].content[1].type).toBe('hardBreak');

    const html = plainTextToHtml(legacyText);
    expect(html).toContain('<p>第一段文字。</p>');
    expect(html).toContain('<br/>');
  });

  it('should compute diff cleanly between structured documents', () => {
    const origDoc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '修鞋铺没有开门。' }],
        },
      ],
    });

    const updatedDoc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: '修鞋铺' },
            { type: 'text', text: '早晨没有开门。' },
          ],
        },
      ],
    });

    const diff = computeCharacterDiff(origDoc, updatedDoc);
    expect(diff).toEqual([
      { type: 'equal', text: '修鞋铺' },
      { type: 'insert', text: '早晨' },
      { type: 'equal', text: '没有开门。' },
    ]);
  });

  it('should project HTML strings directly without escaping tags and extract plain text correctly', () => {
    const rawHtml = '<p><strong>代行故乡</strong></p><p><strong>第二份</strong></p><p>一</p><p>十一月末的一次夜班。</p>';

    // plainTextToHtml should keep raw HTML as-is instead of escaping < to &lt;
    const htmlOutput = plainTextToHtml(rawHtml);
    expect(htmlOutput).toBe(rawHtml);
    expect(htmlOutput).not.toContain('&lt;p&gt;');

    // extractPlainText should clean out HTML tags and produce clean paragraphs
    const plain = extractPlainText(rawHtml);
    expect(plain).toContain('代行故乡\n\n第二份\n\n一\n\n十一月末的一次夜班。');
    expect(plain).not.toContain('<p>');
    expect(plain).not.toContain('<strong>');
  });
});
