import type { LLMProvider, ModelProfile } from '../types';
import { OpenAICompatibleProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';

export function createLLMProvider(
  profile: ModelProfile,
  resolvedApiKey?: string
): LLMProvider {
  const effectiveProfile: ModelProfile = {
    ...profile,
    apiKey: resolvedApiKey || profile.apiKey,
  };

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

