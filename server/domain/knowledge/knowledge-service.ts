import { db } from "../../db/client";
import { knowledgeRevisions } from "../../db/schema";
import { eq, desc } from "drizzle-orm";
import { knowledgeRepository } from "../index";
import type {
  KnowledgeNode,
  CreateKnowledgeNodeInput,
  UpdateKnowledgeNodeInput,
  KnowledgeRevision,
  KnowledgeRelation,
  CreateKnowledgeRelationInput,
} from "../../../shared/schemas/knowledge";

export class KnowledgeService {
  /**
   * Creates a user-authored knowledge node with initial revision record.
   */
  public async createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    const node = await knowledgeRepository.createNode({
      ...input,
      authority: input.authority ?? "user_authored_locked",
      status: "active",
    });

    return node;
  }

  /**
   * Updates an existing knowledge node and appends a monotonic revision.
   */
  public async updateNode(
    id: string,
    projectId: string,
    input: UpdateKnowledgeNodeInput
  ): Promise<{ node: KnowledgeNode; revision: KnowledgeRevision }> {
    const existing = await knowledgeRepository.getNodeById(id);
    if (!existing || existing.projectId !== projectId) {
      throw new Error(`Knowledge node not found or unauthorized: ${id}`);
    }

    const updatedNode = await knowledgeRepository.updateNode(id, input);

    // Fetch latest revision number
    const [latestRev] = await db
      .select()
      .from(knowledgeRevisions)
      .where(eq(knowledgeRevisions.nodeId, id))
      .orderBy(desc(knowledgeRevisions.revisionNumber))
      .limit(1);

    const nextRevisionNumber = (latestRev?.revisionNumber ?? 0) + 1;
    const revision = await knowledgeRepository.createRevision({
      nodeId: id,
      projectId,
      revisionNumber: nextRevisionNumber,
      title: updatedNode.title,
      content: updatedNode.content,
      summary: updatedNode.summary || undefined,
      changeType: "manual_edit",
    });

    return { node: updatedNode, revision };
  }

  /**
   * Archives a knowledge node.
   */
  public async archiveNode(id: string, projectId: string): Promise<boolean> {
    const existing = await knowledgeRepository.getNodeById(id);
    if (!existing || existing.projectId !== projectId) {
      throw new Error(`Knowledge node not found: ${id}`);
    }

    await knowledgeRepository.updateNode(id, { status: "archived" });
    return true;
  }

  /**
   * Links two knowledge nodes with a typed relation.
   */
  public async createRelation(input: CreateKnowledgeRelationInput): Promise<KnowledgeRelation> {
    return knowledgeRepository.createRelation(input);
  }

  /**
   * Returns all active nodes and relations structured for hierarchical display.
   */
  public async getKnowledgeTree(projectId: string): Promise<{
    nodes: KnowledgeNode[];
    relations: KnowledgeRelation[];
    categories: Record<string, KnowledgeNode[]>;
  }> {
    const allNodes = await knowledgeRepository.listNodesByProject(projectId);
    const activeNodes = allNodes.filter((n) => n.status !== "archived");
    const relations = await knowledgeRepository.listRelationsByProject(projectId);

    const categories: Record<string, KnowledgeNode[]> = {};
    for (const node of activeNodes) {
      const kind = node.kind || "custom";
      if (!categories[kind]) {
        categories[kind] = [];
      }
      categories[kind].push(node);
    }

    return {
      nodes: activeNodes,
      relations,
      categories,
    };
  }
}

export const knowledgeService = new KnowledgeService();

