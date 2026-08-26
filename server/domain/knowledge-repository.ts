import { db } from "../db/client";
import {
  knowledgeNodes,
  knowledgeAssets,
  knowledgeArtifacts,
  knowledgeChunks,
  knowledgeRelations,
  knowledgeRevisions,
  mediaSegments,
  ingestionJobs,
} from "../db/schema";
import { eq, and, or, sql, desc, asc } from "drizzle-orm";
import type { IKnowledgeRepository } from "./types";
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
import crypto from "node:crypto";

export class KnowledgeRepository implements IKnowledgeRepository {
  async createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    const id = input.id ?? crypto.randomUUID();
    const content = input.content ?? "";

    const [node] = await db
      .insert(knowledgeNodes)
      .values({
        id,
        projectId: input.projectId,
        manuscriptId: input.manuscriptId,
        sceneId: input.sceneId,
        parentId: input.parentId,
        kind: input.kind,
        title: input.title,
        content,
        summary: input.summary,
        authority: input.authority ?? "user_authored_locked",
        status: input.status ?? "active",
        isPinned: input.isPinned ?? false,
        language: input.language ?? "zh-CN",
        metadata: input.metadata ?? {},
      })
      .returning();

    // Create initial revision
    const revId = crypto.randomUUID();
    await db.insert(knowledgeRevisions).values({
      id: revId,
      nodeId: id,
      projectId: input.projectId,
      revisionNumber: 1,
      title: input.title,
      content,
      summary: input.summary,
      changeType: "initial",
      metadata: {},
    });

