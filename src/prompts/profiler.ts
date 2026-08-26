import type {
  CharacterItem,
  MotifItem,
  Scene,
  ProfilingCurrentValue,
  ProfilingMode,
} from '../types';

export interface ProfilingPromptContext {
  title: string;
  content: string;       // 全篇正文
  mode: ProfilingMode;
  currentValue?: ProfilingCurrentValue;
  userNotes?: string;
}

// ============================================================
// 建档五模块独立 builder（generate / refine 双模式）
// ============================================================

const EDITOR_ROLE_HEADER = '你是一位极具洞察力与结构感的纯文学/严肃文学资深特约编辑。';

function manuscriptOpeningLine(title: string): string {
  return `创作者正在 Verso 工作台整理书稿《${title || '未命名文稿'}》。`;
}

function authorNotesSection(userNotes?: string): string {
  if (!userNotes || !userNotes.trim()) return '';
  return `
【作者批注与核心修正要求 (Author's Notes & Directives)】
创作者/审读者对本次建档与解构提出了以下关键批注与调整要求。在通读文稿并提炼建档数据时，必须最高优先级严格遵从并予以精准修正：
"""
${userNotes.trim()}
"""
`;
}

function manuscriptSection(title: string, content: string): string {
  return `
【文稿正文《${title || '未命名文稿'}》】
"""
${content}
"""
`;
}

function synopsisBaselineSection(current: string): string {
  return `
【当前梗概（修订基线）】
"""
${current}
"""
`;
}

function themeBaselineSection(current: string): string {
  return `
【当前主题剖析（修订基线）】
"""
${current}
"""
`;
}

function charactersListSection(items: CharacterItem[]): string {
  const lines = items.map(
    (c, i) =>
      `${i + 1}. 姓名：${c.name || '（未命名）'}${c.alias ? ` | 别名：${c.alias}` : ''} | 身份：${c.role || '人物'} | 备忘：${c.notes || ''}`
  );
  return `
【当前人物列表（修订基线）】
${lines.join('\n')}
`;
}

function motifsListSection(items: MotifItem[]): string {
  const lines = items.map(
    (m, i) =>
      `${i + 1}. 名称：${m.name || '（未命名）'} | 象征：${m.description || ''}${m.occurrencesCount !== undefined ? ` | 频次：${m.occurrencesCount}` : ''}`
  );
  return `
【当前意象列表（修订基线）】
${lines.join('\n')}
`;
}

function scenesListSection(scenes: Scene[]): string {
  const lines = scenes.map((s, i) => {
    const excerpt = (s.content || '').slice(0, 80).replace(/\s+/g, ' ').trim();
    return `${i + 1}. 《${s.title || `第 ${i + 1} 场`}》｜开头：「${excerpt}」`;
  });
  return `
【当前分场结构（参考切分粒度与边界）】
${lines.join('\n')}
`;
}

export function buildSynopsisPrompt(ctx: ProfilingPromptContext): string {
  const hasNotes = Boolean(ctx.userNotes && ctx.userNotes.trim());
  const isRefine =
    ctx.mode === 'refine' && typeof ctx.currentValue === 'string' && ctx.currentValue.trim().length > 0;
  const baseline = isRefine ? synopsisBaselineSection(ctx.currentValue as string) : '';

  return `
${EDITOR_ROLE_HEADER}
${manuscriptOpeningLine(ctx.title)}
${authorNotesSection(ctx.userNotes)}
${baseline}
${manuscriptSection(ctx.title, ctx.content)}
【解构与提取要求】
生成客观、克制、具有文学密度的故事梗概（synopsis），交代时空舞台、核心行动与人际暗流。${hasNotes ? '（如作者批注中有梗概侧重点要求，请重点体现）' : ''}${isRefine ? '以当前梗概为修订基线，结合批注与全文修正偏差，保留未受批注影响的部分，输出修订后的完整梗概。' : ''}

【输出格式】
必须返回严格合法的 JSON 对象，格式如下：
{
  "synopsis": "..."
}
`.trim();
}

export function buildThemePrompt(ctx: ProfilingPromptContext): string {
  const isRefine =
    ctx.mode === 'refine' && typeof ctx.currentValue === 'string' && ctx.currentValue.trim().length > 0;
  const baseline = isRefine ? themeBaselineSection(ctx.currentValue as string) : '';

  return `
${EDITOR_ROLE_HEADER}
${manuscriptOpeningLine(ctx.title)}
${authorNotesSection(ctx.userNotes)}
${baseline}
${manuscriptSection(ctx.title, ctx.content)}
【解构与提取要求】
提炼深层隐秘矛盾（themeAnalysis），例如"表面是代际隔阂，实质是对消逝故土的抵抗与无力"。${isRefine ? '以当前主题剖析为修订基线，结合批注与全文修正偏差，保留未受批注影响的部分，输出修订后的完整剖析。' : ''}

【输出格式】
必须返回严格合法的 JSON 对象，格式如下：
{
  "themeAnalysis": "..."
}
`.trim();
}

