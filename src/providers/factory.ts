import type { LLMProvider, ModelProfile } from '../types';
import { isStrictLoopbackURL } from '../utils/secretStore';
import { OpenAICompatibleProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';

export function createLLMProvider(
  profile: ModelProfile,
  localOnly: boolean = false,
  resolvedApiKey?: string
): LLMProvider {
  const effectiveProfile: ModelProfile = {
    ...profile,
    apiKey: resolvedApiKey || profile.apiKey,
  };

  if (localOnly) {
    if (profile.providerType !== 'ollama') {
      throw new Error(
        '当前处于「纯本地隐私模式 (Local-only)」，已物理切断所有云端大模型连接。请切换至 Ollama 本地模型。'
      );
    }

    if (profile.providerType === 'ollama' && profile.baseURL && !isStrictLoopbackURL(profile.baseURL)) {
      throw new Error(
        `安全拦截：纯本地模式下仅允许连接本地回环端点 (localhost / 127.0.0.1)，检测到非法外部地址: ${profile.baseURL}`
      );
    }
  }

  switch (profile.providerType) {
    case 'anthropic':
      return new AnthropicProvider(effectiveProfile);
    case 'gemini':
      return new GeminiProvider(effectiveProfile);
    case 'ollama':
      return new OllamaProvider(effectiveProfile);
    case 'openai':
    case 'deepseek':
    case 'openrouter':
    case 'custom':
    default:
      return new OpenAICompatibleProvider(effectiveProfile);
  }
}
