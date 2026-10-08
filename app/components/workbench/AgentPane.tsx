import { useState, useEffect, useCallback } from "react";
import { Send, Square, SlidersHorizontal, X, FileText } from "lucide-react";
import { useI18n } from "../../i18n";
import { useAgentRunStream } from "../agent/useAgentRunStream";
import { api } from "../../utils/api";
import type {
  AgentMessage,
  AgentRun,
  ContextReceiptItem,
} from "../../../shared/schemas/agent";
import type { Scene } from "../../../shared/schemas/project";
import type {
  TaskRequest,
  TaskSnapshot,
  TaskCoverage,
  WorkMode,
} from "../../../shared/schemas/task";
import type { SkillDiscoveryItem } from "../../../server/skills/skill-runtime";

export interface AgentPaneProps {
  projectId: string;
  threadId: string;
  mode: WorkMode;
  scene?: Scene;
  scenes: Scene[];
  selection?: TaskRequest["selection"];
  onClearSelection: () => void;
  onSetSelection: (selection: TaskRequest["selection"]) => void;
  dirty: boolean;
  confirmed: boolean;
  processingHost: string;
  nextGoal?: string;
  onGoalChange: (goal: string) => void;
  onProcessing: () => void;
  onRefresh: () => void;
  onLocate: (sceneId: string, revisionId?: string, quote?: string) => void;
  onOpenChanges: (runId?: string) => void;
  onOpenDrafts: () => void;
}
interface ThreadData {
  messages: AgentMessage[];
  runs: AgentRun[];
  receipts: Array<{ runId: string; items: ContextReceiptItem[] }>;
}

