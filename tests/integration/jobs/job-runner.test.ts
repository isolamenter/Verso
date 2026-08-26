import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { PgBossJobRunner } from "../../../server/jobs/pg-boss-runner";
import { projectRepository, knowledgeRepository } from "../../../server/domain";
import { assetStorage } from "../../../server/storage";
import { Readable } from "node:stream";

describe("PgBossJobRunner Integration", () => {
  let runner: PgBossJobRunner;
  const createdProjectIds: string[] = [];

  beforeAll(async () => {
    runner = new PgBossJobRunner();
    await runner.start();
  });

  afterAll(async () => {
    await runner.stop();
  });

  afterEach(async () => {
    for (const id of createdProjectIds) {
      try {
        await projectRepository.deleteProject(id);
      } catch {
        // ignore cleanup error
      }
    }
    createdProjectIds.length = 0;
  });

  it("enqueues and processes a text extraction ingestion job with domain state transitions", async () => {
    const proj = await projectRepository.createProject({ title: "Ingestion Test Project" });
    createdProjectIds.push(proj.id);

    const textContent = "Manuscript Chapter 2: The sound of rain on the wooden tiles.";
    const stored = await assetStorage.saveStream({
      stream: Readable.from([Buffer.from(textContent, "utf-8")]),
      originalFileName: "chapter_2.txt",
      mimeType: "text/plain",
    });

    const asset = await knowledgeRepository.createAsset({
      projectId: proj.id,
      sha256: stored.sha256,
      storagePath: stored.storagePath,
      originalFileName: stored.originalFileName,
      mimeType: stored.mimeType,
      byteSize: stored.byteSize,
    });

    // 1. Enqueue job
    const { domainJobId } = await runner.enqueueIngestionJob({
      projectId: proj.id,
      assetId: asset.id,
      jobType: "extract_text",
    });

    expect(domainJobId).toBeDefined();

    // 2. Poll for completion (up to 20 seconds)
    let finalJob = await runner.getJobStatus(domainJobId);
    const start = Date.now();
    while (finalJob && (finalJob.status === "pending" || finalJob.status === "processing") && Date.now() - start < 20000) {
      await new Promise((r) => setTimeout(r, 200));
      finalJob = await runner.getJobStatus(domainJobId);
    }

    expect(finalJob?.status).toBe("completed");
    expect(finalJob?.progress).toBe(100);

    // 3. Verify created artifacts and chunks
    const nodes = await knowledgeRepository.listNodesByProject(proj.id);
    expect(nodes.length).toBeGreaterThan(0);

    const artifacts = await knowledgeRepository.listArtifactsByNode(nodes[0].id);
    expect(artifacts.length).toBeGreaterThan(0);
    expect(artifacts[0].content).toBe(textContent);
    expect(artifacts[0].layer).toBe("extraction");

    const chunks = await knowledgeRepository.listChunksByNode(nodes[0].id);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toBe(textContent);
  }, 25000);

  it("handles singleton key to prevent duplicate concurrent runs for the same asset", async () => {
    const proj = await projectRepository.createProject({ title: "Singleton Job Project" });
    createdProjectIds.push(proj.id);

    const stored = await assetStorage.saveStream({
      stream: Readable.from([Buffer.from("Brief note content.")]),
      originalFileName: "note.txt",
      mimeType: "text/plain",
    });

    const asset = await knowledgeRepository.createAsset({
      projectId: proj.id,
      sha256: stored.sha256,
      storagePath: stored.storagePath,
      originalFileName: stored.originalFileName,
      mimeType: stored.mimeType,
      byteSize: stored.byteSize,
    });

    const singletonKey = `extract_text:${asset.id}`;

    // First enqueue
    const job1 = await runner.enqueueIngestionJob({
      projectId: proj.id,
      assetId: asset.id,
      jobType: "extract_text",
      singletonKey,
    });

    // Immediate second enqueue with identical singleton key
    const job2 = await runner.enqueueIngestionJob({
      projectId: proj.id,
      assetId: asset.id,
      jobType: "extract_text",
      singletonKey,
    });

    expect(job1.domainJobId).not.toBe(job2.domainJobId);
  }, 10000);

  it("supports cancelling a domain job", async () => {
    const proj = await projectRepository.createProject({ title: "Cancel Job Project" });
    createdProjectIds.push(proj.id);

    const stored = await assetStorage.saveStream({
      stream: Readable.from([Buffer.from("....ftypisomVideo sample for cancellation test")]),
      originalFileName: "footage.mp4",
      mimeType: "video/mp4",
    });

    const asset = await knowledgeRepository.createAsset({
      projectId: proj.id,
      sha256: stored.sha256,
      storagePath: stored.storagePath,
      originalFileName: stored.originalFileName,
      mimeType: stored.mimeType,
      byteSize: stored.byteSize,
    });

    // Create a domain job directly in pending state
    const domainJob = await knowledgeRepository.createIngestionJob({
      projectId: proj.id,
      assetId: asset.id,
      jobType: "analyze_video",
      status: "pending",
    });

    const cancelled = await runner.cancelJob(domainJob.id);
    expect(cancelled).toBe(true);

    const updated = await runner.getJobStatus(domainJob.id);
    expect(updated?.status).toBe("cancelled");
  });

  it("handles audio transcription and video timeline ingestion jobs", async () => {
    const proj = await projectRepository.createProject({ title: "Media Ingestion Project" });
    createdProjectIds.push(proj.id);

    // Test audio transcription
    const audioStored = await assetStorage.saveStream({
      stream: Readable.from([Buffer.from("ID3fake audio payload")]),
      originalFileName: "interview.mp3",
      mimeType: "audio/mpeg",
    });

    const audioAsset = await knowledgeRepository.createAsset({
      projectId: proj.id,
      sha256: audioStored.sha256,
      storagePath: audioStored.storagePath,
      originalFileName: audioStored.originalFileName,
      mimeType: audioStored.mimeType,
      byteSize: audioStored.byteSize,
    });

    const audioJob = await runner.enqueueIngestionJob({
      projectId: proj.id,
      assetId: audioAsset.id,
      jobType: "transcribe_audio",
    });

    // Wait for audio job
    let finalAudioJob = await runner.getJobStatus(audioJob.domainJobId);
    const startAudio = Date.now();
    while (finalAudioJob && (finalAudioJob.status === "pending" || finalAudioJob.status === "processing") && Date.now() - startAudio < 10000) {
      await new Promise((r) => setTimeout(r, 200));
      finalAudioJob = await runner.getJobStatus(audioJob.domainJobId);
    }
    expect(finalAudioJob?.status).toBe("completed");

    // Test video analysis
    const videoStored = await assetStorage.saveStream({
      stream: Readable.from([Buffer.from("....ftypisomvideo payload")]),
      originalFileName: "scene_reference.mp4",
      mimeType: "video/mp4",
    });

    const videoAsset = await knowledgeRepository.createAsset({
      projectId: proj.id,
      sha256: videoStored.sha256,
      storagePath: videoStored.storagePath,
      originalFileName: videoStored.originalFileName,
      mimeType: videoStored.mimeType,
      byteSize: videoStored.byteSize,
    });

    const videoJob = await runner.enqueueIngestionJob({
      projectId: proj.id,
      assetId: videoAsset.id,
      jobType: "analyze_video",
    });

    let finalVideoJob = await runner.getJobStatus(videoJob.domainJobId);
    const startVideo = Date.now();
    while (finalVideoJob && (finalVideoJob.status === "pending" || finalVideoJob.status === "processing") && Date.now() - startVideo < 10000) {
      await new Promise((r) => setTimeout(r, 200));
      finalVideoJob = await runner.getJobStatus(videoJob.domainJobId);
    }
    expect(finalVideoJob?.status).toBe("completed");

    const segments = await knowledgeRepository.listMediaSegmentsByAsset(videoAsset.id);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0].segmentType).toBe("video_scene");
  }, 20000);

  it("restarts runner and resumes processing queued jobs without duplicate domain side-effects", async () => {
    const proj = await projectRepository.createProject({ title: "Restart Runner Project" });
    createdProjectIds.push(proj.id);

    const stored = await assetStorage.saveStream({
      stream: Readable.from([Buffer.from("Notes preserved through worker restart.")]),
      originalFileName: "restart_note.txt",
      mimeType: "text/plain",
    });

    const asset = await knowledgeRepository.createAsset({
      projectId: proj.id,
      sha256: stored.sha256,
      storagePath: stored.storagePath,
      originalFileName: stored.originalFileName,
      mimeType: stored.mimeType,
      byteSize: stored.byteSize,
    });

    // 1. Stop current runner
    await runner.stop();
    expect(runner.isStarted()).toBe(false);

    // 2. Instantiate and start a new runner instance (simulating worker restart)
    const newRunner = new PgBossJobRunner();
    await newRunner.start();
    expect(newRunner.isStarted()).toBe(true);

    // 3. Enqueue job on the new runner
    const { domainJobId } = await newRunner.enqueueIngestionJob({
      projectId: proj.id,
      assetId: asset.id,
      jobType: "extract_text",
    });

    let jobStatus = await newRunner.getJobStatus(domainJobId);
    const start = Date.now();
    while (jobStatus && (jobStatus.status === "pending" || jobStatus.status === "processing") && Date.now() - start < 10000) {
      await new Promise((r) => setTimeout(r, 200));
      jobStatus = await newRunner.getJobStatus(domainJobId);
    }

    expect(jobStatus?.status).toBe("completed");

    // Clean up new runner and re-assign runner for afterAll cleanup
    await newRunner.stop();
    runner = new PgBossJobRunner();
    await runner.start();
  }, 25000);
});

