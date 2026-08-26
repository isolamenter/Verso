import type { LLMProvider, LLMRequest, LLMResponse, ModelProfile } from '../types';

export class GeminiProvider implements LLMProvider {
  id: string;
  name: string;
  private profile: ModelProfile;

  constructor(profile: ModelProfile) {
    this.id = profile.id;
    this.name = profile.name;
    this.profile = profile;
  }

  private getModelName(): string {
    return this.profile.model || 'gemini-2.0-flash';
  }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.chat({
        messages: [{ role: 'user', content: 'Ping' }],
        maxTokens: 5,
      });
      return { ok: true, message: `Gemini API 连接成功 (${this.getModelName()})` };
    } catch (err: any) {
      console.error('[Gemini testConnection error]:', err);
      return { ok: false, message: err?.message || 'Gemini 连接失败' };
    }
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = this.profile.apiKey;
    const model = this.getModelName();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemInstruction = request.messages.find(m => m.role === 'system')?.content;
    const contents = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: any = {
      contents,
    };

    const generationConfig: any = {};
    if (request.temperature !== undefined || this.profile.temperature !== undefined) {
      generationConfig.temperature = request.temperature ?? this.profile.temperature;
    }
    if (request.maxTokens !== undefined || this.profile.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = request.maxTokens ?? this.profile.maxTokens;
    }
    if (request.responseFormat === 'json_object') {
      generationConfig.responseMimeType = 'application/json';
    }

    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    const timeout = this.profile.timeoutMs || 300000;
    const controller = new AbortController();
    let isTimedOut = false;
    const timer = setTimeout(() => {
      isTimedOut = true;
      try {
        controller.abort(new Error(`Gemini API 请求超时 (${Math.round(timeout / 1000)} 秒)`));
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
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API 错误 [HTTP ${response.status}]: ${errText}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text || '';

      return {
        text,
        finishReason: candidate?.finishReason,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount,
          completionTokens: data.usageMetadata?.candidatesTokenCount,
        },
      };
    } catch (err: any) {
      if (isTimedOut) {
        throw new Error(`Gemini 请求超时 (${Math.round(timeout / 1000)} 秒)，当前文稿篇幅较大或模型响应缓慢，请稍后重试或在设置中延长超时时间。`);
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
    const apiKey = this.profile.apiKey;
    const model = this.getModelName();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const systemInstruction = request.messages.find(m => m.role === 'system')?.content;
    const contents = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: any = {
      contents,
    };

    const generationConfig: any = {};
    if (request.temperature !== undefined || this.profile.temperature !== undefined) {
      generationConfig.temperature = request.temperature ?? this.profile.temperature;
    }
    if (request.maxTokens !== undefined || this.profile.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = request.maxTokens ?? this.profile.maxTokens;
    }
    if (request.responseFormat === 'json_object') {
      generationConfig.responseMimeType = 'application/json';
    }

    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini 流式错误 [HTTP ${response.status}]: ${errText}`);
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
            const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (chunk) {
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
