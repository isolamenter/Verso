import { knowledgeRepository } from "../index";
import type { KnowledgeNode } from "../../../shared/schemas/knowledge";
import type { ContextReceiptBuilder } from "../../agent/context/context-receipt-builder";

export interface RetrievalOptions {
  projectId: string;
  manuscriptId?: string;
  sceneId?: string;
  query?: string;
  maxTokens?: number;
  receiptBuilder?: ContextReceiptBuilder;
}

export interface RetrievalResult {
  fullNodes: KnowledgeNode[];
  summaryNodes: Array<{ node: KnowledgeNode; summaryText: string }>;
  excludedNodes: Array<{ node: KnowledgeNode; reason: string }>;
  estimatedTokens: number;
}

export class HierarchicalRetriever {
  /**
   * Performs task-specific, scope-aware hierarchical retrieval and records decisions on the ContextReceipt.
   */
  public async retrieveContext(options: RetrievalOptions): Promise<RetrievalResult> {
    const { projectId, manuscriptId, sceneId, query, maxTokens = 2000, receiptBuilder } = options;

    const allNodes = await knowledgeRepository.listNodesByProject(projectId);
    const activeNodes = allNodes.filter((n) => n.status !== "archived");

    const fullNodes: KnowledgeNode[] = [];
    const summaryNodes: Array<{ node: KnowledgeNode; summaryText: string }> = [];
    const excludedNodes: Array<{ node: KnowledgeNode; reason: string }> = [];

    let currentTokens = 0;

    // 1. Filter candidates by scope (Prevent scene-local leakage)
    const scopeEligibleNodes: KnowledgeNode[] = [];

    for (const node of activeNodes) {
      // If node is tied to a specific scene, it must match the target scene
      if (node.sceneId && sceneId && node.sceneId !== sceneId) {
        excludedNodes.push({ node, reason: "scene_scope_mismatch" });
        receiptBuilder?.recordItem({
          resourceType: "knowledge_node",
          resourceId: node.id,
          inclusionMode: "excluded",
          omissionReason: "scene_scope_mismatch",
        });
        continue;
      }

      // If node is tied to a specific manuscript, it must match the target manuscript
      if (node.manuscriptId && manuscriptId && node.manuscriptId !== manuscriptId) {
        excludedNodes.push({ node, reason: "manuscript_scope_mismatch" });
        receiptBuilder?.recordItem({
          resourceType: "knowledge_node",
          resourceId: node.id,
          inclusionMode: "excluded",
          omissionReason: "manuscript_scope_mismatch",
        });
        continue;
      }

      scopeEligibleNodes.push(node);
    }

    // 2. Score and rank candidates
    const scoredNodes = scopeEligibleNodes.map((node) => {
      let score = 0;

      // Pinned boost
      if (node.isPinned) score += 1000;

      // Authority weighting
      if (node.authority === "user_authored_locked") score += 200;
      else if (node.authority === "user_corrected") score += 150;
      else if (node.authority === "imported_primary") score += 100;
      else if (node.authority === "agent_approved") score += 50;
      else if (node.authority === "agent_unreviewed") score += 10;

      // Query relevance score
      if (query) {
        const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
        const nodeText = `${node.title} ${node.summary || ""} ${node.content}`.toLowerCase();
        for (const term of queryTerms) {
          if (nodeText.includes(term)) {
            score += 50;
            if (node.title.toLowerCase().includes(term)) {
              score += 50;
            }
          }
        }
      }

      return { node, score };
    });

    // Sort descending by score
    scoredNodes.sort((a, b) => b.score - a.score);

    // 3. Tiered Budget Selection
    for (const { node } of scoredNodes) {
      const fullEstimatedTokens = Math.ceil(node.content.length / 3) + 10;
      const summaryText = node.summary || node.content.slice(0, 100);
      const summaryEstimatedTokens = Math.ceil(summaryText.length / 3) + 5;

      if (currentTokens + fullEstimatedTokens <= maxTokens) {
        // Full inclusion
        fullNodes.push(node);
        currentTokens += fullEstimatedTokens;

        receiptBuilder?.recordItem({
          resourceType: "knowledge_node",
          resourceId: node.id,
          inclusionMode: "full",
          excerptLength: node.content.length,
          tokenCostEstimate: fullEstimatedTokens,
        });
      } else if (currentTokens + summaryEstimatedTokens <= maxTokens) {
        // Summary inclusion
        summaryNodes.push({ node, summaryText });
        currentTokens += summaryEstimatedTokens;

        receiptBuilder?.recordItem({
          resourceType: "knowledge_node",
          resourceId: node.id,
          inclusionMode: "summary",
          excerptLength: summaryText.length,
          tokenCostEstimate: summaryEstimatedTokens,
        });
      } else {
        // Excluded due to budget limit
        excludedNodes.push({ node, reason: "budget_limit" });

        receiptBuilder?.recordItem({
          resourceType: "knowledge_node",
          resourceId: node.id,
          inclusionMode: "excluded",
          omissionReason: "budget_limit",
        });
      }
    }

    return {
      fullNodes,
      summaryNodes,
      excludedNodes,
      estimatedTokens: currentTokens,
    };
  }
}

export const hierarchicalRetriever = new HierarchicalRetriever();

