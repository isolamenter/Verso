import { knowledgeRepository } from "../../index";
import { localAssetStorage } from "../../../storage/local-asset-storage";
import { jobRunner } from "../../../jobs";
import { Readable } from "node:stream";
import type {
  KnowledgeAsset,
  KnowledgeArtifact,
  MediaSegment,
  IngestionJobType,
} from "../../../../shared/schemas/knowledge";

export class AssetService {
  /**
   * Registers an uploaded asset, stores bytes locally, creates DB record, and queues ingestion job.
   */
  public async uploadAsset(
    projectId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{ asset: KnowledgeAsset; domainJobId: string }> {
    // Store raw file in content-addressed local storage
    const saveResult = await localAssetStorage.saveStream({
      stream: Readable.from(fileBuffer),
      originalFileName: fileName,
      mimeType,
    });

    // Determine asset kind and jobType
    let kind: "document" | "image" | "audio" | "video" | "other" = "other";
    let jobType: IngestionJobType = "extract_text";

    if (mimeType.startsWith("image/")) {
      kind = "image";
      jobType = "extract_text";
    } else if (mimeType.startsWith("audio/")) {
      kind = "audio";
      jobType = "transcribe_audio";
    } else if (mimeType.startsWith("video/")) {
      kind = "video";
      jobType = "analyze_video";
    } else {
      kind = "document";
      jobType = "extract_text";
    }

    const asset = await knowledgeRepository.createAsset({
      projectId,
      originalFileName: fileName,
      mimeType,
      byteSize: saveResult.byteSize,
      sha256: saveResult.sha256,
      storagePath: saveResult.storagePath,
      metadata: {
        kind,
        processingStatus: "pending",
      },
    });

    // Enqueue with pg-boss and create domain job
    const jobRes = await jobRunner.enqueueIngestionJob({
      projectId,
      assetId: asset.id,
      jobType,
    });

    return { asset, domainJobId: jobRes.domainJobId };
  }

  /**
   * Retries an ingestion job without altering the immutable original asset bytes.
   */
  public async retryIngestion(
    assetId: string,
    projectId: string
  ): Promise<{ asset: KnowledgeAsset; domainJobId: string }> {
    const asset = await knowledgeRepository.getAssetById(assetId);
    if (!asset || asset.projectId !== projectId) {
      throw new Error(`Asset not found or unauthorized: ${assetId}`);
    }

    const meta = (asset.metadata || {}) as Record<string, any>;
    const kind = (meta.kind as string) || "document";

    await knowledgeRepository.updateAsset(assetId, {
      metadata: {
        ...meta,
        processingStatus: "pending",
        processingError: null,
      },
    });

    let jobType: IngestionJobType = "extract_text";
    if (kind === "audio") jobType = "transcribe_audio";
    else if (kind === "video") jobType = "analyze_video";

    const jobRes = await jobRunner.enqueueIngestionJob({
      projectId,
      assetId: asset.id,
      jobType,
    });

    return { asset, domainJobId: jobRes.domainJobId };
  }

  /**
   * Lists all assets for a project with their derived artifacts and media segments.
   */
  public async listAssetsWithDetails(projectId: string): Promise<
    Array<{
      asset: KnowledgeAsset;
      artifacts: KnowledgeArtifact[];
      segments: MediaSegment[];
    }>
  > {
    const assets = await knowledgeRepository.listAssetsByProject(projectId);
    const results = [];

    for (const asset of assets) {
      const artifacts = await knowledgeRepository.listArtifactsByAsset(asset.id);
      const segments = await knowledgeRepository.listMediaSegmentsByAsset(asset.id);
      results.push({ asset, artifacts, segments });
    }

    return results;
  }
}

export const assetService = new AssetService();

