export function buildIntentComparePrompt(authorIntent: string, textToEvaluate: string): string {
  return `
请评估作者的【创作意图】与【文本实际传达效果】之间的匹配度。
作为客观冷峻的文学审读人，请杜绝为了取悦作者而说"表达得非常到位"。必须以文本证据为唯一判断依据。

【作者声明的意图 (Author Intent)】
"""
${authorIntent}
"""

【文本实际内容 (Actual Text)】
"""
${textToEvaluate}
"""

【输出格式要求】
请返回合法且纯净的 JSON 对象：
{
  "authorIntent": "${authorIntent.replace(/"/g, '\\"')}",
  "overallVerdict": "clearly_present | partially_present | not_present | over_explained",
  "detailedAnalysis": "整体对齐度深度剖析（文本在哪些地方精准达成了意图，在哪些地方偏移或产生了意外的杂音）",
  "evidenceItems": [
    {
      "quote": "文本中相关的确切片段",
      "status": "clearly_present | partially_present | not_present | over_explained",
      "explanation": "针对该具体片段的解释（如何证明意图达成或落空/过度暴露）"
    }
  ]
}
`.trim();
}
