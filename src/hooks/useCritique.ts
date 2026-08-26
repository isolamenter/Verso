import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type {
  LiteraryAnnotation,
  CritiqueCategory,
  ColdReaderReport,
  IntentEvaluation,
  VersionCompareReport,
  ProfilingModule,
  ProfilingRunParams,
  ProfilingModuleResultMap,
  LiteraryLens,
  PromptTemplate,
  ContextSelectionConfig,
  AppSettings,
  Manuscript,
  Scene,
  TaskBindingType,
  ModelProfile,
  LLMProvider,
  ContextPolicy,
  SceneDraftParams,
  SceneDraftResult
} from '../types';
import { db } from '../db';
import { BUILTIN_LENSES, BUILTIN_PROMPT_TEMPLATES } from '../db/initialData';
import { createLLMProvider } from '../providers/factory';
import { getSecretApiKey } from '../utils/secretStore';
import {
  buildLiteraryContext,
  buildColdReaderIsolatedContext,
  resolveEffectiveContextConfig,
} from '../utils/contextBuilder';
import { extractPlainText, findBestAnchorMatch } from '../utils/textProjection';
import { LITERARY_EDITOR_SYSTEM_PROMPT } from '../prompts/system';
import { buildCritiquePrompt } from '../prompts/critique';
import { buildColdReaderPrompt } from '../prompts/coldReader';
import { buildIntentComparePrompt } from '../prompts/intentCompare';
import { buildVersionComparePrompt } from '../prompts/versionCompare';
import { buildSceneDraftPrompt } from '../prompts/draft';
import {
  buildSynopsisPrompt,
  buildThemePrompt,
  buildCharactersPrompt,
  buildMotifsPrompt,
  buildSceneSplitsPrompt,
} from '../prompts/profiler';
import type { ProfilingPromptContext } from '../prompts/profiler';
import {
  parseCritiqueResponse,
  parseColdReaderResponse,
  parseIntentResponse,
  parseVersionCompareResponse,
  parseSynopsisResponse,
  parseThemeResponse,
  parseCharactersResponse,
  parseMotifsResponse,
  parseSceneSplitsResponse,
  parseSceneDraftResponse,
} from '../prompts/parser';

export interface TaskExecutionPlan {
  provider: LLMProvider;
  profile: ModelProfile;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  contextPolicy?: ContextPolicy;
}

// 建档五模块：prompt builder 与 parser 查表
const PROFILING_MODULE_CONFIG: Record<
  ProfilingModule,
  {
    buildPrompt: (ctx: ProfilingPromptContext) => string;
    parse: (
      raw: string,
      fallbackTitle: string,
      sourceText?: string
    ) => ProfilingModuleResultMap[ProfilingModule];
  }
> = {
  synopsis: {
    buildPrompt: buildSynopsisPrompt,
    parse: (raw, title) => ({ text: parseSynopsisResponse(raw, title) }),
  },
  theme: {
    buildPrompt: buildThemePrompt,
    parse: (raw) => ({ text: parseThemeResponse(raw) }),
  },
  characters: {
    buildPrompt: buildCharactersPrompt,
    parse: (raw) => ({ items: parseCharactersResponse(raw) }),
  },
  motifs: {
    buildPrompt: buildMotifsPrompt,
    parse: (raw) => ({ items: parseMotifsResponse(raw) }),
  },
  scene_splits: {
    buildPrompt: buildSceneSplitsPrompt,
    parse: (raw, _title, sourceText) => ({ splits: parseSceneSplitsResponse(raw, sourceText) }),
  },
};

async function checkProfileUsability(
  profile: ModelProfile
): Promise<{ isUsable: boolean; resolvedApiKey?: string }> {
  if (profile.providerType === 'ollama') {
    return { isUsable: Boolean(profile.baseURL && profile.baseURL.trim()) };
  }

  // Cloud providers: require non-empty API key
  let key = profile.apiKey;
  if (!key) {
    key = await getSecretApiKey(profile.id);
  }
  if (key && key.trim()) {
    return { isUsable: true, resolvedApiKey: key.trim() };
  }

  return { isUsable: false };
}

