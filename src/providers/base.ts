import type { LLMMessage } from '../types';

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Approximation: Chinese characters ~ 1.5 - 2 chars per token, English words ~ 0.75 words per token
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 0.8 + otherChars * 0.3);
}

export function formatMessagesForLog(messages: LLMMessage[]): string {
  return messages.map(m => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 100)}...`).join('\n');
}
