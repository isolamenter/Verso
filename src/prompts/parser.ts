import type {
  CritiqueResponse,
  LiteraryAnnotation,
  ColdReaderReport,
  IntentEvaluation,
  VersionCompareReport,
  ManuscriptProfileResult,
  CritiqueCategory,
  SeverityLevel
} from '../types';
import { extractPlainText, findBestAnchorMatch } from '../utils/textProjection';

/**
 * Extracts and cleans JSON from LLM responses (stripping markdown fences, trailing comments, etc.)
 */
export function cleanJsonString(raw: string): string {
  if (!raw) return '{}';
  let cleaned = raw.trim();

  // Strip ```json ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  // If there's leading or trailing non-JSON text, find outermost { ... }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return cleaned.trim();
}

/**
 * Parses Critique LLM response safely with schema validation and accurate quote anchoring.
 */
export function parseCritiqueResponse(
  raw: string,
  defaultCategory: CritiqueCategory = 'critique',
  sourceText?: string,
  rangeHint?: { from: number; to: number }
): CritiqueResponse {
  const cleaned = cleanJsonString(raw);
  const plainSource = sourceText ? extractPlainText(sourceText) : '';

  try {
    const parsed = JSON.parse(cleaned);
    const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : '文学审读完成。';

    const rawAnnotations = Array.isArray(parsed.annotations) ? parsed.annotations : [];

    const validSeverities: SeverityLevel[] = ['low', 'medium', 'high'];
    const validCategories: CritiqueCategory[] = [
      'critique',
      'language',
      'rhythm',
      'dialogue',
      'cut',
      'imagery',
      'distance',
      'ask',
    ];

    const annotations: LiteraryAnnotation[] = rawAnnotations
      .filter((item: any) => item && (item.quote || item.diagnosis))
      .map((item: any, index: number) => {
        const quote = typeof item.quote === 'string' ? item.quote.trim() : '';
        const category = validCategories.includes(item.category)
          ? item.category
          : defaultCategory;
        const severity = validSeverities.includes(item.severity)
          ? item.severity
          : 'medium';
        const diagnosis = typeof item.diagnosis === 'string'
          ? item.diagnosis.trim()
          : '此处语言与构思值得进一步推敲。';

        // Check if quote exists in plainSource and resolve exact range
        let range: { from: number; to: number } | undefined;
        let isStale = false;

        if (plainSource && quote) {
          const match = findBestAnchorMatch({
            plainText: plainSource,
            quote,
            rangeHint,
          });

          if (match.found) {
            range = match.range;
            isStale = false;
          } else {
            isStale = match.isStale || Boolean(match.isAmbiguous);
          }
        }

        return {
          id: `ann-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          quote,
          range,
          category,
          severity,
          diagnosis,
          literaryTradeoff:
            typeof item.literaryTradeoff === 'string' && item.literaryTradeoff.trim()
              ? item.literaryTradeoff.trim()
              : undefined,
          suggestion:
            typeof item.suggestion === 'string' && item.suggestion.trim()
              ? item.suggestion.trim()
              : undefined,
          replacement:
            item.replacement && typeof item.replacement === 'object'
              ? {
                  minimal:
                    typeof item.replacement.minimal === 'string'
                      ? item.replacement.minimal.trim()
                      : undefined,
                  moderate:
                    typeof item.replacement.moderate === 'string'
                      ? item.replacement.moderate.trim()
                      : undefined,
                  radical:
                    typeof item.replacement.radical === 'string'
                      ? item.replacement.radical.trim()
                      : undefined,
                }
              : undefined,
          status: 'pending' as const,
          isStale,
          createdAt: Date.now(),
        };
      });

    return { summary, annotations };
  } catch {
    // If strict JSON parsing failed, create a structured annotation from raw text
    return {
      summary: '审读诊断意见：',
      annotations: [
        {
          id: `ann-${Date.now()}-fallback`,
          quote: '',
          category: defaultCategory,
          severity: 'medium',
          diagnosis: raw.trim() || '未能解析出结构化批注。',
          status: 'pending',
          createdAt: Date.now(),
        },
      ],
    };
  }
}

/**
 * Parses Cold Reader LLM response safely with schema validation.
 */
export function parseColdReaderResponse(raw: string, scopeName: string): ColdReaderReport {
  const cleaned = cleanJsonString(raw);
  try {
    const parsed = JSON.parse(cleaned);
    return {
      id: `cr-${Date.now()}`,
      timestamp: Date.now(),
      scope: typeof parsed.scope === 'string' && parsed.scope.trim() ? parsed.scope : scopeName,
      whatIRead: typeof parsed.whatIRead === 'string' ? parsed.whatIRead : '未获取到阅读事实。',
      whatHappened: typeof parsed.whatHappened === 'string' ? parsed.whatHappened : '未获取到情节动作。',
      characterDynamics:
        typeof parsed.characterDynamics === 'string'
          ? parsed.characterDynamics
          : '未获取到人物关系。',
      sensedThemes: typeof parsed.sensedThemes === 'string' ? parsed.sensedThemes : '未获取到主题感受。',
      confusionAndAmbiguities:
        typeof parsed.confusionAndAmbiguities === 'string'
          ? parsed.confusionAndAmbiguities
          : '无明显语义阻滞。',
      suspectedImplications:
        typeof parsed.suspectedImplications === 'string'
          ? parsed.suspectedImplications
          : '无明显过度暗示。',
      authorOnlyBlindspots:
        typeof parsed.authorOnlyBlindspots === 'string'
          ? parsed.authorOnlyBlindspots
          : '未发现作者独自预设的盲区。',
    };
  } catch {
    return {
      id: `cr-${Date.now()}`,
      timestamp: Date.now(),
      scope: scopeName,
      whatIRead: raw,
      whatHappened: '',
      characterDynamics: '',
      sensedThemes: '',
      confusionAndAmbiguities: '',
      suspectedImplications: '',
      authorOnlyBlindspots: '',
    };
  }
}

/**
 * Parses Intent Evaluation LLM response safely.
 */
export function parseIntentResponse(raw: string, authorIntent: string): IntentEvaluation {
  const cleaned = cleanJsonString(raw);
  try {
    const parsed = JSON.parse(cleaned);
    const validVerdicts = [
      'clearly_present',
      'partially_present',
      'not_present',
      'over_explained',
    ];

    const verdict = validVerdicts.includes(parsed.overallVerdict)
      ? parsed.overallVerdict
      : 'partially_present';

    const evidenceItems = Array.isArray(parsed.evidenceItems)
      ? parsed.evidenceItems.map((item: any) => ({
          quote: typeof item?.quote === 'string' ? item.quote : '',
          status: validVerdicts.includes(item?.status) ? item.status : 'partially_present',
          explanation: typeof item?.explanation === 'string' ? item.explanation : '',
        }))
      : [];

    return {
      id: `intent-${Date.now()}`,
      timestamp: Date.now(),
      authorIntent: typeof parsed.authorIntent === 'string' ? parsed.authorIntent : authorIntent,
      overallVerdict: verdict,
      detailedAnalysis:
        typeof parsed.detailedAnalysis === 'string' ? parsed.detailedAnalysis : raw,
      evidenceItems,
    };
  } catch {
    return {
      id: `intent-${Date.now()}`,
      timestamp: Date.now(),
      authorIntent,
      overallVerdict: 'partially_present',
      detailedAnalysis: raw,
      evidenceItems: [],
    };
  }
}

/**
 * Parses Version Compare LLM response safely.
 */
export function parseVersionCompareResponse(
  raw: string,
  versionAName: string,
  versionBName: string,
  versionAContent: string,
  versionBContent: string
): VersionCompareReport {
  const cleaned = cleanJsonString(raw);
  try {
    const parsed = JSON.parse(cleaned);
    return {
      id: `vc-${Date.now()}`,
      timestamp: Date.now(),
      versionAName: typeof parsed.versionAName === 'string' ? parsed.versionAName : versionAName,
      versionBName: typeof parsed.versionBName === 'string' ? parsed.versionBName : versionBName,
      versionAContent,
      versionBContent,
      versionAGains:
        typeof parsed.versionAGains === 'string'
          ? parsed.versionAGains
          : '保留了原有表达的完整性。',
      versionALosses:
        typeof parsed.versionALosses === 'string'
          ? parsed.versionALosses
          : '存在一定的修辞负荷。',
      versionBGains:
        typeof parsed.versionBGains === 'string' ? parsed.versionBGains : '精简了表述。',
      versionBLosses:
        typeof parsed.versionBLosses === 'string'
          ? parsed.versionBLosses
          : '减少了部分细节余味。',
      literaryTradeoffSummary:
        typeof parsed.literaryTradeoffSummary === 'string'
          ? parsed.literaryTradeoffSummary
          : '两版各有侧重，建议根据场景张力自决。',
    };
  } catch {
    return {
      id: `vc-${Date.now()}`,
      timestamp: Date.now(),
      versionAName,
      versionBName,
      versionAContent,
      versionBContent,
      versionAGains: '见分析文本',
      versionALosses: '',
      versionBGains: '',
      versionBLosses: '',
      literaryTradeoffSummary: raw,
    };
  }
}

/**
 * Parses Manuscript Profile & Deconstruction LLM response safely.
 */
export function parseManuscriptProfileResponse(
  raw: string,
  defaultTitle: string = ''
): ManuscriptProfileResult {
  const cleaned = cleanJsonString(raw);
  try {
    const parsed = JSON.parse(cleaned);

    const synopsis =
      typeof parsed.synopsis === 'string' && parsed.synopsis.trim()
        ? parsed.synopsis.trim()
        : `文稿《${defaultTitle}》导入完成，待提炼故事梗概。`;

    const themeAnalysis =
      typeof parsed.themeAnalysis === 'string' ? parsed.themeAnalysis.trim() : undefined;

    const characters = Array.isArray(parsed.characters)
      ? parsed.characters
          .filter((c: any) => c && typeof c.name === 'string' && c.name.trim())
          .map((c: any, idx: number) => ({
            id: `char-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            name: c.name.trim(),
            alias: typeof c.alias === 'string' ? c.alias.trim() : undefined,
            role: typeof c.role === 'string' ? c.role.trim() : '人物',
            notes: typeof c.notes === 'string' ? c.notes.trim() : '',
          }))
      : [];

    const motifs = Array.isArray(parsed.motifs)
      ? parsed.motifs
          .filter((m: any) => m && typeof m.name === 'string' && m.name.trim())
          .map((m: any, idx: number) => ({
            id: `motif-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            name: m.name.trim(),
            description: typeof m.description === 'string' ? m.description.trim() : '',
            occurrencesCount:
              typeof m.occurrencesCount === 'number' ? m.occurrencesCount : undefined,
          }))
      : [];

    const sceneSplits = Array.isArray(parsed.sceneSplits)
      ? parsed.sceneSplits
          .filter((s: any) => s && (s.content || s.title))
          .map((s: any, idx: number) => ({
            title: typeof s.title === 'string' && s.title.trim() ? s.title.trim() : `第 ${idx + 1} 场`,
            summary: typeof s.summary === 'string' ? s.summary.trim() : undefined,
            content: typeof s.content === 'string' ? s.content : '',
          }))
      : undefined;

    return {
      synopsis,
      themeAnalysis,
      characters,
      motifs,
      sceneSplits,
    };
  } catch {
    return {
      synopsis: raw.trim().slice(0, 300) || `文稿《${defaultTitle}》`,
      characters: [],
      motifs: [],
    };
  }
}

