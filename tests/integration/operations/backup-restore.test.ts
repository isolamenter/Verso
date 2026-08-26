import { describe, it, expect } from "vitest";
import { projectRepository } from "../../../server/domain";
import { createBackup } from "../../../scripts/backup";
import { restoreBackup } from "../../../scripts/restore";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("E20 — Backup, Recovery, and Release Hardening", () => {
  it("creates a consistent backup and verifies checksums and stats", async () => {
    const project = await projectRepository.createProject({ title: "Backup Test Project" });
    const ms = await projectRepository.createManuscript({ projectId: project.id, title: "Book 1" });
    await projectRepository.createScene({ manuscriptId: ms.id, projectId: project.id, title: "Scene 1" });

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "verso-backup-test-"));
    const { backupPath, manifest } = await createBackup(tempDir);

    expect(backupPath).toBe(tempDir);
    expect(manifest.version).toBe("2.0.0");
    expect(manifest.stats.projects).toBeGreaterThanOrEqual(1);
    expect(manifest.stats.manuscripts).toBeGreaterThanOrEqual(1);
    expect(manifest.stats.scenes).toBeGreaterThanOrEqual(1);

    const manifestFile = await fs.readFile(path.join(tempDir, "manifest.json"), "utf-8");
    expect(JSON.parse(manifestFile).checksum).toBe(manifest.checksum);

    // Test restore verification
    const restoreResult = await restoreBackup(tempDir);
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.manifest.checksum).toBe(manifest.checksum);

    // Test tamper detection
    await fs.writeFile(path.join(tempDir, "database.json"), '{"tampered": true}', "utf-8");
    await expect(restoreBackup(tempDir)).rejects.toThrow(/integrity verification failed/);

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
  }, 15000);
});
