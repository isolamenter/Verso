import { describe, it, expect } from 'vitest';
import {
  cleanJsonString,
  parseCritiqueResponse,
  parseColdReaderResponse,
  parseIntentResponse,
  parseVersionCompareResponse,
} from '../parser';

describe('Prompt Parsers & JSON Sanitization', () => {
  it('should clean JSON wrapped in markdown codeblocks and outer text', () => {
    const raw = '以下是审读结果：\n```json\n{\n  "summary": "文风克制",\n  "annotations": []\n}\n```\n希望对作者有帮助。';
    const cleaned = cleanJsonString(raw);
    expect(cleaned).toBe('{\n  "summary": "文风克制",\n  "annotations": []\n}');
  });

  it('should parse structured Critique responses and calculate quote ranges', () => {
    const sourceDoc = '雨停以后，修鞋铺没有开门。她感到一种无法言说的压抑。';
    const jsonStr = JSON.stringify({
      summary: '物象扎实，局部存在情绪命名。',
      annotations: [
        {
          quote: '她感到一种无法言说的压抑。',
          category: 'language',
          severity: 'high',
          diagnosis: '直接命名情绪词汇。',
          literaryTradeoff: '删减增强冷感，但降低直观情绪。',
          suggestion: '替换为客观物态描写。',
          replacement: {
            minimal: '太阳从云后钻出来。',
            moderate: '水泥路面泛出白光。',
            radical: '（整句删去）',
          },
        },
      ],
    });

    const parsed = parseCritiqueResponse(jsonStr, 'language', sourceDoc);
    expect(parsed.summary).toBe('物象扎实，局部存在情绪命名。');
    expect(parsed.annotations.length).toBe(1);
    expect(parsed.annotations[0].category).toBe('language');
    expect(parsed.annotations[0].severity).toBe('high');
    expect(parsed.annotations[0].range).toEqual({ from: 13, to: 26 });
    expect(parsed.annotations[0].isStale).toBe(false);
    expect(parsed.annotations[0].replacement?.minimal).toBe('太阳从云后钻出来。');
  });

  it('should fallback gracefully when Critique output is plain unstructured text', () => {
    const rawText = '这一段的副词太多了，建议把"慢吞吞"删掉。';
    const parsed = parseCritiqueResponse(rawText, 'cut');

    expect(parsed.summary).toBe('审读诊断意见：');
    expect(parsed.annotations.length).toBe(1);
    expect(parsed.annotations[0].diagnosis).toContain('这一段的副词太多了');
  });

  it('should parse Cold Reader responses properly', () => {
    const raw = JSON.stringify({
      scope: '第一场',
      whatIRead: '修鞋铺迟迟未开门。',
      whatHappened: '客人驻足询问。',
      characterDynamics: '老街坊之间的克制默契。',
      sensedThemes: '底层物理空间关闭带来的秩序断裂。',
      confusionAndAmbiguities: '男人的钥匙来源未交代。',
      suspectedImplications: '死水象征停滞。',
      authorOnlyBlindspots: '男人的具体身份未被文本有效编码。',
    });

    const parsed = parseColdReaderResponse(raw, '第一场');
    expect(parsed.whatIRead).toBe('修鞋铺迟迟未开门。');
    expect(parsed.authorOnlyBlindspots).toContain('男人的具体身份');
  });

  it('should parse Intent Evaluation responses', () => {
    const raw = JSON.stringify({
      authorIntent: '表现生活的粘滞感',
      overallVerdict: 'clearly_present',
      detailedAnalysis: '文本通过扫不出的黑水成功表达了这一意图。',
      evidenceItems: [
        {
          quote: '扫了两遍也没把它扫出去',
          status: 'clearly_present',
          explanation: '物象动作极具生活质感。',
        },
      ],
    });

    const parsed = parseIntentResponse(raw, '表现生活的粘滞感');
    expect(parsed.overallVerdict).toBe('clearly_present');
    expect(parsed.evidenceItems.length).toBe(1);
  });

  it('should parse Version Compare reports', () => {
    const raw = JSON.stringify({
      versionAName: '版本 A',
      versionBName: '版本 B',
      versionAGains: '保留了抒情余味',
      versionALosses: '概念提前暴露',
      versionBGains: '纯粹物象呈现',
      versionBLosses: '放慢了阅读节奏',
      literaryTradeoffSummary: '版本 B 牺牲了廉价速度，赢得了深邃质感。',
    });

    const parsed = parseVersionCompareResponse(raw, '版本 A', '版本 B', '文本A', '文本B');
    expect(parsed.versionAGains).toBe('保留了抒情余味');
    expect(parsed.literaryTradeoffSummary).toContain('版本 B 牺牲了廉价速度');
  });
});
