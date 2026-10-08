import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "../../i18n";
import { StudioDialog } from "./StudioDialog";
import { api } from "../../utils/api";
import { DiffViewer } from "../changes/DiffViewer";
import { extractPlainText } from "../../../shared/manuscript";
import type {
  Scene,
  SceneRevision,
  ProjectSettings,
} from "../../../shared/schemas/project";
import type {
  TasteEntry,
  TasteEntryEvidence,
} from "../../../shared/schemas/memory";
import type { AgentArtifact } from "../../../shared/schemas/agent";

export function IntentDialog({
  projectId,
  settings,
  onClose,
  onRefresh,
}: {
  projectId: string;
  settings: ProjectSettings | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  const [feeling, setFeeling] = useState(
      String(settings?.tonePreferences.feeling || ""),
    ),
    [preserve, setPreserve] = useState(
      String(settings?.tonePreferences.preserve || ""),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/workbench`, {
        intent: "save_intent",
        feeling,
        preserve,
      });
      await onRefresh();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <StudioDialog title={t("studio.creativeIntent")} onClose={onClose}>
      <form className="studio-form" onSubmit={save}>
        <p className="studio-help">{t("studio.intentHelp")}</p>
        <label>
          {t("studio.feeling")}
          <textarea
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
            rows={3}
          />
        </label>
        <label>
          {t("studio.preserve")}
          <textarea
            value={preserve}
            onChange={(e) => setPreserve(e.target.value)}
            rows={3}
          />
        </label>
        {error && (
          <p role="alert" className="studio-alert">
            {error}
          </p>
        )}
        <button className="studio-button studio-primary" disabled={busy}>
          {t("common.save")}
        </button>
      </form>
    </StudioDialog>
  );
}

export function PreferencesDialog({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<
      Array<TasteEntry & { evidence: TasteEntryEvidence[] }>
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [preference, setPreference] = useState(""),
    [conditions, setConditions] = useState(""),
    [scope, setScope] = useState("project"),
    [editing, setEditing] = useState<string | null>(null);
  const load = async () => {
    try {
      setItems(
        (
          await api<{ tastes: typeof items }>(
            `/api/projects/${projectId}/memory`,
          )
        ).tastes,
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, [projectId]);
  const mutate = async (values: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/projects/${projectId}/memory`, values);
      await load();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <StudioDialog title={t("studio.preferences")} onClose={onClose} wide>
      <p className="studio-help">{t("studio.preferencesHelp")}</p>
      {error && (
        <p role="alert" className="studio-alert">
          {error}
        </p>
      )}
      <form
        className="studio-form studio-inset"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await mutate(
              editing
                ? { intent: "edit", tasteId: editing, preference, conditions }
                : { intent: "create", preference, conditions, scope },
            )
          ) {
            setEditing(null);
            setPreference("");
            setConditions("");
          }
        }}
      >
        <label>
          {t("studio.preferenceText")}
          <input
            required
            value={preference}
            onChange={(e) => setPreference(e.target.value)}
          />
        </label>
        <label>
          {t("studio.conditions")}
          <input
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            placeholder={t("studio.conditionsPlaceholder")}
          />
        </label>
        {!editing && (
          <label>
            {t("studio.preferenceScope")}
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="project">{t("studio.thisWork")}</option>
              <option value="workspace">{t("studio.allWorks")}</option>
            </select>
          </label>
        )}
        <div className="studio-actions">
          <button className="studio-button studio-primary" disabled={busy}>
            {t(editing ? "common.save" : "studio.addPreference")}
          </button>
          {editing && (
            <button
              type="button"
              className="studio-button"
              onClick={() => {
                setEditing(null);
                setPreference("");
                setConditions("");
              }}
            >
              {t("common.cancel")}
            </button>
          )}
        </div>
      </form>
      <div className="studio-list">
        {items.length === 0 && (
          <p className="studio-help">{t("studio.noPreferences")}</p>
        )}
        {items.map((item) => (
          <article key={item.id} className="studio-list-item">
            <h3>{item.preference}</h3>
            <p className="studio-help">
              {t(
                item.scope === "workspace"
                  ? "studio.allWorks"
                  : "studio.thisWork",
              )}{" "}
              /{" "}
              {t(
                (
                  {
                    candidate: "studio.memory_candidate",
                    active: "studio.memory_active",
                    contested: "studio.memory_contested",
                    superseded: "studio.memory_superseded",
                    disabled: "studio.memory_disabled",
                  } as const
                )[item.status],
              )}{" "}
              /{" "}
              {t(
                item.explicitness === "inferred"
                  ? "studio.inferred"
                  : "studio.explicit",
              )}
            </p>
            {item.conditions.length > 0 && <p>{item.conditions.join("；")}</p>}
            <details>
              <summary>{t("studio.evidence")}</summary>
              {item.evidence.map((e) => (
                <p key={e.id}>
                  {e.quote || e.sourceType}
                  {e.sourceId ? ` (${e.sourceId})` : ""}
                </p>
              ))}
            </details>
            <div className="studio-actions">
              {item.status !== "active" && (
                <button
                  className="studio-button"
                  disabled={busy}
                  onClick={() =>
                    void mutate({ intent: "confirm", tasteId: item.id })
                  }
                >
                  {t("studio.confirmPreference")}
                </button>
              )}
              <button
                className="studio-button"
                disabled={busy}
                onClick={() => {
                  setEditing(item.id);
                  setPreference(item.preference);
                  setConditions(item.conditions.join("；"));
                }}
              >
                {t("common.edit")}
              </button>
              {item.status !== "disabled" && (
                <button
                  className="studio-button"
                  disabled={busy}
                  onClick={() =>
                    void mutate({ intent: "disable", tasteId: item.id })
                  }
                >
                  {t("studio.disable")}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </StudioDialog>
  );
}

export function HistoryDialog({
  projectId,
  scene,
  onClose,
  onRefresh,
}: {
  projectId: string;
  scene: Scene;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { t, formatDate } = useI18n();
  const [revisions, setRevisions] = useState<SceneRevision[]>([]),
    [selected, setSelected] = useState<string>(),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState("");
  const load = async () => {
    try {
      setRevisions(
        (
          await api<{ revisions: SceneRevision[] }>(
            `/api/projects/${projectId}/scenes/${scene.id}`,
          )
        ).revisions,
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, [scene.id]);
  const revision = revisions.find((r) => r.id === selected);
  const mutate = async (values: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/projects/${projectId}/scenes/${scene.id}`, {
        ...values,
        expectedBaseRevisionId: scene.currentRevisionId,
      });
      await onRefresh();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <StudioDialog title={t("studio.versionHistory")} onClose={onClose} wide>
      <p className="studio-help">{t("studio.restoreBoundary")}</p>
      {error && (
        <p role="alert" className="studio-alert">
          {error}
        </p>
      )}
      <form
        className="studio-actions"
        onSubmit={(e) => {
          e.preventDefault();
          void mutate({
            intent: "save",
            content: scene.content,
            checkpoint: true,
            description: name,
          });
        }}
      >
        <input
          aria-label={t("studio.checkpointName")}
          placeholder={t("studio.checkpointName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button className="studio-button" disabled={busy || !name.trim()}>
          {t("studio.markVersion")}
        </button>
      </form>
      <div className="studio-history">
        <nav aria-label={t("studio.versionHistory")}>
          {revisions.map((rev) => (
            <button
              key={rev.id}
              className={selected === rev.id ? "is-active" : ""}
              onClick={() => {
                setSelected(rev.id);
                setConfirm(false);
              }}
            >
              <strong>
                {t("studio.revisionNumber", { n: rev.revisionNumber })}
              </strong>
              <span>{rev.description}</span>
              <small>{formatDate(rev.createdAt)}</small>
            </button>
          ))}
        </nav>
        <div>
          {revision ? (
            <>
              <h3>{t("studio.compareCurrent")}</h3>
              <DiffViewer
                originalText={extractPlainText(revision.content)}
                replacementText={extractPlainText(scene.content)}
              />
              {revision.id !== scene.currentRevisionId && (
                <div className="studio-restore">
                  {confirm && (
                    <p>{t("studio.restoreConfirm", { title: scene.title })}</p>
                  )}
                  <button
                    className="studio-button studio-primary"
                    disabled={busy}
                    onClick={() =>
                      confirm
                        ? void mutate({
                            intent: "restore",
                            revisionId: revision.id,
                          })
                        : setConfirm(true)
                    }
                  >
                    {t(
                      confirm
                        ? "studio.confirmRestore"
                        : "studio.restoreVersion",
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="studio-help">{t("studio.chooseVersion")}</p>
          )}
        </div>
      </div>
    </StudioDialog>
  );
}

export function DraftsDialog({
  projectId,
  scene,
  onClose,
  onRefresh,
}: {
  projectId: string;
  scene?: Scene;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  const [artifacts, setArtifacts] = useState<AgentArtifact[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selection, setSelection] = useState<{ id: string; text: string }>();
  const load = async () => {
    try {
      setArtifacts(
        (
          await api<{ artifacts: AgentArtifact[] }>(
            `/api/projects/${projectId}/drafts`,
          )
        ).artifacts,
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, [projectId]);
  const decide = async (draft: AgentArtifact, disposition: string) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/projects/${projectId}/drafts`, {
        artifactId: draft.id,
        disposition,
        sceneId: scene?.id,
        expectedBaseRevisionId: scene?.currentRevisionId,
        selectedText:
          selection?.id === draft.id ? selection.text : draft.content,
      });
      await load();
      await onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <StudioDialog title={t("studio.drafts")} onClose={onClose} wide>
      <p className="studio-help">
        {t("studio.draftsHelp", { title: scene?.title || "" })}
      </p>
      {error && (
        <p role="alert" className="studio-alert">
          {error}
        </p>
      )}
      <div className="studio-list">
        {artifacts.length === 0 && (
          <p className="studio-help">{t("studio.noDrafts")}</p>
        )}
        {artifacts.map((draft) => (
          <article className="studio-list-item" key={draft.id}>
            <h3>{draft.title}</h3>
            <textarea
              className="studio-draft-text"
              readOnly
              aria-label={draft.title}
              value={draft.content}
              rows={8}
              onSelect={(e) => {
                const el = e.currentTarget;
                setSelection(
                  el.selectionEnd > el.selectionStart
                    ? {
                        id: draft.id,
                        text: draft.content.slice(
                          el.selectionStart,
                          el.selectionEnd,
                        ),
                      }
                    : undefined,
                );
              }}
            />
            {draft.metadata.disposition ? (
              <p className="studio-help">
                {t(
                  draft.metadata.disposition === "adopted"
                    ? "studio.draft_adopted"
                    : draft.metadata.disposition === "material"
                      ? "studio.draft_material"
                      : "studio.draft_dismissed",
                )}
              </p>
            ) : (
              <div className="studio-actions">
                <button
                  className="studio-button studio-primary"
                  disabled={busy || !scene}
                  onClick={() => void decide(draft, "adopted")}
                >
                  {t(
                    selection?.id === draft.id
                      ? "studio.adoptSelection"
                      : "studio.adoptDraft",
                  )}
                </button>
                <button
                  className="studio-button"
                  disabled={busy}
                  onClick={() => void decide(draft, "material")}
                >
                  {t("studio.keepMaterial")}
                </button>
                <button
                  className="studio-button"
                  disabled={busy}
                  onClick={() => void decide(draft, "dismissed")}
                >
                  {t("studio.dismissDraft")}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </StudioDialog>
  );
}

export function StructureView({
  projectId,
  scenes,
  activeScene,
  onSelect,
  onRefresh,
  onTask,
}: {
  projectId: string;
  scenes: Scene[];
  activeScene?: Scene;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onTask: () => void;
}) {
  const { t } = useI18n();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeScene) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/scenes/${activeScene.id}`, {
        intent: "structure",
        title: form.get("title"),
        summary: form.get("summary"),
        pov: form.get("pov"),
        location: form.get("location"),
        timeframe: form.get("timeframe"),
        planned: form.get("planned") === "on",
        expectedBaseRevisionId: activeScene.currentRevisionId,
      });
      onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="studio-structure">
      <header className="studio-section-heading">
        <div>
          <h2>{t("studio.structure")}</h2>
          <p>{t("studio.structureHelp")}</p>
        </div>
        <button className="studio-button" onClick={onTask}>
          {t("studio.checkStructure")}
        </button>
      </header>
      <div className="studio-structure-list">
        {scenes.map((scene, i) => (
          <button
            key={scene.id}
            className={`studio-structure-row ${activeScene?.id === scene.id ? "is-active" : ""}`}
            onClick={() => onSelect(scene.id)}
          >
            <span className="studio-order">{i + 1}</span>
            <div>
              <strong>{scene.title}</strong>
              <p>{scene.summary || t("studio.noSummary")}</p>
              <small>
                {[scene.pov, scene.timeframe, scene.location]
                  .filter(Boolean)
                  .join(" / ")}
              </small>
            </div>
            <span className="studio-structure-state">
              {scene.metadata.planned
                ? t("studio.planned")
                : t("studio.written")}
              {scene.summary &&
                scene.metadata.structureBaseRevisionId !==
                  scene.currentRevisionId && <em>{t("studio.needsCheck")}</em>}
            </span>
          </button>
        ))}
      </div>
      {activeScene && (
        <form
          key={`${activeScene.id}:${activeScene.currentRevisionId}`}
          className="studio-form studio-structure-form"
          onSubmit={save}
        >
          <h3>{activeScene.title}</h3>
          <label>
            {t("studio.title")}
            <input name="title" required defaultValue={activeScene.title} />
          </label>
          <label>
            {t("studio.summary")}
            <textarea
              name="summary"
              rows={3}
              defaultValue={activeScene.summary || ""}
            />
          </label>
          <div className="studio-fields">
            <label>
              {t("studio.pov")}
              <input name="pov" defaultValue={activeScene.pov || ""} />
            </label>
            <label>
              {t("studio.timeframe")}
              <input
                name="timeframe"
                defaultValue={activeScene.timeframe || ""}
              />
            </label>
            <label>
              {t("studio.location")}
              <input
                name="location"
                defaultValue={activeScene.location || ""}
              />
            </label>
          </div>
          <label className="studio-checkbox">
            <input
              name="planned"
              type="checkbox"
              defaultChecked={Boolean(activeScene.metadata.planned)}
            />
            {t("studio.plannedHelp")}
          </label>
          {error && (
            <p role="alert" className="studio-alert">
              {error}
            </p>
          )}
          <button className="studio-button studio-primary" disabled={busy}>
            {t("studio.confirmStructure")}
          </button>
        </form>
      )}
    </section>
  );
}
