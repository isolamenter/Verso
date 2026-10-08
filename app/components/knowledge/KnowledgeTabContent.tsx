import { useEffect, useState, useCallback } from "react";
import { Plus, Upload, Pencil, Archive } from "lucide-react";
import { useI18n } from "../../i18n";
import { api } from "../../utils/api";
import { StudioDialog } from "../workbench/StudioDialog";
import { MediaAssetList, type MediaAssetDetail } from "./media/MediaAssetList";
import type {
  KnowledgeNode,
  KnowledgeRelation,
} from "../../../shared/schemas/knowledge";
import type { Scene } from "../../../shared/schemas/project";

export interface KnowledgeTabContentProps {
  projectId: string;
  scenes: Scene[];
  confirmed: boolean;
  onProcessing: () => void;
}
interface Library {
  nodes: KnowledgeNode[];
  relations: KnowledgeRelation[];
  sources: Array<{ nodeId: string; assetId: string; filename: string }>;
}
function noteRole(node: KnowledgeNode) {
  return node.status === "draft"
    ? "pending"
    : node.metadata.role ||
        ([
          "research_note",
          "reference_document",
          "image_reference",
          "audio_reference",
          "video_reference",
          "voice_reference",
        ].includes(node.kind)
          ? "material"
          : "setting");
}
export function KnowledgeTabContent({
  projectId,
  scenes,
  confirmed,
  onProcessing,
}: KnowledgeTabContentProps) {
  const { t } = useI18n();
  const [library, setLibrary] = useState<Library>({
      nodes: [],
      relations: [],
      sources: [],
    }),
    [assets, setAssets] = useState<MediaAssetDetail[]>([]),
    [tab, setTab] = useState("setting"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<KnowledgeNode | null | undefined>(),
    [upload, setUpload] = useState(false);
  const load = useCallback(async () => {
    try {
      const [notes, media] = await Promise.all([
        api<Library>(`/api/projects/${projectId}/knowledge`),
        api<{ items: MediaAssetDetail[] }>(`/api/projects/${projectId}/assets`),
      ]);
      setLibrary(notes);
      setAssets(media.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  useEffect(() => {
    void load();
  }, [load]);
  const conflicts = library.relations.filter(
    (r) => r.relationType === "conflicts_with",
  );
  return (
    <section className="studio-knowledge">
      <header className="studio-section-heading">
        <div>
          <h2>{t("studio.knowledge")}</h2>
          <p>{t("studio.notesHelp")}</p>
        </div>
        <div className="studio-actions">
          <button
            className="studio-button"
            onClick={() => (confirmed ? setUpload(true) : onProcessing())}
          >
            <Upload size={14} />
            {t("knowledge.uploadMediaFile")}
          </button>
          <button
            className="studio-button studio-primary"
            onClick={() => setEditing(null)}
          >
            <Plus size={14} />
            {t("studio.addNote")}
          </button>
        </div>
      </header>
      <nav className="studio-knowledge-tabs">
        {(
          [
            ["setting", "studio.settingsTab"],
            ["material", "studio.materialsTab"],
            ["pending", "studio.pendingTab"],
            ["media", "studio.media"],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            className={`studio-button ${tab === id ? "is-active" : ""}`}
            onClick={() => setTab(id)}
          >
            {t(key)}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="studio-alert">
          {error}
        </p>
      )}
      {conflicts.map((relation) => (
        <div className="studio-knowledge-conflict" key={relation.id}>
          <strong>
            {library.nodes.find((n) => n.id === relation.sourceNodeId)?.title} /{" "}
            {library.nodes.find((n) => n.id === relation.targetNodeId)?.title}
          </strong>
          <p>{relation.description || t("studio.conflictHelp")}</p>
        </div>
      ))}
      {loading ? (
        <p>{t("studio.loading")}</p>
      ) : tab === "media" ? (
        <>
          <div className="studio-help">
            {assets.map((item) => (
              <p key={item.asset.id}>
                <a
                  className="studio-source-link"
                  href={`/api/projects/${projectId}/assets/${item.asset.id}/file`}
                >
                  {item.asset.originalFileName} — {t("studio.originalFile")}
                </a>
              </p>
            ))}
          </div>
          <MediaAssetList
            assets={assets}
            onRetry={async (id) => {
              if (!confirmed) {
                onProcessing();
                return;
              }
              const response = await fetch(
                `/api/projects/${projectId}/assets/${id}/retry`,
                { method: "POST" },
              );
              const data = await response.json();
              if (!response.ok || data.error) {
                setError(data.error);
                return;
              }
              await load();
            }}
            onUploadClick={() => (confirmed ? setUpload(true) : onProcessing())}
          />
        </>
      ) : (
        <>
          {!library.nodes.some((node) => noteRole(node) === tab) && (
            <p className="studio-help">{t("studio.noNotes")}</p>
          )}
          {library.nodes
            .filter((node) => noteRole(node) === tab)
            .map((node) => (
              <article className="studio-knowledge-item" key={node.id}>
                <div className="studio-section-heading">
                  <h3>{node.title}</h3>
                  <div className="studio-actions">
                    <button
                      className="studio-icon-button"
                      aria-label={t("common.edit")}
                      onClick={() => setEditing(node)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="studio-icon-button"
                      aria-label={t("common.archived")}
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api(`/api/projects/${projectId}/knowledge`, {
                            intent: "archive_node",
                            nodeId: node.id,
                          });
                          await load();
                        } catch (err) {
                          setError((err as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Archive size={15} />
                    </button>
                  </div>
                </div>
                <div className="studio-knowledge-meta">
                  <span>
                    {node.sceneId
                      ? scenes.find((s) => s.id === node.sceneId)?.title
                      : t("studio.wholeWorkScope")}
                  </span>
                  <span>{node.authority}</span>
                  {Boolean(node.metadata.conditions) && (
                    <span>{String(node.metadata.conditions)}</span>
                  )}
                </div>
                <p>{node.content}</p>
                {Boolean(node.metadata.source) && (
                  <p className="studio-help">
                    {t("studio.source")}: {String(node.metadata.source)}{" "}
                    {String(node.metadata.sourceLocator || "")}
                  </p>
                )}
                {library.sources
                  .filter((source) => source.nodeId === node.id)
                  .map((source) => (
                    <a
                      className="studio-source-link"
                      key={source.assetId}
                      href={`/api/projects/${projectId}/assets/${source.assetId}/file`}
                    >
                      {source.filename} — {t("studio.originalFile")}
                    </a>
                  ))}
              </article>
            ))}
        </>
      )}
      {editing !== undefined && (
        <StudioDialog
          title={t(editing ? "common.edit" : "studio.addNote")}
          onClose={() => setEditing(undefined)}
        >
          <form
            className="studio-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await api(`/api/projects/${projectId}/knowledge`, {
                  intent: editing ? "update_node" : "create_node",
                  nodeId: editing?.id,
                  title: form.get("title"),
                  content: form.get("content"),
                  kind: form.get("kind"),
                  role: form.get("role"),
                  source: form.get("source"),
                  sourceLocator: form.get("sourceLocator"),
                  conditions: form.get("conditions"),
                  sceneId: form.get("sceneId") || undefined,
                  confirmed: form.get("confirmed") === "on",
                });
                await load();
                setEditing(undefined);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {t("studio.title")}
              <input name="title" defaultValue={editing?.title} required />
            </label>
            <label>
              {t("studio.noteRole")}
              <select
                name="role"
                defaultValue={
                  editing
                    ? String(editing.metadata.role || noteRole(editing))
                    : tab === "media"
                      ? "material"
                      : tab
                }
              >
                <option value="setting">{t("studio.settingsTab")}</option>
                <option value="material">{t("studio.materialsTab")}</option>
                <option value="pending">{t("studio.pendingTab")}</option>
              </select>
            </label>
            <label>
              {t("studio.method")}
              <select name="kind" defaultValue={editing?.kind || "custom"}>
                {(
                  [
                    ["custom", "knowledge.catCustom"],
                    ["character", "knowledge.catCharacter"],
                    ["world_rule", "knowledge.catWorldRule"],
                    ["location", "knowledge.catLocation"],
                    ["theme", "knowledge.catTheme"],
                    ["timeline", "knowledge.catTimeline"],
                    ["research_note", "studio.materialsTab"],
                  ] as const
                ).map(([id, key]) => (
                  <option key={id} value={id}>
                    {t(key)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("studio.noteContent")}
              <textarea
                name="content"
                defaultValue={editing?.content}
                rows={5}
              />
            </label>
            <label>
              {t("studio.noteScope")}
              <select name="sceneId" defaultValue={editing?.sceneId || ""}>
                <option value="">{t("studio.wholeWorkScope")}</option>
                {scenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("studio.conditions")}
              <input
                name="conditions"
                defaultValue={String(editing?.metadata.conditions || "")}
              />
            </label>
            <label>
              {t("studio.source")}
              <input
                name="source"
                placeholder={t("studio.sourcePlaceholder")}
                defaultValue={String(editing?.metadata.source || "")}
              />
            </label>
            <label>
              {t("studio.sourceLocator")}
              <input
                name="sourceLocator"
                placeholder={t("studio.sourceLocatorPlaceholder")}
                defaultValue={String(editing?.metadata.sourceLocator || "")}
              />
            </label>
            <label className="studio-checkbox">
              <input
                name="confirmed"
                type="checkbox"
                defaultChecked={!editing || editing.status === "active"}
              />
              {t("studio.noteConfirmed")}
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
      )}
      {upload && (
        <StudioDialog
          title={t("knowledge.uploadModalTitle")}
          onClose={() => setUpload(false)}
        >
          <form
            className="studio-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const form = new FormData(e.currentTarget);
                const response = await fetch(
                  `/api/projects/${projectId}/assets`,
                  { method: "POST", body: form },
                );
                const data = await response.json();
                if (!response.ok || data.error)
                  throw new Error(data.error || t("studio.sendFailed"));
                await load();
                setUpload(false);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="studio-help">{t("studio.uploadHelp")}</p>
            <input type="file" name="file" required />
            {error && (
              <p role="alert" className="studio-alert">
                {error}
              </p>
            )}
            <button className="studio-button studio-primary" disabled={busy}>
              {t("knowledge.confirmUpload")}
            </button>
          </form>
        </StudioDialog>
      )}
    </section>
  );
}
