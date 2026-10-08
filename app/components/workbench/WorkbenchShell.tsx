import { useState, useEffect } from "react";
import { Link, useRevalidator, useBlocker } from "react-router";
import {
  BookOpen,
  PanelLeft,
  PanelRight,
  Plus,
  Upload,
  History,
  Download,
  Feather,
  ScanText,
  ListTree,
  Maximize2,
  ChevronLeft,
  X,
} from "lucide-react";
import { useI18n } from "../../i18n";
import { ManuscriptEditor } from "./ManuscriptEditor";
import { ImportSceneModal } from "./ImportSceneModal";
import { AgentPane } from "./AgentPane";
import { RevisionDesk } from "../changes/RevisionDesk";
import { KnowledgeTabContent } from "../knowledge/KnowledgeTabContent";
import { StudioDialog } from "./StudioDialog";
import {
  IntentDialog,
  PreferencesDialog,
  HistoryDialog,
  DraftsDialog,
  StructureView,
} from "./AuthorTools";
import { api } from "../../utils/api";
import {
  calculateEditorStats,
  extractPlainText,
} from "../../../shared/manuscript";
import type {
  Project,
  ProjectSettings,
  Manuscript,
  Scene,
  SceneRevision,
} from "../../../shared/schemas/project";
import type { AgentThread } from "../../../shared/schemas/agent";
import type { TaskRequest, WorkMode } from "../../../shared/schemas/task";

