export function buildManuscriptProfilePrompt(
  title: string,
  content: string,
  options?: { userNotes?: string; shouldSuggestScenes?: boolean }
): string {
  const isLongOrMultiple = options?.shouldSuggestScenes !== false;
  const hasUserNotes = Boolean(options?.userNotes && options.userNotes.trim());

  const userNotesSection = hasUserNotes
    ? `
【作者批注与核心修正要求 (Author's Notes & Directives)】
创作者/审读者对本次建档与解构提出了以下关键批注与调整要求（包含人物关系修正、意象重点、主题纠偏、分场偏好等）。在通读文稿并提炼建档数据时，必须最高优先级严格遵从并予以精准修正：
"""
${options!.userNotes!.trim()}
"""
`
    : '';

  return `
你是一位极具洞察力与结构感的纯文学/严肃文学资深特约编辑。
创作者刚刚向 Verso 工作台导入了一篇文稿《${title || '未命名文稿'}》。
${userNotesSection}
请深入通读并解构以下文稿，提炼出可用于后续精修与审读的【文学基础设施（梗概、人物小传与声线、核心意象网络${isLongOrMultiple ? '、以及长文智能分场切分建议' : ''}）】。${hasUserNotes ? '\n特别注意：请务必严格结合并贯彻上述【作者批注与核心修正要求】，对前述设定的偏差予以精准重构与校准。' : ''}

【文稿正文《${title || '未命名文稿'}》】
"""
${content}
"""

【解构与提取要求】
1. **故事梗概与核心矛盾 (synopsis & themeAnalysis)**：
   - synopsis: 客观、克制、具有文学密度的梗概，交代时空舞台、核心行动与人际暗流。${hasUserNotes ? '（如作者批注中有梗概或矛盾侧重点要求，请重点体现）' : ''}
   - themeAnalysis: 提炼深层隐秘矛盾（例如“表面是代际隔阂，实质是对消逝故土的抵抗与无力”）。
2. **人物小传与声线特征 (characters)**：
   - 提取文稿中出现的全部关键角色（涵盖主角、主要配角、次要人物与重要背景隐性人物，不设人数上限）。
   - name: 人物姓名或称谓。
   - role: "主角" | "主要配角" | "次要人物" | "背景隐性人物"。
   - notes: 包含其性格质感、声线口吻（如“句式简短冷淡，很少使用连词，多潜台词”）、核心动机与人际张力。${hasUserNotes ? '（严格遵从作者批注中关于人物身份、关系与性格的修正）' : ''}
3. **核心意象网络 (motifs)**：
   - 提取反复出现或承载重要叙事象征的物质/感官/环境意象（全面覆盖文稿中的核心意象网络，不设数量上限）。${hasUserNotes ? '（优先覆盖作者批注中指定或强调的核心意象）' : ''}
   - name: 意象名称（如“雨水与锈迹”、“走马灯”）。
   - description: 意象在文中的文学象征机理与出现情境。
   - occurrencesCount: 估计在文中的出现频次。
${isLongOrMultiple ? `4. **智能分场/分章切分建议 (sceneSplits)**：
   - 必须全量切分并完整覆盖文稿从头到尾的所有章节/场次（按原文自然章节、标记、时空转折或逻辑节点逐一完整切分），严禁仅切分前几章或省略后续内容。${hasUserNotes ? '（参考作者批注对切分粒度或转折节点的指示）' : ''}
   - title: 场景标题（如“第一场：破晓时分”或“第一章：...”）。
   - summary: 该场一句话核心事件与张力。
   - content: 该场对应的完整原文段落（务必与原文段落逐字一致）。` : ''}

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
