export interface SaveStreamOptions {
  stream: NodeJS.ReadableStream | ReadableStream<Uint8Array>;
  originalFileName: string;
  mimeType?: string;
  maxBytes?: number;
  projectId?: string;
}

export interface AssetStorageResult {
  sha256: string;
  storagePath: string;
  byteSize: number;
  mimeType: string;
  originalFileName: string;
}

export interface AssetStorage {
  /**
   * Stream data directly to a temporary staging file while calculating SHA-256 and enforcing byte limits,
   * then atomically place it into content-addressed storage (deduplicating physical bytes).
   */
  saveStream(options: SaveStreamOptions): Promise<AssetStorageResult>;

  /**
   * Open a readable stream to an existing stored asset by relative storage path or sha256.
   */
  getStream(storagePath: string): Promise<NodeJS.ReadableStream>;

  /**
   * Read the full buffer of an asset into memory (use with care for small/medium assets).
   */
  getBuffer(storagePath: string): Promise<Buffer>;

  /**
   * Get the absolute filesystem path to an asset, or null if it doesn't exist.
   */
  getFilePath(storagePath: string): Promise<string | null>;

  /**
   * Check if an asset exists in storage.
   */
  exists(storagePath: string): Promise<boolean>;

  /**
   * Delete an asset physically if permitted.
   */
  deleteAsset(storagePath: string): Promise<boolean>;

  /**
   * Conservatively clean up abandoned temporary upload files older than maxAgeMs.
   * Returns the count of deleted temporary files.
   */
  cleanTempFiles(maxAgeMs?: number): Promise<number>;

  /**
   * Resolve a relative storage path safely within the root data directory, preventing directory traversal.
   */
  resolvePath(storagePath: string): string;
}

