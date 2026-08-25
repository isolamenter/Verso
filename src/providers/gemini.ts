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
      generationConfig: {
        temperature: request.temperature ?? this.profile.temperature ?? 0.3,
        maxOutputTokens: request.maxTokens ?? this.profile.maxTokens ?? 3000,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (request.responseFormat === 'json_object') {
      body.generationConfig.responseMimeType = 'application/json';
    }

    const timeout = this.profile.timeoutMs || 60000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const onAbort = () => controller.abort();
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
      generationConfig: {
        temperature: request.temperature ?? this.profile.temperature ?? 0.3,
        maxOutputTokens: request.maxTokens ?? this.profile.maxTokens ?? 3000,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (request.responseFormat === 'json_object') {
      body.generationConfig.responseMimeType = 'application/json';
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
