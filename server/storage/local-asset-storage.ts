import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { env } from "../config/env";
import type {
  AssetStorage,
  AssetStorageResult,
  SaveStreamOptions,
} from "./asset-storage";
import { validateMimeType } from "./mime-validator";

export class LocalAssetStorage implements AssetStorage {
  private readonly rootDir: string;
  private readonly assetsDir: string;
  private readonly tmpDir: string;

  constructor(customRootDir?: string) {
    this.rootDir = path.resolve(customRootDir ?? env.VERSO_DATA_DIR);
    this.assetsDir = path.join(this.rootDir, "assets");
    this.tmpDir = path.join(this.rootDir, "tmp");
  }

  /**
   * Initializes storage directories if they do not already exist.
   */
  async ensureDirs(): Promise<void> {
    await fsp.mkdir(this.assetsDir, { recursive: true });
    await fsp.mkdir(this.tmpDir, { recursive: true });
  }

  /**
   * Resolves and validates a storage path within the root directory.
   * Throws an error if the path attempts directory traversal.
   */
  resolvePath(storagePath: string): string {
    if (!storagePath || typeof storagePath !== "string") {
      throw new Error("Invalid storage path provided");
    }

    if (storagePath.includes("\0") || storagePath.includes("..")) {
      throw new Error(`Security Violation: Path traversal rejected: '${storagePath}'`);
    }

    // Storage paths can either be relative (e.g. "assets/ab/cd/...") or bare sha256
    let relative = storagePath;
    if (!relative.startsWith("assets/") && /^[a-f0-9]{64}$/i.test(relative)) {
      relative = path.join(
        "assets",
        relative.slice(0, 2),
        relative.slice(2, 4),
        relative
      );
    }

    const resolved = path.resolve(this.rootDir, relative);
    const normalizedRoot = path.resolve(this.rootDir);

    if (
      !resolved.startsWith(normalizedRoot + path.sep) &&
      resolved !== normalizedRoot
    ) {
      throw new Error(`Security Violation: Path escapes storage root: '${storagePath}'`);
    }

    return resolved;
  }

