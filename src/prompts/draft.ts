import type { SceneDraftParams, Manuscript, Scene } from '../types';
import { extractPlainText } from '../utils/textProjection';
import { formatCharacterNotes, formatMotifs, getPreviousScene } from '../utils/contextBuilder';

export interface SceneDraftPromptContext {
  params: SceneDraftParams;
  manuscript?: Manuscript | null;
  scenes?: Scene[] | null;
  currentScene?: Scene | null;
}

const DRAFT_ROLE_HEADER = `
你是一位极具语言质感、叙事沉浸感与审美克制力的纯文学 / 严肃小说作家与特约主笔。
你的任务是基于创作者设定的书稿背景、人物声线、核心意象以及当前场景大纲，创作一段具有文学肌理与戏剧张力的小说正文。

【纯文学创作核心准则】
1. **严禁 AI 俗套与廉价陈词滥调 (No Clichés)**：杜绝"似乎在诉说着"、"显现出一丝"、"空气中弥漫着"、"心中五味杂陈"等均质网络语言；拒绝欧化翻译腔从句，追求纯正、考究且有呼吸感的现代汉语节奏。
2. **白描物性与具象感官 (Sensory Materiality)**：严禁直接命名人物情绪（如直接写"他感到焦虑"）。必须通过具体物质的磨损感、动作停顿、天气光影与声音质感来折射内心（Show, Don't Tell）。
3. **对白声线与潜台词 (Subtext & Distinct Voices)**：严格遵循人物小传设定的声线与口吻。对白充满人际暗流、权力流动与未言之意，严禁作者借人物之口向读者倾倒背景信息（No Info-dumping）。
4. **叙述距离与留白克制 (Restraint & POV Distance)**：严格锁定所设定的视角（POV），不随意漂移视角；叙述者不越俎代庖进行道德裁判或哲学说教，保留充分的文学留白。
5. **意象网络自然互文 (Motif Intertextuality)**：若提供了核心意象，在场景中应自然生发，作为情绪或关系的载体，严禁直白生硬地解释象征意义。
`.trim();

function getWordCountGuideline(length: SceneDraftParams['targetLength']): string {
  switch (length) {
    case 'short':
      return '精炼短篇片段，目标篇幅约为 800 ~ 1200 字，注重高密度与留白。';
    case 'long':
      return '详实充分展开，目标篇幅约为 2500 ~ 4000 字，注重细节铺陈、环境物性与人物深层对话交锋。';
    case 'medium':
    default:
      return '标准场景篇幅，目标篇幅约为 1500 ~ 2500 字，兼顾情节推进与人物心理细节。';
  }
}

