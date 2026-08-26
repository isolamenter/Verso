import { describe, it, expect } from 'vitest';
import {
  cleanJsonString,
  parseCritiqueResponse,
  parseColdReaderResponse,
  parseIntentResponse,
  parseVersionCompareResponse,
  parseSynopsisResponse,
  parseThemeResponse,
  parseCharactersResponse,
  parseMotifsResponse,
  parseSceneSplitsResponse,
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

describe('建档五模块独立 parser', () => {
  it('parseSynopsisResponse 解析合法 JSON', () => {
    const raw = JSON.stringify({ synopsis: '一个修表匠与盲女的故事。' });
    expect(parseSynopsisResponse(raw, '夜巡')).toBe('一个修表匠与盲女的故事。');
  });

  it('parseSynopsisResponse 缺 synopsis 键时兜底中文文案', () => {
    const raw = JSON.stringify({ other: true });
    expect(parseSynopsisResponse(raw, '夜巡')).toContain('待提炼故事梗概');
  });

  it('parseSynopsisResponse JSON 失败回退 raw 文本', () => {
    const raw = '这是一篇关于记忆与衰老的小说。';
    expect(parseSynopsisResponse(raw, '夜巡')).toBe(raw);
  });

  it('parseThemeResponse 解析合法 JSON 与失败回退', () => {
    const raw = JSON.stringify({ themeAnalysis: '时间精确与记忆流逝的冲突。' });
    expect(parseThemeResponse(raw)).toBe('时间精确与记忆流逝的冲突。');
    expect(parseThemeResponse('直接返回的自由文本')).toBe('直接返回的自由文本');
    expect(parseThemeResponse(JSON.stringify({}))).toBe('');
  });

  it('parseCharactersResponse 完整解析并批内去重', () => {
    const raw = JSON.stringify({
      characters: [
        { name: '陈老九', alias: '九叔', role: '主角', notes: '沙哑克制。' },
        { name: '陈老九', alias: '九叔', role: '主角', notes: '重复条目。' },
        { name: '九叔', role: '次要人物', notes: '与陈老九重复。' },
        { name: '阿清', role: '主要配角', notes: '盲女。' },
      ],
    });
    const parsed = parseCharactersResponse(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('陈老九');
    expect(parsed[0].alias).toBe('九叔');
    expect(parsed[1].name).toBe('阿清');
  });

  it('parseCharactersResponse 垃圾输入返回空数组', () => {
    expect(parseCharactersResponse('不是 JSON')).toEqual([]);
    expect(parseCharactersResponse(JSON.stringify({ characters: [{ name: '' }] }))).toEqual([]);
  });

  it('parseMotifsResponse 大小写不敏感去重', () => {
    const raw = JSON.stringify({
      motifs: [
        { name: 'Rain', description: '雨水。', occurrencesCount: 3 },
        { name: 'rain', description: '重复。', occurrencesCount: 2 },
      ],
    });
    const parsed = parseMotifsResponse(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].occurrencesCount).toBe(3);
  });

  it('parseSceneSplitsResponse 基于 startQuote 对 sourceText 进行本地高保真切片', () => {
    const source = '第一章 起首\n钟表在黑暗中摆动。\n\n第二章 雨夜\n雨水打在铁皮屋顶上。\n\n第三章 尾声\n天空放晴了。';
    const raw = JSON.stringify({
      sceneSplits: [
        { title: '第一场：起首', summary: '钟表与暗夜', startQuote: '第一章 起首' },
        { title: '第二场：雨夜', summary: '屋顶雨水', startQuote: '第二章 雨夜' },
        { title: '第三场：尾声', summary: '放晴', startQuote: '第三章 尾声' },
      ],
    });

    const parsed = parseSceneSplitsResponse(raw, source);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].title).toBe('第一场：起首');
    expect(parsed[0].summary).toBe('钟表与暗夜');
    expect(parsed[0].content).toBe('第一章 起首\n钟表在黑暗中摆动。\n\n');

    expect(parsed[1].title).toBe('第二场：雨夜');
    expect(parsed[1].content).toBe('第二章 雨夜\n雨水打在铁皮屋顶上。\n\n');

    expect(parsed[2].title).toBe('第三场：尾声');
    expect(parsed[2].content).toBe('第三章 尾声\n天空放晴了。');

    // 验证拼接后严格无缝还原原文（100% 零丢字）
    const reconstructed = parsed.map((s) => s.content).join('');
    expect(reconstructed).toBe(source);
  });

  it('parseSceneSplitsResponse 无 sourceText 时保留 raw 信息', () => {
    const raw = JSON.stringify({
      sceneSplits: [
        { title: '第一场：钟声渐歇', startQuote: '钟表在黑暗中摆动。' },
        { title: '', startQuote: '' },
        { startQuote: '雨水打在铁皮屋顶上。' },
      ],
    });
    const parsed = parseSceneSplitsResponse(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe('第一场：钟声渐歇');
    expect(parsed[1].title).toBe('第 2 场');
  });

  it('parseSceneSplitsResponse 单场景或未匹配到次级锚点时降级为包含全文的单场', () => {
    const source = '全篇只有一句话。';
    const raw = JSON.stringify({
      sceneSplits: [{ title: '单篇', startQuote: '全篇' }],
    });
    const parsed = parseSceneSplitsResponse(raw, source);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('单篇');
    expect(parsed[0].content).toBe(source);
  });

  it('parseSceneSplitsResponse 垃圾输入返回空数组', () => {
    expect(parseSceneSplitsResponse('不是 JSON')).toEqual([]);
  });
});
