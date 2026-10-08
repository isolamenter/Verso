import { agentRepository } from "../../domain";
import type {
  ContextReceipt,
  ContextReceiptItem,
  ContextReceiptResourceType,
  ContextReceiptInclusionMode,
} from "../../../shared/schemas/agent";
import crypto from "node:crypto";
import type { TaskSnapshot, TaskCoverage } from "../../../shared/schemas/task";

export interface ContextItemRecord {
  resourceType: ContextReceiptResourceType;
  resourceId: string;
  inclusionMode: ContextReceiptInclusionMode;
  locator?: Record<string, unknown>;
  revisionId?: string;
  excerptLength?: number;
  tokenCostEstimate?: number;
  omissionReason?: string;
  reason?: string;
}

export class ContextReceiptBuilder {
  private items: ContextItemRecord[] = [];
  public runId: string;
  public threadId: string;
  public projectId: string;

  constructor(runId: string, threadId: string, projectId: string) {
    this.runId = runId;
    this.threadId = threadId;
    this.projectId = projectId;
  }

  public recordItem(item: ContextItemRecord): void {
    this.items.push(item);
  }

  public getRecordedItems(): ContextItemRecord[] {
    return [...this.items];
  }

  public coverage(task: TaskSnapshot, stopReason?: string): TaskCoverage {
    const scenes = task.scenes.map((scene) => {
      const intervals = this.items
        .filter(
          (i) =>
            i.resourceType === "scene" &&
            i.resourceId === scene.id &&
            i.revisionId === scene.revisionId &&
            i.locator &&
            typeof i.locator.from === "number" &&
            typeof i.locator.to === "number",
        )
        .map((i) => ({
          from: Math.max(scene.from, i.locator!.from as number),
          to: Math.min(scene.to, i.locator!.to as number),
        }))
        .sort((a, b) => a.from - b.from);
      let read = 0,
        end = scene.from;
      for (const interval of intervals) {
        read += Math.max(0, interval.to - Math.max(end, interval.from));
        end = Math.max(end, interval.to);
      }
      return {
        id: scene.id,
        title: scene.title,
        revisionId: scene.revisionId,
        revisionNumber: scene.revisionNumber,
        read,
        total: scene.to - scene.from,
        summaryUsed: this.items.some(
          (i) =>
            i.resourceType === "scene" &&
            i.resourceId === scene.id &&
            i.inclusionMode === "summary",
        ),
      };
    });
    return {
      scenes,
      complete: scenes.every((s) => s.read >= s.total) && !stopReason,
      stopReason,
    };
  }

  /**
   * Persists the final Context Receipt and all its items to PostgreSQL.
   */
  public async finalize(
    metadata: Record<string, unknown> = {},
  ): Promise<{ receipt: ContextReceipt; items: ContextReceiptItem[] }> {
    const totalTokens = this.items.reduce(
      (sum, it) =>
        sum + (it.tokenCostEstimate ?? Math.ceil((it.excerptLength ?? 0) / 3)),
      0,
    );

    const receipt = await agentRepository.createContextReceipt({
      id: crypto.randomUUID(),
      runId: this.runId,
      projectId: this.projectId,
      totalTokensApprox: totalTokens,
      metadata,
    });

    const persistedItems: ContextReceiptItem[] = [];
    for (const item of this.items) {
      const persisted = await agentRepository.createContextReceiptItem({
        contextReceiptId: receipt.id,
        projectId: this.projectId,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        tier: 0,
        inclusionMode: item.inclusionMode,
        estimatedTokens:
          item.tokenCostEstimate ?? Math.ceil((item.excerptLength ?? 0) / 3),
        exclusionReason: item.omissionReason,
        metadata: {
          locator: item.locator ?? {},
          revisionId: item.revisionId,
          excerptLength: item.excerptLength,
        },
      });
      persistedItems.push(persisted);
    }

    // Link receipt to run
    await agentRepository.updateRun(this.runId, {
      contextReceiptId: receipt.id,
    });

    return { receipt, items: persistedItems };
  }
}
