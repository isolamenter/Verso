import type { LLMProvider, LLMRequest, LLMResponse, ModelProfile } from '../types';

export class OpenAICompatibleProvider implements LLMProvider {
  id: string;
  name: string;
  private profile: ModelProfile;

  constructor(profile: ModelProfile) {
    this.id = profile.id;
    this.name = profile.name;
    this.profile = profile;
  }

  private getBaseURL(): string {
    if (this.profile.baseURL && this.profile.baseURL.trim()) {
      return this.profile.baseURL.trim().replace(/\/+$/, '');
    }
    if (this.profile.providerType === 'deepseek') {
      return 'https://api.deepseek.com/v1';
    }
    if (this.profile.providerType === 'openrouter') {
      return 'https://openrouter.ai/api/v1';
    }
    return 'https://api.openai.com/v1';
  }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await this.chat({
        messages: [{ role: 'user', content: 'Ping: return OK' }],
        maxTokens: 10,
      });
      return {
        ok: true,
        message: `连接成功 (模型: ${this.profile.model}, 回复: ${res.text.slice(0, 15)})`,
      };
    } catch (err: any) {
      return { ok: false, message: err?.message || '连接失败，请检查 API Key 或 Base URL' };
    }
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const baseURL = this.getBaseURL();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.profile.apiKey || ''}`,
    };

    if (this.profile.providerType === 'openrouter') {
      headers['HTTP-Referer'] = 'https://verso.app';
      headers['X-Title'] = 'Verso Literary Editor';
    }

    const payload: any = {
      model: this.profile.model,
      messages: request.messages,
      temperature: request.temperature ?? this.profile.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? this.profile.maxTokens ?? 3000,
    };

    if (request.responseFormat === 'json_object') {
      payload.response_format = { type: 'json_object' };
    }

    const timeout = this.profile.timeoutMs || 60000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const onAbort = () => controller.abort();
    if (request.signal) {
      request.signal.addEventListener('abort', onAbort);
    }

    try {
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API 请求失败 [HTTP ${response.status}]: ${errText}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const text = choice?.message?.content || '';

      return {
        text,
        finishReason: choice?.finish_reason,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.profile.apiKey || ''}`,
    };

    if (this.profile.providerType === 'openrouter') {
      headers['HTTP-Referer'] = 'https://verso.app';
      headers['X-Title'] = 'Verso Literary Editor';
    }

    const payload: any = {
      model: this.profile.model,
      messages: request.messages,
      temperature: request.temperature ?? this.profile.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? this.profile.maxTokens ?? 3000,
      stream: true,
    };

    if (request.responseFormat === 'json_object') {
      payload.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: request.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API 流式请求失败 [HTTP ${response.status}]: ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

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
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              accumulated += delta;
              onChunk(delta, accumulated);
            }
          } catch {
            // Ignore parse errors on SSE chunks
          }
        }
      }
    }

    return accumulated;
  }
}