export function buildSceneDraftPrompt(context: SceneDraftPromptContext): string {
  const { params, manuscript, scenes, currentScene } = context;
  const sections: string[] = [];

  sections.push(DRAFT_ROLE_HEADER);

  // 1. Manuscript Synopsis & Themes
  if (manuscript) {
    if (manuscript.synopsis && manuscript.synopsis.trim()) {
      sections.push(`【全书故事梗概 (Manuscript Synopsis)】\n"""\n${manuscript.synopsis.trim()}\n"""`);
    }
    if (manuscript.themeAnalysis && manuscript.themeAnalysis.trim()) {
      sections.push(`【深层主题矛盾剖析 (Theme Analysis)】\n"""\n${manuscript.themeAnalysis.trim()}\n"""`);
    }
    if (manuscript.notes && manuscript.notes.trim()) {
      sections.push(`【全局创作备忘 (Author's Notes)】\n"""\n${manuscript.notes.trim()}\n"""`);
    }

    const charNotes = formatCharacterNotes(manuscript).trim();
    if (charNotes) {
      sections.push(`【主要登场人物与声线设定 (Characters & Voice)】\n${charNotes}`);
    }

    const motifNotes = formatMotifs(manuscript).trim();
    if (motifNotes) {
      sections.push(`【核心意象与物象网络 (Motifs)】\n${motifNotes}`);
    }
  }

  // 2. Preceding scene bridge (前置场景衔接)
  if (scenes && scenes.length > 1 && currentScene) {
    const prev = getPreviousScene(scenes, currentScene.id);
    if (prev && prev.content && prev.content.trim()) {
      const prevPlain = extractPlainText(prev.content).trim();
      const prevTail = prevPlain.length > 800 ? `...${prevPlain.slice(-800)}` : prevPlain;
      sections.push(`【前一场景末尾衔接 (Preceding Scene Ending Context: 《${prev.title}》)】\n"""\n${prevTail}\n"""`);
    }
  }

  // 3. Current Scene Settings (本场舞台、视角与时空)
  const sceneInfo: string[] = [];
  sceneInfo.push(`• 场景篇名：《${params.sceneTitle || currentScene?.title || '未命名场景'}》`);
  if (params.pov || currentScene?.pov) {
    sceneInfo.push(`• 叙述视角 (POV)：${params.pov || currentScene?.pov}`);
  }
  if (params.locationAndTime || currentScene?.location || currentScene?.timeframe) {
    const loc = params.locationAndTime || [currentScene?.timeframe, currentScene?.location].filter(Boolean).join(' ');
    sceneInfo.push(`• 时空舞台：${loc}`);
  }
  sections.push(`【当前场景基本设定】\n${sceneInfo.join('\n')}`);

  // 4. Scene Outline / Beats (核心大纲细纲)
  sections.push(`【本场场景大纲与情节点 (Scene Outline & Beats)】\n"""\n${params.sceneOutline.trim() || '（请根据书稿梗概与人物关系自由铺展本场冲突）'}\n"""`);

  // 5. Existing draft or selected text if in continuation / expand mode
  if (params.mode === 'continuation' && params.existingContent && params.existingContent.trim()) {
    const plain = extractPlainText(params.existingContent).trim();
    const tail = plain.length > 1200 ? `...${plain.slice(-1200)}` : plain;
    sections.push(`【当前已有正文（请紧密顺接其末尾继续书写）】\n"""\n${tail}\n"""`);
  } else if (params.mode === 'expand' && params.selectedText && params.selectedText.trim()) {
    sections.push(`【待扩写的骨架文段 / 选区】\n"""\n${params.selectedText.trim()}\n"""`);
  }

  // 6. Directives & Target Length
  const directives: string[] = [];
  directives.push(`• 篇幅要求：${getWordCountGuideline(params.targetLength)}`);

  if (params.mode === 'draft') {
    directives.push('• 创作任务：从本场开头落笔，完整铺展场景的时空入景、人际对话、张力发展与收束。');
  } else if (params.mode === 'continuation') {
    directives.push('• 创作任务：无缝顺接上方已有正文的语气、叙述距离与人物动作，继续推进大纲中的下一阶段情节。');
  } else if (params.mode === 'expand') {
    directives.push('• 创作任务：将待扩写的骨架文段展开为富含感官细节、心理暗流、微动作与环境物象的丰满文学段落。');
  }

  if (params.userNotes && params.userNotes.trim()) {
    directives.push(`• 创作者特别要求：${params.userNotes.trim()}`);
  }
  if (params.lensInstruction && params.lensInstruction.trim()) {
    directives.push(`• 文学透镜指导要求：${params.lensInstruction.trim()}`);
  }

  sections.push(`【生成要求与指导】\n${directives.join('\n')}`);

  // 7. Output Format
  sections.push(`
【输出格式要求】
必须返回严格合法的 JSON 对象，不要包含多余的包装说明。JSON 格式规范如下：
{
  "content": "此处输出完整的小说场景正文，采用规范的段落换行，语言质感醇厚，严禁任何元说明或大纲标记。",
  "literaryNotes": "此处输出 100~200 字的文学机理小结，说明本场在叙述视角、意象运用、对白潜台词与留白克制上的具体构思设计。"
}
`.trim());

  return sections.join('\n\n');
}

