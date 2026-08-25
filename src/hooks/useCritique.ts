import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type {
  LiteraryAnnotation,
  CritiqueCategory,
  ColdReaderReport,
  IntentEvaluation,
  VersionCompareReport,
  ManuscriptProfileResult,
  LiteraryLens,
  PromptTemplate,
  ContextSelectionConfig,
  AppSettings,
  Manuscript,
  Scene,
  TaskBindingType,
  ModelProfile,
  LLMProvider
} from '../types';
import { db } from '../db';
import { BUILTIN_LENSES, BUILTIN_PROMPT_TEMPLATES } from '../db/initialData';
import { createLLMProvider } from '../providers/factory';
import { getSecretApiKey, isStrictLoopbackURL } from '../utils/secretStore';
import {
  buildLiteraryContext,
  buildColdReaderIsolatedContext,
} from '../utils/contextBuilder';
import { extractPlainText, findBestAnchorMatch } from '../utils/textProjection';
import { LITERARY_EDITOR_SYSTEM_PROMPT } from '../prompts/system';
import { buildCritiquePrompt } from '../prompts/critique';
import { buildColdReaderPrompt } from '../prompts/coldReader';
import { buildIntentComparePrompt } from '../prompts/intentCompare';
import { buildVersionComparePrompt } from '../prompts/versionCompare';
import { buildManuscriptProfilePrompt } from '../prompts/profiler';
import {
  parseCritiqueResponse,
  parseColdReaderResponse,
  parseIntentResponse,
  parseVersionCompareResponse,
  parseManuscriptProfileResponse
} from '../prompts/parser';

export interface TaskExecutionPlan {
  provider: LLMProvider;
  profile: ModelProfile;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  contextPolicy?: string;
}

async function checkProfileUsability(
  profile: ModelProfile,
  localOnlyMode: boolean
): Promise<{ isUsable: boolean; resolvedApiKey?: string; isLocked?: boolean }> {
  if (localOnlyMode) {
    if (profile.providerType !== 'ollama') {
      return { isUsable: false };
    }
    return { isUsable: isStrictLoopbackURL(profile.baseURL) };
  }

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

  // Check if encrypted key exists in localStorage (locked profile)
  if (typeof localStorage !== 'undefined') {
    try {
      const enc = localStorage.getItem(`verso_sec_enc_${profile.id}`);
      if (enc) {
        return { isUsable: false, isLocked: true };
      }
    } catch {}
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

  // Profiling State
  const [isProfilingLoading, setIsProfilingLoading] = useState(false);

  // Abort Controllers for race condition & cancellation protection
  const critiqueAbortRef = useRef<AbortController | null>(null);
  const coldReaderAbortRef = useRef<AbortController | null>(null);
  const intentAbortRef = useRef<AbortController | null>(null);
  const compareAbortRef = useRef<AbortController | null>(null);
  const askAbortRef = useRef<AbortController | null>(null);
  const profilerAbortRef = useRef<AbortController | null>(null);

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
      let targetLockedProfileName: string | undefined;

      // 1. Check if there is a task-bound profile that is configured and usable
      const boundProfile = settings.profiles.find((p) => p.taskBinding === task);
      if (boundProfile) {
        const { isUsable, resolvedApiKey, isLocked } = await checkProfileUsability(boundProfile, settings.localOnlyMode);
        if (isUsable) {
          chosenProfile = boundProfile;
          resolvedKey = resolvedApiKey;
        } else if (isLocked) {
          targetLockedProfileName = boundProfile.name;
        }
      }

      // 2. Fallback to activeProfileId if usable
      if (!chosenProfile) {
        const activeProfile = settings.profiles.find((p) => p.id === settings.activeProfileId);
        if (activeProfile) {
          const { isUsable, resolvedApiKey, isLocked } = await checkProfileUsability(activeProfile, settings.localOnlyMode);
          if (isUsable) {
            chosenProfile = activeProfile;
            resolvedKey = resolvedApiKey;
          } else if (isLocked && !targetLockedProfileName) {
            targetLockedProfileName = activeProfile.name;
          }
        }
      }

      // 3. Fallback to any usable profile in settings (configured provider)
      if (!chosenProfile) {
        for (const p of settings.profiles) {
          const { isUsable, resolvedApiKey, isLocked } = await checkProfileUsability(p, settings.localOnlyMode);
          if (isUsable) {
            chosenProfile = p;
            resolvedKey = resolvedApiKey;
            break;
          } else if (isLocked && !targetLockedProfileName) {
            targetLockedProfileName = p.name;
          }
        }
      }

      // If no usable profile found, throw explicit error prompting user to configure API key
      if (!chosenProfile) {
        if (targetLockedProfileName) {
          throw new Error(`Profile「${targetLockedProfileName}」处于加密锁定状态，请在设置中输入主口令解锁后使用。`);
        }
        if (settings.localOnlyMode) {
          throw new Error('当前处于「纯本地隐私模式」，未检测到可用的 Ollama 本地模型。请在设置中配置 Ollama 基础地址 (如 http://localhost:11434)。');
        }
        throw new Error('未配置可用的 AI 模型 Profile 或 API Key。请点击右上角「设置」配置您的 API Key 或本地模型。');
      }

      const provider = createLLMProvider(chosenProfile, settings.localOnlyMode, resolvedKey);
      const systemPrompt = chosenProfile.systemPrompt || LITERARY_EDITOR_SYSTEM_PROMPT;
      const temperature = chosenProfile.temperature ?? 0.3;
      const maxTokens = chosenProfile.maxTokens ?? 3000;

      return {
        provider,
        profile: chosenProfile,
        systemPrompt,
        temperature,
        maxTokens,
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

        // Build unified multi-source context
        const builtContext = buildLiteraryContext(
          contextConfig,
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

        // Build context if user enabled context options
        const builtContext = buildLiteraryContext(
          contextConfig,
          manuscript,
          scenes,
          currentScene,
          activeSelectedText
        );

        let userPromptWithContext = question;
        if (builtContext.formattedPromptString.trim()) {
          userPromptWithContext = `${builtContext.formattedPromptString}\n\n【创作者发问】\n${question}`;
        }

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

  // Run AI Literary Profiling on manuscript/scene import or explicit request
  const runManuscriptProfile = useCallback(
    async (
      title: string,
      content: string,
      options?: { shouldSuggestScenes?: boolean }
    ): Promise<ManuscriptProfileResult> => {
      if (profilerAbortRef.current) {
        profilerAbortRef.current.abort();
      }
      const abortController = new AbortController();
      profilerAbortRef.current = abortController;
      setIsProfilingLoading(true);

      try {
        const plan = await getExecutionPlanForTask('general');
        const userPrompt = buildManuscriptProfilePrompt(title, content, options);

        const res = await plan.provider.chat({
          messages: [
            { role: 'system', content: plan.systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.25,
          maxTokens: Math.max(plan.maxTokens, 3500),
          responseFormat: 'json_object',
          signal: abortController.signal,
        });

        return parseManuscriptProfileResponse(res.text, title);
      } finally {
        setIsProfilingLoading(false);
      }
    },
    [getExecutionPlanForTask]
  );

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
    isProfilingLoading,
    runManuscriptProfile,
  };
}
