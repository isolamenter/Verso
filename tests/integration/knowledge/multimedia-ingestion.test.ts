import { describe, it, expect } from "vitest";
import { projectRepository, assetService } from "../../../server/domain";
import { loader as assetsLoader, action as assetsAction } from "../../../app/routes/api.projects.$projectId.assets";
import { action as retryAction } from "../../../app/routes/api.projects.$projectId.assets.$assetId.retry";

describe("E15 — Document, Image, Audio, and Video Ingestion", () => {
  it("uploads asset, computes sha256 checksum, and creates ingestion job", async () => {
    const project = await projectRepository.createProject({ title: "Multimedia Project" });
    const fakeAudioBuffer = Buffer.from("RIFF....WAVEfmt ....data....fake audio sample content");

    const result = await assetService.uploadAsset(
      project.id,
      fakeAudioBuffer,
      "interview_recording.mp3",
      "audio/mpeg"
    );

    expect(result.asset.id).toBeDefined();
    expect((result.asset.metadata as any).kind).toBe("audio");
    expect(result.asset.sha256).toBeDefined();
    expect((result.asset.metadata as any).processingStatus).toBe("pending");
    expect(result.domainJobId).toBeDefined();

    // Check retry capability without altering original bytes
    const retryRes = await assetService.retryIngestion(result.asset.id, project.id);
    expect(retryRes.asset.storagePath).toBe(result.asset.storagePath);
    expect(retryRes.domainJobId).toBeDefined();
  });

  it("handles assets API loader and upload / retry actions", async () => {
    const project = await projectRepository.createProject({ title: "Asset API Project" });

    // 1. Upload via multipart form action
    const fakeFile = new File(["test document contents for character backstory"], "backstory.txt", {
      type: "text/plain",
    });

    const formData = new FormData();
    formData.append("file", fakeFile);

    const uploadReq = new Request("http://127.0.0.1:4173/api/projects/p/assets", {
      method: "POST",
      body: formData,
    });

    const uploadRes = (await assetsAction({
      request: uploadReq,
      params: { projectId: project.id },
    })) as { success: boolean; asset: any; domainJobId: string };

    expect(uploadRes.success).toBe(true);
    expect(uploadRes.asset.originalFileName).toBe("backstory.txt");
    expect(uploadRes.asset.metadata.kind).toBe("document");

    const assetId = uploadRes.asset.id;

    // 2. Load assets list via API loader
    const loadRes = (await assetsLoader({
      params: { projectId: project.id },
    })) as { items: any[] };

    expect(loadRes.items.length).toBe(1);
    expect(loadRes.items[0].asset.id).toBe(assetId);

    // 3. Retry via API action
    const retryRes = (await retryAction({
      params: { projectId: project.id, assetId },
    })) as { success: boolean; asset: any; domainJobId: string };

    expect(retryRes.success).toBe(true);
    expect(retryRes.domainJobId).toBeDefined();
  });
});

