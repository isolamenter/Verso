import { knowledgeRepository } from "../../domain";
import { assetStorage } from "../../storage";
import type { IngestionJobContext } from "../types";
import mammoth from "mammoth";

export class IngestionHandlers {
  /**
   * Dispatches an ingestion job context to the corresponding typed handler.
   */
  static async handleJob(ctx: IngestionJobContext): Promise<void> {
    const { jobType } = ctx.payload;

    switch (jobType) {
      case "extract_text":
        await IngestionHandlers.handleExtractText(ctx);
        break;
      case "transcribe_audio":
        await IngestionHandlers.handleTranscribeAudio(ctx);
        break;
      case "analyze_video":
        await IngestionHandlers.handleAnalyzeVideo(ctx);
        break;
      case "generate_summary":
        await IngestionHandlers.handleGenerateSummary(ctx);
        break;
      case "generate_embeddings":
        await IngestionHandlers.handleGenerateEmbeddings(ctx);
        break;
      default:
        throw new Error(`Unknown ingestion job type: ${jobType}`);
    }
  }

  static async handleExtractText(ctx: IngestionJobContext): Promise<void> {
    const { projectId, assetId, nodeId } = ctx.payload;

    if (await ctx.isCancelled()) return;
    await ctx.reportProgress(10, { step: "loading_asset" });

    const asset = await knowledgeRepository.getAssetById(assetId);
    if (!asset) {
      throw new Error(`Asset not found for id: ${assetId}`);
    }

    const buffer = await assetStorage.getBuffer(asset.storagePath);
    let extractedText = "";

    await ctx.reportProgress(30, { step: "parsing_content" });
    if (await ctx.isCancelled()) return;

    const mime = asset.mimeType.toLowerCase();

    if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      asset.originalFileName.endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value.trim();
    } else if (mime === "application/pdf" || asset.originalFileName.endsWith(".pdf")) {
      // Basic text extraction for PDF
      extractedText = buffer
        .toString("utf-8")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
        .trim();
      if (!extractedText || extractedText.length < 10) {
        extractedText = `[PDF Document: ${asset.originalFileName}, ${asset.byteSize} bytes]`;
      }
    } else {
      // Plain text / markdown / json / csv
      extractedText = buffer.toString("utf-8").trim();
    }

    if (await ctx.isCancelled()) return;
    await ctx.reportProgress(70, { step: "saving_artifacts" });

    // Target node ID: if not directly provided in payload, check if asset is attached to a node, or create a node
    let targetNodeId = nodeId || asset.nodeId;
    if (!targetNodeId) {
      const newNode = await knowledgeRepository.createNode({
        projectId,
        kind: "reference_document",
        title: asset.originalFileName,
        content: extractedText,
        authority: "imported_primary",
      });
      targetNodeId = newNode.id;
    }

    // Persist extraction artifact (idempotent: we create or record the artifact)
    const artifact = await knowledgeRepository.createArtifact({
      projectId,
      nodeId: targetNodeId,
      assetId: asset.id,
      layer: "extraction",
      generatorType: "text_extractor",
      generatorVersion: "1.0.0",
      content: extractedText,
      structuredData: {
        originalFileName: asset.originalFileName,
        byteSize: asset.byteSize,
        charCount: extractedText.length,
      },
    });

    // Create chunks if extracted text is available
    if (extractedText.length > 0) {
      const chunkSize = 1000;
      const chunks = [];
      for (let i = 0; i < extractedText.length; i += chunkSize) {
        chunks.push(extractedText.slice(i, i + chunkSize));
      }

      for (let idx = 0; idx < chunks.length; idx++) {
        await knowledgeRepository.createChunk({
          projectId,
          nodeId: targetNodeId,
          artifactId: artifact.id,
          chunkIndex: idx,
          content: chunks[idx],
          sourceLocator: {
            startOffset: idx * chunkSize,
            endOffset: idx * chunkSize + chunks[idx].length,
          },
        });
      }
    }

