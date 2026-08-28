import { db } from "../../db/client";
import {
  scenes,
  sceneRevisions,
  knowledgeNodes,
  knowledgeRevisions,
  changeOperations,
  changeSets,
} from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { changeSetRepository } from "../index";
import {
  isTipTapDocJson,
  plainTextToTipTapDoc,
  findBestAnchorMatch,
  applyPlainTextPatchToTipTapDoc,
  computeTextChecksum,
  extractPlainText,
} from "../../../shared/manuscript";
import type {
  ChangeSet,
  CreateChangeSetInput,
  ChangeOperation,
  CreateChangeOperationInput,
  ChangeApplyAttempt,
} from "../../../shared/schemas/changeset";
import crypto from "node:crypto";

export interface ValidationDetail {
  isValid: boolean;
  status: "proposed" | "conflict" | "approved";
  reason?: string;
  matchedRange?: { from: number; to: number };
}

export class ChangeSetService {
  /**
   * Creates a ChangeSet and its associated operations atomically.
   */
  public async createChangeSetWithOperations(
    input: CreateChangeSetInput,
    operations: Array<Omit<CreateChangeOperationInput, "changeSetId" | "projectId">>
  ): Promise<{ changeSet: ChangeSet; operations: ChangeOperation[] }> {
    const changeSet = await changeSetRepository.createChangeSet({
      ...input,
      status: "proposed",
    });

    const createdOps: ChangeOperation[] = [];
    let seq = 1;
    for (const op of operations) {
      const createdOp = await changeSetRepository.createOperation({
        ...op,
        changeSetId: changeSet.id,
        projectId: input.projectId,
        sequenceNumber: seq++,
        status: "proposed",
      });
      createdOps.push(createdOp);
    }

    // Validate the operations immediately
    await this.validateChangeSet(changeSet.id, input.projectId);

    const refreshedChangeSet = await changeSetRepository.getChangeSetById(changeSet.id);
    const refreshedOps = await changeSetRepository.listOperationsByChangeSet(changeSet.id);

    return {
      changeSet: refreshedChangeSet ?? changeSet,
      operations: refreshedOps,
    };
  }

  /**
   * Validates all operations in a ChangeSet against current project state.
   */
  public async validateChangeSet(
    changeSetId: string,
    projectId: string
  ): Promise<{ isValid: boolean; conflictCount: number }> {
    const ops = await changeSetRepository.listOperationsByChangeSet(changeSetId);
    let conflictCount = 0;

    for (const op of ops) {
      const val = await this.validateOperation(op, projectId);
      if (!val.isValid) {
        conflictCount++;
        await changeSetRepository.updateOperation(op.id, {
          status: "conflict",
          validationResult: { error: val.reason },
        });
      } else {
        await changeSetRepository.updateOperation(op.id, {
          status: "proposed",
          validationResult: { valid: true, matchedRange: val.matchedRange },
        });
      }
    }

    const newStatus = conflictCount > 0 ? "needs_rebase" : "proposed";
    await changeSetRepository.updateChangeSet(changeSetId, {
      status: newStatus,
    });

    return {
      isValid: conflictCount === 0,
      conflictCount,
    };
  }

