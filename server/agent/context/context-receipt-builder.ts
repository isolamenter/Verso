import { agentRepository } from "../../domain";
import type {
  ContextReceipt,
  ContextReceiptItem,
  ContextReceiptResourceType,
  ContextReceiptInclusionMode,
} from "../../../shared/schemas/agent";
import crypto from "node:crypto";

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

  /**
   * Persists the final Context Receipt and all its items to PostgreSQL.
   */
  public async finalize(): Promise<{ receipt: ContextReceipt; items: ContextReceiptItem[] }> {
    const totalTokens = this.items.reduce(
      (sum, it) => sum + (it.tokenCostEstimate ?? Math.ceil((it.excerptLength ?? 0) / 3)),
      0
    );

    const receipt = await agentRepository.createContextReceipt({
      id: crypto.randomUUID(),
      runId: this.runId,
      projectId: this.projectId,
      totalTokensApprox: totalTokens,
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
        estimatedTokens: item.tokenCostEstimate ?? Math.ceil((item.excerptLength ?? 0) / 3),
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