    return node as unknown as KnowledgeNode;
  }

  async getNodeById(id: string): Promise<KnowledgeNode | null> {
    const [node] = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.id, id));
    return (node as unknown as KnowledgeNode) ?? null;
  }

  async listNodesByProject(projectId: string, kind?: string): Promise<KnowledgeNode[]> {
    if (kind) {
      const rows = await db
        .select()
        .from(knowledgeNodes)
        .where(and(eq(knowledgeNodes.projectId, projectId), eq(knowledgeNodes.kind, kind)))
        .orderBy(desc(knowledgeNodes.isPinned), desc(knowledgeNodes.updatedAt));
      return rows as unknown as KnowledgeNode[];
    }
    const rows = await db
      .select()
      .from(knowledgeNodes)
      .where(eq(knowledgeNodes.projectId, projectId))
      .orderBy(desc(knowledgeNodes.isPinned), desc(knowledgeNodes.updatedAt));
    return rows as unknown as KnowledgeNode[];
  }

  async updateNode(id: string, input: UpdateKnowledgeNodeInput): Promise<KnowledgeNode> {
    const [node] = await db
      .update(knowledgeNodes)
      .set({
        title: input.title,
        content: input.content,
        summary: input.summary,
        authority: input.authority,
        status: input.status,
        isPinned: input.isPinned,
        language: input.language,
        parentId: input.parentId,
        metadata: input.metadata,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeNodes.id, id))
      .returning();
    if (!node) {
      throw new Error(`KnowledgeNode not found: ${id}`);
    }
    return node as unknown as KnowledgeNode;
  }

  async deleteNode(id: string): Promise<boolean> {
    const result = await db.delete(knowledgeNodes).where(eq(knowledgeNodes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createAsset(input: CreateKnowledgeAssetInput): Promise<KnowledgeAsset> {
    const id = input.id ?? crypto.randomUUID();
    const [asset] = await db
      .insert(knowledgeAssets)
      .values({
        id,
        projectId: input.projectId,
        nodeId: input.nodeId,
        sha256: input.sha256,
        storagePath: input.storagePath,
        originalFileName: input.originalFileName,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        metadata: input.metadata ?? {},
      })
      .returning();
    return asset as unknown as KnowledgeAsset;
  }

  async getAssetById(id: string): Promise<KnowledgeAsset | null> {
    const [asset] = await db.select().from(knowledgeAssets).where(eq(knowledgeAssets.id, id));
    return (asset as unknown as KnowledgeAsset) ?? null;
  }

  async getAssetBySha256(projectId: string, sha256: string): Promise<KnowledgeAsset | null> {
    const [asset] = await db
      .select()
      .from(knowledgeAssets)
      .where(and(eq(knowledgeAssets.projectId, projectId), eq(knowledgeAssets.sha256, sha256)));
    return (asset as unknown as KnowledgeAsset) ?? null;
  }

  async listAssetsByProject(projectId: string): Promise<KnowledgeAsset[]> {
    const rows = await db
      .select()
      .from(knowledgeAssets)
      .where(eq(knowledgeAssets.projectId, projectId))
      .orderBy(desc(knowledgeAssets.createdAt));
    return rows as unknown as KnowledgeAsset[];
  }

  async updateAsset(id: string, input: { metadata?: Record<string, unknown> }): Promise<KnowledgeAsset> {
    const [asset] = await db
      .update(knowledgeAssets)
      .set({
        metadata: input.metadata,
      })
      .where(eq(knowledgeAssets.id, id))
      .returning();
    if (!asset) {
      throw new Error(`KnowledgeAsset not found: ${id}`);
    }
    return asset as unknown as KnowledgeAsset;
  }

  async listArtifactsByAsset(assetId: string): Promise<KnowledgeArtifact[]> {
    const rows = await db
      .select()
      .from(knowledgeArtifacts)
      .where(eq(knowledgeArtifacts.assetId, assetId))
      .orderBy(desc(knowledgeArtifacts.createdAt));
    return rows as unknown as KnowledgeArtifact[];
  }

  async createArtifact(input: CreateKnowledgeArtifactInput): Promise<KnowledgeArtifact> {
    const id = input.id ?? crypto.randomUUID();
    const [artifact] = await db
      .insert(knowledgeArtifacts)
      .values({
        id,
        projectId: input.projectId,
        nodeId: input.nodeId,
        assetId: input.assetId,
        layer: input.layer,
        generatorType: input.generatorType,
        generatorModel: input.generatorModel,
        generatorVersion: input.generatorVersion,
        content: input.content,
        structuredData: input.structuredData ?? {},
        confidence: input.confidence,
        isUserCorrected: input.isUserCorrected ?? false,
        metadata: input.metadata ?? {},
      })
      .returning();
    return artifact as unknown as KnowledgeArtifact;
  }

  async listArtifactsByNode(nodeId: string): Promise<KnowledgeArtifact[]> {
    const rows = await db
      .select()
      .from(knowledgeArtifacts)
      .where(eq(knowledgeArtifacts.nodeId, nodeId))
      .orderBy(asc(knowledgeArtifacts.createdAt));
    return rows as unknown as KnowledgeArtifact[];
  }

  async createChunk(input: CreateKnowledgeChunkInput): Promise<KnowledgeChunk> {
    const id = input.id ?? crypto.randomUUID();
    const [chunk] = await db
      .insert(knowledgeChunks)
      .values({
        id,
        projectId: input.projectId,
        nodeId: input.nodeId,
        artifactId: input.artifactId,
        chunkIndex: input.chunkIndex,
        content: input.content,
        embedding: input.embedding,
        sourceLocator: input.sourceLocator ?? {},
        metadata: input.metadata ?? {},
      })
      .returning();
    return chunk as unknown as KnowledgeChunk;
  }

  async listChunksByNode(nodeId: string): Promise<KnowledgeChunk[]> {
    const rows = await db
      .select()
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.nodeId, nodeId))
      .orderBy(asc(knowledgeChunks.chunkIndex));
    return rows as unknown as KnowledgeChunk[];
  }

  async searchSimilarChunks(
    projectId: string,
    queryEmbedding: number[],
    limit = 10
  ): Promise<{ chunk: KnowledgeChunk; distance: number }[]> {
    const embeddingStr = `[${queryEmbedding.join(",")}]`;
    const rows = await db
      .select({
        chunk: knowledgeChunks,
        distance: sql<number>`${knowledgeChunks.embedding} <-> ${embeddingStr}::vector`.as("distance"),
      })
      .from(knowledgeChunks)
      .where(and(eq(knowledgeChunks.projectId, projectId), sql`${knowledgeChunks.embedding} IS NOT NULL`))
      .orderBy(sql`distance ASC`)
      .limit(limit);

    return rows.map((r) => ({
      chunk: r.chunk as unknown as KnowledgeChunk,
      distance: Number(r.distance),
    }));
  }

  async createRelation(input: CreateKnowledgeRelationInput): Promise<KnowledgeRelation> {
    const id = input.id ?? crypto.randomUUID();
    const [relation] = await db
      .insert(knowledgeRelations)
      .values({
        id,
        projectId: input.projectId,
        sourceNodeId: input.sourceNodeId,
        targetNodeId: input.targetNodeId,
        relationType: input.relationType,
        description: input.description,
        confidence: input.confidence,
        isUserConfirmed: input.isUserConfirmed ?? false,
        metadata: input.metadata ?? {},
      })
      .returning();
    return relation as unknown as KnowledgeRelation;
  }

  async listRelationsByProject(projectId: string): Promise<KnowledgeRelation[]> {
    const rows = await db
      .select()
      .from(knowledgeRelations)
      .where(eq(knowledgeRelations.projectId, projectId))
      .orderBy(desc(knowledgeRelations.createdAt));
    return rows as unknown as KnowledgeRelation[];
  }

  async listRelationsForNode(nodeId: string): Promise<KnowledgeRelation[]> {
    const rows = await db
      .select()
      .from(knowledgeRelations)
      .where(
        or(
          eq(knowledgeRelations.sourceNodeId, nodeId),
          eq(knowledgeRelations.targetNodeId, nodeId)
        )
      )
      .orderBy(desc(knowledgeRelations.createdAt));
    return rows as unknown as KnowledgeRelation[];
  }

  async deleteRelation(id: string): Promise<boolean> {
    const result = await db.delete(knowledgeRelations).where(eq(knowledgeRelations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createRevision(input: CreateKnowledgeRevisionInput): Promise<KnowledgeRevision> {
    const id = input.id ?? crypto.randomUUID();
    let revisionNumber = input.revisionNumber;

    if (revisionNumber === undefined) {
      const [latest] = await db
        .select()
        .from(knowledgeRevisions)
        .where(eq(knowledgeRevisions.nodeId, input.nodeId))
        .orderBy(desc(knowledgeRevisions.revisionNumber))
        .limit(1);
      revisionNumber = (latest?.revisionNumber ?? 0) + 1;
    }

    const [rev] = await db
      .insert(knowledgeRevisions)
      .values({
        id,
        nodeId: input.nodeId,
        projectId: input.projectId,
        revisionNumber,
        title: input.title,
        content: input.content,
        summary: input.summary,
        changeType: input.changeType,
        metadata: input.metadata ?? {},
      })
      .returning();
    return rev as unknown as KnowledgeRevision;
  }

  async listRevisionsByNode(nodeId: string): Promise<KnowledgeRevision[]> {
    const rows = await db
      .select()
      .from(knowledgeRevisions)
      .where(eq(knowledgeRevisions.nodeId, nodeId))
      .orderBy(desc(knowledgeRevisions.revisionNumber));
    return rows as unknown as KnowledgeRevision[];
  }

  async createMediaSegment(input: CreateMediaSegmentInput): Promise<MediaSegment> {
    const id = input.id ?? crypto.randomUUID();
    const [segment] = await db
      .insert(mediaSegments)
      .values({
        id,
        assetId: input.assetId,
        projectId: input.projectId,
        segmentType: input.segmentType,
        startTimeMs: input.startTimeMs,
        endTimeMs: input.endTimeMs,
        pageNumber: input.pageNumber,
        storagePath: input.storagePath,
        transcript: input.transcript,
        visualDescription: input.visualDescription,
        speakers: input.speakers ?? [],
        metadata: input.metadata ?? {},
      })
      .returning();
    return segment as unknown as MediaSegment;
  }

  async getMediaSegmentById(id: string): Promise<MediaSegment | null> {
    const [segment] = await db.select().from(mediaSegments).where(eq(mediaSegments.id, id));
    return (segment as unknown as MediaSegment) ?? null;
  }

  async listMediaSegmentsByAsset(assetId: string): Promise<MediaSegment[]> {
    const rows = await db
      .select()
      .from(mediaSegments)
      .where(eq(mediaSegments.assetId, assetId))
      .orderBy(asc(mediaSegments.startTimeMs), asc(mediaSegments.pageNumber));
    return rows as unknown as MediaSegment[];
  }

  async createIngestionJob(input: CreateIngestionJobInput): Promise<IngestionJob> {
    const id = input.id ?? crypto.randomUUID();
    const [job] = await db
      .insert(ingestionJobs)
      .values({
        id,
        projectId: input.projectId,
        assetId: input.assetId,
        nodeId: input.nodeId,
        jobType: input.jobType,
        status: input.status ?? "pending",
        pgBossJobId: input.pgBossJobId,
        metadata: input.metadata ?? {},
      })
      .returning();
    return job as unknown as IngestionJob;
  }

  async getIngestionJobById(id: string): Promise<IngestionJob | null> {
    const [job] = await db.select().from(ingestionJobs).where(eq(ingestionJobs.id, id));
    return (job as unknown as IngestionJob) ?? null;
  }

  async updateIngestionJob(id: string, input: UpdateIngestionJobInput): Promise<IngestionJob> {
    const [job] = await db
      .update(ingestionJobs)
      .set({
        status: input.status,
        progress: input.progress,
        error: input.error,
        startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
        completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
        metadata: input.metadata,
        updatedAt: new Date(),
      })
      .where(eq(ingestionJobs.id, id))
      .returning();
    if (!job) {
      throw new Error(`IngestionJob not found: ${id}`);
    }
    return job as unknown as IngestionJob;
  }
}

