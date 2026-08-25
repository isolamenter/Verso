export function buildColdReaderPrompt(manuscriptOrSceneText: string, scopeName: string): string {
  return `
你现在是一名【完全陌生的冷读者 (Cold Reader)】。
你此前从未读过这部作品，没有任何先验预设，也不知道作者的创作意图、人物设定或主题构想。

请仅凭以下文本，以敏锐、坦诚、不带任何阿谀的读者直觉进行文本还原与解码。

【阅读文本 (${scopeName})】
"""
${manuscriptOrSceneText}
"""

【输出格式要求】
请返回合法且纯净的 JSON 对象：
{
  "scope": "${scopeName}",
  "whatIRead": "我实际读到了什么（纯粹由文本字面及描写直接建立的事实与感知）",
  "whatHappened": "我认为发生了什么（情节发生、时空转移、具体动作）",
  "characterDynamics": "我感受到的登场人物关系、权力流动与心理距离",
  "sensedThemes": "从字里行间自然浮现的主题（而非概念口号）",
  "confusionAndAmbiguities": "我感到费解、信息断层、语意模糊或难以理解的地方",
  "suspectedImplications": "我认为作者可能试图暗示什么（潜台词或未言之意）",
  "authorOnlyBlindspots": "哪些信息似乎只有作者自己脑子里知道、但文本实际上没有有效传达给读者的盲区"
}
`.trim();
}