export interface WorkbenchShellProps {
  project: Project;
  manuscripts: Manuscript[];
  scenes: Scene[];
  activeThread?: AgentThread;
  settings: ProjectSettings | null;
  processing: {
    endpoint: string;
    host: string;
    model: string;
    storage: "local";
  };
}
export function WorkbenchShell({
  project,
  manuscripts,
  scenes: initialScenes,
  activeThread,
  settings,
  processing,
}: WorkbenchShellProps) {
  const { t, locale, setLocale } = useI18n();
  const revalidator = useRevalidator();
  const resume = settings?.metadata.resume as
    | { sceneId?: string; mode?: WorkMode; cursor?: number; nextGoal?: string }
    | undefined;
  const [scenes, setScenes] = useState(initialScenes),
    [activeId, setActiveId] = useState(
      resume?.sceneId || initialScenes[0]?.id || "",
    ),
    [mode, setMode] = useState<WorkMode>(resume?.mode || "write");
  const [directory, setDirectory] = useState(true),
    [assistant, setAssistant] = useState(true),
    [focus, setFocus] = useState(false),
    [dirty, setDirty] = useState(false),
    [continuous, setContinuous] = useState(false);
  const [search, setSearch] = useState(""),
    [selection, setSelection] = useState<TaskRequest["selection"]>(),
    [cursor, setCursor] = useState(resume?.cursor || 0),
    [nextGoal, setNextGoal] = useState(resume?.nextGoal || "");
  const [dialog, setDialog] = useState<
    | "import"
    | "history"
    | "intent"
    | "preferences"
    | "drafts"
    | "processing"
    | "create"
    | "create_manuscript"
    | null
  >(null);
  const [rightTab, setRightTab] = useState<"agent" | "changes">("agent"),
    [refreshKey, setRefreshKey] = useState(0),
    [runFilter, setRunFilter] = useState<string>(),
    [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(
      settings?.metadata.confirmedEndpoint === processing.endpoint,
    ),
    [busy, setBusy] = useState(false);
  const [historical, setHistorical] = useState<{
      sceneId: string;
      revision: SceneRevision;
      quote?: string;
    }>(),
    [locatedQuote, setLocatedQuote] = useState<string>();
  const [materials, setMaterials] = useState(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    setScenes(initialScenes);
  }, [initialScenes]);
  useEffect(() => {
    if (window.innerWidth < 1000) setDirectory(false);
    if (window.innerWidth < 760) setAssistant(false);
  }, []);
  useEffect(() => {
    setConfirmed(settings?.metadata.confirmedEndpoint === processing.endpoint);
  }, [settings?.metadata.confirmedEndpoint, processing.endpoint]);
  const rank = new Map(manuscripts.map((m, i) => [m.id, i]));
  const ordered = [...scenes].sort(
    (a, b) =>
      (rank.get(a.manuscriptId) || 0) - (rank.get(b.manuscriptId) || 0) ||
      a.order - b.order,
  );
  const scene = ordered.find((s) => s.id === activeId) || ordered[0];
  const activeManuscript = manuscripts.find(
    (m) => m.id === scene?.manuscriptId,
  );
  const stats = calculateEditorStats(scene?.content || "");
  useEffect(() => {
    if (!scene) return;
    const timer = window.setTimeout(() => {
      api(`/api/projects/${project.id}/workbench`, {
        intent: "resume",
        sceneId: scene.id,
        mode,
        cursor,
        nextGoal,
      }).catch((err) => setError(err.message));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [project.id, scene?.id, mode, cursor, nextGoal]);
  const refresh = async () => {
    await revalidator.revalidate();
    setRefreshKey((key) => key + 1);
  };
  const guard = (action: () => void) => {
    if (dirty) {
      setError(t("studio.saveBeforeNavigation"));
      return;
    }
    action();
    setError("");
  };
  const selectScene = (id: string) =>
    guard(() => {
      setActiveId(id);
      setSelection(undefined);
      setHistorical(undefined);
      setLocatedQuote(undefined);
      setMaterials(false);
      setCursor(0);
    });
  const switchMode = (next: WorkMode) =>
    guard(() => {
      setMode(next);
      setHistorical(undefined);
      setMaterials(false);
      setContinuous(false);
    });
  const locate = async (
    sceneId: string,
    revisionId?: string,
    quote?: string,
  ) => {
    if (dirty) {
      setError(t("studio.saveBeforeNavigation"));
      return;
    }
    const target = ordered.find((s) => s.id === sceneId);
    if (!target) {
      setError(t("studio.sourceMissing"));
      return;
    }
    setActiveId(sceneId);
    setMaterials(false);
    setContinuous(false);
    setMode("review");
    setSelection(undefined);
    setLocatedQuote(quote);
    if (revisionId && revisionId !== target.currentRevisionId) {
      try {
        const data = await api<{ revisions: SceneRevision[] }>(
          `/api/projects/${project.id}/scenes/${sceneId}`,
        );
        const revision = data.revisions.find((r) => r.id === revisionId);
        if (!revision) throw new Error(t("studio.sourceMissing"));
        setHistorical({ sceneId, revision, quote });
      } catch (err) {
        setError((err as Error).message);
      }
    } else setHistorical(undefined);
  };
  const save = async (content: string, expectedBaseRevisionId?: string) => {
    if (!scene) throw new Error(t("studio.sourceMissing"));
    try {
      const result = await api<{ scene: Scene }>(
        `/api/projects/${project.id}/scenes/${scene.id}`,
        { intent: "save", content, expectedBaseRevisionId },
      );
      setScenes((current) =>
        current.map((s) => (s.id === result.scene.id ? result.scene : s)),
      );
      refresh();
      return result.scene;
    } catch (err) {
      refresh();
      throw err;
    }
  };
  const displayedScene =
    scene && historical?.sceneId === scene.id
      ? {
          ...scene,
          content: historical.revision.content,
          currentRevisionId: historical.revision.id,
        }
      : scene;
  const selectedScenes = ordered.filter(
    (s) =>
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.summary?.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div
      className={`studio ${focus ? "studio-focus" : ""} ${directory ? "studio-directory-open" : ""} ${assistant ? "studio-assistant-open" : ""}`}
    >
      <header className="studio-header">
        <div className="studio-brand">
          <Link
            to="/"
            className="studio-icon-button"
            aria-label={t("common.back")}
          >
            <ChevronLeft size={17} />
          </Link>
          <span className="studio-logo">Verso</span>
          <span className="studio-brand-rule" />
          <h1>{project.title}</h1>
        </div>
        <nav className="studio-mode-tabs" aria-label={t("studio.workMode")}>
          {(
            [
              ["write", "studio.write", Feather],
              ["review", "studio.review", ScanText],
              ["structure", "studio.structure", ListTree],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              aria-current={mode === id ? "page" : undefined}
              onClick={() => switchMode(id)}
            >
              <Icon size={15} />
              <span>{t(label)}</span>
            </button>
          ))}
        </nav>
        <div className="studio-actions">
          <button
            className="studio-icon-button"
            title={t("studio.focusMode")}
            aria-label={t("studio.focusMode")}
            aria-pressed={focus}
            onClick={() => setFocus(!focus)}
          >
            <Maximize2 size={16} />
          </button>
          <button
            className="studio-button studio-locale"
            onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}
          >
            {locale === "zh-CN" ? "EN" : "中"}
          </button>
        </div>
      </header>
      <div className="studio-subheader">
        <div className="studio-actions">
          <button
            className="studio-icon-button"
            aria-label={t("studio.directory")}
            aria-expanded={directory && !focus}
            onClick={() => {
              setDirectory(!directory);
              setFocus(false);
            }}
          >
            <PanelLeft size={16} />
          </button>
          <span>{scene?.title || t("studio.emptyWork")}</span>
          <small>
            {t("workbench.wordCount", {
              count: stats.chineseCharacters + stats.totalWords,
            })}
          </small>
        </div>
        <div className="studio-actions">
          <button
            className="studio-button"
            onClick={() => guard(() => setDialog("import"))}
          >
            <Upload size={14} />
            <span>{t("studio.import")}</span>
          </button>
          <button
            className="studio-button"
            disabled={!scene}
            onClick={() => guard(() => setDialog("history"))}
          >
            <History size={14} />
            <span>{t("studio.history")}</span>
          </button>
          <button
            className="studio-button"
            onClick={() =>
              guard(() => {
                window.location.href = `/api/projects/${project.id}/export`;
              })
            }
          >
            <Download size={14} />
            <span>{t("studio.export")}</span>
          </button>
          <button
            className="studio-icon-button"
            aria-label={t("studio.assistant")}
            aria-expanded={assistant && !focus}
            onClick={() => {
              setAssistant(!assistant);
              setFocus(false);
            }}
          >
            <PanelRight size={16} />
          </button>
        </div>
      </div>
      {error && (
        <div className="studio-shell-alert" role="alert">
          {error}
          <button
            className="studio-icon-button"
            aria-label={t("common.close")}
            onClick={() => setError("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <main className="studio-layout">
        <aside className="studio-directory">
          <header className="studio-pane-heading">
            <h2>{t("studio.directory")}</h2>
            <button
              className="studio-icon-button"
              aria-label={t("studio.addChapter")}
              onClick={() => guard(() => setDialog("create"))}
            >
              <Plus size={16} />
            </button>
          </header>
          <div className="studio-directory-search">
            <input
              aria-label={t("studio.findChapter")}
              placeholder={t("studio.findChapter")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <nav
            className="studio-directory-tree"
            aria-label={t("studio.chapters")}
          >
            {manuscripts.map((manuscript) => (
              <div className="studio-manuscript-group" key={manuscript.id}>
                <h3>{manuscript.title}</h3>
                {selectedScenes
                  .filter((s) => s.manuscriptId === manuscript.id)
                  .map((s, i) => (
                    <button
                      key={s.id}
                      className={scene?.id === s.id ? "is-active" : ""}
                      onClick={() => selectScene(s.id)}
                    >
                      <span>{i + 1}</span>
                      <strong>{s.title}</strong>
                      {Boolean(s.metadata.planned) && (
                        <small>{t("studio.planned")}</small>
                      )}
                    </button>
                  ))}
              </div>
            ))}
          </nav>
          <div className="studio-directory-footer">
            <button
              onClick={() =>
                guard(() => {
                  setContinuous(!continuous);
                  setMaterials(false);
                  setHistorical(undefined);
                  if (mode === "structure") setMode("review");
                })
              }
            >
              <BookOpen size={15} />
              {t(continuous ? "studio.singleChapter" : "studio.continuousRead")}
            </button>
            <button onClick={() => guard(() => setDialog("create_manuscript"))}>
              <Plus size={15} />
              {t("studio.addManuscript")}
            </button>
            <button
              className={materials ? "is-active" : ""}
              onClick={() => guard(() => setMaterials(!materials))}
            >
              {t("studio.knowledge")}
            </button>
            <button onClick={() => setDialog("intent")}>
              {t("studio.creativeIntent")}
            </button>
            <button onClick={() => setDialog("preferences")}>
              {t("studio.preferences")}
            </button>
            <button onClick={() => guard(() => setDialog("drafts"))}>
              {t("studio.drafts")}
            </button>
          </div>
        </aside>
        <div className="studio-document-area">
          {historical && (
            <div className="studio-historical-banner">
              {t("studio.viewingHistory", {
                n: historical.revision.revisionNumber,
              })}
              <button onClick={() => setHistorical(undefined)}>
                {t("studio.returnCurrent")}
              </button>
            </div>
          )}
          {materials ? (
            <KnowledgeTabContent
              key={refreshKey}
              projectId={project.id}
              scenes={ordered}
              confirmed={confirmed}
              onProcessing={() => setDialog("processing")}
            />
          ) : mode === "structure" ? (
            <StructureView
              projectId={project.id}
              scenes={ordered}
              activeScene={scene}
              onSelect={selectScene}
              onRefresh={refresh}
              onTask={() => {
                setAssistant(true);
                setFocus(false);
                setRightTab("agent");
              }}
            />
          ) : continuous ? (
            <div className="studio-continuous">
              {ordered
                .filter((s) => !s.metadata.planned)
                .map((s) => (
                  <article
                    className={`studio-page ${manuscripts.find((m) => m.id === s.manuscriptId)?.genre === "poetry" ? "studio-poetry" : ""}`}
                    key={s.id}
                  >
                    <div className="studio-page-heading">
                      <h2>{s.title}</h2>
                      <button
                        className="studio-button"
                        onClick={() => {
                          selectScene(s.id);
                          setContinuous(false);
                        }}
                      >
                        {t("studio.openChapter")}
                      </button>
                    </div>
                    <div className="studio-continuous-prose">
                      {extractPlainText(s.content)}
                    </div>
                  </article>
                ))}
            </div>
          ) : displayedScene ? (
            <ManuscriptEditor
              key={`${displayedScene.id}:${historical?.revision.id || "current"}`}
              scene={displayedScene}
              editable={mode === "write" && !historical}
              poetry={activeManuscript?.genre === "poetry"}
              historical={Boolean(historical)}
              locateQuote={locatedQuote}
              resumeCursor={cursor}
              onSave={save}
              onDirtyChange={setDirty}
              onSelection={(s) => {
                if (s && !historical) setSelection(s);
              }}
              onCursor={setCursor}
              onEnterEdit={() => switchMode("write")}
            />
          ) : (
            <div className="studio-empty">
              <h2>{t("studio.emptyWork")}</h2>
              <button
                className="studio-button studio-primary"
                onClick={() => setDialog("create")}
              >
                {t("studio.addChapter")}
              </button>
            </div>
          )}
        </div>
        <div className="studio-right-pane">
          <nav
            className="studio-right-tabs"
            aria-label={t("studio.assistantPanels")}
          >
            <button
              className={rightTab === "agent" ? "is-active" : ""}
              onClick={() => setRightTab("agent")}
            >
              {t("studio.conversation")}
            </button>
            <button
              className={rightTab === "changes" ? "is-active" : ""}
              onClick={() => setRightTab("changes")}
            >
              {t("studio.proposals")}
            </button>
          </nav>
          <div className="studio-right-content" hidden={rightTab !== "agent"}>
            {activeThread && (
              <AgentPane
                projectId={project.id}
                threadId={activeThread.id}
                mode={mode}
                scene={scene}
                scenes={ordered}
                selection={selection}
                onClearSelection={() => setSelection(undefined)}
                onSetSelection={setSelection}
                dirty={dirty || Boolean(historical)}
                confirmed={confirmed}
                processingHost={processing.host}
                nextGoal={nextGoal}
                onGoalChange={setNextGoal}
                onProcessing={() => setDialog("processing")}
                onRefresh={refresh}
                onLocate={locate}
                onOpenChanges={(runId) => {
                  setRunFilter(runId);
                  setRightTab("changes");
                }}
                onOpenDrafts={() => guard(() => setDialog("drafts"))}
              />
            )}
          </div>
          <div className="studio-right-content" hidden={rightTab !== "changes"}>
            <RevisionDesk
              projectId={project.id}
              scenes={ordered}
              refreshKey={refreshKey}
              runId={runFilter}
              blocked={dirty}
              onLocate={locate}
              onApplied={refresh}
              onReadback={() =>
                guard(() => {
                  setHistorical(undefined);
                  setContinuous(false);
                  setMaterials(false);
                  setMode("review");
                })
              }
            />
          </div>
        </div>
      </main>
      {dialog === "import" && (
        <ImportSceneModal
          isOpen
          onClose={() => setDialog(null)}
          projectId={project.id}
          manuscripts={manuscripts}
          activeScene={scene}
          scenesCount={scenes.length}
          onImportComplete={refresh}
        />
      )}
      {dialog === "history" && scene && (
        <HistoryDialog
          projectId={project.id}
          scene={scene}
          onClose={() => setDialog(null)}
          onRefresh={refresh}
        />
      )}
      {dialog === "intent" && (
        <IntentDialog
          projectId={project.id}
          settings={settings}
          onClose={() => setDialog(null)}
          onRefresh={refresh}
        />
      )}
      {dialog === "preferences" && (
        <PreferencesDialog
          projectId={project.id}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "drafts" && (
        <DraftsDialog
          projectId={project.id}
          scene={scene}
          onClose={() => setDialog(null)}
          onRefresh={refresh}
        />
      )}
      {dialog === "processing" && (
        <StudioDialog
          title={t("studio.processingRules")}
          onClose={() => setDialog(null)}
        >
          <div className="studio-form">
            <p>{t("studio.storageDescription")}</p>
            <dl className="studio-processing-facts">
              <dt>{t("studio.processingProvider")}</dt>
              <dd>{processing.host}</dd>
              <dt>{t("studio.model")}</dt>
              <dd>{processing.model}</dd>
            </dl>
            <p>{t("studio.sendingDescription")}</p>
            <p className="studio-help">{t("studio.providerTerms")}</p>
            <button
              className="studio-button studio-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/api/projects/${project.id}/workbench`, {
                    intent: "confirm_processing",
                    endpoint: processing.endpoint,
                  });
                  setConfirmed(true);
                  refresh();
                  setDialog(null);
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t(confirmed ? "common.close" : "studio.confirmProcessing")}
            </button>
          </div>
        </StudioDialog>
      )}
      {(dialog === "create" || dialog === "create_manuscript") && (
        <StudioDialog
          title={t(
            dialog === "create" ? "studio.addChapter" : "studio.addManuscript",
          )}
          onClose={() => setDialog(null)}
        >
          <form
            className="studio-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              setBusy(true);
              try {
                const result = await api<{ scene?: Scene }>(
                  `/api/projects/${project.id}/workbench`,
                  {
                    intent:
                      dialog === "create"
                        ? "create_chapter"
                        : "create_manuscript",
                    title: values.get("title"),
                    manuscriptId: values.get("manuscriptId"),
                    planned: values.get("planned") === "on",
                  },
                );
                if (result.scene) setActiveId(result.scene.id);
                refresh();
                setDialog(null);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {t("studio.title")}
              <input name="title" required autoFocus />
            </label>
            {dialog === "create" && (
              <>
                <label>
                  {t("studio.manuscript")}
                  <select
                    name="manuscriptId"
                    defaultValue={scene?.manuscriptId}
                  >
                    {manuscripts.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="studio-checkbox">
                  <input type="checkbox" name="planned" />
                  {t("studio.plannedHelp")}
                </label>
              </>
            )}
            <button
              className="studio-button studio-primary"
              disabled={busy || (dialog === "create" && !manuscripts.length)}
            >
              {t("common.create")}
            </button>
          </form>
        </StudioDialog>
      )}
      {blocker.state === "blocked" && (
        <StudioDialog
          title={t("studio.unsaved")}
          onClose={() => blocker.reset()}
        >
          <p>{t("studio.leaveDraftHelp")}</p>
          <div className="studio-actions">
            <button className="studio-button" onClick={() => blocker.reset()}>
              {t("studio.keepWriting")}
            </button>
            <button
              className="studio-button studio-primary"
              onClick={() => blocker.proceed()}
            >
              {t("studio.leaveWithDraft")}
            </button>
          </div>
        </StudioDialog>
      )}
    </div>
  );
}