  private async validateOperation(
    op: ChangeOperation,
    projectId: string
  ): Promise<ValidationDetail> {
    if (op.targetType === "scene") {
      const [scene] = await db
        .select()
        .from(scenes)
        .where(and(eq(scenes.id, op.targetId), eq(scenes.projectId, projectId)));

      if (!scene) {
        return { isValid: false, status: "conflict", reason: "Target scene does not exist in project" };
      }

      // Check base revision
      if (op.baseRevisionId && scene.currentRevisionId && op.baseRevisionId !== scene.currentRevisionId) {
        return {
          isValid: false,
          status: "conflict",
          reason: `Stale base revision: expected ${op.baseRevisionId}, current is ${scene.currentRevisionId}`,
        };
      }

      // If text replacement/insertion/deletion, test anchor matching
      if (
        op.operationType === "replace_text_range" ||
        op.operationType === "delete_text_range" ||
        op.operationType === "insert_text"
      ) {
        if (op.quote) {
          const plainText = extractPlainText(scene.content);
          const anchorResult = findBestAnchorMatch({
            plainText,
            quote: op.quote,
            prefixAnchor: op.prefixAnchor || undefined,
            suffixAnchor: op.suffixAnchor || undefined,
          });

          if (!anchorResult.found) {
            return {
              isValid: false,
              status: "conflict",
              reason: anchorResult.isAmbiguous
                ? `Ambiguous quote match: multiple occurrences found for "${op.quote}"`
                : `Quote not found in scene content: "${op.quote}"`,
            };
          }

          // Test patch application
          const patchRes = applyPlainTextPatchToTipTapDoc(scene.content, {
            quote: op.quote,
            prefixAnchor: op.prefixAnchor || undefined,
            suffixAnchor: op.suffixAnchor || undefined,
            replacementContent: op.replacementContent || "",
          });

          if (!patchRes.success) {
            return {
              isValid: false,
              status: "conflict",
              reason: patchRes.error || "Failed to generate valid patch AST",
            };
          }

          return {
            isValid: true,
            status: "proposed",
            matchedRange: anchorResult.range,
          };
        }
      }

      if (op.operationType === "split_scene") {
        const payload = op.structuredPayload as Record<string, any>;
        const splits = payload?.splits;
        if (!Array.isArray(splits) || splits.length < 2) {
          return {
            isValid: false,
            status: "conflict",
            reason: "Split scene operation requires at least 2 split targets in payload",
          };
        }
        return { isValid: true, status: "proposed" };
      }

      return { isValid: true, status: "proposed" };
    }

    if (op.targetType === "knowledge_node") {
      if (op.operationType === "update_knowledge" || op.operationType === "archive_knowledge") {
        const [node] = await db
          .select()
          .from(knowledgeNodes)
          .where(and(eq(knowledgeNodes.id, op.targetId), eq(knowledgeNodes.projectId, projectId)));

        if (!node) {
          return { isValid: false, status: "conflict", reason: "Target knowledge node does not exist in project" };
        }
      }
      return { isValid: true, status: "proposed" };
    }

    return { isValid: true, status: "proposed" };
  }

  /**
   * Creates a derived ChangeSet from a subset of approved operation IDs (Partial Approval).
   */
  public async createDerivedChangeSet(
    parentChangeSetId: string,
    approvedOperationIds: string[],
    projectId: string
  ): Promise<{ derivedChangeSet: ChangeSet; operations: ChangeOperation[] }> {
    const parent = await changeSetRepository.getChangeSetById(parentChangeSetId);
    if (!parent || parent.projectId !== projectId) {
      throw new Error(`Parent ChangeSet not found: ${parentChangeSetId}`);
    }

    const allOps = await changeSetRepository.listOperationsByChangeSet(parentChangeSetId);
    const approvedOps = allOps.filter((o) => approvedOperationIds.includes(o.id));

    if (approvedOps.length === 0) {
      throw new Error("No approved operations selected for derived ChangeSet");
    }

    const derived = await changeSetRepository.createChangeSet({
      projectId,
      threadId: parent.threadId || undefined,
      runId: parent.runId || undefined,
      title: `${parent.title} (部分采纳)`,
      objective: parent.objective,
      rationale: parent.rationale || undefined,
      status: "approved",
      metadata: {
        parentChangeSetId: parent.id,
        isDerived: true,
      },
    });

    const newOps: ChangeOperation[] = [];
    let seq = 1;
    for (const op of approvedOps) {
      const newOp = await changeSetRepository.createOperation({
        changeSetId: derived.id,
        projectId,
        sequenceNumber: seq++,
        targetType: op.targetType,
        targetId: op.targetId,
        baseRevisionId: op.baseRevisionId || undefined,
        operationType: op.operationType,
        status: "approved",
        quote: op.quote || undefined,
        prefixAnchor: op.prefixAnchor || undefined,
        suffixAnchor: op.suffixAnchor || undefined,
        originalChecksum: op.originalChecksum || undefined,
        replacementContent: op.replacementContent || undefined,
        literaryTradeoff: op.literaryTradeoff || undefined,
        structuredPayload: op.structuredPayload,
      });
      newOps.push(newOp);
    }

    // Mark parent ChangeSet as partially_approved
    await changeSetRepository.updateChangeSet(parentChangeSetId, {
      status: "partially_approved",
    });

    return {
      derivedChangeSet: derived,
      operations: newOps,
    };
  }

