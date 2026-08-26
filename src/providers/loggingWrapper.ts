import type { LLMProvider, LLMRequest, LLMResponse, ModelProfile } from '../types';
import { estimateTokenCount } from './base';

export class LoggingLLMProvider implements LLMProvider {
  id: string;
  name: string;
  private delegate: LLMProvider;
  private profile: ModelProfile;

  constructor(delegate: LLMProvider, profile: ModelProfile) {
    this.id = delegate.id;
    this.name = delegate.name;
    this.delegate = delegate;
    this.profile = profile;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const startTime = performance.now();
    const model = this.profile.model || 'default';
    const totalChars = request.messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
    const estTokens = request.messages.reduce((acc, m) => acc + estimateTokenCount(m.content || ''), 0);
    const temp = request.temperature ?? this.profile.temperature ?? '默认';
    const format = request.responseFormat || 'text';

    console.log(
      `🤖 [AI 请求发起] ${this.name} (${model}) | 消息数: ${request.messages.length} | 预估输入: ~${estTokens} tokens (${totalChars} 字) | 温度: ${temp} | 格式: ${format}`
    );

    const lastUserMsg = request.messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '';
    if (lastUserMsg) {
      const preview = lastUserMsg.length > 300 ? lastUserMsg.slice(0, 300) + '...' : lastUserMsg;
      console.log(`📝 [Prompt 预览]:\n${preview}`);
    }

    try {
      const res = await this.delegate.chat(request);
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      const usageStr = res.usage
        ? `prompt: ${res.usage.promptTokens ?? '?'}, completion: ${res.usage.completionTokens ?? '?'}`
        : '未知';

      console.log(
        `✅ [AI 响应成功] ${this.name} (${model}) | 耗时: ${elapsed}s | 输出长度: ${res.text?.length || 0} 字 | Token消耗: [${usageStr}]`
      );

      if (res.text) {
        const preview = res.text.length > 300 ? res.text.slice(0, 300) + '...' : res.text;
        console.log(`💬 [AI 回复预览]:\n${preview}`);
      }

      return res;
    } catch (err: any) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      if (err?.name === 'AbortError' || err?.message?.includes('取消') || err?.message?.includes('中断')) {
        console.warn(`⏹️ [AI 请求中断/取消] ${this.name} (${model}) | 耗时: ${elapsed}s | 原因: ${err.message}`);
      } else {
        console.error(`❌ [AI 请求失败] ${this.name} (${model}) | 耗时: ${elapsed}s | 错误详情:`, err);
      }
      throw err;
    }
  }

  async chatStream(
    request: LLMRequest,
    onChunk: (chunkText: string, accumulated: string) => void
  ): Promise<string> {
    const startTime = performance.now();
    const model = this.profile.model || 'default';
    const totalChars = request.messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
    const estTokens = request.messages.reduce((acc, m) => acc + estimateTokenCount(m.content || ''), 0);

    console.log(
      `🌊 [AI 流式请求发起] ${this.name} (${model}) | 消息数: ${request.messages.length} | 预估输入: ~${estTokens} tokens (${totalChars} 字)`
    );

    let chunkCount = 0;
    let firstChunkTime: number | null = null;

    try {
      const fullText = await this.delegate.chatStream(request, (chunk, accumulated) => {
        chunkCount++;
        if (chunkCount === 1) {
          firstChunkTime = performance.now();
          const ttft = ((firstChunkTime - startTime) / 1000).toFixed(2);
          console.log(`⚡ [AI 首字响应 TTFT] ${this.name} (${model}) | 耗时: ${ttft}s`);
        }
        onChunk(chunk, accumulated);
      });

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(
        `✅ [AI 流式完成] ${this.name} (${model}) | 总耗时: ${elapsed}s | 分块数: ${chunkCount} | 总字数: ${fullText.length}`
      );
      return fullText;
    } catch (err: any) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      if (err?.name === 'AbortError' || err?.message?.includes('取消') || err?.message?.includes('中断')) {
        console.warn(`⏹️ [AI 流式中断/取消] ${this.name} (${model}) | 耗时: ${elapsed}s`);
      } else {
        console.error(`❌ [AI 流式失败] ${this.name} (${model}) | 耗时: ${elapsed}s | 错误详情:`, err);
      }
      throw err;
    }
  }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    console.log(`🔌 [AI 连接测试] 正在测试 ${this.name} (${this.profile.model || '默认模型'}) ...`);
    const startTime = performance.now();
    try {
      const res = await this.delegate.testConnection();
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      if (res.ok) {
        console.log(`✅ [AI 连接成功] ${this.name} | 耗时: ${elapsed}s | ${res.message}`);
      } else {
        console.error(`❌ [AI 连接失败] ${this.name} | 耗时: ${elapsed}s | ${res.message}`);
      }
      return res;
    } catch (err: any) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      console.error(`❌ [AI 连接异常] ${this.name} | 耗时: ${elapsed}s | 错误详情:`, err);
      return { ok: false, message: err?.message || '连接异常' };
    }
  }
}

