import type { CritiqueCategory } from '../types';

export function buildCritiquePrompt(
  category: CritiqueCategory,
  contextBlock: string,
  lensInstruction?: string
): string {
  const categoryDirectives: Record<CritiqueCategory, string> = {
    critique: `
【综合文学审读】
重点关注：
1. 冗余与过度解释 (Exposition Overkill)
2. 情绪提前命名 (Naming emotions rather than evoking them)
3. 叙述距离漂移 (Narrative distance & POV drift)
4. 戏剧张力流失
5. 动作与环境是否有效承载人物心理
`,
    language: `
【语言质感与修辞显微镜】
重点排查：
1. 抽象概念词与陈词滥调 (Clichés)
2. LLM式均质书面语与翻译腔
3. 空洞无力的修饰语与副词堆砌
4. 动词强度与汉语四字节奏
5. 感官细节是否具备真实的物质磨损感
`,
    rhythm: `
【句式节奏与呼吸分析】
重点关注：
1. 长短句分布与单调重复的句式
2. 标点停顿的呼吸感与机械感
3. 连续相同结构（如连续的主谓宾均质句）
4. 段落推进中的语流阻滞或滑脱
`,
    dialogue: `
【对白真实性与潜台词】
重点检查：
1. 角色声音是否区分，还是作者借角色之口发表议论 (Author intrusion)
2. 是否存在向读者倾倒背景信息的工具性对白 (Info-dumping)
3. 对白是否有潜台词 (Subtext) 与未言之意
4. 语调、方言腔调与人物身份的契合度
`,
    cut: `
【极简删削 (Subtractive Knife)】
你的唯一任务是寻找可以【删除】的部分：
1. 哪些副词或虚词可以毫不留情地删掉？
2. 哪些半句或整句其实在重复前面的信息？
3. 删掉哪些多余的心理交代可以让读者自己进入情境？
只提供减法方案，原则是"能删一字绝不留半词"。
`,
    imagery: `
【意象与感官网络】
重点分析：
1. 意象是否重复承担同一种象征功能
2. 象征是否过于直白露骨，作者是否在文本中自行解释了意象
3. 视觉、听觉、嗅觉、触觉在场景中的分布平衡
`,
    distance: `
【叙述距离与视角】
重点分析：
1. 叙述者是否突兀介入 (Narrator intrusion)
2. 自由间接引语 (Free indirect discourse) 是否自然
3. 摄影机机位（远景/全景/特写/微距）推拉是否平滑
`,
    ask: `
【文学讨论】
请针对创作者的疑问，以资深文学编辑的敏锐与客观进行深度剖析。
`
  };

  return `
请对以下文本进行深度文学分析与审读。

${categoryDirectives[category] || categoryDirectives.critique}

${lensInstruction ? `【当前应用的文学透镜 (Literary Lens)】\n${lensInstruction}\n` : ''}

${contextBlock}

【输出格式要求】
你必须返回合法的 JSON 对象，不要输出额外的解释性包装文字。JSON 结构如下：
{
  "summary": "一句话整体文学诊断断语",
  "annotations": [
    {
      "quote": "确切存在于目标文本中的原文片段（务必与原文逐字完全一致）",
      "category": "${category === 'ask' ? 'critique' : category}",
      "severity": "low | medium | high",
      "diagnosis": "具体文学机理与成因解释（指出为什么此处需要推敲）",
      "literaryTradeoff": "修改此处的得与失（例如：删减后增强了客观冷感，但降低了直接情绪传达）",
      "suggestion": "编辑建议与思考方向",
      "replacement": {
        "minimal": "最小干预的精修版本（微创手术，仅调几个字）",
        "moderate": "中度提炼版本（句式提炼）",
        "radical": "重构构想版本（重构或整句删去）"
      }
    }
  ]
}
`.trim();
}
