import { projectRepository, knowledgeRepository, memoryRepository, manuscriptService } from "../../domain";
import { extractPlainText } from "../../../shared/manuscript";
import type { ContextReceiptBuilder } from "../context/context-receipt-builder";
import type {
  ListResourcesInput,
  ReadResourceInput,
  SearchManuscriptInput,
  SearchKnowledgeInput,
  ReadKnowledgeSourceInput,
  InspectMediaSegmentInput,
  GetRevisionInput,
  CompareRevisionsInput,
  QueryMemoryInput,
} from "../../../shared/schemas/tools";
import type { KnowledgeAsset, MemoryEntry } from "../../../shared/schemas";

export interface ToolExecutionContext {
  projectId: string;
  runId: string;
  threadId: string;
  receiptBuilder?: ContextReceiptBuilder;
  isColdReader?: boolean;
}

export class ReadToolsEngine {
  /**
   * 1. list_resources
   */
  public async listResources(input: ListResourcesInput, ctx: ToolExecutionContext) {
    const results: Array<{ id: string; type: string; title: string; updatedAt: string }> = [];

    if (input.type === "all" || input.type === "scene") {
      const scenes = await projectRepository.listScenesByProject(ctx.projectId);
      for (const sc of scenes.slice(0, input.limit)) {
        results.push({
          id: sc.id,
          type: "scene",
          title: sc.title || "未命名场景",
          updatedAt: String(sc.updatedAt),
        });
      }
    }

    if (!ctx.isColdReader && (input.type === "all" || input.type === "knowledge")) {
      const nodes = await knowledgeRepository.listNodesByProject(ctx.projectId);
      for (const kn of nodes.slice(0, input.limit)) {
        results.push({
          id: kn.id,
          type: "knowledge",
          title: kn.title,
          updatedAt: String(kn.updatedAt),
        });
      }
    }

    if (!ctx.isColdReader && (input.type === "all" || input.type === "memory")) {
      const memories = await memoryRepository.listMemoryEntriesByProject(ctx.projectId);
      for (const m of memories.slice(0, input.limit)) {
        results.push({
          id: m.id,
          type: "memory",
          title: m.key || "记忆条目",
          updatedAt: String(m.updatedAt),
        });
      }
    }

    return {
      count: results.length,
      resources: results.slice(0, input.limit),
    };
  }

  /**
   * 2. read_resource
   */
  public async readResource(input: ReadResourceInput, ctx: ToolExecutionContext) {
    const { type, id } = input;
    const offset = input.offset ?? 0;
    const maxLen = input.maxLength ?? 100000;

    if (type === "scene") {
      const scene = await manuscriptService.getSceneById(id, ctx.projectId);
      if (!scene) {
        return { error: `Scene not found or unauthorized in project ${ctx.projectId}` };
      }

      const plain = extractPlainText(scene.content);
      const sliceStart = Math.min(Math.max(0, offset), plain.length);
      const sliceEnd = Math.min(sliceStart + maxLen, plain.length);
      const truncated = plain.slice(sliceStart, sliceEnd);
      const isTruncated = sliceEnd < plain.length || sliceStart > 0;

      ctx.receiptBuilder?.recordItem({
        resourceType: "scene",
        resourceId: id,
        inclusionMode: isTruncated ? "excerpt" : "full",
        revisionId: scene.currentRevisionId || undefined,
        excerptLength: truncated.length,
        reason: "Read by agent tool",
      });

      return {
        id: scene.id,
        type: "scene",
        title: scene.title,
        content: truncated,
        offset: sliceStart,
        characterCount: plain.length,
        isTruncated,
      };
    }

    if (type === "knowledge") {
      if (ctx.isColdReader) {
        return { error: "Cold Reader policy prohibits reading external knowledge" };
      }

      const node = await knowledgeRepository.getNodeById(id);
      if (!node || node.projectId !== ctx.projectId) {
        return { error: `Knowledge node not found or unauthorized in project ${ctx.projectId}` };
      }

      const plain = extractPlainText(node.content);
      const sliceStart = Math.min(Math.max(0, offset), plain.length);
      const sliceEnd = Math.min(sliceStart + maxLen, plain.length);
      const truncated = plain.slice(sliceStart, sliceEnd);
      const isTruncated = sliceEnd < plain.length || sliceStart > 0;

      ctx.receiptBuilder?.recordItem({
        resourceType: "knowledge_node",
        resourceId: id,
        inclusionMode: isTruncated ? "excerpt" : "full",
        excerptLength: truncated.length,
      });

      return {
        id: node.id,
        type: "knowledge",
        title: node.title,
        kind: node.kind,
        content: truncated,
        offset: sliceStart,
        characterCount: plain.length,
        isTruncated,
      };
    }

    if (type === "memory") {
      if (ctx.isColdReader) {
        return { error: "Cold Reader policy prohibits reading memory entries" };
      }

      const entry = await memoryRepository.getMemoryEntryById(id);
      if (!entry || entry.projectId !== ctx.projectId) {
        return { error: `Memory entry not found or unauthorized in project ${ctx.projectId}` };
      }

      ctx.receiptBuilder?.recordItem({
        resourceType: "memory_entry",
        resourceId: id,
        inclusionMode: "full",
        excerptLength: entry.content.length,
      });

      return {
        id: entry.id,
        type: "memory",
        key: entry.key,
        content: entry.content,
      };
    }

    return { error: `Unsupported resource type: ${type}` };
  }

