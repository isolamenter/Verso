export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'ollama'
  | 'deepseek'
  | 'openrouter'
  | 'custom';

export type TaskBindingType =
  | 'general'
  | 'cold_reader'
  | 'line_editor'
  | 'quick_critique'
  | 'ask'
  | 'local_privacy';

export type ApiKeyStorageMode = 'session' | 'encrypted_local';

export interface ModelProfile {
  id: string;
  name: string;
  providerType: ProviderType;
  model: string;
  baseURL?: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  contextPolicy?: string;
  timeoutMs?: number;
  isDefault?: boolean;
  taskBinding?: TaskBindingType;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json_object' | 'text';
  signal?: AbortSignal;
}

export interface LLMResponse {
  text: string;
  finishReason?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface LLMProvider {
  id: string;
  name: string;
  chat(request: LLMRequest): Promise<LLMResponse>;
  chatStream(
    request: LLMRequest,
    onChunk: (chunkText: string, accumulated: string) => void
  ): Promise<string>;
  testConnection(): Promise<{ ok: boolean; message?: string }>;
}

export interface AppSettings {
  activeProfileId: string;
  profiles: ModelProfile[];
  keyStorageMode: ApiKeyStorageMode;
  localOnlyMode: boolean;
  autoSaveIntervalMs: number;
  autoSnapshotIntervalMs: number;
  typewriterMode: boolean;
  focusMode: boolean;
  paperTheme: 'parchment' | 'frost' | 'ink';
  typography: 'serif' | 'kaiti' | 'sans' | 'mono';
  fontSize: number;
  lineHeight: number;
}