export function AgentPane({
  projectId,
  threadId,
  mode,
  scene,
  scenes,
  selection,
  onClearSelection,
  onSetSelection,
  dirty,
  confirmed,
  processingHost,
  nextGoal,
  onGoalChange,
  onProcessing,
  onRefresh,
  onLocate,
  onOpenChanges,
  onOpenDrafts,
}: AgentPaneProps) {
  const { t } = useI18n();
  const [input, setInput] = useState(""),
    [error, setError] = useState(""),
    [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<ThreadData>({
    messages: [],
    runs: [],
    receipts: [],
  });
  const [runId, setRunId] = useState<string | null>(null),
    [skills, setSkills] = useState<SkillDiscoveryItem[]>([]),
    [skillId, setSkillId] = useState("");
  const [scope, setScope] = useState<TaskRequest["scope"]>("scene"),
    [advanced, setAdvanced] = useState(false);
  const [background, setBackground] =
    useState<TaskRequest["background"]>("scene");
  const [participation, setParticipation] =
    useState<TaskRequest["participation"]>("discuss");
  const [knowledge, setKnowledge] = useState(true),
    [memory, setMemory] = useState(false),
    [media, setMedia] = useState(false),
    [cold, setCold] = useState(false),
    [preserve, setPreserve] = useState("");
  const [continueRunId, setContinueRunId] = useState<string | undefined>();
  const load = useCallback(async () => {
    try {
      const result = await api<ThreadData>(
        `/api/projects/${projectId}/threads/${threadId}/messages`,
      );
      setData(result);
      const active = result.runs.find(
        (run) =>
          !["completed", "partial", "failed", "cancelled"].includes(run.status),
      );
      setRunId(active?.id || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("studio.loadFailed"));
    }
  }, [projectId, threadId, t]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    api<{ skills: SkillDiscoveryItem[] }>("/api/skills")
      .then((d) => setSkills(d.skills))
      .catch((err) => setError(err.message));
  }, []);
  useEffect(() => {
    setParticipation("discuss");
    setContinueRunId(undefined);
    setSkillId("");
    setScope(mode === "structure" ? "project" : "scene");
  }, [mode]);
  useEffect(() => {
    if (selection) {
      setScope("selection");
      setBackground("none");
    }
  }, [selection]);
  useEffect(() => {
    setContinueRunId(undefined);
    if (!selection) setScope(mode === "structure" ? "project" : "scene");
  }, [scene?.id]);
  const { streamedText, isStreaming, status, events, cancel } =
    useAgentRunStream({
      runId,
      onCompleted: () => {
        void load();
        onRefresh();
      },
      onError: (err) => {
        setError(err);
        void load();
        onRefresh();
      },
    });
  const blocked = submitting || isStreaming || Boolean(runId);
  const isCold = cold || skillId === "cold_reader";
  const selectedPolicy = skills.find((s) => s.id === skillId)?.contextPolicy;
  const usesKnowledge =
    knowledge && !isCold && (selectedPolicy?.includeKnowledge ?? true);
  const usesMemory =
    memory && !isCold && (selectedPolicy?.includeMemory ?? true);
  const usesMedia = media && !isCold && (selectedPolicy?.includeMedia ?? true);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || blocked) return;
    if (dirty) {
      setError(t("studio.saveBeforeTask"));
      return;
    }
    if (!confirmed) {
      onProcessing();
      return;
    }
    const readable =
      scope === "project" || background === "project"
        ? scenes
        : scene
          ? [scene]
          : [];
    const task: TaskRequest = {
      mode,
      scope,
      sceneId: scene?.id,
      revisionMap: Object.fromEntries(
        readable
          .filter((s) => s.currentRevisionId)
          .map((s) => [s.id, s.currentRevisionId!]),
      ),
      selection: scope === "selection" ? selection : undefined,
      objective: nextGoal || input.trim(),
      preserve: isCold ? "" : preserve,
      participation,
      background: scope === "project" ? "project" : background,
      useKnowledge: usesKnowledge,
      useMemory: usesMemory,
      useMedia: usesMedia,
      coldRead: isCold,
      continueRunId,
    };
    setSubmitting(true);
    setError("");
    try {
      const result = await api<{ runId: string }>(
        `/api/projects/${projectId}/threads/${threadId}/messages`,
        { prompt: input.trim(), task, skillId: skillId || undefined },
      );
      setInput("");
      setRunId(result.runId);
      setContinueRunId(undefined);
      const resultData = await api<ThreadData>(
        `/api/projects/${projectId}/threads/${threadId}/messages`,
      );
      setData(resultData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("studio.sendFailed"));
    } finally {
      setSubmitting(false);
    }
  };
  const continueTask = (message: AgentMessage) => {
    const task = message.metadata.task as unknown as TaskSnapshot;
    if (!task || !message.runId) return;
    if (
      task.mode !== mode ||
      (task.scope !== "project" && task.sceneId !== scene?.id) ||
      Object.entries(task.revisionMap).some(
        ([id, revision]) =>
          scenes.find((s) => s.id === id)?.currentRevisionId !== revision,
      )
    ) {
      setError(t("studio.continueMismatch"));
      return;
    }
    onSetSelection(task.selection);
    setScope(task.scope);
    setBackground(task.background);
    setParticipation(task.participation);
    setKnowledge(task.useKnowledge);
    setMemory(task.useMemory);
    setMedia(task.useMedia);
    setCold(task.coldRead);
    setPreserve(task.preserve);
    setContinueRunId(message.runId);
    onGoalChange(task.objective);
    setInput(t("studio.continuePrompt"));
  };
  const liveCoverage = events.filter((e) => e.type === "receipt").at(-1)
    ?.coverage as TaskCoverage | undefined;
  return (
    <aside className="studio-agent">
      <header className="studio-pane-heading">
        <h2>{t("studio.assistant")}</h2>
        <button
          className="studio-icon-button"
          aria-label={t("studio.taskOptions")}
          aria-expanded={advanced}
          onClick={() => setAdvanced(!advanced)}
        >
          <SlidersHorizontal size={16} />
        </button>
      </header>
      <div className="studio-thread" aria-live="polite" aria-busy={blocked}>
        {data.messages.length === 0 && (
          <div className="studio-agent-empty">
            <span className="studio-assistant-mark">✳</span>
            <h3>
              {t(
                mode === "write"
                  ? "studio.startSmall"
                  : mode === "review"
                    ? "studio.readWithGoal"
                    : "studio.followStructure",
              )}
            </h3>
            <p>
              {t(
                mode === "write"
                  ? "studio.startSmallHelp"
                  : mode === "review"
                    ? "studio.readWithGoalHelp"
                    : "studio.followStructureHelp",
              )}
            </p>
            <button
              className="studio-button"
              onClick={() =>
                setInput(
                  t(
                    mode === "write"
                      ? "studio.ideaPrompt"
                      : "studio.reviewPrompt",
                  ),
                )
              }
            >
              {t("studio.tryPrompt")}
            </button>
          </div>
        )}
        {data.messages.map((message) => {
          const task = message.metadata.task as unknown as
            TaskSnapshot | undefined;
          const coverage = message.metadata.coverage as
            TaskCoverage | undefined;
          const receiptItems =
            data.receipts.find((r) => r.runId === message.runId)?.items || [];
          return (
            <article
              key={message.id}
              className={`studio-message ${message.role === "user" ? "studio-message-user" : ""}`}
            >
              <div className="studio-message-author">
                {t(
                  message.role === "user"
                    ? "studio.author"
                    : "studio.assistant",
                )}
                {task && (
                  <span>
                    {task.scope === "project"
                      ? t("studio.wholeWork")
                      : task.scenes?.find((s) => s.id === task.sceneId)?.title}
                    {task.scope === "selection" && ` ${t("studio.selection")}`}
                  </span>
                )}
              </div>
              <p className="studio-message-text">{message.content}</p>
              {task && (
                <details className="studio-receipt">
                  <summary>
                    {t("studio.taskBasis")}
                    {task.coldRead ? ` / ${t("studio.coldRead")}` : ""}
                  </summary>
                  <p>
                    {t("studio.objective")}: {task.objective}
                  </p>
                  {task.preserve && (
                    <p>
                      {t("studio.preserve")}: {task.preserve}
                    </p>
                  )}
                  {task.scenes?.map((s) => (
                    <button
                      key={s.id}
                      className="studio-source-link"
                      onClick={() =>
                        onLocate(s.id, s.revisionId, task.selection?.text)
                      }
                    >
                      <FileText size={12} />
                      {s.title}{" "}
                      {t("studio.revisionNumber", { n: s.revisionNumber })}
                    </button>
                  ))}
                  <p>
                    {t("studio.background")}:{" "}
                    {t(
                      task.background === "none"
                        ? "studio.onlySelection"
                        : task.background === "project"
                          ? "studio.wholeWork"
                          : "studio.currentChapter",
                    )}
                  </p>
                  <p>
                    {[
                      task.useKnowledge && t("studio.knowledge"),
                      task.useMemory && t("studio.preferences"),
                      task.useMedia && t("studio.media"),
                    ]
                      .filter(Boolean)
                      .join(" / ") || t("studio.manuscriptOnly")}
                  </p>
                  {receiptItems
                    .filter((i) => i.resourceType !== "scene")
                    .map((i) => (
                      <p key={i.id}>
                        {t("studio.usedResource")}:{" "}
                        {String(
                          (
                            i.metadata.locator as
                              Record<string, unknown> | undefined
                          )?.title ||
                            (i.resourceType === "project_convention"
                              ? t("studio.creativeIntent")
                              : t("studio.knowledge")),
                        )}
                      </p>
                    ))}
                </details>
              )}
              {coverage && <CoverageView coverage={coverage} />}
              {message.role === "assistant" && (
                <div className="studio-message-actions">
                  <button
                    disabled={blocked}
                    onClick={() => continueTask(message)}
                  >
                    {t("studio.continueTask")}
                  </button>
                  <button
                    onClick={() => onOpenChanges(message.runId || undefined)}
                  >
                    {t("studio.proposals")}
                  </button>
                  {task?.mode === "write" && task.participation === "draft" && (
                    <button onClick={onOpenDrafts}>{t("studio.drafts")}</button>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {isStreaming && (
          <article className="studio-message">
            <div className="studio-message-author">
              {t("studio.assistant")}
              <span>
                {t(
                  status === "planning"
                    ? "studio.planning"
                    : "studio.processing",
                )}
              </span>
            </div>
            <p className="studio-message-text">
              {streamedText || t("studio.reading")}
            </p>
            {liveCoverage && <CoverageView coverage={liveCoverage} />}
          </article>
        )}
        {error && (
          <p role="alert" className="studio-alert">
            {error}
            <button
              className="studio-icon-button"
              aria-label={t("common.close")}
              onClick={() => setError("")}
            >
              <X size={14} />
            </button>
          </p>
        )}
      </div>
      <form className="studio-composer" onSubmit={send}>
        <div className="studio-task-row">
          <label>
            {t("studio.target")}
            <select
              aria-label={t("studio.target")}
              disabled={blocked}
              value={scope}
              onChange={(e) => setScope(e.target.value as TaskRequest["scope"])}
            >
              <option value="scene">{t("studio.currentChapter")}</option>
              {selection && (
                <option value="selection">{t("studio.selection")}</option>
              )}
              <option value="project">{t("studio.wholeWork")}</option>
            </select>
          </label>
          <select
            aria-label={t("studio.participation")}
            value={participation}
            disabled={blocked}
            onChange={(e) =>
              setParticipation(e.target.value as TaskRequest["participation"])
            }
          >
            <option value="discuss">
              {t(mode === "write" ? "studio.discuss" : "studio.diagnose")}
            </option>
            <option value="suggest">{t("studio.suggest")}</option>
            {mode === "write" && (
              <option value="draft">{t("studio.localDraft")}</option>
            )}
          </select>
        </div>
        <p className="studio-target-caption">
          {scope === "project"
            ? t("studio.chapterCount", { n: scenes.length })
            : scene?.title}{" "}
          {continueRunId && t("studio.continuing")}
        </p>
        {scope === "selection" && selection && (
          <div className="studio-attached">
            <p>{selection.text}</p>
            <button
              type="button"
              className="studio-icon-button"
              aria-label={t("agent.removeQuote")}
              onClick={() => {
                onClearSelection();
                setScope("scene");
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {advanced && (
          <fieldset className="studio-task-options" disabled={blocked}>
            <label>
              {t("studio.objective")}
              <input
                value={nextGoal || ""}
                onChange={(e) => onGoalChange(e.target.value)}
                placeholder={t("studio.objectivePlaceholder")}
              />
            </label>
            <label>
              {t("studio.preserve")}
              <input
                value={preserve}
                disabled={isCold}
                onChange={(e) => setPreserve(e.target.value)}
                placeholder={t("studio.preservePlaceholder")}
              />
            </label>
            <label>
              {t("studio.background")}
              <select
                value={background}
                onChange={(e) =>
                  setBackground(e.target.value as TaskRequest["background"])
                }
              >
                <option value="none">{t("studio.onlyTarget")}</option>
                <option value="scene">{t("studio.currentChapter")}</option>
                <option value="project">{t("studio.wholeWork")}</option>
              </select>
            </label>
            <label>
              {t("studio.method")}
              <select
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
              >
                <option value="">{t("studio.general")}</option>
                {skills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="studio-checkbox">
              <input
                type="checkbox"
                checked={cold}
                onChange={(e) => setCold(e.target.checked)}
              />
              {t("studio.coldRead")}
            </label>
            <label className="studio-checkbox">
              <input
                type="checkbox"
                checked={usesKnowledge}
                disabled={isCold || selectedPolicy?.includeKnowledge === false}
                onChange={(e) => setKnowledge(e.target.checked)}
              />
              {t("studio.useKnowledge")}
            </label>
            <label className="studio-checkbox">
              <input
                type="checkbox"
                checked={usesMemory}
                disabled={isCold || selectedPolicy?.includeMemory === false}
                onChange={(e) => setMemory(e.target.checked)}
              />
              {t("studio.useMemory")}
            </label>
            <label className="studio-checkbox">
              <input
                type="checkbox"
                checked={usesMedia}
                disabled={isCold || selectedPolicy?.includeMedia === false}
                onChange={(e) => setMedia(e.target.checked)}
              />
              {t("studio.useMedia")}
            </label>
          </fieldset>
        )}
        <textarea
          aria-label={t("studio.askAssistant")}
          value={input}
          rows={3}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t(
            mode === "write"
              ? "studio.ideaPlaceholder"
              : "studio.questionPlaceholder",
          )}
          disabled={blocked}
        />
        <div className="studio-composer-footer">
          <button
            type="button"
            className="studio-processing-link"
            onClick={onProcessing}
          >
            {processingHost}
          </button>
          {blocked ? (
            <button
              type="button"
              className="studio-button"
              onClick={() => void cancel()}
            >
              <Square size={13} />
              {t("studio.stop")}
            </button>
          ) : (
            <button
              className="studio-button studio-primary"
              type="submit"
              disabled={!input.trim() || dirty}
            >
              <Send size={14} />
              {t("studio.send")}
            </button>
          )}
        </div>
        {dirty && <p className="studio-note">{t("studio.saveBeforeTask")}</p>}
      </form>
    </aside>
  );
}
function CoverageView({ coverage }: { coverage: TaskCoverage }) {
  const { t } = useI18n();
  return (
    <details className="studio-coverage">
      <summary>
        {coverage.complete ? t("studio.covered") : t("studio.partialCoverage")}
      </summary>
      {coverage.stopReason && <p>{coverage.stopReason}</p>}
      {coverage.scenes.map((s) => (
        <p key={s.id}>
          {s.title}: {s.read}/{s.total} {t("studio.characters")}
          {s.summaryUsed && ` / ${t("studio.summaryUsed")}`}
        </p>
      ))}
    </details>
  );
}
