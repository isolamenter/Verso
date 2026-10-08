import {
  projectRepository,
  knowledgeRepository,
  memoryRepository,
  memoryService,
  manuscriptService,
} from "../../domain";
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
import type { TaskSnapshot } from "../../../shared/schemas/task";
import type { KnowledgeAsset, MemoryEntry } from "../../../shared/schemas";

export interface ToolExecutionContext {
  projectId: string;
  runId: string;
  threadId: string;
  receiptBuilder?: ContextReceiptBuilder;
  isColdReader?: boolean;
  task?: TaskSnapshot;
  allowedKnowledgeKinds?: string[];
}

function allowsNode(
  node: import("../../../shared/schemas/knowledge").KnowledgeNode,
  ctx: ToolExecutionContext,
) {
  if (node.status !== "active") return false;
  if (
    ctx.allowedKnowledgeKinds?.length &&
    !ctx.allowedKnowledgeKinds.includes(node.kind)
  )
    return false;
  if (ctx.task) {
    if (!ctx.task.useKnowledge) return false;
    if (
      !ctx.task.useMedia &&
      ["image_reference", "audio_reference", "video_reference"].includes(
        node.kind,
      )
    )
      return false;
    if (node.sceneId && !ctx.task.scenes.some((s) => s.id === node.sceneId))
      return false;
    if (
      node.manuscriptId &&
      !ctx.task.scenes.some((s) => s.manuscriptId === node.manuscriptId)
    )
      return false;
  }
  return true;
}
export class ReadToolsEngine {
  /**
   * 1. list_resources
   */
  public async listResources(
    input: ListResourcesInput,
    ctx: ToolExecutionContext,
  ) {
    const results: Array<{
      id: string;
      type: string;
      title: string;
      updatedAt: string;
    }> = [];

    if (input.type === "all" || input.type === "scene") {
      const scenes = ctx.task
        ? ctx.task.scenes.map((s) => ({
            ...s,
            content: s.text.slice(s.from, s.to),
            updatedAt: "",
            currentRevisionId: s.revisionId,
          }))
        : await projectRepository.listScenesByProject(ctx.projectId);
      for (const sc of scenes.slice(0, input.limit)) {
        results.push({
          id: sc.id,
          type: "scene",
          title: sc.title || "未命名场景",
          updatedAt: String(sc.updatedAt),
        });
      }
    }

    if (
      !ctx.isColdReader &&
      (ctx.task?.useKnowledge ?? true) &&
      (input.type === "all" || input.type === "knowledge")
    ) {
      const nodes = await knowledgeRepository.listNodesByProject(ctx.projectId);
      for (const kn of nodes
        .filter((n) => allowsNode(n, ctx))
        .slice(0, input.limit)) {
        results.push({
          id: kn.id,
          type: "knowledge",
          title: kn.title,
          updatedAt: String(kn.updatedAt),
        });
      }
    }

    if (
      !ctx.isColdReader &&
      (ctx.task?.useMemory ?? true) &&
      (input.type === "all" || input.type === "memory")
    ) {
      const memories = await memoryRepository.listMemoryEntriesByProject(
        ctx.projectId,
      );
      for (const m of memories
        .filter((m) => m.status === "active")
        .slice(0, input.limit)) {
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
  /**
   * 聚合读取：一次性返回当前作品所有场景的拼接全文（服务端自动分页聚合）。
   * 供 read_resource(type=manuscript) 与新增 read_full_manuscript 工具复用。
   */
  public async readFullManuscript(
    projectId: string,
    opts?: { offset?: number; maxLength?: number; manuscriptId?: string },
    ctx?: ToolExecutionContext,
  ) {
    const source = ctx?.task
      ? ctx.task.scenes
      : (await manuscriptService.listManuscriptsWithScenes(projectId))
          .flatMap((m) => m.scenes)
          .map((s) => ({
            ...s,
            revisionId: s.currentRevisionId,
            text: extractPlainText(s.content),
            from: 0,
            to: extractPlainText(s.content).length,
          }));
    if (
      opts?.manuscriptId &&
      !source.some((s) => s.manuscriptId === opts.manuscriptId)
    )
      return { error: "文稿不在本轮范围内" };
    const scenes = source.filter(
      (s) => !opts?.manuscriptId || s.manuscriptId === opts.manuscriptId,
    );
    const full = scenes.map((s) => s.text.slice(s.from, s.to)).join("\n\n");
    const start = Math.min(Math.max(0, opts?.offset ?? 0), full.length);
    const end = Math.min(
      start + Math.max(0, opts?.maxLength ?? 12000),
      full.length,
    );
    let cursor = 0;
    for (const scene of scenes) {
      const length = scene.to - scene.from;
      const from = Math.max(start, cursor),
        to = Math.min(end, cursor + length);
      if (to > from || length === 0)
        ctx?.receiptBuilder?.recordItem({
          resourceType: "scene",
          resourceId: scene.id,
          revisionId: scene.revisionId || undefined,
          inclusionMode:
            from === cursor && to === cursor + length ? "full" : "excerpt",
          excerptLength: Math.max(0, to - from),
          locator: {
            from: scene.from + from - cursor,
            to: scene.from + to - cursor,
          },
        });
      cursor += length + 2;
    }
    return {
      id: opts?.manuscriptId || projectId,
      type: "manuscript",
      content: full.slice(start, end),
      offset: start,
      nextOffset: end,
      characterCount: full.length,
      isTruncated: end < full.length,
      sceneCount: scenes.length,
      scenes: scenes.map((s) => ({
        id: s.id,
        title: s.title,
        revisionId: s.revisionId,
      })),
    };
  }

  public async readResource(
    input: ReadResourceInput,
    ctx: ToolExecutionContext,
  ) {
    const { type, id } = input;
    const offset = input.offset ?? 0;
    const maxLen = input.maxLength ?? 100000;

    if (type === "manuscript") {
      if (
        id !== ctx.projectId &&
        !(ctx.task
          ? ctx.task.scenes.some((s) => s.manuscriptId === id)
          : (
              await projectRepository.listManuscriptsByProject(ctx.projectId)
            ).some((m) => m.id === id))
      )
        return { error: "文稿不属于本作品或本轮范围" };
      return this.readFullManuscript(
        ctx.projectId,
        {
          offset,
          maxLength: maxLen,
          manuscriptId: id === ctx.projectId ? undefined : id,
        },
        ctx,
      );
    }

    if (type === "scene") {
      const snapshot = ctx.task?.scenes.find((s) => s.id === id);
      if (ctx.task && !snapshot)
        return { error: "章节不在本轮允许参考的范围内" };
      const scene = snapshot
        ? {
            ...snapshot,
            content: snapshot.text,
            currentRevisionId: snapshot.revisionId,
          }
        : await manuscriptService.getSceneById(id, ctx.projectId);
      if (!scene) {
        return {
          error: `Scene not found or unauthorized in project ${ctx.projectId}`,
        };
      }

      const plain = extractPlainText(scene.content);
      const sliceStart = Math.min(
        Math.max(snapshot?.from ?? 0, offset),
        snapshot?.to ?? plain.length,
      );
      const sliceEnd = Math.min(
        sliceStart + maxLen,
        snapshot?.to ?? plain.length,
      );
      const truncated = plain.slice(sliceStart, sliceEnd);
      const isTruncated = sliceEnd < (snapshot?.to ?? plain.length);

      ctx.receiptBuilder?.recordItem({
        resourceType: "scene",
        resourceId: id,
        inclusionMode: isTruncated ? "excerpt" : "full",
        revisionId: scene.currentRevisionId || undefined,
        excerptLength: truncated.length,
        reason: "Read by agent tool",
        locator: { from: sliceStart, to: sliceEnd },
      });

      return {
        id: scene.id,
        type: "scene",
        title: scene.title,
        content: truncated,
        offset: sliceStart,
        nextOffset: sliceEnd,
        allowedFrom: snapshot?.from ?? 0,
        allowedTo: snapshot?.to ?? plain.length,
        characterCount: plain.length,
        isTruncated,
      };
    }

    if (type === "knowledge") {
      if (ctx.isColdReader || (ctx.task && !ctx.task.useKnowledge)) {
        return {
          error: "本轮不允许读取设定和素材",
        };
      }

      const node = await knowledgeRepository.getNodeById(id);
      if (!node || node.projectId !== ctx.projectId || !allowsNode(node, ctx)) {
        return {
          error: `Knowledge node not found or unauthorized in project ${ctx.projectId}`,
        };
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
        locator: {
          title: node.title,
          source: node.metadata.source,
          sourceLocator: node.metadata.sourceLocator,
        },
      });

      return {
        id: node.id,
        type: "knowledge",
        title: node.title,
        kind: node.kind,
        authority: node.authority,
        sceneId: node.sceneId,
        manuscriptId: node.manuscriptId,
        role: node.metadata.role,
        source: node.metadata.source,
        sourceLocator: node.metadata.sourceLocator,
        conditions: node.metadata.conditions,
        content: truncated,
        offset: sliceStart,
        characterCount: plain.length,
        isTruncated,
      };
    }

    if (type === "memory") {
      if (ctx.isColdReader || (ctx.task && !ctx.task.useMemory)) {
        return { error: "本轮不允许读取偏好记忆" };
      }

      const entry = await memoryRepository.getMemoryEntryById(id);
      if (
        !entry ||
        entry.projectId !== ctx.projectId ||
        entry.status !== "active"
      ) {
        return {
          error: `Memory entry not found or unauthorized in project ${ctx.projectId}`,
        };
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
  public async searchManuscript(
    input: SearchManuscriptInput,
    ctx: ToolExecutionContext,
  ) {
    const scenes = ctx.task
      ? ctx.task.scenes.map((s) => ({
          ...s,
          content: s.text.slice(s.from, s.to),
          updatedAt: "",
          currentRevisionId: s.revisionId,
        }))
      : await projectRepository.listScenesByProject(ctx.projectId);
    const results: Array<{
      sceneId: string;
      sceneTitle: string;
      snippet: string;
      offset: number;
    }> = [];

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
          offset:
            pos + (ctx.task?.scenes.find((s) => s.id === scene.id)?.from ?? 0),
        });

        ctx.receiptBuilder?.recordItem({
          resourceType: "scene",
          resourceId: scene.id,
          inclusionMode: "excerpt",
          excerptLength: snippet.length,
          reason: `Search match for "${input.query}"`,
          revisionId: scene.currentRevisionId || undefined,
          locator: {
            from:
              start +
              (ctx.task?.scenes.find((s) => s.id === scene.id)?.from ?? 0),
            to:
              end +
              (ctx.task?.scenes.find((s) => s.id === scene.id)?.from ?? 0),
          },
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
  public async searchKnowledge(
    input: SearchKnowledgeInput,
    ctx: ToolExecutionContext,
  ) {
    if (ctx.isColdReader || (ctx.task && !ctx.task.useKnowledge)) {
      return { error: "本轮不允许搜索设定和素材" };
    }

    const nodes = await knowledgeRepository.listNodesByProject(ctx.projectId);
    const queryLower = input.query.toLowerCase();
    const matches: Array<{
      nodeId: string;
      title: string;
      kind: string;
      snippet: string;
    }> = [];

    for (const node of nodes) {
      if (!allowsNode(node, ctx)) continue;
      if (input.category && node.kind !== input.category) continue;

      const titleMatch = node.title.toLowerCase().includes(queryLower);
      const plainContent = extractPlainText(node.content);
      const contentMatch = plainContent.toLowerCase().includes(queryLower);

      if (titleMatch || contentMatch) {
        const start = Math.max(
          0,
          plainContent.toLowerCase().indexOf(queryLower) - 30,
        );
        const snippet = plainContent
          ? `...${plainContent.slice(start, start + 80)}...`
          : node.title;

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
          locator: {
            title: node.title,
            source: node.metadata.source,
            sourceLocator: node.metadata.sourceLocator,
          },
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
  public async readKnowledgeSource(
    input: ReadKnowledgeSourceInput,
    ctx: ToolExecutionContext,
  ) {
    if (ctx.isColdReader || (ctx.task && !ctx.task.useKnowledge)) {
      return {
        error: "本轮不允许读取素材来源",
      };
    }

    const node = await knowledgeRepository.getNodeById(input.nodeId);
    if (!node || node.projectId !== ctx.projectId || !allowsNode(node, ctx)) {
      return { error: "Knowledge node not found or unauthorized" };
    }

    const assets = await knowledgeRepository.listAssetsByProject(ctx.projectId);
    const relevantAssets = assets.filter(
      (a: KnowledgeAsset) => a.nodeId === node.id,
    );

    ctx.receiptBuilder?.recordItem({
      resourceType: "knowledge_node",
      resourceId: node.id,
      inclusionMode: "full",
      excerptLength: node.content.length,
      locator: {
        title: node.title,
        source: node.metadata.source,
        sourceLocator: node.metadata.sourceLocator,
      },
    });

    return {
      nodeId: node.id,
      title: node.title,
      content: extractPlainText(node.content),
      authority: node.authority,
      scope: { sceneId: node.sceneId, manuscriptId: node.manuscriptId },
      source: node.metadata.source,
      sourceLocator: node.metadata.sourceLocator,
      conditions: node.metadata.conditions,
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
  public async inspectMediaSegment(
    input: InspectMediaSegmentInput,
    ctx: ToolExecutionContext,
  ) {
    if (ctx.isColdReader || (ctx.task && !ctx.task.useMedia)) {
      return { error: "本轮不允许读取媒体" };
    }

    const segment = await knowledgeRepository.getMediaSegmentById(
      input.segmentId,
    );
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
    if (
      ctx.isColdReader ||
      (ctx.task &&
        (ctx.task.coldRead ||
          ctx.task.background === "none" ||
          !ctx.task.scenes.some((s) => s.id === input.sceneId)))
    )
      return { error: "历史版本不在本轮可读范围" };
    const revisions = await manuscriptService.listSceneRevisions(
      input.sceneId,
      ctx.projectId,
    );
    let targetRev = null;

    if (input.revisionId) {
      targetRev = revisions.find((r) => r.id === input.revisionId);
    } else if (input.revisionNumber) {
      targetRev = revisions.find(
        (r) => r.revisionNumber === input.revisionNumber,
      );
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
  public async compareRevisions(
    input: CompareRevisionsInput,
    ctx: ToolExecutionContext,
  ) {
    if (
      ctx.isColdReader ||
      (ctx.task &&
        (ctx.task.coldRead ||
          ctx.task.background === "none" ||
          !ctx.task.scenes.some((s) => s.id === input.sceneId)))
    )
      return { error: "历史版本不在本轮可读范围" };
    const revisions = await manuscriptService.listSceneRevisions(
      input.sceneId,
      ctx.projectId,
    );
    const base = revisions.find(
      (r) => r.revisionNumber === input.baseRevisionNumber,
    );
    const target = revisions.find(
      (r) => r.revisionNumber === input.targetRevisionNumber,
    );

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
    if (ctx.isColdReader || (ctx.task && !ctx.task.useMemory)) {
      return { error: "本轮不允许读取偏好记忆" };
    }

    const memories = (
      await memoryService.getScopedMemories({ projectId: ctx.projectId })
    ).memories;
    const results = memories
      .filter((m) => m.status === "active")
      .slice(0, input.limit)
      .map((m: MemoryEntry) => {
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
