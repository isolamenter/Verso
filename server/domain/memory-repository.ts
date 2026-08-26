import { db } from "../db/client";
import {
  memoryEntries,
  memoryEvidence,
  tasteEntries,
  tasteEntryEvidence,
  memoryRevisions,
} from "../db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import type { IMemoryRepository } from "./types";
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
import crypto from "node:crypto";

export class MemoryRepository implements IMemoryRepository {
  async createMemoryEntry(input: CreateMemoryEntryInput): Promise<MemoryEntry> {
    const id = input.id ?? crypto.randomUUID();
    const [entry] = await db
      .insert(memoryEntries)
      .values({
        id,
        projectId: input.projectId,
        scope: input.scope,
        scopeId: input.scopeId,
        layer: input.layer,
        key: input.key,
        content: input.content,
        embedding: input.embedding,
        confidence: input.confidence ?? 1.0,
        status: input.status ?? "active",
        metadata: input.metadata ?? {},
      })
      .returning();
    return entry as unknown as MemoryEntry;
  }

  async getMemoryEntryById(id: string): Promise<MemoryEntry | null> {
    const [entry] = await db.select().from(memoryEntries).where(eq(memoryEntries.id, id));
    return (entry as unknown as MemoryEntry) ?? null;
  }

  async listMemoryEntries(scope: string, scopeId?: string | null): Promise<MemoryEntry[]> {
    if (scopeId !== undefined && scopeId !== null) {
      const rows = await db
        .select()
        .from(memoryEntries)
        .where(and(eq(memoryEntries.scope, scope), eq(memoryEntries.scopeId, scopeId)))
        .orderBy(desc(memoryEntries.updatedAt));
      return rows as unknown as MemoryEntry[];
    }
    const rows = await db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.scope, scope))
      .orderBy(desc(memoryEntries.updatedAt));
    return rows as unknown as MemoryEntry[];
  }

  async listMemoryEntriesByProject(projectId: string): Promise<MemoryEntry[]> {
    const rows = await db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.projectId, projectId))
      .orderBy(desc(memoryEntries.updatedAt));
    return rows as unknown as MemoryEntry[];
  }

  async updateMemoryEntry(id: string, input: UpdateMemoryEntryInput): Promise<MemoryEntry> {
    const [entry] = await db
      .update(memoryEntries)
      .set({
        content: input.content,
        confidence: input.confidence,
        status: input.status,
        metadata: input.metadata,
        updatedAt: new Date(),
      })
      .where(eq(memoryEntries.id, id))
      .returning();
    if (!entry) {
      throw new Error(`MemoryEntry not found: ${id}`);
    }
    return entry as unknown as MemoryEntry;
  }

  async deleteMemoryEntry(id: string): Promise<boolean> {
    const result = await db.delete(memoryEntries).where(eq(memoryEntries.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async searchSimilarMemory(
    queryEmbedding: number[],
    scope?: string,
    scopeId?: string | null,
    limit = 10
  ): Promise<{ entry: MemoryEntry; distance: number }[]> {
    const embeddingStr = `[${queryEmbedding.join(",")}]`;
    const conditions = [sql`${memoryEntries.embedding} IS NOT NULL`];

    if (scope) {
      conditions.push(eq(memoryEntries.scope, scope));
    }
    if (scopeId) {
      conditions.push(eq(memoryEntries.scopeId, scopeId));
    }

    const rows = await db
      .select({
        entry: memoryEntries,
        distance: sql<number>`${memoryEntries.embedding} <-> ${embeddingStr}::vector`.as("distance"),
      })
      .from(memoryEntries)
      .where(and(...conditions))
      .orderBy(sql`distance ASC`)
      .limit(limit);

    return rows.map((r) => ({
      entry: r.entry as unknown as MemoryEntry,
      distance: Number(r.distance),
    }));
  }

  async createMemoryEvidence(input: CreateMemoryEvidenceInput): Promise<MemoryEvidence> {
    const id = input.id ?? crypto.randomUUID();
    const [evidence] = await db
      .insert(memoryEvidence)
      .values({
        id,
        memoryEntryId: input.memoryEntryId,
        projectId: input.projectId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        quote: input.quote,
        weight: input.weight ?? 1.0,
        metadata: input.metadata ?? {},
      })
      .returning();
    return evidence as unknown as MemoryEvidence;
  }

  async listEvidenceForMemoryEntry(memoryEntryId: string): Promise<MemoryEvidence[]> {
    const rows = await db
      .select()
      .from(memoryEvidence)
      .where(eq(memoryEvidence.memoryEntryId, memoryEntryId))
      .orderBy(desc(memoryEvidence.createdAt));
    return rows as unknown as MemoryEvidence[];
  }

  async createTasteEntry(input: CreateTasteEntryInput): Promise<TasteEntry> {
    const id = input.id ?? crypto.randomUUID();
    const [entry] = await db
      .insert(tasteEntries)
      .values({
        id,
        scope: input.scope ?? "workspace",
        scopeId: input.scopeId,
        dimension: input.dimension,
        preference: input.preference,
        conditions: input.conditions ?? [],
        antiPreferences: input.antiPreferences ?? [],
        confidence: input.confidence ?? 0.5,
        status: input.status ?? "active",
        explicitness: input.explicitness ?? "inferred",
        supersedesId: input.supersedesId,
        metadata: input.metadata ?? {},
      })
      .returning();
    return entry as unknown as TasteEntry;
  }

  async getTasteEntryById(id: string): Promise<TasteEntry | null> {
    const [entry] = await db.select().from(tasteEntries).where(eq(tasteEntries.id, id));
    return (entry as unknown as TasteEntry) ?? null;
  }

  async listTasteEntries(scope: string, scopeId?: string | null): Promise<TasteEntry[]> {
    if (scopeId !== undefined && scopeId !== null) {
      const rows = await db
        .select()
        .from(tasteEntries)
        .where(and(eq(tasteEntries.scope, scope), eq(tasteEntries.scopeId, scopeId)))
        .orderBy(desc(tasteEntries.updatedAt));
      return rows as unknown as TasteEntry[];
    }
    const rows = await db
      .select()
      .from(tasteEntries)
      .where(eq(tasteEntries.scope, scope))
      .orderBy(desc(tasteEntries.updatedAt));
    return rows as unknown as TasteEntry[];
  }

  async updateTasteEntry(id: string, input: UpdateTasteEntryInput): Promise<TasteEntry> {
    const [entry] = await db
      .update(tasteEntries)
      .set({
        preference: input.preference,
        conditions: input.conditions,
        antiPreferences: input.antiPreferences,
        confidence: input.confidence,
        status: input.status,
        lastConfirmedAt: input.lastConfirmedAt ? new Date(input.lastConfirmedAt) : undefined,
        supersedesId: input.supersedesId,
        metadata: input.metadata,
        updatedAt: new Date(),
      })
      .where(eq(tasteEntries.id, id))
      .returning();
    if (!entry) {
      throw new Error(`TasteEntry not found: ${id}`);
    }
    return entry as unknown as TasteEntry;
  }

  async deleteTasteEntry(id: string): Promise<boolean> {
    const result = await db.delete(tasteEntries).where(eq(tasteEntries.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createTasteEvidence(input: CreateTasteEntryEvidenceInput): Promise<TasteEntryEvidence> {
    const id = input.id ?? crypto.randomUUID();
    const [evidence] = await db
      .insert(tasteEntryEvidence)
      .values({
        id,
        tasteEntryId: input.tasteEntryId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        quote: input.quote,
        weight: input.weight ?? 1.0,
        metadata: input.metadata ?? {},
      })
      .returning();
    return evidence as unknown as TasteEntryEvidence;
  }

  async listEvidenceForTasteEntry(tasteEntryId: string): Promise<TasteEntryEvidence[]> {
    const rows = await db
      .select()
      .from(tasteEntryEvidence)
      .where(eq(tasteEntryEvidence.tasteEntryId, tasteEntryId))
      .orderBy(desc(tasteEntryEvidence.createdAt));
    return rows as unknown as TasteEntryEvidence[];
  }

  async createMemoryRevision(input: CreateMemoryRevisionInput): Promise<MemoryRevision> {
    const id = input.id ?? crypto.randomUUID();
    let revisionNumber = input.revisionNumber;

    if (revisionNumber === undefined) {
      if (input.memoryEntryId) {
        const [latest] = await db
          .select()
          .from(memoryRevisions)
          .where(eq(memoryRevisions.memoryEntryId, input.memoryEntryId))
          .orderBy(desc(memoryRevisions.revisionNumber))
          .limit(1);
        revisionNumber = (latest?.revisionNumber ?? 0) + 1;
      } else if (input.tasteEntryId) {
        const [latest] = await db
          .select()
          .from(memoryRevisions)
          .where(eq(memoryRevisions.tasteEntryId, input.tasteEntryId))
          .orderBy(desc(memoryRevisions.revisionNumber))
          .limit(1);
        revisionNumber = (latest?.revisionNumber ?? 0) + 1;
      } else {
        revisionNumber = 1;
      }
    }

    const [rev] = await db
      .insert(memoryRevisions)
      .values({
        id,
        memoryEntryId: input.memoryEntryId,
        tasteEntryId: input.tasteEntryId,
        revisionNumber,
        previousState: input.previousState ?? {},
        newState: input.newState ?? {},
        changeReason: input.changeReason,
      })
      .returning();
    return rev as unknown as MemoryRevision;
  }

  async listRevisionsForEntry(options: {
    memoryEntryId?: string;
    tasteEntryId?: string;
  }): Promise<MemoryRevision[]> {
    if (options.memoryEntryId) {
      const rows = await db
        .select()
        .from(memoryRevisions)
        .where(eq(memoryRevisions.memoryEntryId, options.memoryEntryId))
        .orderBy(desc(memoryRevisions.revisionNumber));
      return rows as unknown as MemoryRevision[];
    }
    if (options.tasteEntryId) {
      const rows = await db
        .select()
        .from(memoryRevisions)
        .where(eq(memoryRevisions.tasteEntryId, options.tasteEntryId))
        .orderBy(desc(memoryRevisions.revisionNumber));
      return rows as unknown as MemoryRevision[];
    }
    return [];
  }
}

