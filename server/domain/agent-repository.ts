import { db } from "../db/client";
import {
  agentThreads,
  agentMessages,
  agentRuns,
  agentRunEvents,
  agentArtifacts,
  contextReceipts,
  contextReceiptItems,
} from "../db/schema";
import { eq, and, gt, desc, asc } from "drizzle-orm";
import type { IAgentRepository } from "./types";
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
import crypto from "node:crypto";

export class AgentRepository implements IAgentRepository {
  async createThread(input: CreateAgentThreadInput): Promise<AgentThread> {
    const id = input.id ?? crypto.randomUUID();
    const [thread] = await db
      .insert(agentThreads)
      .values({
        id,
        projectId: input.projectId,
        title: input.title,
        status: input.status ?? "active",
        currentSceneId: input.currentSceneId,
        activeSkillId: input.activeSkillId,
        metadata: input.metadata ?? {},
      })
      .returning();
    return thread as unknown as AgentThread;
  }

  async getThreadById(id: string): Promise<AgentThread | null> {
    const [thread] = await db.select().from(agentThreads).where(eq(agentThreads.id, id));
    return (thread as unknown as AgentThread) ?? null;
  }

  async listThreadsByProject(projectId: string): Promise<AgentThread[]> {
    const rows = await db
      .select()
      .from(agentThreads)
      .where(eq(agentThreads.projectId, projectId))
      .orderBy(desc(agentThreads.updatedAt));
    return rows as unknown as AgentThread[];
  }

