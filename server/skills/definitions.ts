export interface SkillContextPolicy {
  includeKnowledge: boolean;
  includeMemory: boolean;
  includeMedia: boolean;
  allowedKnowledgeKinds: string[];
}

export interface BuiltinSkillConfig {
  id: string;
  name: string;
  category: "critique" | "creation" | "analysis" | "revision";
  description: string;
  version: string;
  instructions: string;
  contextPolicy: SkillContextPolicy;
  supportedTools: string[];
}

export const BUILTIN_SKILLS: BuiltinSkillConfig[] = [
  {
    id: "cold_reader",
    name: "冷读鉴赏 (Cold Reader)",
    category: "critique",
    description: "以完全不了解设定与前置背景的第一读者视角审阅正文，提供最纯粹的阅读反馈。",
    version: "1.0.0",
    instructions: `你是一名“冷读体验官”（Cold Reader）。你没有关于此书的任何世界观设定、人物小传或作者写作意图。
请完全站在普通初次读者的立场，基于眼前的正文文本，评估：
1. 开篇吸引力与代入感
2. 情节是否产生困惑或信息断层
3. 角色动机是否清晰易懂
4. 语言节奏与阅读沉浸度`,
    contextPolicy: {
      includeKnowledge: false,
      includeMemory: false,
      includeMedia: false,
      allowedKnowledgeKinds: [],
    },
    supportedTools: ["read_resource", "propose_text_change"],
  },
  {
    id: "literary_critique",
    name: "文学透镜推敲 (Literary Critique)",
    category: "critique",
    description: "多维度七大透镜（主题、人物、风格、节奏、结构、情绪、逻辑）深度推敲文本。",
    version: "1.0.0",
    instructions: `你是一名专业文学编辑。运用七大文学透镜对指定场景进行多维度深度审阅：
- 主题透镜：核心立意与隐喻表达
- 人物透镜：言语声线、动机连贯度与心理刻画
- 风格透镜：遣词造句、修辞质感与语体统一性
- 节奏透镜：叙事张弛、详略安排与场景密度
- 结构透镜：起承转合与伏笔呼应
- 情绪透镜：情感张力与读者共鸣点
- 逻辑透镜：情节因果与世界观自洽`,
    contextPolicy: {
      includeKnowledge: true,
      includeMemory: true,
      includeMedia: true,
      allowedKnowledgeKinds: ["character", "world_rule", "theme", "location", "timeline"],
    },
    supportedTools: [
      "read_resource",
      "search_knowledge",
      "search_manuscript",
      "propose_text_change",
      "propose_scene_change",
    ],
  },
  {
    id: "scene_drafting",
    name: "场景起草 (Scene Drafting)",
    category: "creation",
    description: "依据大纲、分镜要求和角色声线，草拟具有文学质感的正文场景。",
    version: "1.0.0",
    instructions: `你是一名专注小说正文起草的文学创作助手。
根据用户给出的场景大纲与情节要求，参考相关角色小传与世界观设定，起草富有文学表现力、声线贴切、细节丰满的场景正文。
起草完成后，请通过 propose_text_change 或 propose_scene_change 工具提交提案。`,
    contextPolicy: {
      includeKnowledge: true,
      includeMemory: true,
      includeMedia: true,
      allowedKnowledgeKinds: ["character", "world_rule", "location"],
    },
    supportedTools: ["read_resource", "search_knowledge", "propose_text_change", "propose_scene_change"],
  },
  {
    id: "prose_expansion",
    name: "感官扩写 (Prose Expansion)",
    category: "creation",
    description: "对指定段落进行五感描写强化、心理外化与环境烘托。",
    version: "1.0.0",
    instructions: `你是一名精于细节描写的扩写大师。
对用户选定的场景段落进行生动扩写：
- 调动视、听、触、嗅、味等五感细节
- 强化动作微表情与肢体语言
- 融入与角色心境呼应的环境描写
- 保持原文语体风格与叙事节奏不拖沓`,
    contextPolicy: {
      includeKnowledge: true,
      includeMemory: true,
      includeMedia: false,
      allowedKnowledgeKinds: ["character", "location"],
    },
    supportedTools: ["read_resource", "propose_text_change"],
  },
  {
    id: "character_profiler",
    name: "角色特质提取 (Character Profiler)",
    category: "analysis",
    description: "从场景正文中自动提炼角色外貌、性格、口癖与人际关系。",
    version: "1.0.0",
    instructions: `你是一名文学人物分析师。
分析给定场景中的对话与举止，提炼角色的性格特质、语言习惯、心理防线以及与其他角色的互动张力。
提取出的新设定可通过 propose_knowledge_create 或 propose_knowledge_update 提交。`,
    contextPolicy: {
      includeKnowledge: true,
      includeMemory: false,
      includeMedia: false,
      allowedKnowledgeKinds: ["character"],
    },
    supportedTools: ["read_resource", "propose_knowledge_create", "propose_knowledge_update"],
  },
  {
    id: "revision_comparison",
    name: "版本对勘 (Revision Comparison)",
    category: "revision",
    description: "对两个历史版本进行文学得失比对与演变轨迹分析。",
    version: "1.0.0",
    instructions: `你是一名版本学与文本对勘专家。
对比给定场景的新旧版本修改，分析文字改动背后的文学意图、节奏变化以及叙事得失。`,
    contextPolicy: {
      includeKnowledge: false,
      includeMemory: false,
      includeMedia: false,
      allowedKnowledgeKinds: [],
    },
    supportedTools: ["get_revision", "compare_revisions", "read_resource"],
  },
];

