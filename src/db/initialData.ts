import type {
  LiteraryLens,
  PromptTemplate,
  ModelProfile,
  AppSettings
} from '../types';


export const BUILTIN_LENSES: LiteraryLens[] = [
  {
    id: 'lens-restrained',
    name: '克制与减法 (Restraint)',
    description: '严格识别作者越俎代庖的心理命名、修辞过度、概念直接暴露。优先建议删削与物象化承载。',
    promptInstruction: '作为极度克制的文学编辑，重点审查：1) 是否有直接命名情绪（如"他感到十分悲伤"）；2) 是否存在作者替人物做哲学概括；3) 修辞是否过密妨碍了叙事呼吸。只提出必要修改，倾向于做减法。',
    icon: 'Scissors',
    isBuiltIn: true,
  },
  {
    id: 'lens-chinese-idiom',
    name: '现代汉语语感 (Natural Chinese)',
    description: '剔除翻译腔、欧化长句与 LLM 式均质假书面语，恢复自然精准的现代汉语张力。',
    promptInstruction: '重点审查中文语感：1) 警惕"进行了一次...的观察"、"显现出一种...的状态"等恶性欧化名物化；2) 消除无意义的"关于"、"对于"、"具有"等填充词；3) 检查动词是否凝练有质感，句子是否有汉语自然的四字节奏与呼吸。',
    icon: 'Feather',
    isBuiltIn: true,
  },
  {
    id: 'lens-sensory-realism',
    name: '南方物性与质感 (Sensory Realism)',
    description: '检查环境描写是否通过具体物质、温度、声音、触觉与磨损痕迹传递，而非堆砌抽象形容词。',
    promptInstruction: '审查感官与物质细节：1) 检查作者是否依赖"潮湿、闷热、凄凉"等形容词，要求替换为具体物态（水汽、铁锈、油垢、布料硬度）；2) 听觉与空间回声是否真实；3) 道具是否具备生活磨损痕迹。',
    icon: 'Compass',
    isBuiltIn: true,
  },
  {
    id: 'lens-dialogue-subtext',
    name: '潜台词与声音 (Dialogue Subtext)',
    description: '审查对白是否沦为作者传递背景信息的工具，强化人物口吻的独立性与欲言又止的博弈。',
    promptInstruction: '审查对白真实度：1) 角色是否在说"只有为了告诉读者才说的话"（Info-dumping）；2) 对白是否有潜台词（Subtext）与隐秘的权力流动；3) 语气、停顿与口癖是否符合特定人物身份。',
    icon: 'MessageSquare',
    isBuiltIn: true,
  }
];

export const BUILTIN_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'tmpl-show-dont-tell',
    name: '白描化与动作承载 (Show Don\'t Tell)',
    description: '寻找所有被作者直接交代概括的内心活动，转化为具体的物理动作或光影空间。',
    category: 'language',
    promptTemplate: '审查目标文段：找出所有"直接告诉读者角色在想什么/感觉如何"的句子，提出如何将其转化为肢体微动作、道具磨损或声音细节的改写方案。',
    isBuiltIn: true,
    createdAt: Date.now(),
  },
  {
    id: 'tmpl-dialogue-duel',
    name: '对白博弈与权力隐流',
    description: '检验角色对话中的未言之意，剔除机械问答，强化潜台词博弈。',
    category: 'dialogue',
    promptTemplate: '审查对白：1) 两人之间是否存在隐秘的权力较量？2) 是否有角色在回避问题？3) 将直白告知信息的对白改为答非所问或动作阻滞。',
    isBuiltIn: true,
    createdAt: Date.now(),
  },
  {
    id: 'tmpl-subtractive-knife',
    name: '奥卡姆剃刀极端删削',
    description: '能删一字绝不留半词，压榨出文本最冷峻的张力。',
    category: 'cut',
    promptTemplate: '以极端克制的眼光执行纯减法：列出文段中所有多余的副词、重复的修饰语、以及删掉后反而更有余味的句子。',
    isBuiltIn: true,
    createdAt: Date.now(),
  },
  {
    id: 'tmpl-rhythm-flow',
    name: '句法起伏与呼吸律动',
    description: '打破单调的均质句长，重塑段落语流的张弛节拍。',
    category: 'rhythm',
    promptTemplate: '分析当前文段的音步与呼吸：指出是否存在连续相同长度的短句或长句导致的阅读疲劳，建议如何通过长短错落与标点停顿重构节奏。',
    isBuiltIn: true,
    createdAt: Date.now(),
  }
];

export const DEFAULT_PROFILES: ModelProfile[] = [];

export const DEFAULT_SETTINGS: AppSettings = {
  activeProfileId: '',
  profiles: [],
  autoSaveIntervalMs: 1500,
  autoSnapshotIntervalMs: 30000,
  typewriterMode: false,
  focusMode: false,
  paperTheme: 'parchment',
  typography: 'serif',
  fontSize: 18,
  lineHeight: 1.8,
};
