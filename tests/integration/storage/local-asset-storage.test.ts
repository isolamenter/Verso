import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalAssetStorage } from "../../../server/storage/local-asset-storage";
import { Readable } from "node:stream";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";

describe("LocalAssetStorage Integration", () => {
  let testDataDir: string;
  let storage: LocalAssetStorage;

  beforeEach(async () => {
    testDataDir = path.join(os.tmpdir(), `verso_test_storage_${crypto.randomUUID()}`);
    await fsp.mkdir(testDataDir, { recursive: true });
    storage = new LocalAssetStorage(testDataDir);
  });

  afterEach(async () => {
    try {
      await fsp.rm(testDataDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("streams and stores file content-addressed with valid SHA-256", async () => {
    const textContent = "Chapter 1: The cobbler worked in silence under the dim amber lamp.";
    const stream = Readable.from([Buffer.from(textContent, "utf-8")]);

    const result = await storage.saveStream({
      stream,
      originalFileName: "manuscript_draft.txt",
      mimeType: "text/plain",
    });

    const expectedSha256 = crypto
      .createHash("sha256")
      .update(textContent, "utf-8")
      .digest("hex");

    expect(result.sha256).toBe(expectedSha256);
    expect(result.byteSize).toBe(Buffer.byteLength(textContent, "utf-8"));
    expect(result.originalFileName).toBe("manuscript_draft.txt");
    expect(result.mimeType).toBe("text/plain");

    // Verify storage path layout: assets/xx/yy/xxxx...
    expect(result.storagePath).toBe(
      path.join("assets", expectedSha256.slice(0, 2), expectedSha256.slice(2, 4), expectedSha256)
    );

    // Verify file exists on disk
    const exists = await storage.exists(result.storagePath);
    expect(exists).toBe(true);

    // Verify buffer retrieval matches exactly
    const buffer = await storage.getBuffer(result.storagePath);
    expect(buffer.toString("utf-8")).toBe(textContent);

    // Verify stream retrieval
    const readStream = await storage.getStream(result.storagePath);
    const chunks: Buffer[] = [];
    for await (const chunk of readStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString("utf-8")).toBe(textContent);
  });

  it("deduplicates physical storage bytes when saving identical content across different uploads", async () => {
    const content = "Identical research document content shared by multiple projects.";
    const expectedSha256 = crypto.createHash("sha256").update(content).digest("hex");

    // First upload
    const upload1 = await storage.saveStream({
      stream: Readable.from([Buffer.from(content)]),
      originalFileName: "doc_a.txt",
      mimeType: "text/plain",
    });

    // Second upload of identical content with different filename
    const upload2 = await storage.saveStream({
      stream: Readable.from([Buffer.from(content)]),
      originalFileName: "doc_b.txt",
      mimeType: "text/plain",
    });

    expect(upload1.sha256).toBe(expectedSha256);
    expect(upload2.sha256).toBe(expectedSha256);
    expect(upload1.storagePath).toBe(upload2.storagePath);

    // Check that physical file exists and temp files are cleaned up
    const filePath = await storage.getFilePath(upload1.storagePath);
    expect(filePath).not.toBeNull();

    const tmpEntries = await fsp.readdir(path.join(testDataDir, "tmp"));
    expect(tmpEntries.length).toBe(0);
  });

  it("enforces maxBytes size limit during streaming and cleans up temporary staging file", async () => {
    // 50KB payload with 10KB limit
    const chunk = Buffer.alloc(1024 * 10, "A"); // 10KB
    async function* largeGenerator() {
      for (let i = 0; i < 5; i++) {
        yield chunk;
      }
    }

    const stream = Readable.from(largeGenerator());

    await expect(
      storage.saveStream({
        stream,
        originalFileName: "huge_file.txt",
        mimeType: "text/plain",
        maxBytes: 15 * 1024, // 15KB max
      })
    ).rejects.toThrow(/Upload exceeds maximum allowed size/);

    // Staging temp directory must be empty
    const tmpEntries = await fsp.readdir(path.join(testDataDir, "tmp"));
    expect(tmpEntries.length).toBe(0);
  });

  it("rejects path traversal attempts in file names and paths", async () => {
    const stream = Readable.from([Buffer.from("malicious payload")]);

    // 1. Path traversal in file name
    await expect(
      storage.saveStream({
        stream,
        originalFileName: "../../etc/passwd",
        mimeType: "text/plain",
      })
    ).rejects.toThrow(/Path traversal sequence detected/);

    // 2. Path traversal in resolvePath
    expect(() => storage.resolvePath("../../../etc/shadow")).toThrow(/Path traversal rejected/);
    expect(() => storage.resolvePath("assets/../../secret")).toThrow(/Path traversal rejected/);
    expect(() => storage.resolvePath("assets/test\0evil")).toThrow(/Path traversal rejected/);
  });

  it("detects and rejects MIME spoofing", async () => {
    // Provide plain text content while claiming it is an image/png
    const stream = Readable.from([Buffer.from("This is plain text pretending to be a PNG image")]);

    await expect(
      storage.saveStream({
        stream,
        originalFileName: "fake_image.png",
        mimeType: "image/png",
      })
    ).rejects.toThrow(/MIME spoof detected/);

    // Verify temp directory cleaned up
    const tmpEntries = await fsp.readdir(path.join(testDataDir, "tmp"));
    expect(tmpEntries.length).toBe(0);
  });

  it("conservatively cleans up abandoned temporary files without deleting stored assets", async () => {
    await storage.ensureDirs();

    // 1. Create a legitimate asset
    const validAsset = await storage.saveStream({
      stream: Readable.from([Buffer.from("Permanent knowledge asset")]),
      originalFileName: "permanent.txt",
      mimeType: "text/plain",
    });

    // 2. Create an old abandoned temporary file in tmpDir
    const staleTempFile = path.join(testDataDir, "tmp", "upload_abandoned_old.tmp");
    await fsp.writeFile(staleTempFile, "abandoned partial upload");
    // Backdate mtime by 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    await fsp.utimes(staleTempFile, twoHoursAgo, twoHoursAgo);

    // 3. Create a fresh temporary file in tmpDir (10 seconds old)
    const freshTempFile = path.join(testDataDir, "tmp", "upload_in_progress.tmp");
    await fsp.writeFile(freshTempFile, "active upload chunk");

    // Clean temp files older than 1 hour (3600,000 ms)
    const cleaned = await storage.cleanTempFiles(3600 * 1000);
    expect(cleaned).toBe(1);

    // Stale temp file removed
    await expect(fsp.access(staleTempFile)).rejects.toThrow();

    // Fresh temp file preserved
    await expect(fsp.access(freshTempFile)).resolves.toBeUndefined();

    // Stored permanent asset preserved
    expect(await storage.exists(validAsset.storagePath)).toBe(true);
  });
});

