import { db } from "../db/client";
import {
  scenes,
  sceneRevisions,
  changeSets,
  changeOperations,
  changeApplyAttempts,
} from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { SceneRevision } from "../../shared/schemas/project";
import type { ChangeApplyAttempt } from "../../shared/schemas/changeset";
import crypto from "node:crypto";

export type DbClient = typeof db;

export async function withTransaction<T>(
  callback: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return await db.transaction(callback);
}

export interface CreateSceneRevisionAtomicParams {
  sceneId: string;
  projectId: string;
  changeType: "manual_edit" | "ai_accepted" | "cut" | "checkpoint" | "rollback" | "pre_apply" | "initial";
  description: string;
  content: string;
  diffSummary?: string;
  rollbackSourceRevId?: string;
  appliedChangeSetId?: string;
  metadata?: Record<string, unknown>;
}

export async function createSceneRevisionAtomic(
  params: CreateSceneRevisionAtomicParams,
  client: DbClient = db
): Promise<SceneRevision> {
  return await client.transaction(async (tx) => {
    // 1. Fetch current scene and calculate next revision number
    const [scene] = await tx
      .select()
      .from(scenes)
      .where(and(eq(scenes.id, params.sceneId), eq(scenes.projectId, params.projectId)))
      .for("update");

    if (!scene) {
      throw new Error(`Scene not found: ${params.sceneId} in project ${params.projectId}`);
    }

    const [latestRev] = await tx
      .select()
      .from(sceneRevisions)
      .where(eq(sceneRevisions.sceneId, params.sceneId))
      .orderBy(sql`${sceneRevisions.revisionNumber} DESC`)
      .limit(1);

    const nextRevNumber = (latestRev?.revisionNumber ?? 0) + 1;
    const revisionId = crypto.randomUUID();
    const characterCount = params.content.length;

    // 2. Insert new revision record
    const [newRevision] = await tx
      .insert(sceneRevisions)
      .values({
        id: revisionId,
        sceneId: params.sceneId,
        projectId: params.projectId,
        revisionNumber: nextRevNumber,
        changeType: params.changeType,
        description: params.description,
        content: params.content,
        diffSummary: params.diffSummary,
        characterCount,
        rollbackSourceRevId: params.rollbackSourceRevId,
        appliedChangeSetId: params.appliedChangeSetId,
        metadata: params.metadata ?? {},
      })
      .returning();

    // 3. Update scene with new content and currentRevisionId
    await tx
      .update(scenes)
      .set({
        content: params.content,
        characterCount,
        currentRevisionId: revisionId,
        updatedAt: new Date(),
      })
      .where(eq(scenes.id, params.sceneId));

    return newRevision as unknown as SceneRevision;
  });
}

export interface ApplyChangeSetAtomicParams {
  changeSetId: string;
  projectId: string;
}

export async function applyChangeSetAtomic(
  params: ApplyChangeSetAtomicParams,
  client: DbClient = db
): Promise<ChangeApplyAttempt> {
  try {
    return await client.transaction(async (tx) => {
      const [changeSet] = await tx
        .select()
        .from(changeSets)
        .where(and(eq(changeSets.id, params.changeSetId), eq(changeSets.projectId, params.projectId)))
        .for("update");

      if (!changeSet) {
        throw new Error(`ChangeSet not found: ${params.changeSetId}`);
      }

      const operations = await tx
        .select()
        .from(changeOperations)
        .where(eq(changeOperations.changeSetId, params.changeSetId))
        .orderBy(changeOperations.sequenceNumber);

      const resultingRevisionMap: Record<string, string> = {};
      const applyAttemptId = crypto.randomUUID();

      // Process approved operations
      for (const op of operations) {
        if (op.status === "rejected") {
          continue;
        }

        if (op.targetType === "scene" && op.replacementContent !== null) {
          const [targetScene] = await tx
            .select()
            .from(scenes)
            .where(eq(scenes.id, op.targetId))
            .for("update");

          if (!targetScene) {
            throw new Error(`Target scene not found: ${op.targetId}`);
          }

          // Verify base revision if specified
          if (op.baseRevisionId && targetScene.currentRevisionId && targetScene.currentRevisionId !== op.baseRevisionId) {
            throw new Error(`Revision conflict on scene ${op.targetId}: expected ${op.baseRevisionId}, current is ${targetScene.currentRevisionId}`);
          }

          // Create new revision for the applied scene
          const revId = crypto.randomUUID();
          const [latestRev] = await tx
            .select()
            .from(sceneRevisions)
            .where(eq(sceneRevisions.sceneId, op.targetId))
            .orderBy(sql`${sceneRevisions.revisionNumber} DESC`)
            .limit(1);

          const nextRevNumber = (latestRev?.revisionNumber ?? 0) + 1;
          const newContent = op.replacementContent ?? targetScene.content;

          await tx.insert(sceneRevisions).values({
            id: revId,
            sceneId: op.targetId,
            projectId: params.projectId,
            revisionNumber: nextRevNumber,
            changeType: "ai_accepted",
            description: `Applied ChangeSet: ${changeSet.title} (Op #${op.sequenceNumber})`,
            content: newContent,
            diffSummary: op.literaryTradeoff,
            characterCount: newContent.length,
            appliedChangeSetId: params.changeSetId,
            metadata: {},
          });

          await tx
            .update(scenes)
            .set({
              content: newContent,
              characterCount: newContent.length,
              currentRevisionId: revId,
              updatedAt: new Date(),
            })
            .where(eq(scenes.id, op.targetId));

          resultingRevisionMap[op.targetId] = revId;

          // Update operation status to applied
          await tx
            .update(changeOperations)
            .set({ status: "applied" })
            .where(eq(changeOperations.id, op.id));
        }
      }

      // Mark ChangeSet as applied
      await tx
        .update(changeSets)
        .set({
          status: "applied",
          appliedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(changeSets.id, params.changeSetId));

      const [attempt] = await tx
        .insert(changeApplyAttempts)
        .values({
          id: applyAttemptId,
          changeSetId: params.changeSetId,
          projectId: params.projectId,
          status: "success",
          resultingRevisionMap,
          attemptedAt: new Date(),
        })
        .returning();

      return attempt as unknown as ChangeApplyAttempt;
    });
  } catch (err) {
    // Record failed attempt and mark ChangeSet as needs_rebase
    const applyAttemptId = crypto.randomUUID();
    const errorMessage = err instanceof Error ? err.message : String(err);
    try {
      await client.insert(changeApplyAttempts).values({
        id: applyAttemptId,
        changeSetId: params.changeSetId,
        projectId: params.projectId,
        status: "conflict",
        resultingRevisionMap: {},
        error: errorMessage,
        attemptedAt: new Date(),
      });

      await client
        .update(changeSets)
        .set({
          status: "needs_rebase",
          updatedAt: new Date(),
        })
        .where(eq(changeSets.id, params.changeSetId));
    } catch {
      // ignore
    }
    throw err;
  }
}