export function buildCharactersPrompt(ctx: ProfilingPromptContext): string {
  const isRefine =
    ctx.mode === 'refine' && Array.isArray(ctx.currentValue) && ctx.currentValue.length > 0;
  const baseline = isRefine ? charactersListSection(ctx.currentValue as CharacterItem[]) : '';

  return `
${EDITOR_ROLE_HEADER}
${manuscriptOpeningLine(ctx.title)}
${authorNotesSection(ctx.userNotes)}
${baseline}
${manuscriptSection(ctx.title, ctx.content)}
【解构与提取要求】
提取文稿中出现的全部关键角色（涵盖主角、主要配角、次要人物与重要背景隐性人物，不设人数上限）。
- name: 人物姓名或称谓。
- role: "主角" | "主要配角" | "次要人物" | "背景隐性人物"。
- alias: 人物在文中的别名或昵称（如有）。
- notes: 包含其性格质感、声线口吻（如"句式简短冷淡，很少使用连词，多潜台词"）、核心动机与人际张力。${isRefine ? '以当前人物列表为修订基线：修正偏差、合并重复条目（同一人物的多个条目合为一条）、补充遗漏人物，输出修订后的完整列表。' : ''}

【输出格式】
必须返回严格合法的 JSON 对象，格式如下：
{
  "characters": [
    { "name": "...", "alias": "...", "role": "...", "notes": "..." }
  ]
}
`.trim();
}

export function buildMotifsPrompt(ctx: ProfilingPromptContext): string {
  const isRefine =
    ctx.mode === 'refine' && Array.isArray(ctx.currentValue) && ctx.currentValue.length > 0;
  const baseline = isRefine ? motifsListSection(ctx.currentValue as MotifItem[]) : '';

  return `
${EDITOR_ROLE_HEADER}
${manuscriptOpeningLine(ctx.title)}
${authorNotesSection(ctx.userNotes)}
${baseline}
${manuscriptSection(ctx.title, ctx.content)}
【解构与提取要求】
提取反复出现或承载重要叙事象征的物质/感官/环境意象（全面覆盖文稿中的核心意象网络，不设数量上限）。
- name: 意象名称（如"雨水与锈迹"、"走马灯"）。
- description: 意象在文中的文学象征机理与出现情境。
- occurrencesCount: 估计在文中的出现频次。${isRefine ? '以当前意象列表为修订基线：修正偏差、合并重复条目、补充遗漏意象，输出修订后的完整列表。' : ''}

【输出格式】
必须返回严格合法的 JSON 对象，格式如下：
{
  "motifs": [
    { "name": "...", "description": "...", "occurrencesCount": 3 }
  ]
}
`.trim();
}

export function buildSceneSplitsPrompt(ctx: ProfilingPromptContext): string {
  const isRefine =
    ctx.mode === 'refine' && Array.isArray(ctx.currentValue) && ctx.currentValue.length > 0;
  const baseline = isRefine ? scenesListSection(ctx.currentValue as Scene[]) : '';

  return `
${EDITOR_ROLE_HEADER}
${manuscriptOpeningLine(ctx.title)}
${authorNotesSection(ctx.userNotes)}
${baseline}
${manuscriptSection(ctx.title, ctx.content)}
【解构与提取要求】
智能分场/分章切分建议：
- 必须全量切分并完整覆盖文稿从头到尾的所有章节/场次（按原文自然章节、时空转折或叙事节奏逐一完整切分），严禁仅切分前几章或省略后续内容。
- title: 场景标题（如"第一场：破晓时分"或"第一章：..."）。
- summary: 该场一句话核心事件与张力。
- startQuote: 该场在原文中的起始句/开头片段（15~30字，务必与原文逐字完全一致，作为切分起始锚点）。第一场通常对应文稿开篇第一句，后续各场对应各自分界线处的第一句。
- 严禁回吐大段正文内容，仅返回切分锚点（系统将自动在本地执行高保真切片）。${isRefine ? '可参考现有分场边界，也可结合批注对切分粒度与转折节点重新划分；仍须全量覆盖全文。' : ''}

【输出格式】
必须返回严格合法的 JSON 对象，格式如下：
{
  "sceneSplits": [
    { "title": "...", "summary": "...", "startQuote": "..." }
  ]
}
`.trim();
}
