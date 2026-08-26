import { db } from "../../db/client";
import { scenes, sceneRevisions, manuscripts } from "../../db/schema";
import { eq, desc, asc, and } from "drizzle-orm";
import type { Scene, SceneRevision, Manuscript, SceneRevisionChangeType } from "../../../shared/schemas/project";
import { computeTextChecksum } from "../../../shared/manuscript";
import crypto from "node:crypto";

export class RevisionConflictError extends Error {
  public sceneId: string;
  public expectedBaseRevisionId: string;
  public actualLatestRevisionId: string;

  constructor(sceneId: string, expected: string, actual: string) {
    super(`Revision conflict for scene ${sceneId}: expected base revision ${expected}, but latest revision is ${actual}`);
    this.name = "RevisionConflictError";
    this.sceneId = sceneId;
    this.expectedBaseRevisionId = expected;
    this.actualLatestRevisionId = actual;
  }
}

export class ManuscriptService {
  public async getSceneById(sceneId: string, projectId: string): Promise<Scene | null> {
    const [scene] = await db
      .select()
      .from(scenes)
      .where(and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId)));
    return (scene as unknown as Scene) ?? null;
  }

  public async getLatestSceneRevision(sceneId: string, projectId: string): Promise<SceneRevision | null> {
    const [rev] = await db
      .select()
      .from(sceneRevisions)
      .where(and(eq(sceneRevisions.sceneId, sceneId), eq(sceneRevisions.projectId, projectId)))
      .orderBy(desc(sceneRevisions.revisionNumber))
      .limit(1);
    return (rev as unknown as SceneRevision) ?? null;
  }

  public async listSceneRevisions(sceneId: string, projectId: string): Promise<SceneRevision[]> {
    const rows = await db
      .select()
      .from(sceneRevisions)
      .where(and(eq(sceneRevisions.sceneId, sceneId), eq(sceneRevisions.projectId, projectId)))
      .orderBy(desc(sceneRevisions.revisionNumber));
    return rows as unknown as SceneRevision[];
  }

  public async saveSceneContent(
    sceneId: string,
    projectId: string,
    content: string,
    options?: {
      expectedBaseRevisionId?: string;
      changeType?: SceneRevisionChangeType;
      description?: string;
      diffSummary?: Record<string, unknown>;
      appliedChangeSetId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{ scene: Scene; revision: SceneRevision }> {
    return await db.transaction(async (tx) => {
      // 1. Fetch current scene and lock row for update
      const [scene] = await tx
        .select()
        .from(scenes)
        .where(and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId)))
        .for("update");

      if (!scene) {
        throw new Error(`Scene not found: ${sceneId} in project ${projectId}`);
      }

      // 2. Fetch latest revision
      const [latestRev] = await tx
        .select()
        .from(sceneRevisions)
        .where(and(eq(sceneRevisions.sceneId, sceneId), eq(sceneRevisions.projectId, projectId)))
        .orderBy(desc(sceneRevisions.revisionNumber))
        .limit(1);

      // Check base revision conflict if expectedBaseRevisionId was specified
      if (options?.expectedBaseRevisionId && latestRev) {
        if (latestRev.id !== options.expectedBaseRevisionId) {
          throw new RevisionConflictError(
            sceneId,
            options.expectedBaseRevisionId,
            latestRev.id
          );
        }
      }

      const nextRevNum = (latestRev?.revisionNumber ?? 0) + 1;
      const newRevId = crypto.randomUUID();
      const characterCount = content.length;
      const checksum = computeTextChecksum(content);

      const [newRev] = await tx
        .insert(sceneRevisions)
        .values({
          id: newRevId,
          sceneId,
          projectId,
          revisionNumber: nextRevNum,
          changeType: options?.changeType ?? "manual_edit",
          description: options?.description ?? `Revision ${nextRevNum}`,
          content,
          characterCount,
          diffSummary: typeof options?.diffSummary === "string"
            ? options.diffSummary
            : options?.diffSummary
            ? JSON.stringify(options.diffSummary)
            : null,
          appliedChangeSetId: options?.appliedChangeSetId,
          metadata: {
            ...(options?.metadata ?? {}),
            checksum,
          },
        })
        .returning();

      const [updatedScene] = await tx
        .update(scenes)
        .set({
          content,
          characterCount,
          currentRevisionId: newRevId,
          updatedAt: new Date(),
        })
        .where(and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId)))
        .returning();

      return {
        scene: updatedScene as unknown as Scene,
        revision: newRev as unknown as SceneRevision,
      };
    });
  }

  public async restoreSceneRevision(
    sceneId: string,
    projectId: string,
    targetRevisionId: string
  ): Promise<{ scene: Scene; revision: SceneRevision }> {
    return await db.transaction(async (tx) => {
      // 1. Fetch target revision
      const [targetRev] = await tx
        .select()
        .from(sceneRevisions)
        .where(
          and(
            eq(sceneRevisions.id, targetRevisionId),
            eq(sceneRevisions.sceneId, sceneId),
            eq(sceneRevisions.projectId, projectId)
          )
        );

      if (!targetRev) {
        throw new Error(`Target revision not found: ${targetRevisionId}`);
      }

      // 2. Fetch current latest revision
      const [latestRev] = await tx
        .select()
        .from(sceneRevisions)
        .where(and(eq(sceneRevisions.sceneId, sceneId), eq(sceneRevisions.projectId, projectId)))
        .orderBy(desc(sceneRevisions.revisionNumber))
        .limit(1);

      const nextRevNum = (latestRev?.revisionNumber ?? 0) + 1;
      const newRevId = crypto.randomUUID();
      const checksum = computeTextChecksum(targetRev.content);

      // Create new rollback revision (never rewrite history)
      const [newRev] = await tx
        .insert(sceneRevisions)
        .values({
          id: newRevId,
          sceneId,
          projectId,
          revisionNumber: nextRevNum,
          changeType: "rollback",
          description: `Restored to Revision ${targetRev.revisionNumber}`,
          content: targetRev.content,
          characterCount: targetRev.content.length,
          rollbackSourceRevId: targetRevisionId,
          metadata: {
            restoredFromRevisionNumber: targetRev.revisionNumber,
            checksum,
          },
        })
        .returning();

      const [updatedScene] = await tx
        .update(scenes)
        .set({
          content: targetRev.content,
          characterCount: targetRev.content.length,
          currentRevisionId: newRevId,
          updatedAt: new Date(),
        })
        .where(and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId)))
        .returning();

      return {
        scene: updatedScene as unknown as Scene,
        revision: newRev as unknown as SceneRevision,
      };
    });
  }

  public async listManuscriptsWithScenes(projectId: string): Promise<Array<Manuscript & { scenes: Scene[] }>> {
    const msList = await db
      .select()
      .from(manuscripts)
      .where(eq(manuscripts.projectId, projectId))
      .orderBy(asc(manuscripts.order));

    const results: Array<Manuscript & { scenes: Scene[] }> = [];
    for (const ms of msList) {
      const scList = await db
        .select()
        .from(scenes)
        .where(and(eq(scenes.manuscriptId, ms.id), eq(scenes.projectId, projectId)))
        .orderBy(asc(scenes.order));

      results.push({
        ...(ms as unknown as Manuscript),
        scenes: scList as unknown as Scene[],
      });
    }

    return results;
  }
}

export const manuscriptService = new ManuscriptService();