  /**
   * Streams upload to a temporary file while calculating SHA-256 and enforcing byte limits,
   * then atomically moves into content-addressed store.
   */
  async saveStream(options: SaveStreamOptions): Promise<AssetStorageResult> {
    await this.ensureDirs();

    const maxBytes = options.maxBytes ?? env.VERSO_MAX_UPLOAD_BYTES;
    const tempFileName = `upload_${crypto.randomUUID()}.tmp`;
    const tempFilePath = path.join(this.tmpDir, tempFileName);

    let nodeStream: NodeJS.ReadableStream;
    if (options.stream instanceof Readable) {
      nodeStream = options.stream;
    } else if (
      typeof (options.stream as ReadableStream<Uint8Array>)?.getReader === "function"
    ) {
      nodeStream = Readable.fromWeb(options.stream as unknown as import("node:stream/web").ReadableStream);
    } else {
      nodeStream = Readable.from(options.stream as AsyncIterable<Uint8Array>);
    }

    const hash = crypto.createHash("sha256");
    const writeStream = fs.createWriteStream(tempFilePath, { flags: "w" });

    let byteSize = 0;
    const headerChunks: Buffer[] = [];
    let headerCollectedBytes = 0;
    const HEADER_LIMIT = 4096;

    let mimeValidationChecked = false;
    let detectedMime = options.mimeType || "application/octet-stream";
    let sanitizedFileName = "unnamed_asset";

    const cleanTempFile = async () => {
      try {
        await fsp.unlink(tempFilePath);
      } catch {
        // Ignore if file doesn't exist
      }
    };

    try {
      for await (const chunk of nodeStream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        byteSize += buffer.length;

        if (byteSize > maxBytes) {
          writeStream.destroy();
          await cleanTempFile();
          throw new Error(
            `Upload exceeds maximum allowed size of ${maxBytes} bytes (received ${byteSize} bytes)`
          );
        }

        hash.update(buffer);
        writeStream.write(buffer);

        if (!mimeValidationChecked) {
          if (headerCollectedBytes < HEADER_LIMIT) {
            headerChunks.push(buffer);
            headerCollectedBytes += buffer.length;
          }

          // Once we have at least 512 bytes or the stream is short
          if (headerCollectedBytes >= 512) {
            const headerBuffer = Buffer.concat(headerChunks);
            const validation = validateMimeType(
              options.mimeType,
              headerBuffer,
              options.originalFileName
            );

            if (!validation.isValid) {
              writeStream.destroy();
              await cleanTempFile();
              throw new Error(
                `MIME / Path Validation Failed: ${validation.reason || "Invalid file content or name"}`
              );
            }

            detectedMime = validation.detectedMime;
            sanitizedFileName = validation.sanitizedFileName;
            mimeValidationChecked = true;
          }
        }
      }

      // Finish writing
      await new Promise<void>((resolve, reject) => {
        writeStream.end((err?: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // If stream was smaller than 512 bytes and validation was not run yet
      if (!mimeValidationChecked) {
        const headerBuffer = Buffer.concat(headerChunks);
        const validation = validateMimeType(
          options.mimeType,
          headerBuffer,
          options.originalFileName
        );

        if (!validation.isValid) {
          await cleanTempFile();
          throw new Error(
            `MIME / Path Validation Failed: ${validation.reason || "Invalid file content or name"}`
          );
        }

        detectedMime = validation.detectedMime;
        sanitizedFileName = validation.sanitizedFileName;
      }

      const sha256 = hash.digest("hex");
      const relativeStoragePath = path.join(
        "assets",
        sha256.slice(0, 2),
        sha256.slice(2, 4),
        sha256
      );
      const destinationPath = path.resolve(this.rootDir, relativeStoragePath);
      const destinationDir = path.dirname(destinationPath);

      await fsp.mkdir(destinationDir, { recursive: true });

      // Physical Deduplication:
      // If an identical file already exists at the destination path, discard the temp file.
      try {
        await fsp.access(destinationPath);
        // Destination already exists! Clean up the temporary upload file
        await cleanTempFile();
      } catch {
        // Destination does not exist yet. Move the temporary file into place atomically.
        try {
          await fsp.rename(tempFilePath, destinationPath);
        } catch (renameErr) {
          // In case rename fails due to cross-device link (EXDEV), fallback to copy + unlink
          await fsp.copyFile(tempFilePath, destinationPath);
          await cleanTempFile();
        }
      }

      return {
        sha256,
        storagePath: relativeStoragePath,
        byteSize,
        mimeType: detectedMime,
        originalFileName: sanitizedFileName,
      };
    } catch (err) {
      writeStream.destroy();
      await cleanTempFile();
      throw err;
    }
  }

  /**
   * Opens a readable stream to an existing stored asset.
   */
  async getStream(storagePath: string): Promise<NodeJS.ReadableStream> {
    const resolved = this.resolvePath(storagePath);
    try {
      await fsp.access(resolved);
    } catch {
      throw new Error(`Asset not found at '${storagePath}'`);
    }
    return fs.createReadStream(resolved);
  }

  /**
   * Reads an asset fully into a buffer.
   */
  async getBuffer(storagePath: string): Promise<Buffer> {
    const resolved = this.resolvePath(storagePath);
    try {
      return await fsp.readFile(resolved);
    } catch (err) {
      throw new Error(`Asset not found at '${storagePath}': ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Returns the absolute path to an asset if it exists, or null.
   */
  async getFilePath(storagePath: string): Promise<string | null> {
    try {
      const resolved = this.resolvePath(storagePath);
      await fsp.access(resolved);
      return resolved;
    } catch {
      return null;
    }
  }

  /**
   * Checks if an asset exists.
   */
  async exists(storagePath: string): Promise<boolean> {
    try {
      const resolved = this.resolvePath(storagePath);
      await fsp.access(resolved);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Deletes an asset physically from storage.
   */
  async deleteAsset(storagePath: string): Promise<boolean> {
    try {
      const resolved = this.resolvePath(storagePath);
      await fsp.unlink(resolved);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Conservatively cleans up abandoned temporary files in tmpDir older than maxAgeMs.
   */
  async cleanTempFiles(maxAgeMs = 3600_000): Promise<number> {
    await this.ensureDirs();
    let cleanedCount = 0;
    const now = Date.now();

    try {
      const entries = await fsp.readdir(this.tmpDir);
      for (const entry of entries) {
        const fullPath = path.join(this.tmpDir, entry);
        try {
          const stat = await fsp.stat(fullPath);
          if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) {
            await fsp.unlink(fullPath);
            cleanedCount++;
          }
        } catch {
          // Ignore individual file error
        }
      }
    } catch {
      // Ignore if tmpDir read fails
    }

    return cleanedCount;
  }
}

export const localAssetStorage = new LocalAssetStorage();
