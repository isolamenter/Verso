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
      max_tokens: request.maxTokens ?? this.profile.maxTokens ?? 3000,
      temperature: request.temperature ?? this.profile.temperature ?? 0.3,
      messages: userAndAssistantMessages,
    };

    if (systemMessage) {
      payload.system = systemMessage;
    }

    const timeout = this.profile.timeoutMs || 60000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const onAbort = () => controller.abort();
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
      max_tokens: request.maxTokens ?? this.profile.maxTokens ?? 3000,
      temperature: request.temperature ?? this.profile.temperature ?? 0.3,
      messages: userAndAssistantMessages,
      stream: true,
    };

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
