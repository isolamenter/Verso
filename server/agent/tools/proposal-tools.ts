import { changeSetService } from "../../domain";
import type { ToolExecutionContext } from "./read-tools";

export interface ProposeTextChangeInput {
  changeSetTitle?: string;
  changeSetObjective?: string;
  sceneId: string;
  baseRevisionId?: string;
  quote: string;
  prefixAnchor?: string;
  suffixAnchor?: string;
  replacementText: string;
  explanation?: string;
}

export interface ProposeKnowledgeCreateInput {
  changeSetTitle?: string;
  kind: string;
  title: string;
  content: string;
  explanation?: string;
}

export interface ProposeKnowledgeUpdateInput {
  changeSetTitle?: string;
  nodeId: string;
  content: string;
  explanation?: string;
}

export interface ProposeKnowledgeArchiveInput {
  changeSetTitle?: string;
  nodeId: string;
  explanation?: string;
}

export class ProposalToolsEngine {
  /**
   * 1. propose_text_change
   */
  public async proposeTextChange(input: ProposeTextChangeInput, ctx: ToolExecutionContext) {
    const result = await changeSetService.createChangeSetWithOperations(
      {
        projectId: ctx.projectId,
        threadId: ctx.threadId,
        runId: ctx.runId,
        title: input.changeSetTitle || "推敲修改建议",
        objective: input.changeSetObjective || "根据创作要求调整正文描写与用词",
        rationale: input.explanation,
      },
      [
        {
          targetType: "scene",
          targetId: input.sceneId,
          baseRevisionId: input.baseRevisionId,
          operationType: "replace_text_range",
          quote: input.quote,
          prefixAnchor: input.prefixAnchor,
          suffixAnchor: input.suffixAnchor,
          replacementContent: input.replacementText,
          literaryTradeoff: input.explanation,
        },
      ]
    );

    return {
      success: true,
      changeSetId: result.changeSet.id,
      status: result.changeSet.status,
      operationCount: result.operations.length,
      operations: result.operations.map((op) => ({
        id: op.id,
        status: op.status,
        validationResult: op.validationResult,
      })),
    };
  }

  /**
   * 2. propose_knowledge_create
   */
  public async proposeKnowledgeCreate(input: ProposeKnowledgeCreateInput, ctx: ToolExecutionContext) {
    const result = await changeSetService.createChangeSetWithOperations(
      {
        projectId: ctx.projectId,
        threadId: ctx.threadId,
        runId: ctx.runId,
        title: input.changeSetTitle || `新增设定: ${input.title}`,
        objective: "根据故事展开新增设定条目",
        rationale: input.explanation,
      },
      [
        {
          targetType: "knowledge_node",
          targetId: `new-node-${Date.now()}`,
          operationType: "create_knowledge",
          replacementContent: input.content,
          structuredPayload: {
            kind: input.kind,
            title: input.title,
          },
          literaryTradeoff: input.explanation,
        },
      ]
    );

    return {
      success: true,
      changeSetId: result.changeSet.id,
      status: result.changeSet.status,
    };
  }

  /**
   * 3. propose_knowledge_update
   */
  public async proposeKnowledgeUpdate(input: ProposeKnowledgeUpdateInput, ctx: ToolExecutionContext) {
    const result = await changeSetService.createChangeSetWithOperations(
      {
        projectId: ctx.projectId,
        threadId: ctx.threadId,
        runId: ctx.runId,
        title: input.changeSetTitle || "更新设定条目",
        objective: "根据最新章节情节修正设定内容",
        rationale: input.explanation,
      },
      [
        {
          targetType: "knowledge_node",
          targetId: input.nodeId,
          operationType: "update_knowledge",
          replacementContent: input.content,
          literaryTradeoff: input.explanation,
        },
      ]
    );

    return {
      success: true,
      changeSetId: result.changeSet.id,
      status: result.changeSet.status,
    };
  }

  /**
   * 4. propose_knowledge_archive
   */
  public async proposeKnowledgeArchive(input: ProposeKnowledgeArchiveInput, ctx: ToolExecutionContext) {
    const result = await changeSetService.createChangeSetWithOperations(
      {
        projectId: ctx.projectId,
        threadId: ctx.threadId,
        runId: ctx.runId,
        title: input.changeSetTitle || "归档已废弃设定条目",
        objective: "归档不再适用的设定",
        rationale: input.explanation,
      },
      [
        {
          targetType: "knowledge_node",
          targetId: input.nodeId,
          operationType: "archive_knowledge",
          literaryTradeoff: input.explanation,
        },
      ]
    );

    return {
      success: true,
      changeSetId: result.changeSet.id,
      status: result.changeSet.status,
    };
  }
}

export const proposalToolsEngine = new ProposalToolsEngine();

