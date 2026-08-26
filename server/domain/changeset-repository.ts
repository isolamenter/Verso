import { db } from "../db/client";
import {
  changeSets,
  changeOperations,
  changeReviews,
  changeApplyAttempts,
} from "../db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import type { IChangeSetRepository } from "./types";
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
import { applyChangeSetAtomic } from "./transaction-helper";
import crypto from "node:crypto";

export class ChangeSetRepository implements IChangeSetRepository {
  async createChangeSet(input: CreateChangeSetInput): Promise<ChangeSet> {
    const id = input.id ?? crypto.randomUUID();
    const [changeSet] = await db
      .insert(changeSets)
      .values({
        id,
        projectId: input.projectId,
        threadId: input.threadId,
        runId: input.runId,
        title: input.title,
        objective: input.objective,
        rationale: input.rationale,
        status: input.status ?? "draft",
        baseRevisionMap: input.baseRevisionMap ?? {},
        contextReceiptId: input.contextReceiptId,
        skillInvocationIds: input.skillInvocationIds ?? [],
        metadata: input.metadata ?? {},
      })
      .returning();
    return changeSet as unknown as ChangeSet;
  }

  async getChangeSetById(id: string): Promise<ChangeSet | null> {
    const [changeSet] = await db.select().from(changeSets).where(eq(changeSets.id, id));
    return (changeSet as unknown as ChangeSet) ?? null;
  }

  async listChangeSetsByProject(projectId: string, status?: string): Promise<ChangeSet[]> {
    if (status) {
      const rows = await db
        .select()
        .from(changeSets)
        .where(and(eq(changeSets.projectId, projectId), eq(changeSets.status, status)))
        .orderBy(desc(changeSets.createdAt));
      return rows as unknown as ChangeSet[];
    }
    const rows = await db
      .select()
      .from(changeSets)
      .where(eq(changeSets.projectId, projectId))
      .orderBy(desc(changeSets.createdAt));
    return rows as unknown as ChangeSet[];
  }

  async updateChangeSet(id: string, input: UpdateChangeSetInput): Promise<ChangeSet> {
    const [changeSet] = await db
      .update(changeSets)
      .set({
        title: input.title,
        objective: input.objective,
        rationale: input.rationale,
        status: input.status,
        baseRevisionMap: input.baseRevisionMap,
        appliedAt: input.appliedAt ? new Date(input.appliedAt) : undefined,
        metadata: input.metadata,
        updatedAt: new Date(),
      })
      .where(eq(changeSets.id, id))
      .returning();
    if (!changeSet) {
      throw new Error(`ChangeSet not found: ${id}`);
    }
    return changeSet as unknown as ChangeSet;
  }

  async createOperation(input: CreateChangeOperationInput): Promise<ChangeOperation> {
    const id = input.id ?? crypto.randomUUID();
    let sequenceNumber = input.sequenceNumber;

    if (sequenceNumber === undefined) {
      const [latest] = await db
        .select()
        .from(changeOperations)
        .where(eq(changeOperations.changeSetId, input.changeSetId))
        .orderBy(desc(changeOperations.sequenceNumber))
        .limit(1);
      sequenceNumber = (latest?.sequenceNumber ?? 0) + 1;
    }

    const [operation] = await db
      .insert(changeOperations)
      .values({
        id,
        changeSetId: input.changeSetId,
        projectId: input.projectId,
        sequenceNumber,
        targetType: input.targetType,
        targetId: input.targetId,
        baseRevisionId: input.baseRevisionId,
        operationType: input.operationType,
        status: input.status ?? "proposed",
        quote: input.quote,
        prefixAnchor: input.prefixAnchor,
        suffixAnchor: input.suffixAnchor,
        originalChecksum: input.originalChecksum,
        rangeFrom: input.rangeFrom,
        rangeTo: input.rangeTo,
        replacementContent: input.replacementContent,
        literaryTradeoff: input.literaryTradeoff,
        structuredPayload: input.structuredPayload ?? {},
        validationResult: input.validationResult ?? null,
        metadata: input.metadata ?? {},
      })
      .returning();
    return operation as unknown as ChangeOperation;
  }

  async listOperationsByChangeSet(changeSetId: string): Promise<ChangeOperation[]> {
    const rows = await db
      .select()
      .from(changeOperations)
      .where(eq(changeOperations.changeSetId, changeSetId))
      .orderBy(asc(changeOperations.sequenceNumber));
    return rows as unknown as ChangeOperation[];
  }

  async updateOperation(id: string, input: UpdateChangeOperationInput): Promise<ChangeOperation> {
    const [operation] = await db
      .update(changeOperations)
      .set({
        status: input.status,
        validationResult: input.validationResult,
        metadata: input.metadata,
      })
      .where(eq(changeOperations.id, id))
      .returning();
    if (!operation) {
      throw new Error(`ChangeOperation not found: ${id}`);
    }
    return operation as unknown as ChangeOperation;
  }

  async createReview(input: CreateChangeReviewInput): Promise<ChangeReview> {
    const id = input.id ?? crypto.randomUUID();
    const [review] = await db
      .insert(changeReviews)
      .values({
        id,
        changeSetId: input.changeSetId,
        projectId: input.projectId,
        operationId: input.operationId,
        decision: input.decision,
        userFeedback: input.userFeedback,
      })
      .returning();

    // If review decision is for a specific operation, update operation status
    if (input.operationId) {
      const opStatus = input.decision === "approved" ? "approved" : "rejected";
      await db
        .update(changeOperations)
        .set({ status: opStatus })
        .where(eq(changeOperations.id, input.operationId));
    }

    return review as unknown as ChangeReview;
  }

  async listReviewsByChangeSet(changeSetId: string): Promise<ChangeReview[]> {
    const rows = await db
      .select()
      .from(changeReviews)
      .where(eq(changeReviews.changeSetId, changeSetId))
      .orderBy(asc(changeReviews.createdAt));
    return rows as unknown as ChangeReview[];
  }

  async createApplyAttempt(input: CreateChangeApplyAttemptInput): Promise<ChangeApplyAttempt> {
    const id = input.id ?? crypto.randomUUID();
    const [attempt] = await db
      .insert(changeApplyAttempts)
      .values({
        id,
        changeSetId: input.changeSetId,
        projectId: input.projectId,
        status: input.status,
        resultingRevisionMap: input.resultingRevisionMap ?? {},
        error: input.error,
      })
      .returning();
    return attempt as unknown as ChangeApplyAttempt;
  }

  async listApplyAttempts(changeSetId: string): Promise<ChangeApplyAttempt[]> {
    const rows = await db
      .select()
      .from(changeApplyAttempts)
      .where(eq(changeApplyAttempts.changeSetId, changeSetId))
      .orderBy(desc(changeApplyAttempts.attemptedAt));
    return rows as unknown as ChangeApplyAttempt[];
  }

  async applyChangeSet(changeSetId: string, projectId: string): Promise<ChangeApplyAttempt> {
    return await applyChangeSetAtomic({ changeSetId, projectId });
  }
}