export function useCritique(
  settings: AppSettings,
  manuscript: Manuscript | null,
  scenes: Scene[],
  currentScene: Scene | null
) {
  // Lenses state
  const [lenses, setLenses] = useState<LiteraryLens[]>(BUILTIN_LENSES);
  const [activeLensId, setActiveLensId] = useState<string | null>(null);

  // Prompt Templates state
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>(BUILTIN_PROMPT_TEMPLATES);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  // Context Selection Config
  const [contextConfig, setContextConfig] = useState<ContextSelectionConfig>({
    includeSelectedText: true,
    includeCurrentScene: true,
    includePreviousScene: false,
    includeCharacterNotes: false,
    includeMotifs: false,
    includeEntireManuscript: false,
  });

  // Critique View State
  const [critiqueSummary, setCritiqueSummary] = useState<string>('');
  const [annotations, setAnnotations] = useState<LiteraryAnnotation[]>([]);
  const [isCritiqueLoading, setIsCritiqueLoading] = useState(false);

  // Cold Reader State
  const [coldReaderReport, setColdReaderReport] = useState<ColdReaderReport | null>(null);
  const [isColdReaderLoading, setIsColdReaderLoading] = useState(false);

  // Intent State
  const [intentEvaluation, setIntentEvaluation] = useState<IntentEvaluation | null>(null);
  const [isIntentLoading, setIsIntentLoading] = useState(false);

  // Compare State
  const [compareReport, setCompareReport] = useState<VersionCompareReport | null>(null);
  const [isCompareLoading, setIsCompareLoading] = useState(false);

  // Ask Chat State
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isAskLoading, setIsAskLoading] = useState(false);

  // Scene Drafting State (场景起草与生成)
  const [draftResult, setDraftResult] = useState<SceneDraftResult | null>(null);
  const [draftStreamingText, setDraftStreamingText] = useState<string>('');
  const [isDraftLoading, setIsDraftLoading] = useState(false);

  // Profiling State（建档五模块，每模块独立 loading + abort）
  const [profilingLoading, setProfilingLoading] = useState<Record<ProfilingModule, boolean>>({
    synopsis: false,
    theme: false,
    characters: false,
    motifs: false,
    scene_splits: false,
  });
  const profilingAbortRefs = useRef<Partial<Record<ProfilingModule, AbortController>>>({});

  // Abort Controllers for race condition & cancellation protection
  const critiqueAbortRef = useRef<AbortController | null>(null);
  const coldReaderAbortRef = useRef<AbortController | null>(null);
  const intentAbortRef = useRef<AbortController | null>(null);
  const compareAbortRef = useRef<AbortController | null>(null);
  const askAbortRef = useRef<AbortController | null>(null);
  const draftAbortRef = useRef<AbortController | null>(null);

  // Load Lenses & Templates from DB
  useEffect(() => {
    async function loadData() {
      const storedLenses = await db.lenses.toArray();
      if (storedLenses.length > 0) setLenses(storedLenses);

      const storedTemplates = await db.promptTemplates.toArray();
      if (storedTemplates.length > 0) setPromptTemplates(storedTemplates);
    }
    loadData();
  }, []);

  // Load scene-specific annotations from DB on scene change
  useEffect(() => {
    let isMounted = true;
    async function loadSceneAnnotations() {
      if (!currentScene?.id) return;
      const stored = await db.annotations
        .where('sceneId')
        .equals(currentScene.id)
        .reverse()
        .sortBy('createdAt');
      if (isMounted) {
        setAnnotations(stored);
      }
    }
    loadSceneAnnotations();
    return () => {
      isMounted = false;
      // Abort any ongoing critique request when scene switches
      if (critiqueAbortRef.current) critiqueAbortRef.current.abort();
    };
  }, [currentScene?.id]);

  // Derive re-anchored and stale-aware annotations based on current scene content using unified anchor matcher
  const sceneContent = currentScene?.content || '';
  const activeAnnotations = useMemo(() => {
    if (!sceneContent) return annotations;
    const plain = extractPlainText(sceneContent);
    return annotations.map((ann) => {
      if (!ann.quote) return ann;
      const match = findBestAnchorMatch({
        plainText: plain,
        quote: ann.quote,
        previousRange: ann.range,
      });

      if (!match.found) {
        return ann.isStale ? ann : { ...ann, isStale: true };
      }

      const newFrom = match.range.from;
      const newTo = match.range.to;
      if (ann.isStale || !ann.range || ann.range.from !== newFrom || ann.range.to !== newTo) {
        return { ...ann, isStale: false, range: { from: newFrom, to: newTo } };
      }
      return ann;
    });
  }, [annotations, sceneContent]);

  const saveLenses = useCallback(async (newLenses: LiteraryLens[]) => {
    setLenses(newLenses);
    await db.lenses.clear();
    for (const lens of newLenses) {
      await db.lenses.put(lens);
    }
  }, []);

  const savePromptTemplates = useCallback(async (newTemplates: PromptTemplate[]) => {
    setPromptTemplates(newTemplates);
    await db.promptTemplates.clear();
    for (const tmpl of newTemplates) {
      await db.promptTemplates.put(tmpl);
    }
  }, []);

  // Helper to resolve task-specific execution plan & fallback to active / configured profile
  const getExecutionPlanForTask = useCallback(
    async (task: TaskBindingType = 'general'): Promise<TaskExecutionPlan> => {
      let chosenProfile: ModelProfile | undefined;
      let resolvedKey: string | undefined;

      // 1. Check if there is a task-bound profile that is configured and usable
      const boundProfile = settings.profiles.find((p) => p.taskBinding === task);
      if (boundProfile) {
        const { isUsable, resolvedApiKey } = await checkProfileUsability(boundProfile);
        if (isUsable) {
          chosenProfile = boundProfile;
          resolvedKey = resolvedApiKey;
        }
      }

      // 2. Fallback to activeProfileId if usable
      if (!chosenProfile) {
        const activeProfile = settings.profiles.find((p) => p.id === settings.activeProfileId);
        if (activeProfile) {
          const { isUsable, resolvedApiKey } = await checkProfileUsability(activeProfile);
          if (isUsable) {
            chosenProfile = activeProfile;
            resolvedKey = resolvedApiKey;
          }
        }
      }

      // 3. Fallback to any usable profile in settings (configured provider)
      if (!chosenProfile) {
        for (const p of settings.profiles) {
          const { isUsable, resolvedApiKey } = await checkProfileUsability(p);
          if (isUsable) {
            chosenProfile = p;
            resolvedKey = resolvedApiKey;
            break;
          }
        }
      }

      // If no usable profile found, throw explicit error prompting user to configure API key
      if (!chosenProfile) {
        throw new Error('未配置可用的 AI 模型 Profile 或 API Key。请点击右上角「设置」配置您的 API Key 或本地模型。');
      }

      const provider = createLLMProvider(chosenProfile, resolvedKey);
      const systemPrompt = chosenProfile.systemPrompt || LITERARY_EDITOR_SYSTEM_PROMPT;

      return {
        provider,
        profile: chosenProfile,
        systemPrompt,
        temperature: chosenProfile.temperature,
        maxTokens: chosenProfile.maxTokens,
        contextPolicy: chosenProfile.contextPolicy,
      };
    },
    [settings]
  );

  // Execute Selection-first Critique
  const runSelectionCritique = useCallback(
    async (category: CritiqueCategory, selectedText: string, range?: { from: number; to: number }) => {
      if (!currentScene) return;
      if (critiqueAbortRef.current) critiqueAbortRef.current.abort();
      critiqueAbortRef.current = new AbortController();

      setIsCritiqueLoading(true);
      try {
        const taskBinding: TaskBindingType = category === 'cut' ? 'line_editor' : 'quick_critique';
        const plan = await getExecutionPlanForTask(taskBinding);
        const activeLens = lenses.find((l) => l.id === activeLensId);
        const activeTemplate = promptTemplates.find((t) => t.id === activeTemplateId);

        // Resolve effective context configuration based on execution plan policy
        const effectiveContextConfig = resolveEffectiveContextConfig(contextConfig, plan.contextPolicy);

        // Build unified multi-source context
        const builtContext = buildLiteraryContext(
          effectiveContextConfig,
          manuscript,
          scenes,
          currentScene,
          selectedText
        );

        let customInstruction = activeLens?.promptInstruction;
        if (activeTemplate) {
          customInstruction = `${customInstruction ? customInstruction + '\n' : ''}【模板审读要求】: ${activeTemplate.promptTemplate}`;
        }

        const prompt = buildCritiquePrompt(
          category,
          builtContext.formattedPromptString,
          customInstruction
        );

        console.log(
          `📖 [Verso 审读] 启动审读任务 | 类别: ${category} | 视角: ${activeLens?.name || '默认'} | 选中文本: ${selectedText.length} 字`
        );

        const res = await plan.provider.chat({
          messages: [
            { role: 'system', content: plan.systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: plan.temperature,
          maxTokens: plan.maxTokens,
          responseFormat: 'json_object',
          signal: critiqueAbortRef.current.signal,
        });

        const parsed = parseCritiqueResponse(res.text, category, currentScene.content, range);

        // Attach sceneId to annotations (preserving each annotation's own calculated range)
        const enrichedAnnotations: LiteraryAnnotation[] = parsed.annotations.map((ann) => ({
          ...ann,
          sceneId: currentScene.id,
        }));

        setCritiqueSummary(parsed.summary);
        setAnnotations(enrichedAnnotations);

        // Persist to IndexedDB
        for (const ann of enrichedAnnotations) {
          await db.annotations.put(ann);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('[Verso AI: 审读调用失败]', err);
        setCritiqueSummary(`审读调用失败: ${err?.message || '未知错误'}`);
      } finally {
        setIsCritiqueLoading(false);
      }
    },
    [
      getExecutionPlanForTask,
      lenses,
      activeLensId,
      promptTemplates,
      activeTemplateId,
      contextConfig,
      manuscript,
      scenes,
      currentScene,
    ]
  );

  // Execute Cold Reader (Strict Isolation)
  const runColdRead = useCallback(async () => {
    if (!currentScene) return;
    if (coldReaderAbortRef.current) coldReaderAbortRef.current.abort();
    coldReaderAbortRef.current = new AbortController();

    setIsColdReaderLoading(true);
    try {
      const plan = await getExecutionPlanForTask('cold_reader');

      // Strict Zero-Context Isolation: Only pure scene text without any notes or lenses
      const isolatedContext = buildColdReaderIsolatedContext(currentScene);
      const prompt = buildColdReaderPrompt(isolatedContext.formattedPromptString, currentScene.title);

      const coldReaderSystem =
        plan.profile.systemPrompt ||
        '你是一名敏锐、冷峻、没有任何先入为主假定的文学冷读者。请完全基于文本实际呈现的信息进行事实感知与结构解码。你不知道作者的任何设定与意图。';

      console.log(`❄️ [Verso 冷读] 启动冷读者孤立感知分析 | 场景: ${currentScene.title}`);

      const res = await plan.provider.chat({
        messages: [
          {
            role: 'system',
            content: coldReaderSystem,
          },
          { role: 'user', content: prompt },
        ],
        temperature: plan.temperature,
        maxTokens: plan.maxTokens,
        responseFormat: 'json_object',
        signal: coldReaderAbortRef.current.signal,
      });

      const parsed = parseColdReaderResponse(res.text, currentScene.title);
      setColdReaderReport(parsed);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('[Verso AI: 冷读分析失败]', err);
      alert(`冷读分析失败: ${err?.message || '未知错误'}`);
    } finally {
      setIsColdReaderLoading(false);
    }
  }, [getExecutionPlanForTask, currentScene]);

  // Execute Intent Evaluation
  const runIntentEvaluation = useCallback(
    async (authorIntent: string) => {
      if (!currentScene) return;
      if (intentAbortRef.current) intentAbortRef.current.abort();
      intentAbortRef.current = new AbortController();

      setIsIntentLoading(true);
      try {
        const plan = await getExecutionPlanForTask('general');
        const prompt = buildIntentComparePrompt(authorIntent, extractPlainText(currentScene.content));

        console.log(`🎯 [Verso 意图] 启动作者意图达成度评估 | 意图: "${authorIntent.slice(0, 40)}..."`);

        const res = await plan.provider.chat({
          messages: [
            { role: 'system', content: plan.systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: plan.temperature,
          maxTokens: plan.maxTokens,
          responseFormat: 'json_object',
          signal: intentAbortRef.current.signal,
        });

        const parsed = parseIntentResponse(res.text, authorIntent);
        setIntentEvaluation(parsed);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('[Verso AI: 意图比对失败]', err);
        alert(`意图比对失败: ${err?.message || '未知错误'}`);
      } finally {
        setIsIntentLoading(false);
      }
    },
    [getExecutionPlanForTask, currentScene]
  );

  // Execute Version Compare
  const runVersionCompare = useCallback(
    async (nameA: string, textA: string, nameB: string, textB: string) => {
      if (compareAbortRef.current) compareAbortRef.current.abort();
      compareAbortRef.current = new AbortController();

      setIsCompareLoading(true);
      try {
        const plan = await getExecutionPlanForTask('general');
        const prompt = buildVersionComparePrompt(nameA, textA, nameB, textB);

        console.log(`⚖️ [Verso 比对] 启动双版本差异审校 | [${nameA}] vs [${nameB}]`);

        const res = await plan.provider.chat({
          messages: [
            { role: 'system', content: plan.systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: plan.temperature,
          maxTokens: plan.maxTokens,
          responseFormat: 'json_object',
          signal: compareAbortRef.current.signal,
        });

        const parsed = parseVersionCompareResponse(res.text, nameA, nameB, textA, textB);
        setCompareReport(parsed);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('[Verso AI: 版本对比失败]', err);
        alert(`版本对比失败: ${err?.message || '未知错误'}`);
      } finally {
        setIsCompareLoading(false);
      }
    },
    [getExecutionPlanForTask]
  );

  // Execute Free-form Ask with unified ContextBuilder
  const askQuestion = useCallback(
    async (question: string, activeSelectedText?: string) => {
      if (askAbortRef.current) askAbortRef.current.abort();
      askAbortRef.current = new AbortController();

      setIsAskLoading(true);
      const newHistory = [...chatHistory, { role: 'user' as const, content: question }];
      setChatHistory(newHistory);

      try {
        const plan = await getExecutionPlanForTask('ask');

        // Resolve effective context configuration based on execution plan policy
        const effectiveContextConfig = resolveEffectiveContextConfig(contextConfig, plan.contextPolicy);

        // Build context if user enabled context options
        const builtContext = buildLiteraryContext(
          effectiveContextConfig,
          manuscript,
          scenes,
          currentScene,
          activeSelectedText
        );

        let userPromptWithContext = question;
        if (builtContext.formattedPromptString.trim()) {
          userPromptWithContext = `${builtContext.formattedPromptString}\n\n【创作者发问】\n${question}`;
        }

        console.log(`💬 [Verso 问答] 发起文学发问: "${question.slice(0, 50)}..."`);

        const messages = [
          { role: 'system' as const, content: plan.systemPrompt },
          ...chatHistory,
          { role: 'user' as const, content: userPromptWithContext },
        ];

        const res = await plan.provider.chat({
          messages,
          temperature: plan.temperature,
          maxTokens: plan.maxTokens,
          signal: askAbortRef.current.signal,
        });

        setChatHistory([...newHistory, { role: 'assistant', content: res.text }]);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('[Verso AI: 问答调用失败]', err);
        setChatHistory([
          ...newHistory,
          { role: 'assistant', content: `对话失败: ${err?.message || '模型未返回有效响应'}` },
        ]);
      } finally {
        setIsAskLoading(false);
      }
    },
    [chatHistory, getExecutionPlanForTask, contextConfig, manuscript, scenes, currentScene]
  );

  // Annotation Status Management
  const updateAnnotationStatus = useCallback(
    async (id: string, status: 'accepted' | 'rejected', replacementType?: any) => {
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status, appliedReplacementType: replacementType } : a
        )
      );
      await db.annotations.update(id, {
        status,
        appliedReplacementType: replacementType,
      });
    },
    []
  );

  // Full text of the manuscript across all scenes in sequential order for whole-book profiling
  const fullManuscriptContent = useMemo(() => {
    if (!scenes || scenes.length === 0) return '';
    return scenes
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => s.content)
      .filter(Boolean)
      .join('\n\n');
  }, [scenes]);

  // Run a single profiling module (generate from manuscript / refine current value)
  const runProfilingModule = useCallback(
    async <M extends ProfilingModule>(
      module: M,
      params: ProfilingRunParams
    ): Promise<ProfilingModuleResultMap[M]> => {
      if (!manuscript) throw new Error('当前没有打开的书稿，无法执行 AI 建档。');
      if (params.mode === 'refine' && !params.currentValue) {
        throw new Error('当前没有可精修的内容。');
      }

      profilingAbortRefs.current[module]?.abort();
      const abortController = new AbortController();
      profilingAbortRefs.current[module] = abortController;
      setProfilingLoading((prev) => ({ ...prev, [module]: true }));

      try {
        const plan = await getExecutionPlanForTask('general');
        const cfg = PROFILING_MODULE_CONFIG[module];
        const userPrompt = cfg.buildPrompt({
          title: manuscript.title,
          content: fullManuscriptContent,
          mode: params.mode,
          currentValue: params.currentValue,
          userNotes: params.userNotes,
        });

        console.log(`📚 [Verso 建档] 启动全书建档分析 | 模块: ${module} | 模式: ${params.mode}`);

        const res = await plan.provider.chat({
          messages: [
            { role: 'system', content: plan.systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: plan.temperature,
          maxTokens: plan.maxTokens,
          responseFormat: 'json_object',
          signal: abortController.signal,
        });

        return cfg.parse(res.text, manuscript.title, fullManuscriptContent) as ProfilingModuleResultMap[M];
      } finally {
        setProfilingLoading((prev) => ({ ...prev, [module]: false }));
      }
    },
    [getExecutionPlanForTask, manuscript, fullManuscriptContent]
  );

  // Execute Scene Drafting / Story Generation with Streaming Support
  const runSceneDraft = useCallback(
    async (
      draftParams: SceneDraftParams,
      onStreamChunk?: (chunk: string, accumulated: string) => void
    ): Promise<SceneDraftResult> => {
      if (draftAbortRef.current) draftAbortRef.current.abort();
      draftAbortRef.current = new AbortController();

      setIsDraftLoading(true);
      setDraftStreamingText('');

      try {
        const plan = await getExecutionPlanForTask('scene_draft');
        const activeLens = lenses.find((l) => l.id === activeLensId);

        const prompt = buildSceneDraftPrompt({
          params: {
            ...draftParams,
            lensInstruction: draftParams.lensInstruction || activeLens?.promptInstruction,
          },
          manuscript,
          scenes,
          currentScene,
        });

        console.log(
          `✍️ [Verso 起草] 启动场景创作 | 场景: 《${draftParams.sceneTitle}》 | 模式: ${draftParams.mode} | 篇幅: ${draftParams.targetLength}`
        );

        let accumulated = '';
        const systemPrompt =
          plan.profile.systemPrompt ||
          '你是一位极具语言质感、叙事沉浸感与审美克制力的纯文学/严肃小说作家与特约主笔。请严格按照纯文学标准创作高质量的小说场景。';

        try {
          accumulated = await plan.provider.chatStream(
            {
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
              ],
              temperature: plan.temperature ?? 0.7,
              maxTokens: plan.maxTokens ?? 8192,
              responseFormat: 'json_object',
              signal: draftAbortRef.current.signal,
            },
            (chunkText, fullAccumulated) => {
              accumulated = fullAccumulated;
              setDraftStreamingText(fullAccumulated);
              if (onStreamChunk) {
                onStreamChunk(chunkText, fullAccumulated);
              }
            }
          );
        } catch (streamErr: any) {
          if (streamErr?.name === 'AbortError') throw streamErr;
          console.warn('[Verso AI: 流式输出降级为普通请求]', streamErr);
          const chatRes = await plan.provider.chat({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            temperature: plan.temperature ?? 0.7,
            maxTokens: plan.maxTokens ?? 8192,
            responseFormat: 'json_object',
            signal: draftAbortRef.current.signal,
          });
          accumulated = chatRes.text;
          setDraftStreamingText(accumulated);
        }

        const parsed = parseSceneDraftResponse(accumulated);
        setDraftResult(parsed);
        return parsed;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          console.log('[Verso AI: 场景起草已被创作者取消]');
          throw err;
        }
        console.error('[Verso AI: 场景起草失败]', err);
        throw err;
      } finally {
        setIsDraftLoading(false);
      }
    },
    [getExecutionPlanForTask, lenses, activeLensId, manuscript, scenes, currentScene]
  );

  const abortSceneDraft = useCallback(() => {
    if (draftAbortRef.current) {
      draftAbortRef.current.abort();
      draftAbortRef.current = null;
    }
    setIsDraftLoading(false);
  }, []);

  const clearDraftResult = useCallback(() => {
    setDraftResult(null);
    setDraftStreamingText('');
  }, []);

  return {
    lenses,
    activeLensId,
    setActiveLensId,
    saveLenses,
    promptTemplates,
    activeTemplateId,
    setActiveTemplateId,
    savePromptTemplates,
    contextConfig,
    setContextConfig,
    critiqueSummary,
    annotations: activeAnnotations,
    isCritiqueLoading,
    runSelectionCritique,
    updateAnnotationStatus,
    coldReaderReport,
    isColdReaderLoading,
    runColdRead,
    intentEvaluation,
    isIntentLoading,
    runIntentEvaluation,
    compareReport,
    isCompareLoading,
    runVersionCompare,
    chatHistory,
    isAskLoading,
    askQuestion,
    profilingLoading,
    runProfilingModule,
    fullManuscriptContent,
    draftResult,
    draftStreamingText,
    isDraftLoading,
    runSceneDraft,
    abortSceneDraft,
    clearDraftResult,
  };
}
