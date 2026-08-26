import type { LLMProvider, ModelProfile } from '../types';
import { OpenAICompatibleProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';
import { LoggingLLMProvider } from './loggingWrapper';

export function createLLMProvider(
  profile: ModelProfile,
  resolvedApiKey?: string
): LLMProvider {
  const effectiveProfile: ModelProfile = {
    ...profile,
    apiKey: resolvedApiKey || profile.apiKey,
  };

  let rawProvider: LLMProvider;
  switch (profile.providerType) {
    case 'anthropic':
      rawProvider = new AnthropicProvider(effectiveProfile);
      break;
    case 'gemini':
      rawProvider = new GeminiProvider(effectiveProfile);
      break;
    case 'ollama':
      rawProvider = new OllamaProvider(effectiveProfile);
      break;
    case 'openai':
    case 'deepseek':
    case 'openrouter':
    case 'custom':
    default:
      rawProvider = new OpenAICompatibleProvider(effectiveProfile);
      break;
  }

  return new LoggingLLMProvider(rawProvider, effectiveProfile);
}

