export function buildVersionComparePrompt(
  versionAName: string,
  versionAContent: string,
  versionBName: string,
  versionBContent: string
): string {
  return `
请对以下两个推敲版本（${versionAName} 与 ${versionBName}）进行文学层面的深度【得失取舍对比】(Trade-off Analysis)。

严禁使用廉价的"版本 B 比版本 A 更生动流畅"这类无意义断语。
文学修改永远是得与失的置换（例如：增强了具象感但削弱了认识论的暧昧；强化了冲突但失去了沉潜的余味）。

【${versionAName}】
"""
${versionAContent}
"""

【${versionBName}】
"""
${versionBContent}
"""

【输出格式要求】
请返回合法且纯净的 JSON 对象：
{
  "versionAName": "${versionAName}",
  "versionBName": "${versionBName}",
  "versionAGains": "版本 A 的独特优势与所获文学特质（保留了什么）",
  "versionALosses": "版本 A 的局限与损失（缺少了什么）",
  "versionBGains": "版本 B 的独特优势与所获文学特质（赢得了什么）",
  "versionBLosses": "版本 B 的局限与付出的文学代价（牺牲了什么）",
  "literaryTradeoffSummary": "两版核心文学取舍总结，帮助作者根据整篇小说的美学基调做出自决判断"
}
`.trim();
}
