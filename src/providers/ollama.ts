import type { LLMProvider, LLMRequest, LLMResponse, ModelProfile } from '../types';

export class OllamaProvider implements LLMProvider {
  id: string;
  name: string;
  private profile: ModelProfile;

  constructor(profile: ModelProfile) {
    this.id = profile.id;
    this.name = profile.name;
    this.profile = profile;
  }

  private getBaseURL(): string {
    return this.profile.baseURL?.trim().replace(/\/+$/, '') || 'http://localhost:11434';
  }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    try {
      const baseURL = this.getBaseURL();
      const res = await fetch(`${baseURL}/api/tags`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const modelCount = data.models?.length || 0;
      return { ok: true, message: `Ollama 本地服务正常，检测到 ${modelCount} 个本地模型。` };
    } catch (err: any) {
      return {
        ok: false,
        message: `Ollama 连接失败: 请确认本地已启动 ollama serve 且允许跨域访问。(${err?.message})`,
      };
    }
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const baseURL = this.getBaseURL();
    const payload: any = {
      model: this.profile.model || 'qwen2.5:32b',
      messages: request.messages,
      stream: false,
    };

    const options: any = {};
    if (request.temperature !== undefined || this.profile.temperature !== undefined) {
      options.temperature = request.temperature ?? this.profile.temperature;
    }
    if (request.maxTokens !== undefined || this.profile.maxTokens !== undefined) {
      options.num_predict = request.maxTokens ?? this.profile.maxTokens;
    }

    if (Object.keys(options).length > 0) {
      payload.options = options;
    }

    if (request.responseFormat === 'json_object') {
      payload.format = 'json';
    }

    const timeout = this.profile.timeoutMs || 300000;
    const controller = new AbortController();
    let isTimedOut = false;
    const timer = setTimeout(() => {
      isTimedOut = true;
      try {
        controller.abort(new Error(`Ollama 请求超时 (${Math.round(timeout / 1000)} 秒)`));
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
      const response = await fetch(`${baseURL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama 错误 [HTTP ${response.status}]: ${errText}`);
      }

      const data = await response.json();
      return {
        text: data.message?.content || '',
        usage: {
          promptTokens: data.prompt_eval_count,
          completionTokens: data.eval_count,
        },
      };
    } catch (err: any) {
      if (isTimedOut) {
        throw new Error(`Ollama 本地模型请求超时 (${Math.round(timeout / 1000)} 秒)，本地推理大文本较耗时，请稍后重试或在设置中延长超时时间。`);
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
    const payload: any = {
      model: this.profile.model || 'qwen2.5:32b',
      messages: request.messages,
      stream: true,
    };

    const options: any = {};
    if (request.temperature !== undefined || this.profile.temperature !== undefined) {
      options.temperature = request.temperature ?? this.profile.temperature;
    }
    if (request.maxTokens !== undefined || this.profile.maxTokens !== undefined) {
      options.num_predict = request.maxTokens ?? this.profile.maxTokens;
    }

    if (Object.keys(options).length > 0) {
      payload.options = options;
    }

    if (request.responseFormat === 'json_object') {
      payload.format = 'json';
    }

    const response = await fetch(`${baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: request.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama 流式错误 [HTTP ${response.status}]: ${errText}`);
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
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          const chunk = parsed.message?.content || '';
          if (chunk) {
            accumulated += chunk;
            onChunk(chunk, accumulated);
          }
        } catch {}
      }
    }

    return accumulated;
  }
}
