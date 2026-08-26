import { db } from "../db/client";
import {
  skillDefinitions,
  skillVersions,
  skillOverlays,
  skillInvocations,
} from "../db/schema";
import { eq, and, desc, asc, isNull } from "drizzle-orm";
import type { ISkillRepository } from "./types";
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
import crypto from "node:crypto";

export class SkillRepository implements ISkillRepository {
  async upsertSkillDefinition(input: CreateSkillDefinitionInput): Promise<SkillDefinition> {
    const [def] = await db
      .insert(skillDefinitions)
      .values({
        id: input.id,
        name: input.name,
        description: input.description,
        category: input.category,
        isBuiltIn: input.isBuiltIn ?? true,
        metadata: input.metadata ?? {},
      })
      .onConflictDoUpdate({
        target: skillDefinitions.id,
        set: {
          name: input.name,
          description: input.description,
          category: input.category,
          isBuiltIn: input.isBuiltIn ?? true,
          metadata: input.metadata ?? {},
          updatedAt: new Date(),
        },
      })
      .returning();
    return def as unknown as SkillDefinition;
  }

  async getSkillDefinitionById(id: string): Promise<SkillDefinition | null> {
    const [def] = await db.select().from(skillDefinitions).where(eq(skillDefinitions.id, id));
    return (def as unknown as SkillDefinition) ?? null;
  }

  async listSkillDefinitions(category?: string): Promise<SkillDefinition[]> {
    if (category) {
      const rows = await db
        .select()
        .from(skillDefinitions)
        .where(eq(skillDefinitions.category, category))
        .orderBy(asc(skillDefinitions.id));
      return rows as unknown as SkillDefinition[];
    }
    const rows = await db.select().from(skillDefinitions).orderBy(asc(skillDefinitions.id));
    return rows as unknown as SkillDefinition[];
  }

  async createSkillVersion(input: CreateSkillVersionInput): Promise<SkillVersion> {
    const id = input.id ?? crypto.randomUUID();
    const [version] = await db
      .insert(skillVersions)
      .values({
        id,
        skillId: input.skillId,
        version: input.version,
        manifest: input.manifest ?? {},
        instructions: input.instructions,
        outputSchema: input.outputSchema ?? {},
        contextPolicy: input.contextPolicy ?? {},
        metadata: input.metadata ?? {},
      })
      .returning();
    return version as unknown as SkillVersion;
  }

  async getSkillVersion(skillId: string, version: string): Promise<SkillVersion | null> {
    const [ver] = await db
      .select()
      .from(skillVersions)
      .where(and(eq(skillVersions.skillId, skillId), eq(skillVersions.version, version)));
    return (ver as unknown as SkillVersion) ?? null;
  }

  async listSkillVersions(skillId: string): Promise<SkillVersion[]> {
    const rows = await db
      .select()
      .from(skillVersions)
      .where(eq(skillVersions.skillId, skillId))
      .orderBy(desc(skillVersions.version));
    return rows as unknown as SkillVersion[];
  }

  async upsertSkillOverlay(input: CreateSkillOverlayInput): Promise<SkillOverlay> {
    const id = input.id ?? crypto.randomUUID();
    const [overlay] = await db
      .insert(skillOverlays)
      .values({
        id,
        skillId: input.skillId,
        projectId: input.projectId,
        customName: input.customName,
        focusAreas: input.focusAreas ?? [],
        avoidAreas: input.avoidAreas ?? [],
        preferredStrength: input.preferredStrength,
        customInstructions: input.customInstructions,
        isEnabled: input.isEnabled ?? true,
        metadata: input.metadata ?? {},
      })
      .returning();
    return overlay as unknown as SkillOverlay;
  }

  async updateSkillOverlay(id: string, input: UpdateSkillOverlayInput): Promise<SkillOverlay> {
    const [overlay] = await db
      .update(skillOverlays)
      .set({
        customName: input.customName,
        focusAreas: input.focusAreas,
        avoidAreas: input.avoidAreas,
        preferredStrength: input.preferredStrength,
        customInstructions: input.customInstructions,
        isEnabled: input.isEnabled,
        metadata: input.metadata,
        updatedAt: new Date(),
      })
      .where(eq(skillOverlays.id, id))
      .returning();
    if (!overlay) {
      throw new Error(`SkillOverlay not found: ${id}`);
    }
    return overlay as unknown as SkillOverlay;
  }

  async getSkillOverlayById(id: string): Promise<SkillOverlay | null> {
    const [overlay] = await db.select().from(skillOverlays).where(eq(skillOverlays.id, id));
    return (overlay as unknown as SkillOverlay) ?? null;
  }

  async listSkillOverlays(projectId?: string | null): Promise<SkillOverlay[]> {
    if (projectId) {
      const rows = await db
        .select()
        .from(skillOverlays)
        .where(eq(skillOverlays.projectId, projectId))
        .orderBy(desc(skillOverlays.updatedAt));
      return rows as unknown as SkillOverlay[];
    }
    const rows = await db
      .select()
      .from(skillOverlays)
      .where(isNull(skillOverlays.projectId))
      .orderBy(desc(skillOverlays.updatedAt));
    return rows as unknown as SkillOverlay[];
  }

  async createSkillInvocation(input: CreateSkillInvocationInput): Promise<SkillInvocation> {
    const id = input.id ?? crypto.randomUUID();
    const [invocation] = await db
      .insert(skillInvocations)
      .values({
        id,
        runId: input.runId,
        skillId: input.skillId,
        skillVersionId: input.skillVersionId,
        overlayId: input.overlayId,
        invocationMode: input.invocationMode,
        resolvedParameters: input.resolvedParameters ?? {},
      })
      .returning();
    return invocation as unknown as SkillInvocation;
  }

  async listSkillInvocationsByRun(runId: string): Promise<SkillInvocation[]> {
    const rows = await db
      .select()
      .from(skillInvocations)
      .where(eq(skillInvocations.runId, runId))
      .orderBy(asc(skillInvocations.createdAt));
    return rows as unknown as SkillInvocation[];
  }
}