    await ctx.reportProgress(100, { step: "completed", artifactId: artifact.id });
  }

  static async handleTranscribeAudio(ctx: IngestionJobContext): Promise<void> {
    const { projectId, assetId, nodeId } = ctx.payload;

    if (await ctx.isCancelled()) return;
    await ctx.reportProgress(20, { step: "preparing_audio" });

    const asset = await knowledgeRepository.getAssetById(assetId);
    if (!asset) {
      throw new Error(`Asset not found for id: ${assetId}`);
    }

    if (await ctx.isCancelled()) return;
    await ctx.reportProgress(50, { step: "transcribing" });

    let targetNodeId = nodeId || asset.nodeId;
    if (!targetNodeId) {
      const newNode = await knowledgeRepository.createNode({
        projectId,
        kind: "audio_reference",
        title: asset.originalFileName,
        content: `[Audio Recording: ${asset.originalFileName}]`,
        authority: "imported_primary",
      });
      targetNodeId = newNode.id;
    }

    const artifact = await knowledgeRepository.createArtifact({
      projectId,
      nodeId: targetNodeId,
      assetId: asset.id,
      layer: "extraction",
      generatorType: "audio_transcriber",
      generatorVersion: "1.0.0",
      content: `[Audio transcript placeholder for ${asset.originalFileName}]`,
      structuredData: {
        durationMs: 0,
        originalFileName: asset.originalFileName,
      },
    });

    await ctx.reportProgress(100, { step: "completed", artifactId: artifact.id });
  }

  static async handleAnalyzeVideo(ctx: IngestionJobContext): Promise<void> {
    const { projectId, assetId, nodeId } = ctx.payload;

    if (await ctx.isCancelled()) return;
    await ctx.reportProgress(20, { step: "preparing_video" });

    const asset = await knowledgeRepository.getAssetById(assetId);
    if (!asset) {
      throw new Error(`Asset not found for id: ${assetId}`);
    }

    if (await ctx.isCancelled()) return;
    await ctx.reportProgress(60, { step: "generating_multimodal_timeline" });

    let targetNodeId = nodeId || asset.nodeId;
    if (!targetNodeId) {
      const newNode = await knowledgeRepository.createNode({
        projectId,
        kind: "video_reference",
        title: asset.originalFileName,
        content: `[Video Asset: ${asset.originalFileName}]`,
        authority: "imported_primary",
      });
      targetNodeId = newNode.id;
    }

    const artifact = await knowledgeRepository.createArtifact({
      projectId,
      nodeId: targetNodeId,
      assetId: asset.id,
      layer: "extraction",
      generatorType: "video_analyzer",
      generatorVersion: "1.0.0",
      content: `[Video timeline artifact for ${asset.originalFileName}]`,
      structuredData: {
        originalFileName: asset.originalFileName,
      },
    });

    // Create a sample media segment
    await knowledgeRepository.createMediaSegment({
      projectId,
      assetId: asset.id,
      segmentType: "video_scene",
      startTimeMs: 0,
      endTimeMs: 10000,
      visualDescription: `Opening scene of ${asset.originalFileName}`,
      transcript: "Scene opening dialogue.",
      speakers: ["Speaker 1"],
    });

    await ctx.reportProgress(100, { step: "completed", artifactId: artifact.id });
  }

  static async handleGenerateSummary(ctx: IngestionJobContext): Promise<void> {
    const { projectId, assetId, nodeId } = ctx.payload;

    if (await ctx.isCancelled()) return;
    await ctx.reportProgress(30, { step: "reading_artifacts" });

    let targetNodeId = nodeId;
    if (!targetNodeId) {
      const asset = await knowledgeRepository.getAssetById(assetId);
      targetNodeId = asset?.nodeId ?? undefined;
    }

    if (!targetNodeId) {
      throw new Error("Target node ID is required for generating summary");
    }

    const node = await knowledgeRepository.getNodeById(targetNodeId);
    if (!node) {
      throw new Error(`Node not found: ${targetNodeId}`);
    }

    if (await ctx.isCancelled()) return;
    await ctx.reportProgress(70, { step: "summarizing" });

    const summaryContent = node.content
      ? node.content.slice(0, 300) + (node.content.length > 300 ? "..." : "")
      : `Summary of ${node.title}`;

    await knowledgeRepository.updateNode(node.id, {
      summary: summaryContent,
    });

    const artifact = await knowledgeRepository.createArtifact({
      projectId,
      nodeId: node.id,
      assetId,
      layer: "summary",
      generatorType: "summary_generator",
      generatorVersion: "1.0.0",
      content: summaryContent,
    });

    await ctx.reportProgress(100, { step: "completed", artifactId: artifact.id });
  }

  static async handleGenerateEmbeddings(ctx: IngestionJobContext): Promise<void> {
    const { assetId, nodeId } = ctx.payload;

    if (await ctx.isCancelled()) return;
    await ctx.reportProgress(40, { step: "generating_embeddings" });

    let targetNodeId = nodeId;
    if (!targetNodeId) {
      const asset = await knowledgeRepository.getAssetById(assetId);
      targetNodeId = asset?.nodeId ?? undefined;
    }

    if (targetNodeId) {
      const chunks = await knowledgeRepository.listChunksByNode(targetNodeId);
      for (const chunk of chunks) {
        if (await ctx.isCancelled()) return;
        if (!chunk.embedding) {
          // Placeholder embedding generation if missing
        }
      }
    }

    await ctx.reportProgress(100, { step: "completed" });
  }
}

