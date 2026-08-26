import type {
  Project,
  ProjectSummary,
  CreateProjectInput,
  UpdateProjectInput,
  Manuscript,
  CreateManuscriptInput,
  UpdateManuscriptInput,
  Scene,
  CreateSceneInput,
  UpdateSceneInput,
  SceneRevision,
  CreateSceneRevisionInput,
  WorkspaceSettings,
  ProjectSettings,
} from "../../shared/schemas/project";
import type {
  AgentThread,
  CreateAgentThreadInput,
  UpdateAgentThreadInput,
  AgentMessage,
  CreateAgentMessageInput,
  AgentRun,
  CreateAgentRunInput,
  UpdateAgentRunInput,
  AgentRunEvent,
  CreateAgentRunEventInput,
  AgentArtifact,
  CreateAgentArtifactInput,
  ContextReceipt,
  CreateContextReceiptInput,
  ContextReceiptItem,
  CreateContextReceiptItemInput,
} from "../../shared/schemas/agent";
import type {
  ChangeSet,
  CreateChangeSetInput,
  UpdateChangeSetInput,
  ChangeOperation,
  CreateChangeOperationInput,
  UpdateChangeOperationInput,
  ChangeReview,
  CreateChangeReviewInput,
  ChangeApplyAttempt,
  CreateChangeApplyAttemptInput,
} from "../../shared/schemas/changeset";
import type {
  KnowledgeNode,
  CreateKnowledgeNodeInput,
  UpdateKnowledgeNodeInput,
  KnowledgeAsset,
  CreateKnowledgeAssetInput,
  KnowledgeArtifact,
  CreateKnowledgeArtifactInput,
  KnowledgeChunk,
  CreateKnowledgeChunkInput,
  KnowledgeRelation,
  CreateKnowledgeRelationInput,
  KnowledgeRevision,
  CreateKnowledgeRevisionInput,
  MediaSegment,
  CreateMediaSegmentInput,
  IngestionJob,
  CreateIngestionJobInput,
  UpdateIngestionJobInput,
} from "../../shared/schemas/knowledge";
import type {
  MemoryEntry,
  CreateMemoryEntryInput,
  UpdateMemoryEntryInput,
  MemoryEvidence,
  CreateMemoryEvidenceInput,
  TasteEntry,
  CreateTasteEntryInput,
  UpdateTasteEntryInput,
  TasteEntryEvidence,
  CreateTasteEntryEvidenceInput,
  MemoryRevision,
  CreateMemoryRevisionInput,
} from "../../shared/schemas/memory";
import type {
  SkillDefinition,
  CreateSkillDefinitionInput,
  SkillVersion,
  CreateSkillVersionInput,
  SkillOverlay,
  CreateSkillOverlayInput,
  UpdateSkillOverlayInput,
  SkillInvocation,
  CreateSkillInvocationInput,
} from "../../shared/schemas/skills";
import type {
  LiteraryAnnotation,
  CreateLiteraryAnnotationInput,
  MarginNote,
  CreateMarginNoteInput,
  ImportJob,
  CreateImportJobInput,
} from "../../shared/schemas/literary";

export interface IProjectRepository {
  getWorkspaceSettings(): Promise<WorkspaceSettings>;
  updateWorkspaceSettings(input: Partial<WorkspaceSettings>): Promise<WorkspaceSettings>;

  createProject(input: CreateProjectInput): Promise<Project>;
  getProjectById(id: string): Promise<Project | null>;
  listProjects(options?: { includeArchived?: boolean }): Promise<Project[]>;
  listProjectsWithSummary(options?: { includeArchived?: boolean }): Promise<ProjectSummary[]>;
  updateProject(id: string, input: UpdateProjectInput): Promise<Project>;
  deleteProject(id: string): Promise<boolean>;

  getProjectSettings(projectId: string): Promise<ProjectSettings | null>;
  upsertProjectSettings(projectId: string, input: Partial<ProjectSettings>): Promise<ProjectSettings>;

  createManuscript(input: CreateManuscriptInput): Promise<Manuscript>;
  getManuscriptById(id: string): Promise<Manuscript | null>;
  listManuscriptsByProject(projectId: string): Promise<Manuscript[]>;
  updateManuscript(id: string, input: UpdateManuscriptInput): Promise<Manuscript>;
  deleteManuscript(id: string): Promise<boolean>;

  createScene(input: CreateSceneInput): Promise<Scene>;
  getSceneById(id: string): Promise<Scene | null>;
  listScenesByManuscript(manuscriptId: string): Promise<Scene[]>;
  listScenesByProject(projectId: string): Promise<Scene[]>;
  updateScene(id: string, input: UpdateSceneInput): Promise<Scene>;
  deleteScene(id: string): Promise<boolean>;

