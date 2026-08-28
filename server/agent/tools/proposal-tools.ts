import { changeSetService, projectRepository, manuscriptService } from "../../domain";
import type { ToolExecutionContext } from "./read-tools";
import { splitManuscriptTextByAnchors, computeSplitCoverage } from "../../../shared/manuscript";
import type { ProposeSceneSplitsInput } from "../../../shared/schemas/tools";

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

  /**
   * 5. propose_scene_splits
   */
  public async proposeSceneSplits(input: ProposeSceneSplitsInput, ctx: ToolExecutionContext) {
    // 1. Resolve target scene
    let targetSceneId = input.sceneId;
    if (!targetSceneId && input.manuscriptId) {
      const scenes = await projectRepository.listScenesByManuscript(input.manuscriptId);
      targetSceneId = scenes[0]?.id;
    }
    if (!targetSceneId) {
      const allScenes = await projectRepository.listScenesByProject(ctx.projectId);
      targetSceneId = allScenes[0]?.id;
    }

    if (!targetSceneId) {
      throw new Error(`No target scene found to split in project ${ctx.projectId}`);
    }

    const scene = await manuscriptService.getSceneById(targetSceneId, ctx.projectId);
    if (!scene) {
      throw new Error(`Target scene not found: ${targetSceneId}`);
    }

    const sourceText = scene.content;
    const splitResults = splitManuscriptTextByAnchors(sourceText, input.splits);
    const coverage = computeSplitCoverage(sourceText, splitResults);

    // Detect any splits that could not be matched by startQuote anchors
    const matchedTitles = new Set(splitResults.map((s) => s.title));
    const unmatchedSplits = input.splits
      .filter((s) => !matchedTitles.has(s.title))
      .map((s) => ({ title: s.title, startQuote: s.startQuote }));

    if (unmatchedSplits.length > 0) {
      console.warn(
        `[ProposalTools] ${unmatchedSplits.length} split(s) failed to match anchors in scene ${scene.id}:`,
        unmatchedSplits
      );
    }

    const changeSetTitle = input.changeSetTitle || `分场规划方案：${splitResults.length} 场`;
    const changeSetObjective =
      input.changeSetObjective ||
      `将《${scene.title}》细化拆分为 ${splitResults.length} 个独立场景/章节`;

    const result = await changeSetService.createChangeSetWithOperations(
      {
        projectId: ctx.projectId,
        threadId: ctx.threadId,
        runId: ctx.runId,
        title: changeSetTitle,
        objective: changeSetObjective,
        rationale: input.rationale,
      },
      [
        {
          targetType: "scene",
          targetId: scene.id,
          baseRevisionId: scene.currentRevisionId || undefined,
          operationType: "split_scene",
          quote: splitResults[0]?.startQuote || "",
          replacementContent: JSON.stringify(splitResults),
          literaryTradeoff: input.rationale,
          structuredPayload: {
            coverage,
            sceneCount: splitResults.length,
            splits: splitResults,
            unmatchedSplits: unmatchedSplits.length > 0 ? unmatchedSplits : undefined,
            originalSceneTitle: scene.title,
            manuscriptId: scene.manuscriptId,
          },
        },
      ]
    );

    return {
      success: true,
      changeSetId: result.changeSet.id,
      status: result.changeSet.status,
      coverage,
      sceneCount: splitResults.length,
      unmatchedSplits: unmatchedSplits.length > 0 ? unmatchedSplits : undefined,
      splits: splitResults.map((s) => ({
        title: s.title,
        summary: s.summary,
        characterCount: s.characterCount,
        startQuote: s.startQuote,
        range: s.range,
        pov: s.pov,
        timeframe: s.timeframe,
      })),
    };
  }
}

export const proposalToolsEngine = new ProposalToolsEngine();