  /**
   * 3. search_manuscript
   */
  public async searchManuscript(input: SearchManuscriptInput, ctx: ToolExecutionContext) {
    const scenes = await projectRepository.listScenesByProject(ctx.projectId);
    const results: Array<{ sceneId: string; sceneTitle: string; snippet: string; offset: number }> = [];

    const queryLower = input.query.toLowerCase();

    for (const scene of scenes) {
      if (input.manuscriptId && scene.manuscriptId !== input.manuscriptId) {
        continue;
      }

      const plain = extractPlainText(scene.content);
      let pos = plain.toLowerCase().indexOf(queryLower);

      while (pos !== -1 && results.length < input.limit) {
        const start = Math.max(0, pos - 40);
        const end = Math.min(plain.length, pos + queryLower.length + 40);
        const snippet = `...${plain.slice(start, end)}...`;

        results.push({
          sceneId: scene.id,
          sceneTitle: scene.title || "未命名场景",
          snippet,
          offset: pos,
        });

        ctx.receiptBuilder?.recordItem({
          resourceType: "scene",
          resourceId: scene.id,
          inclusionMode: "excerpt",
          excerptLength: snippet.length,
          reason: `Search match for "${input.query}"`,
        });

        pos = plain.toLowerCase().indexOf(queryLower, pos + queryLower.length);
      }

      if (results.length >= input.limit) break;
    }

    return {
      query: input.query,
      count: results.length,
      results,
    };
  }

  /**
   * 4. search_knowledge
   */
  public async searchKnowledge(input: SearchKnowledgeInput, ctx: ToolExecutionContext) {
    if (ctx.isColdReader) {
      return { error: "Cold Reader policy prohibits searching knowledge" };
    }

    const nodes = await knowledgeRepository.listNodesByProject(ctx.projectId);
    const queryLower = input.query.toLowerCase();
    const matches: Array<{ nodeId: string; title: string; kind: string; snippet: string }> = [];

    for (const node of nodes) {
      if (input.category && node.kind !== input.category) continue;

      const titleMatch = node.title.toLowerCase().includes(queryLower);
      const plainContent = extractPlainText(node.content);
      const contentMatch = plainContent.toLowerCase().includes(queryLower);

      if (titleMatch || contentMatch) {
        const start = Math.max(0, plainContent.toLowerCase().indexOf(queryLower) - 30);
        const snippet = plainContent ? `...${plainContent.slice(start, start + 80)}...` : node.title;

        matches.push({
          nodeId: node.id,
          title: node.title,
          kind: node.kind,
          snippet,
        });

        ctx.receiptBuilder?.recordItem({
          resourceType: "knowledge_node",
          resourceId: node.id,
          inclusionMode: "excerpt",
          excerptLength: snippet.length,
          reason: `Knowledge search match for "${input.query}"`,
        });
      }

      if (matches.length >= input.limit) break;
    }

    return {
      query: input.query,
      count: matches.length,
      results: matches,
    };
  }