  createSceneRevision(input: CreateSceneRevisionInput): Promise<SceneRevision>;
  getSceneRevisionById(id: string): Promise<SceneRevision | null>;
  getLatestSceneRevision(sceneId: string): Promise<SceneRevision | null>;
  listSceneRevisions(sceneId: string): Promise<SceneRevision[]>;

  createLiteraryAnnotation(input: CreateLiteraryAnnotationInput): Promise<LiteraryAnnotation>;
  listLiteraryAnnotationsByScene(sceneId: string): Promise<LiteraryAnnotation[]>;
  listLiteraryAnnotationsByProject(projectId: string): Promise<LiteraryAnnotation[]>;
  deleteLiteraryAnnotation(id: string): Promise<boolean>;

  createMarginNote(input: CreateMarginNoteInput): Promise<MarginNote>;
  listMarginNotesByScene(sceneId: string): Promise<MarginNote[]>;
  deleteMarginNote(id: string): Promise<boolean>;

  createImportJob(input: CreateImportJobInput): Promise<ImportJob>;
  getImportJobById(id: string): Promise<ImportJob | null>;
}

export interface IAgentRepository {
  createThread(input: CreateAgentThreadInput): Promise<AgentThread>;
  getThreadById(id: string): Promise<AgentThread | null>;
  listThreadsByProject(projectId: string): Promise<AgentThread[]>;
  updateThread(id: string, input: UpdateAgentThreadInput): Promise<AgentThread>;
  deleteThread(id: string): Promise<boolean>;

  createMessage(input: CreateAgentMessageInput): Promise<AgentMessage>;
  listMessagesByThread(threadId: string): Promise<AgentMessage[]>;

  createRun(input: CreateAgentRunInput): Promise<AgentRun>;
  getRunById(id: string): Promise<AgentRun | null>;
  listRunsByThread(threadId: string): Promise<AgentRun[]>;
  updateRun(id: string, input: UpdateAgentRunInput): Promise<AgentRun>;

  createRunEvent(input: CreateAgentRunEventInput): Promise<AgentRunEvent>;
  listRunEvents(runId: string, afterSequence?: number): Promise<AgentRunEvent[]>;

  createArtifact(input: CreateAgentArtifactInput): Promise<AgentArtifact>;
  getArtifactById(id: string): Promise<AgentArtifact | null>;
  listArtifactsByRun(runId: string): Promise<AgentArtifact[]>;
  listArtifactsByThread(threadId: string): Promise<AgentArtifact[]>;

  createContextReceipt(input: CreateContextReceiptInput): Promise<ContextReceipt>;
  getContextReceiptByRunId(runId: string): Promise<ContextReceipt | null>;
  createContextReceiptItem(input: CreateContextReceiptItemInput): Promise<ContextReceiptItem>;
  listContextReceiptItems(contextReceiptId: string): Promise<ContextReceiptItem[]>;
}

export interface IChangeSetRepository {
  createChangeSet(input: CreateChangeSetInput): Promise<ChangeSet>;
  getChangeSetById(id: string): Promise<ChangeSet | null>;
  listChangeSetsByProject(projectId: string, status?: string): Promise<ChangeSet[]>;
  updateChangeSet(id: string, input: UpdateChangeSetInput): Promise<ChangeSet>;

  createOperation(input: CreateChangeOperationInput): Promise<ChangeOperation>;
  listOperationsByChangeSet(changeSetId: string): Promise<ChangeOperation[]>;
  updateOperation(id: string, input: UpdateChangeOperationInput): Promise<ChangeOperation>;

  createReview(input: CreateChangeReviewInput): Promise<ChangeReview>;
  listReviewsByChangeSet(changeSetId: string): Promise<ChangeReview[]>;

  createApplyAttempt(input: CreateChangeApplyAttemptInput): Promise<ChangeApplyAttempt>;
  listApplyAttempts(changeSetId: string): Promise<ChangeApplyAttempt[]>;
}

export interface IKnowledgeRepository {
  createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode>;
  getNodeById(id: string): Promise<KnowledgeNode | null>;
  listNodesByProject(projectId: string, kind?: string): Promise<KnowledgeNode[]>;
  updateNode(id: string, input: UpdateKnowledgeNodeInput): Promise<KnowledgeNode>;
  deleteNode(id: string): Promise<boolean>;

  createAsset(input: CreateKnowledgeAssetInput): Promise<KnowledgeAsset>;
  getAssetById(id: string): Promise<KnowledgeAsset | null>;
  getAssetBySha256(projectId: string, sha256: string): Promise<KnowledgeAsset | null>;
  listAssetsByProject(projectId: string): Promise<KnowledgeAsset[]>;
  updateAsset(id: string, input: { metadata?: Record<string, unknown> }): Promise<KnowledgeAsset>;

