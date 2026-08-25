import type { LLMProvider, LLMRequest, LLMResponse, ModelProfile } from '../types';

export class AnthropicProvider implements LLMProvider {
  id: string;
  name: string;
  private profile: ModelProfile;

  constructor(profile: ModelProfile) {
    this.id = profile.id;
    this.name = profile.name;
    this.profile = profile;
  }

  private getBaseURL(): string {
    return this.profile.baseURL?.trim().replace(/\/+$/, '') || 'https://api.anthropic.com/v1';
  }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.chat({
        messages: [{ role: 'user', content: 'Ping' }],
        maxTokens: 5,
      });
      return { ok: true, message: `Claude API 连接成功 (${this.profile.model})` };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Claude 连接失败' };
    }
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const baseURL = this.getBaseURL();
    const systemMessage = request.messages.find(m => m.role === 'system')?.content || '';
    const userAndAssistantMessages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    const payload: any = {
      model: this.profile.model || 'claude-3-7-sonnet-20250219',
      max_tokens: request.maxTokens ?? this.profile.maxTokens ?? 8192,
      messages: userAndAssistantMessages,
    };

    if (request.temperature !== undefined || this.profile.temperature !== undefined) {
      payload.temperature = request.temperature ?? this.profile.temperature;
    }

    if (systemMessage) {
      payload.system = systemMessage;
    }

    const timeout = this.profile.timeoutMs || 300000;
    const controller = new AbortController();
    let isTimedOut = false;
    const timer = setTimeout(() => {
      isTimedOut = true;
      try {
        controller.abort(new Error(`Claude API 请求超时 (${Math.round(timeout / 1000)} 秒)`));
      } catch {
        controller.abort();
      }
    }, timeout);

    const onAbort = () => {
      try {
        controller.abort(request.signal?.reason || new Error('请求已取消'));
      } catch {
        controller.abort();
      }
    };
    if (request.signal) {
      request.signal.addEventListener('abort', onAbort);
    }

    try {
      const response = await fetch(`${baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.profile.apiKey || '',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Claude API 错误 [HTTP ${response.status}]: ${errText}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      return {
        text,
        usage: {
          promptTokens: data.usage?.input_tokens,
          completionTokens: data.usage?.output_tokens,
        },
      };
    } catch (err: any) {
      if (isTimedOut) {
        throw new Error(`Claude 请求超时 (${Math.round(timeout / 1000)} 秒)，当前文稿篇幅较大或模型响应缓慢，请稍后重试或在设置中延长超时时间。`);
      }
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
        const customReason = request.signal?.reason?.message || (typeof request.signal?.reason === 'string' ? request.signal?.reason : null);
        throw new Error(customReason || '请求已被取消或超时中断');
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (request.signal) {
        request.signal.removeEventListener('abort', onAbort);
      }
    }
  }

  async chatStream(
    request: LLMRequest,
    onChunk: (chunkText: string, accumulated: string) => void
  ): Promise<string> {
    const baseURL = this.getBaseURL();
    const systemMessage = request.messages.find(m => m.role === 'system')?.content || '';
    const userAndAssistantMessages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    const payload: any = {
      model: this.profile.model || 'claude-3-7-sonnet-20250219',
      max_tokens: request.maxTokens ?? this.profile.maxTokens ?? 8192,
      messages: userAndAssistantMessages,
      stream: true,
    };

    if (request.temperature !== undefined || this.profile.temperature !== undefined) {
      payload.temperature = request.temperature ?? this.profile.temperature;
    }

    if (systemMessage) {
      payload.system = systemMessage;
    }

    const response = await fetch(`${baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.profile.apiKey || '',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(payload),
      signal: request.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude 流式错误 [HTTP ${response.status}]: ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法读取响应流');

    const decoder = new TextDecoder('utf-8');
    let accumulated = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              const chunk = parsed.delta.text || '';
              accumulated += chunk;
              onChunk(chunk, accumulated);
            }
          } catch {}
        }
      }
    }

    return accumulated;
  }
}
