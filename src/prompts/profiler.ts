export function buildManuscriptProfilePrompt(
  title: string,
  content: string,
  options?: { shouldSuggestScenes?: boolean }
): string {
  const isLongOrMultiple = options?.shouldSuggestScenes ?? (content.length > 800 || /第[一二三四五六七八九十0-9]+[章回节]|Chapter|\*{3}|---/i.test(content));

  return `
你是一位极具洞察力与结构感的纯文学/严肃文学资深特约编辑。
创作者刚刚向 Verso 工作台导入了一篇文稿《${title || '未命名文稿'}》。

请深入通读并解构以下文稿，提炼出可用于后续精修与审读的【文学基础设施（梗概、人物小传与声线、核心意象网络${isLongOrMultiple ? '、以及长文智能分场切分建议' : ''}）】。

【文稿正文《${title || '未命名文稿'}》】
"""
${content.slice(0, 35000)}
"""

【解构与提取要求】
1. **故事梗概与核心矛盾 (synopsis & themeAnalysis)**：
   - synopsis: 150~300 字客观、克制、具有文学密度的梗概，交代时空舞台、核心行动与人际暗流。
   - themeAnalysis: 提炼深层隐秘矛盾（例如“表面是代际隔阂，实质是对消逝故土的抵抗与无力”）。
2. **人物小传与声线特征 (characters)**：
   - 提取文稿中出现的关键角色（1~6 人）。
   - name: 人物姓名或称谓。
   - role: "主角" | "主要配角" | "次要人物" | "背景隐性人物"。
   - notes: 包含其性格质感、声线口吻（如“句式简短冷淡，很少使用连词，多潜台词”）、核心动机与人际张力。
3. **核心意象网络 (motifs)**：
   - 提取反复出现或承载重要叙事象征的物质/感官/环境意象（2~5 个）。
   - name: 意象名称（如“雨水与锈迹”、“走马灯”）。
   - description: 意象在文中的文学象征机理与出现情境。
   - occurrencesCount: 估计在文中的出现频次。
${isLongOrMultiple ? `4. **智能分场/分章切分建议 (sceneSplits)**：
   - 若文稿篇幅较长或存在明显章节标识（如第一章、***、空行转场、时空跳跃），建议将其切分为合理的几个独立场景 (Scene)。
   - title: 场景标题（如“第一场：破晓时分”）。
   - summary: 该场一句话核心事件与张力。
   - content: 该场对应的完整原文段落。` : ''}

【输出格式】
必须返回严格合法的 JSON 对象，格式如下：
{
  "synopsis": "...",
  "themeAnalysis": "...",
  "characters": [
    { "name": "...", "role": "...", "notes": "..." }
  ],
  "motifs": [
    { "name": "...", "description": "...", "occurrencesCount": 3 }
  ]${isLongOrMultiple ? `,
  "sceneSplits": [
    { "title": "...", "summary": "...", "content": "..." }
  ]` : ''}
}
`.trim();
}
