import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  DEFAULT_PROFILES
} from '../db/initialData';
import { createLLMProvider } from '../providers/factory';
import { buildLiteraryContext, buildColdReaderIsolatedContext } from '../utils/contextBuilder';
import { buildCritiquePrompt } from '../prompts/critique';
import { buildColdReaderPrompt } from '../prompts/coldReader';
import { buildIntentComparePrompt } from '../prompts/intentCompare';
import { buildVersionComparePrompt } from '../prompts/versionCompare';
import {
  parseCritiqueResponse,
  parseColdReaderResponse,
  parseIntentResponse,
  parseVersionCompareResponse
} from '../prompts/parser';
import { extractPlainText } from '../utils/textProjection';
import type { ModelProfile, Manuscript, Scene } from '../types';

describe('BYOK Execution Plan & Security Architecture', () => {
  it('should initialize database with zero preset profiles so user configures their own key directly', () => {
    expect(DEFAULT_SETTINGS.activeProfileId).toBe('');
    expect(DEFAULT_SETTINGS.profiles).toEqual([]);
    expect(DEFAULT_PROFILES).toEqual([]);
  });

  it('should create valid LLMProvider instances when configured with user BYOK keys', () => {
    const deepseekProf: ModelProfile = {
      id: 'prof-user-deepseek',
      name: 'DeepSeek V3 / R1',
      providerType: 'deepseek',
      model: 'deepseek-chat',
      baseURL: 'https://api.deepseek.com/v1',
      temperature: 0.2,
      maxTokens: 3000,
    };
    const deepseekProvider = createLLMProvider(deepseekProf, false, 'sk-test-deepseek-key');
    expect(deepseekProvider.name).toBe(deepseekProf.name);

    const claudeProf: ModelProfile = {
      id: 'prof-user-claude',
      name: 'Claude 3.7 Sonnet',
      providerType: 'anthropic',
      model: 'claude-3-7-sonnet-20250219',
      temperature: 0.3,
      maxTokens: 4000,
    };
    const claudeProvider = createLLMProvider(claudeProf, false, 'sk-ant-api03-test-key');
    expect(claudeProvider.name).toBe(claudeProf.name);

    const geminiProf: ModelProfile = {
      id: 'prof-user-gemini',
      name: 'Gemini 2.0 Flash',
      providerType: 'gemini',
      model: 'gemini-2.0-flash',
      temperature: 0.3,
      maxTokens: 3000,
    };
    const geminiProvider = createLLMProvider(geminiProf, false, 'AIzaSyTestGeminiKey');
    expect(geminiProvider.name).toBe(geminiProf.name);

    const ollamaProf: ModelProfile = {
      id: 'prof-user-ollama',
      name: 'Ollama 本地隐私',
      providerType: 'ollama',
      model: 'qwen2.5:32b',
      baseURL: 'http://localhost:11434',
      temperature: 0.2,
      maxTokens: 2048,
    };
    const ollamaProvider = createLLMProvider(ollamaProf, true);
    expect(ollamaProvider.name).toBe(ollamaProf.name);
  });

  it('should enforce Local-Only mode security boundaries', () => {
    const deepseekProf: ModelProfile = {
      id: 'prof-deepseek',
      name: 'DeepSeek',
      providerType: 'deepseek',
      model: 'deepseek-chat',
      baseURL: 'https://api.deepseek.com/v1',
      temperature: 0.2,
      maxTokens: 3000,
    };
    expect(() => createLLMProvider(deepseekProf, true, 'sk-test')).toThrow(
      /纯本地隐私模式/
    );

    const maliciousOllama: ModelProfile = {
      id: 'prof-evil-ollama',
      name: 'External Ollama',
      providerType: 'ollama',
      model: 'qwen2.5',
      baseURL: 'https://external-leak-server.com/api',
      temperature: 0.2,
      maxTokens: 2000,
    };
    expect(() => createLLMProvider(maliciousOllama, true)).toThrow(
      /安全拦截：纯本地模式下仅允许连接本地回环端点/
    );
  });

  it('should construct and parse Prompt pipelines correctly for all literary lenses and tools', () => {
    const testManuscript: Manuscript = {
      id: 'test-manu-01',
      projectId: 'test-proj-01',
      title: '测试书稿',
      genre: 'short_story',
      synopsis: '测试梗概',
      motifs: [],
      characters: [],
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const testScenes: Scene[] = [
      {
        id: 'test-scene-01',
        manuscriptId: 'test-manu-01',
        title: '第一场：测试',
        order: 1,
        content: '雨停以后，修鞋铺没有开门。她感到一种无法言说的压抑，好像整个下午的沉闷都随着太阳一起从云后压了下来。',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
    ];

    const scene = testScenes[0];
    const selectedText = '她感到一种无法言说的压抑，好像整个下午的沉闷都随着太阳一起从云后压了下来。';

    // 1. Context and critique prompt
    const builtContext = buildLiteraryContext(
      {
        includeSelectedText: true,
        includeCurrentScene: true,
        includePreviousScene: false,
        includeCharacterNotes: false,
        includeMotifs: false,
        includeEntireManuscript: false,
      },
      testManuscript,
      testScenes,
      scene,
      selectedText
    );
    const critiquePrompt = buildCritiquePrompt('language', builtContext.formattedPromptString);
    expect(critiquePrompt).toContain(selectedText);


    // 2. Parser verification
    const sampleCritiqueJson = JSON.stringify({
      summary: '物象扎实，发现 1 处直陈概念。',
      annotations: [
        {
          quote: selectedText,
          category: 'language',
          severity: 'high',
          diagnosis: '直接命名压抑',
          suggestion: '以物理细节代之',
          replacement: {
            minimal: '太阳从云后钻出来。',
            moderate: '路面泛出白光。',
            radical: '（删去整句）'
          }
        }
      ]
    });
    const parsedCritique = parseCritiqueResponse(sampleCritiqueJson, 'language', scene.content);
    expect(parsedCritique.annotations.length).toBe(1);
    expect(parsedCritique.annotations[0].quote).toBe(selectedText);

    // 3. Cold Reader prompt & parser
    const isolatedContext = buildColdReaderIsolatedContext(scene);
    const coldPrompt = buildColdReaderPrompt(isolatedContext.formattedPromptString, scene.title);
    expect(coldPrompt).toContain('完全陌生的冷读者');

    const sampleColdJson = JSON.stringify({
      scope: '场景一',
      whatIRead: '暴雨初歇老街',
      whatHappened: '修鞋匠缺席',
      characterDynamics: '熟客与阿秀',
      sensedThemes: '停滞感',
      confusionAndAmbiguities: '老周去向',
      suspectedImplications: '黑水积聚',
      authorOnlyBlindspots: '男人身份'
    });
    const parsedCold = parseColdReaderResponse(sampleColdJson, scene.title);
    expect(parsedCold.whatIRead).toBe('暴雨初歇老街');

    // 4. Intent Compare prompt & parser
    const intentPrompt = buildIntentComparePrompt('表现底层停滞感', extractPlainText(scene.content));
    expect(intentPrompt).toContain('创作意图');

    const sampleIntentJson = JSON.stringify({
      authorIntent: '表现底层停滞感',
      overallVerdict: 'clearly_present',
      detailedAnalysis: '细节非常生动',
      evidenceItems: []
    });
    const parsedIntent = parseIntentResponse(sampleIntentJson, '表现底层停滞感');
    expect(parsedIntent.overallVerdict).toBe('clearly_present');

    // 5. Version Compare prompt & parser
    const versionPrompt = buildVersionComparePrompt('版本A', '文本A', '版本B', '文本B');
    expect(versionPrompt).toContain('版本A');

    const sampleVersionJson = JSON.stringify({
      versionAName: '版本A',
      versionBName: '版本B',
      versionAGains: '直观',
      versionALosses: '直白',
      versionBGains: '高级',
      versionBLosses: '门槛高',
      literaryTradeoffSummary: '建议采用B'
    });
    const parsedVersion = parseVersionCompareResponse(sampleVersionJson, '版本A', '版本B', '文本A', '文本B');
    expect(parsedVersion.literaryTradeoffSummary).toBe('建议采用B');
  });
});