  createArtifact(input: CreateKnowledgeArtifactInput): Promise<KnowledgeArtifact>;
  listArtifactsByNode(nodeId: string): Promise<KnowledgeArtifact[]>;
  listArtifactsByAsset(assetId: string): Promise<KnowledgeArtifact[]>;

  createChunk(input: CreateKnowledgeChunkInput): Promise<KnowledgeChunk>;
  listChunksByNode(nodeId: string): Promise<KnowledgeChunk[]>;
  searchSimilarChunks(projectId: string, queryEmbedding: number[], limit?: number): Promise<{ chunk: KnowledgeChunk; distance: number }[]>;

  createRelation(input: CreateKnowledgeRelationInput): Promise<KnowledgeRelation>;
  listRelationsByProject(projectId: string): Promise<KnowledgeRelation[]>;
  listRelationsForNode(nodeId: string): Promise<KnowledgeRelation[]>;
  deleteRelation(id: string): Promise<boolean>;

  createRevision(input: CreateKnowledgeRevisionInput): Promise<KnowledgeRevision>;
  listRevisionsByNode(nodeId: string): Promise<KnowledgeRevision[]>;

  createMediaSegment(input: CreateMediaSegmentInput): Promise<MediaSegment>;
  getMediaSegmentById(id: string): Promise<MediaSegment | null>;
  listMediaSegmentsByAsset(assetId: string): Promise<MediaSegment[]>;

  createIngestionJob(input: CreateIngestionJobInput): Promise<IngestionJob>;
  getIngestionJobById(id: string): Promise<IngestionJob | null>;
  updateIngestionJob(id: string, input: UpdateIngestionJobInput): Promise<IngestionJob>;
}

export interface IMemoryRepository {
  createMemoryEntry(input: CreateMemoryEntryInput): Promise<MemoryEntry>;
  getMemoryEntryById(id: string): Promise<MemoryEntry | null>;
  listMemoryEntries(scope: string, scopeId?: string | null): Promise<MemoryEntry[]>;
  listMemoryEntriesByProject(projectId: string): Promise<MemoryEntry[]>;
  updateMemoryEntry(id: string, input: UpdateMemoryEntryInput): Promise<MemoryEntry>;
  deleteMemoryEntry(id: string): Promise<boolean>;
  searchSimilarMemory(queryEmbedding: number[], scope?: string, scopeId?: string | null, limit?: number): Promise<{ entry: MemoryEntry; distance: number }[]>;

  createMemoryEvidence(input: CreateMemoryEvidenceInput): Promise<MemoryEvidence>;
  listEvidenceForMemoryEntry(memoryEntryId: string): Promise<MemoryEvidence[]>;

  createTasteEntry(input: CreateTasteEntryInput): Promise<TasteEntry>;
  getTasteEntryById(id: string): Promise<TasteEntry | null>;
  listTasteEntries(scope: string, scopeId?: string | null): Promise<TasteEntry[]>;
  updateTasteEntry(id: string, input: UpdateTasteEntryInput): Promise<TasteEntry>;
  deleteTasteEntry(id: string): Promise<boolean>;

  createTasteEvidence(input: CreateTasteEntryEvidenceInput): Promise<TasteEntryEvidence>;
  listEvidenceForTasteEntry(tasteEntryId: string): Promise<TasteEntryEvidence[]>;

  createMemoryRevision(input: CreateMemoryRevisionInput): Promise<MemoryRevision>;
  listRevisionsForEntry(options: { memoryEntryId?: string; tasteEntryId?: string }): Promise<MemoryRevision[]>;
}

export interface ISkillRepository {
  upsertSkillDefinition(input: CreateSkillDefinitionInput): Promise<SkillDefinition>;
  getSkillDefinitionById(id: string): Promise<SkillDefinition | null>;
  listSkillDefinitions(category?: string): Promise<SkillDefinition[]>;

  createSkillVersion(input: CreateSkillVersionInput): Promise<SkillVersion>;
  getSkillVersion(skillId: string, version: string): Promise<SkillVersion | null>;
  listSkillVersions(skillId: string): Promise<SkillVersion[]>;

  upsertSkillOverlay(input: CreateSkillOverlayInput): Promise<SkillOverlay>;
  updateSkillOverlay(id: string, input: UpdateSkillOverlayInput): Promise<SkillOverlay>;
  getSkillOverlayById(id: string): Promise<SkillOverlay | null>;
  listSkillOverlays(projectId?: string | null): Promise<SkillOverlay[]>;

  createSkillInvocation(input: CreateSkillInvocationInput): Promise<SkillInvocation>;
  listSkillInvocationsByRun(runId: string): Promise<SkillInvocation[]>;
}