  /**
   * Applies all operations of an approved ChangeSet atomically within a single PostgreSQL transaction.
   * If any operation fails, the entire transaction rolls back cleanly.
   */
  public async applyChangeSet(
    changeSetId: string,
    projectId: string
  ): Promise<{ success: boolean; applyAttempt: ChangeApplyAttempt }> {
    const changeSet = await changeSetRepository.getChangeSetById(changeSetId);
    if (!changeSet || changeSet.projectId !== projectId) {
      throw new Error(`ChangeSet not found: ${changeSetId}`);
    }

    const ops = await changeSetRepository.listOperationsByChangeSet(changeSetId);
    if (ops.length === 0) {
      throw new Error("ChangeSet has no operations to apply");
    }

    const resultingRevisionMap: Record<string, string> = {};

    try {
      await db.transaction(async (tx) => {
        for (const op of ops) {
          if (op.targetType === "scene") {
            // Lock and fetch scene
            const [scene] = await tx
              .select()
              .from(scenes)
              .where(and(eq(scenes.id, op.targetId), eq(scenes.projectId, projectId)));

            if (!scene) {
              throw new Error(`Scene not found or unauthorized: ${op.targetId}`);
            }

            // Stale check
            if (op.baseRevisionId && scene.currentRevisionId && op.baseRevisionId !== scene.currentRevisionId) {
              throw new Error(
                `Stale revision conflict on scene ${scene.id}: expected ${op.baseRevisionId}, current is ${scene.currentRevisionId}`
              );
            }

            if (op.operationType === "split_scene") {
              const payload = op.structuredPayload as Record<string, any>;
              const splits: Array<{
                title: string;
                summary?: string;
                content: string;
                pov?: string;
                timeframe?: string;
              }> = payload?.splits || [];

              if (splits.length === 0) {
                throw new Error(`Invalid split_scene payload on scene ${scene.id}: no splits provided`);
              }

              // 1. First split updates the target scene (scene.id)
              const firstSplit = splits[0];
              const firstDoc = isTipTapDocJson(firstSplit.content)
                ? JSON.parse(firstSplit.content)
                : plainTextToTipTapDoc(firstSplit.content);
              const firstContentJson = JSON.stringify(firstDoc);

              const [latestRev] = await tx
                .select()
                .from(sceneRevisions)
                .where(eq(sceneRevisions.sceneId, scene.id))
                .orderBy(desc(sceneRevisions.revisionNumber))
                .limit(1);

              const nextRevisionNumber = (latestRev?.revisionNumber ?? 0) + 1;
              const newRevisionId = crypto.randomUUID();
              const checksum = computeTextChecksum(firstContentJson);

              await tx.insert(sceneRevisions).values({
                id: newRevisionId,
                sceneId: scene.id,
                projectId,
                revisionNumber: nextRevisionNumber,
                content: firstContentJson,
                changeType: "agent_applied",
                description: `分场重组：第 1 场《${firstSplit.title}》`,
                diffSummary: JSON.stringify({
                  changeSetId,
                  operationId: op.id,
                  operationType: "split_scene",
                  splitIndex: 0,
                }),
                characterCount: firstContentJson.length,
                appliedChangeSetId: changeSetId,
                metadata: { checksum },
              });

              await tx
                .update(scenes)
                .set({
                  title: firstSplit.title || scene.title,
                  summary: firstSplit.summary ?? scene.summary,
                  pov: firstSplit.pov ?? scene.pov,
                  timeframe: firstSplit.timeframe ?? scene.timeframe,
                  content: firstContentJson,
                  characterCount: firstContentJson.length,
                  currentRevisionId: newRevisionId,
                  updatedAt: new Date(),
                })
                .where(eq(scenes.id, scene.id));

              resultingRevisionMap[scene.id] = newRevisionId;

              // 2. Subsequent splits become new scenes in the same manuscript
              if (splits.length > 1) {
                const addedCount = splits.length - 1;
                // Shift subsequent scenes with order > scene.order by addedCount
                const laterScenes = await tx
                  .select()
                  .from(scenes)
                  .where(and(eq(scenes.manuscriptId, scene.manuscriptId), eq(scenes.projectId, projectId)))
                  .orderBy(desc(scenes.order));

                for (const later of laterScenes) {
                  if (later.id !== scene.id && later.order > scene.order) {
                    await tx
                      .update(scenes)
                      .set({ order: later.order + addedCount })
                      .where(eq(scenes.id, later.id));
                  }
                }

                // Insert new scenes
                for (let k = 1; k < splits.length; k++) {
                  const splitItem = splits[k];
                  const splitDoc = isTipTapDocJson(splitItem.content)
                    ? JSON.parse(splitItem.content)
                    : plainTextToTipTapDoc(splitItem.content);
                  const splitContentJson = JSON.stringify(splitDoc);
                  const newSceneId = crypto.randomUUID();
                  const newSceneRevId = crypto.randomUUID();
                  const splitChecksum = computeTextChecksum(splitContentJson);
                  const targetOrder = scene.order + k;

                  await tx.insert(scenes).values({
                    id: newSceneId,
                    manuscriptId: scene.manuscriptId,
                    projectId,
                    title: splitItem.title || `第 ${k + 1} 场`,
                    order: targetOrder,
                    content: splitContentJson,
                    characterCount: splitContentJson.length,
                    summary: splitItem.summary,
                    pov: splitItem.pov,
                    timeframe: splitItem.timeframe,
                    currentRevisionId: newSceneRevId,
                  });

                  await tx.insert(sceneRevisions).values({
                    id: newSceneRevId,
                    sceneId: newSceneId,
                    projectId,
                    revisionNumber: 1,
                    content: splitContentJson,
                    changeType: "agent_applied",
                    description: `分场重组：第 ${k + 1} 场《${splitItem.title}》`,
                    diffSummary: JSON.stringify({
                      changeSetId,
                      operationId: op.id,
                      operationType: "split_scene",
                      splitIndex: k,
                    }),
                    characterCount: splitContentJson.length,
                    appliedChangeSetId: changeSetId,
                    metadata: { checksum: splitChecksum },
                  });

                  resultingRevisionMap[newSceneId] = newSceneRevId;
                }
              }
            } else {
              let newContentJson = scene.content;

              if (
                op.operationType === "replace_text_range" ||
                op.operationType === "delete_text_range" ||
                op.operationType === "insert_text"
              ) {
                const patchRes = applyPlainTextPatchToTipTapDoc(scene.content, {
                  quote: op.quote || undefined,
                  prefixAnchor: op.prefixAnchor || undefined,
                  suffixAnchor: op.suffixAnchor || undefined,
                  replacementContent: op.replacementContent || "",
                });

                if (!patchRes.success) {
                  throw new Error(`Failed to apply patch to scene ${scene.id}: ${patchRes.error}`);
                }
                newContentJson = patchRes.newDocJson;
              } else if (op.operationType === "replace_scene") {
                const doc = isTipTapDocJson(op.replacementContent || "")
                  ? JSON.parse(op.replacementContent || "{}")
                  : plainTextToTipTapDoc(op.replacementContent || "");
                newContentJson = JSON.stringify(doc);
              }

              // Get next monotonic revision number
              const [latestRev] = await tx
                .select()
                .from(sceneRevisions)
                .where(eq(sceneRevisions.sceneId, scene.id))
                .orderBy(desc(sceneRevisions.revisionNumber))
                .limit(1);

              const nextRevisionNumber = (latestRev?.revisionNumber ?? 0) + 1;
              const newRevisionId = crypto.randomUUID();
              const checksum = computeTextChecksum(newContentJson);

              // Insert new revision
              await tx.insert(sceneRevisions).values({
                id: newRevisionId,
                sceneId: scene.id,
                projectId,
                revisionNumber: nextRevisionNumber,
                content: newContentJson,
                changeType: "agent_applied",
                description: `AI 修订采纳: ${changeSet.title}`,
                diffSummary: JSON.stringify({
                  changeSetId,
                  operationId: op.id,
                  operationType: op.operationType,
                }),
                characterCount: newContentJson.length,
                appliedChangeSetId: changeSetId,
                metadata: { checksum },
              });

              // Update scene record
              await tx
                .update(scenes)
                .set({
                  content: newContentJson,
                  currentRevisionId: newRevisionId,
                  updatedAt: new Date(),
                })
                .where(eq(scenes.id, scene.id));

              resultingRevisionMap[scene.id] = newRevisionId;
            }
          } else if (op.targetType === "knowledge_node") {
            if (op.operationType === "create_knowledge") {
              const newNodeId = op.targetId || crypto.randomUUID();
              const payload = op.structuredPayload || {};
              await tx.insert(knowledgeNodes).values({
                id: newNodeId,
                projectId,
                kind: (payload.kind as any) || "custom",
                title: (payload.title as string) || "未命名设定",
                content: op.replacementContent || "",
                authority: "user_authored_locked",
                status: "active",
              });
              resultingRevisionMap[newNodeId] = "created";
            } else if (op.operationType === "update_knowledge") {
              const [latestRev] = await tx
                .select()
                .from(knowledgeRevisions)
                .where(eq(knowledgeRevisions.nodeId, op.targetId))
                .orderBy(desc(knowledgeRevisions.revisionNumber))
                .limit(1);

              const nextRevNum = (latestRev?.revisionNumber ?? 0) + 1;
              const newRevId = crypto.randomUUID();

              await tx.insert(knowledgeRevisions).values({
                id: newRevId,
                nodeId: op.targetId,
                projectId,
                revisionNumber: nextRevNum,
                title: "更新设定",
                content: op.replacementContent || "",
                changeType: "agent_update",
              });

              await tx
                .update(knowledgeNodes)
                .set({
                  content: op.replacementContent || "",
                  updatedAt: new Date(),
                })
                .where(eq(knowledgeNodes.id, op.targetId));

              resultingRevisionMap[op.targetId] = newRevId;
            } else if (op.operationType === "archive_knowledge") {
              await tx
                .update(knowledgeNodes)
                .set({
                  status: "archived",
                  updatedAt: new Date(),
                })
                .where(eq(knowledgeNodes.id, op.targetId));
              resultingRevisionMap[op.targetId] = "archived";
            }
          }

          // Mark operation applied
          await tx
            .update(changeOperations)
            .set({ status: "applied" })
            .where(eq(changeOperations.id, op.id));
        }

        // Mark changeSet applied
        await tx
          .update(changeSets)
          .set({
            status: "applied",
            appliedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(changeSets.id, changeSetId));
      });

      // Record successful apply attempt
      const attempt = await changeSetRepository.createApplyAttempt({
        changeSetId,
        projectId,
        status: "success",
        resultingRevisionMap,
      });

      return { success: true, applyAttempt: attempt };
    } catch (err: any) {
      // Record failed apply attempt
      await changeSetRepository.createApplyAttempt({
        changeSetId,
        projectId,
        status: "failed",
        error: err.message,
      });

      await changeSetRepository.updateChangeSet(changeSetId, {
        status: "failed",
      });

      throw err;
    }
  }
}

export const changeSetService = new ChangeSetService();

