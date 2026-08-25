import type { CharacterItem, MotifItem } from './project';

export type CritiqueCategory =
  | 'critique'      // 文学综合审读 (叙述距离、冗余、情绪命名、戏剧张力)
  | 'language'      // 语言质感 (抽象词、陈词滥调、AI味、空洞修辞、动词张力)
  | 'rhythm'        // 句法节奏 (长短句分布、句式重复、停顿、标点)
  | 'dialogue'      // 对白真实性 (人物声音、潜台词、信息倾倒)
  | 'cut'           // 删削 (减法建议: 单词、半句、整段)
  | 'imagery'       // 意象分析 (意象密度、感官分布、象征露骨度)
  | 'distance'      // 叙述距离 (叙述者介入、自由间接引语、视角漂移)
  | 'ask';          // 自由文学问答

export type SeverityLevel = 'low' | 'medium' | 'high';

export interface CritiqueReplacement {
  minimal?: string;   // 最小手术：仅删两三个词或微调语序
  moderate?: string;  // 中度优化：提炼句式
  radical?: string;   // 重构视角或重拟
}

export interface LiteraryAnnotation {
  id: string;
  sceneId?: string;
  range?: {
    from: number;
    to: number;
  };
  quote: string;                     // 原文对应片段
  category: CritiqueCategory;        // 类别
  severity: SeverityLevel;           // 严重/关注程度 (Low/Medium/High, 禁止伪数值评分)
  diagnosis: string;                 // 诊断原因 (指出具体文学机理: 解释过度 / 情绪提前命名 / 抽象动词)
  literaryTradeoff?: string;         // 修改的取舍分析 (得与失)
  suggestion?: string;               // 思考与修改方向
  replacement?: CritiqueReplacement; // 改写方案
  appliedReplacementType?: 'minimal' | 'moderate' | 'radical' | null;
  status: 'pending' | 'accepted' | 'rejected';
  isStale?: boolean;                 // 文稿大幅修改后标记为过期
  createdAt: number;
}

export interface CritiqueResponse {
  summary: string;
  annotations: LiteraryAnnotation[];
}

export interface ColdReaderReport {
  id: string;
  timestamp: number;
  scope: string;                      // e.g. "第一场：修鞋铺" 或 "全场景"
  whatIRead: string;                   // 我实际读到了什么
  whatHappened: string;               // 我认为发生了什么 (情节与动作)
  characterDynamics: string;          // 我理解的人物关系与权力流动
  sensedThemes: string;               // 我感受到的隐秘主题
  confusionAndAmbiguities: string;    // 我没有理解或感到语义断裂的地方
  suspectedImplications: string;      // 我认为作者可能在暗示什么
  authorOnlyBlindspots: string;       // 哪些信息似乎只有作者自己知道 (未被文本有效编码)
}

export interface IntentEvaluation {
  id: string;
  timestamp: number;
  authorIntent: string;               // 作者表达意图
  overallVerdict: 'clearly_present' | 'partially_present' | 'not_present' | 'over_explained';
  detailedAnalysis: string;
  evidenceItems: {
    quote: string;
    status: 'clearly_present' | 'partially_present' | 'not_present' | 'over_explained';
    explanation: string;
  }[];
}

export interface VersionCompareReport {
  id: string;
  timestamp: number;
  versionAName: string;
  versionBName: string;
  versionAContent: string;
  versionBContent: string;
  versionAGains: string;              // A 获得了什么
  versionALosses: string;             // A 失去了什么
  versionBGains: string;              // B 获得了什么
  versionBLosses: string;             // B 失去了什么
  literaryTradeoffSummary: string;    // 核心文学取舍 (如: 牺牲认识论暧昧换取伦理冲突)
}

export interface LiteraryLens {
  id: string;
  name: string;
  description: string;
  promptInstruction: string;
  icon?: string;
  isBuiltIn?: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: CritiqueCategory | 'custom';
  promptTemplate: string;
  isBuiltIn?: boolean;
  createdAt: number;
}

export interface ContextSelectionConfig {
  includeSelectedText: boolean;
  includeCurrentScene: boolean;
  includePreviousScene: boolean;
  includeCharacterNotes: boolean;
  includeMotifs: boolean;
  includeEntireManuscript: boolean;
}

export interface SceneSplitSuggestion {
  title: string;
  summary?: string;
  content: string;
}

export interface ManuscriptProfileResult {
  synopsis: string;
  themeAnalysis?: string;
  characters: CharacterItem[];
  motifs: MotifItem[];
  sceneSplits?: SceneSplitSuggestion[];
}