  /**
   * 5. read_knowledge_source
   */
  public async readKnowledgeSource(input: ReadKnowledgeSourceInput, ctx: ToolExecutionContext) {
    if (ctx.isColdReader) {
      return { error: "Cold Reader policy prohibits reading knowledge sources" };
    }

    const node = await knowledgeRepository.getNodeById(input.nodeId);
    if (!node || node.projectId !== ctx.projectId) {
      return { error: "Knowledge node not found or unauthorized" };
    }

    const assets = await knowledgeRepository.listAssetsByProject(ctx.projectId);
    const relevantAssets = assets.filter((a: KnowledgeAsset) => a.nodeId === node.id);

    ctx.receiptBuilder?.recordItem({
      resourceType: "knowledge_node",
      resourceId: node.id,
      inclusionMode: "full",
      excerptLength: node.content.length,
    });

    return {
      nodeId: node.id,
      title: node.title,
      content: extractPlainText(node.content),
      assets: relevantAssets.map((a: KnowledgeAsset) => ({
        id: a.id,
        filename: a.originalFileName,
        mimeType: a.mimeType,
      })),
    };
  }

  /**
   * 6. inspect_media_segment
   */
  public async inspectMediaSegment(input: InspectMediaSegmentInput, ctx: ToolExecutionContext) {
    if (ctx.isColdReader) {
      return { error: "Cold Reader policy prohibits media inspection" };
    }

    const segment = await knowledgeRepository.getMediaSegmentById(input.segmentId);
    if (!segment || segment.projectId !== ctx.projectId) {
      return { error: "Media segment not found or unauthorized" };
    }

    ctx.receiptBuilder?.recordItem({
      resourceType: "media_segment",
      resourceId: segment.id,
      inclusionMode: "full",
      locator: (segment.metadata?.locator as Record<string, unknown>) || {},
      excerptLength: segment.transcript?.length || 0,
    });

    return {
      segmentId: segment.id,
      transcript: segment.transcript,
      description: segment.visualDescription,
      speakers: segment.speakers,
    };
  }

  /**
   * 7. get_revision
   */
  public async getRevision(input: GetRevisionInput, ctx: ToolExecutionContext) {
    const revisions = await manuscriptService.listSceneRevisions(input.sceneId, ctx.projectId);
    let targetRev = null;

    if (input.revisionId) {
      targetRev = revisions.find((r) => r.id === input.revisionId);
    } else if (input.revisionNumber) {
      targetRev = revisions.find((r) => r.revisionNumber === input.revisionNumber);
    } else {
      targetRev = revisions[0];
    }

    if (!targetRev) {
      return { error: "Revision not found" };
    }

    const plain = extractPlainText(targetRev.content);
    ctx.receiptBuilder?.recordItem({
      resourceType: "scene",
      resourceId: input.sceneId,
      inclusionMode: "full",
      revisionId: targetRev.id,
      excerptLength: plain.length,
    });

    return {
      revisionId: targetRev.id,
      revisionNumber: targetRev.revisionNumber,
      changeType: targetRev.changeType,
      description: targetRev.description,
      content: plain,
      createdAt: String(targetRev.createdAt),
    };
  }

  /**
   * 8. compare_revisions
   */
  public async compareRevisions(input: CompareRevisionsInput, ctx: ToolExecutionContext) {
    const revisions = await manuscriptService.listSceneRevisions(input.sceneId, ctx.projectId);
    const base = revisions.find((r) => r.revisionNumber === input.baseRevisionNumber);
    const target = revisions.find((r) => r.revisionNumber === input.targetRevisionNumber);

    if (!base || !target) {
      return { error: "One or both revisions not found" };
    }

    const baseText = extractPlainText(base.content);
    const targetText = extractPlainText(target.content);

    return {
      sceneId: input.sceneId,
      baseRevisionNumber: base.revisionNumber,
      targetRevisionNumber: target.revisionNumber,
      baseCharacterCount: baseText.length,
      targetCharacterCount: targetText.length,
      characterDiff: targetText.length - baseText.length,
    };
  }

  /**
   * 9. query_memory
   */
  public async queryMemory(input: QueryMemoryInput, ctx: ToolExecutionContext) {
    if (ctx.isColdReader) {
      return { error: "Cold Reader policy prohibits memory inspection" };
    }

    const memories = await memoryRepository.listMemoryEntriesByProject(ctx.projectId);
    const results = memories.slice(0, input.limit).map((m: MemoryEntry) => {
      ctx.receiptBuilder?.recordItem({
        resourceType: "memory_entry",
        resourceId: m.id,
        inclusionMode: "full",
        excerptLength: m.content.length,
      });

      return {
        id: m.id,
        key: m.key,
        content: m.content,
        scope: m.scope,
      };
    });

    return {
      count: results.length,
      entries: results,
    };
  }
}

export const readToolsEngine = new ReadToolsEngine();