  async updateThread(id: string, input: UpdateAgentThreadInput): Promise<AgentThread> {
    const [thread] = await db
      .update(agentThreads)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(agentThreads.id, id))
      .returning();
    if (!thread) {
      throw new Error(`Agent thread not found: ${id}`);
    }
    return thread as unknown as AgentThread;
  }

  async deleteThread(id: string): Promise<boolean> {
    const result = await db.delete(agentThreads).where(eq(agentThreads.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createMessage(input: CreateAgentMessageInput): Promise<AgentMessage> {
    const id = input.id ?? crypto.randomUUID();
    let sequenceNumber = input.sequenceNumber;

    if (sequenceNumber === undefined) {
      const [latest] = await db
        .select()
        .from(agentMessages)
        .where(eq(agentMessages.threadId, input.threadId))
        .orderBy(desc(agentMessages.sequenceNumber))
        .limit(1);
      sequenceNumber = (latest?.sequenceNumber ?? 0) + 1;
    }

    const [message] = await db
      .insert(agentMessages)
      .values({
        id,
        threadId: input.threadId,
        projectId: input.projectId,
        role: input.role,
        content: input.content,
        sequenceNumber,
        runId: input.runId,
        skillId: input.skillId,
        targetSceneId: input.targetSceneId,
        targetRevisionId: input.targetRevisionId,
        attachments: input.attachments ?? [],
        metadata: input.metadata ?? {},
      })
      .returning();

    // Update thread's updatedAt
    await db
      .update(agentThreads)
      .set({ updatedAt: new Date() })
      .where(eq(agentThreads.id, input.threadId));

    return message as unknown as AgentMessage;
  }

  async listMessagesByThread(threadId: string): Promise<AgentMessage[]> {
    const rows = await db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.threadId, threadId))
      .orderBy(asc(agentMessages.sequenceNumber));
    return rows as unknown as AgentMessage[];
  }

  async createRun(input: CreateAgentRunInput): Promise<AgentRun> {
    const id = input.id ?? crypto.randomUUID();
    const [run] = await db
      .insert(agentRuns)
      .values({
        id,
        threadId: input.threadId,
        projectId: input.projectId,
        skillId: input.skillId,
        skillVersion: input.skillVersion,
        status: input.status ?? "queued",
        modelRole: input.modelRole,
        modelId: input.modelId,
        targetResource: input.targetResource ?? null,
        metadata: input.metadata ?? {},
      })
      .returning();
    return run as unknown as AgentRun;
  }

  async getRunById(id: string): Promise<AgentRun | null> {
    const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, id));
    return (run as unknown as AgentRun) ?? null;
  }

  async listRunsByThread(threadId: string): Promise<AgentRun[]> {
    const rows = await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.threadId, threadId))
      .orderBy(desc(agentRuns.createdAt));
    return rows as unknown as AgentRun[];
  }

  async updateRun(id: string, input: UpdateAgentRunInput): Promise<AgentRun> {
    const [run] = await db
      .update(agentRuns)
      .set({
        status: input.status,
        contextReceiptId: input.contextReceiptId,
        error: input.error,
        startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
        completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
        metadata: input.metadata,
        updatedAt: new Date(),
      })
      .where(eq(agentRuns.id, id))
      .returning();
    if (!run) {
      throw new Error(`Agent run not found: ${id}`);
    }
    return run as unknown as AgentRun;
  }

  async createRunEvent(input: CreateAgentRunEventInput): Promise<AgentRunEvent> {
    const id = input.id ?? crypto.randomUUID();
    let sequenceNumber = input.sequenceNumber;

    if (sequenceNumber === undefined) {
      const [latest] = await db
        .select()
        .from(agentRunEvents)
        .where(eq(agentRunEvents.runId, input.runId))
        .orderBy(desc(agentRunEvents.sequenceNumber))
        .limit(1);
      sequenceNumber = (latest?.sequenceNumber ?? 0) + 1;
    }

    const [event] = await db
      .insert(agentRunEvents)
      .values({
        id,
        runId: input.runId,
        threadId: input.threadId,
        projectId: input.projectId,
        sequenceNumber,
        type: input.type,
        payload: input.payload ?? {},
      })
      .returning();
    return event as unknown as AgentRunEvent;
  }

  async listRunEvents(runId: string, afterSequence?: number): Promise<AgentRunEvent[]> {
    if (afterSequence !== undefined) {
      const rows = await db
        .select()
        .from(agentRunEvents)
        .where(and(eq(agentRunEvents.runId, runId), gt(agentRunEvents.sequenceNumber, afterSequence)))
        .orderBy(asc(agentRunEvents.sequenceNumber));
      return rows as unknown as AgentRunEvent[];
    }
    const rows = await db
      .select()
      .from(agentRunEvents)
      .where(eq(agentRunEvents.runId, runId))
      .orderBy(asc(agentRunEvents.sequenceNumber));
    return rows as unknown as AgentRunEvent[];
  }

  async createArtifact(input: CreateAgentArtifactInput): Promise<AgentArtifact> {
    const id = input.id ?? crypto.randomUUID();
    const [artifact] = await db
      .insert(agentArtifacts)
      .values({
        id,
        runId: input.runId,
        threadId: input.threadId,
        projectId: input.projectId,
        type: input.type,
        title: input.title,
        content: input.content,
        structuredData: input.structuredData ?? {},
        locale: input.locale ?? "zh-CN",
        metadata: input.metadata ?? {},
      })
      .returning();
    return artifact as unknown as AgentArtifact;
  }

  async getArtifactById(id: string): Promise<AgentArtifact | null> {
    const [artifact] = await db.select().from(agentArtifacts).where(eq(agentArtifacts.id, id));
    return (artifact as unknown as AgentArtifact) ?? null;
  }

  async listArtifactsByRun(runId: string): Promise<AgentArtifact[]> {
    const rows = await db
      .select()
      .from(agentArtifacts)
      .where(eq(agentArtifacts.runId, runId))
      .orderBy(asc(agentArtifacts.createdAt));
    return rows as unknown as AgentArtifact[];
  }

  async listArtifactsByThread(threadId: string): Promise<AgentArtifact[]> {
    const rows = await db
      .select()
      .from(agentArtifacts)
      .where(eq(agentArtifacts.threadId, threadId))
      .orderBy(desc(agentArtifacts.createdAt));
    return rows as unknown as AgentArtifact[];
  }

  async createContextReceipt(input: CreateContextReceiptInput): Promise<ContextReceipt> {
    const id = input.id ?? crypto.randomUUID();
    const [receipt] = await db
      .insert(contextReceipts)
      .values({
        id,
        runId: input.runId,
        projectId: input.projectId,
        skillId: input.skillId,
        skillVersion: input.skillVersion,
        totalTokensApprox: input.totalTokensApprox,
        tierBreakdown: input.tierBreakdown ?? {},
        metadata: input.metadata ?? {},
      })
      .returning();

    // Link receipt to run
    await db
      .update(agentRuns)
      .set({ contextReceiptId: id })
      .where(eq(agentRuns.id, input.runId));

    return receipt as unknown as ContextReceipt;
  }

  async getContextReceiptByRunId(runId: string): Promise<ContextReceipt | null> {
    const [receipt] = await db
      .select()
      .from(contextReceipts)
      .where(eq(contextReceipts.runId, runId));
    return (receipt as unknown as ContextReceipt) ?? null;
  }

  async createContextReceiptItem(input: CreateContextReceiptItemInput): Promise<ContextReceiptItem> {
    const id = input.id ?? crypto.randomUUID();
    const [item] = await db
      .insert(contextReceiptItems)
      .values({
        id,
        contextReceiptId: input.contextReceiptId,
        projectId: input.projectId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        tier: input.tier,
        inclusionMode: input.inclusionMode,
        exclusionReason: input.exclusionReason,
        estimatedTokens: input.estimatedTokens,
        contentSnippet: input.contentSnippet,
        metadata: input.metadata ?? {},
      })
      .returning();
    return item as unknown as ContextReceiptItem;
  }

  async listContextReceiptItems(contextReceiptId: string): Promise<ContextReceiptItem[]> {
    const rows = await db
      .select()
      .from(contextReceiptItems)
      .where(eq(contextReceiptItems.contextReceiptId, contextReceiptId))
      .orderBy(asc(contextReceiptItems.tier), asc(contextReceiptItems.createdAt));
    return rows as unknown as ContextReceiptItem[];
  }
}

