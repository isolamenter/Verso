import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "../server/db/client";
import {
  projects,
  manuscripts,
  scenes,
  sceneRevisions,
  knowledgeNodes,
  knowledgeRevisions,
  knowledgeAssets,
  mediaSegments,
  memoryEntries,
  memoryEvidence,
  tasteEntries,
  tasteEntryEvidence,
  skillDefinitions,
  skillOverlays,
  agentThreads,
  agentMessages,
  agentRuns,
  changeSets,
  changeOperations,
} from "../server/db/schema";
import { env } from "../server/config/env";
import type { BackupManifest } from "./backup";

function parseDates<T extends Record<string, any>>(row: T): T {
  const result = { ...row };
  for (const [k, v] of Object.entries(result)) {
    if (
      typeof v === "string" &&
      (k.endsWith("At") || k.endsWith("_at")) &&
      !isNaN(Date.parse(v))
    ) {
      (result as any)[k] = new Date(v);
    }
  }
  return result;
}

export async function restoreBackup(backupDir: string): Promise<{
  success: boolean;
  manifest: BackupManifest;
  restoredStats: Record<string, number>;
}> {
  const manifestPath = path.join(backupDir, "manifest.json");
  const manifestRaw = await fs.readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw) as BackupManifest;

  const dbPath = path.join(backupDir, "database.json");
  const dbRaw = await fs.readFile(dbPath, "utf-8");

  // 1. Verify DB Checksum
  const computedChecksum = crypto.createHash("sha256").update(dbRaw).digest("hex");
  if (computedChecksum !== manifest.checksum) {
    throw new Error(`Backup database integrity verification failed: expected ${manifest.checksum}, got ${computedChecksum}`);
  }

  const data = JSON.parse(dbRaw);

  // 2. Restore DB tables transactionally
  await db.transaction(async (tx) => {
    // Upsert Projects
    for (const p of data.projects || []) {
      await tx.insert(projects).values(parseDates(p)).onConflictDoNothing();
    }
    for (const m of data.manuscripts || []) {
      await tx.insert(manuscripts).values(parseDates(m)).onConflictDoNothing();
    }
    for (const s of data.scenes || []) {
      await tx.insert(scenes).values(parseDates(s)).onConflictDoNothing();
    }
    for (const sr of data.sceneRevisions || []) {
      await tx.insert(sceneRevisions).values(parseDates(sr)).onConflictDoNothing();
    }
    for (const k of data.knowledgeNodes || []) {
      await tx.insert(knowledgeNodes).values(parseDates(k)).onConflictDoNothing();
    }
    for (const kr of data.knowledgeRevisions || []) {
      await tx.insert(knowledgeRevisions).values(parseDates(kr)).onConflictDoNothing();
    }
    for (const a of data.knowledgeAssets || []) {
      await tx.insert(knowledgeAssets).values(parseDates(a)).onConflictDoNothing();
    }
    for (const ms of data.mediaSegments || []) {
      await tx.insert(mediaSegments).values(parseDates(ms)).onConflictDoNothing();
    }
    for (const mem of data.memoryEntries || []) {
      await tx.insert(memoryEntries).values(parseDates(mem)).onConflictDoNothing();
    }
    for (const me of data.memoryEvidence || []) {
      await tx.insert(memoryEvidence).values(parseDates(me)).onConflictDoNothing();
    }
    for (const t of data.tasteEntries || []) {
      await tx.insert(tasteEntries).values(parseDates(t)).onConflictDoNothing();
    }
    for (const te of data.tasteEntryEvidence || []) {
      await tx.insert(tasteEntryEvidence).values(parseDates(te)).onConflictDoNothing();
    }
    for (const sk of data.skillDefinitions || []) {
      await tx.insert(skillDefinitions).values(parseDates(sk)).onConflictDoNothing();
    }
    for (const sko of data.skillOverlays || []) {
      await tx.insert(skillOverlays).values(parseDates(sko)).onConflictDoNothing();
    }
    for (const th of data.agentThreads || []) {
      await tx.insert(agentThreads).values(parseDates(th)).onConflictDoNothing();
    }
    for (const msg of data.agentMessages || []) {
      await tx.insert(agentMessages).values(parseDates(msg)).onConflictDoNothing();
    }
    for (const r of data.agentRuns || []) {
      await tx.insert(agentRuns).values(parseDates(r)).onConflictDoNothing();
    }
    for (const cs of data.changeSets || []) {
      await tx.insert(changeSets).values(parseDates(cs)).onConflictDoNothing();
    }
    for (const op of data.changeOperations || []) {
      await tx.insert(changeOperations).values(parseDates(op)).onConflictDoNothing();
    }
  });

  // 3. Restore asset files to local storage root
  const backupAssetsDir = path.join(backupDir, "assets");
  const targetAssetsRoot = path.resolve(path.join(env.VERSO_DATA_DIR, "assets"));
  await fs.mkdir(targetAssetsRoot, { recursive: true });

  try {
    const assetFiles = await fs.readdir(backupAssetsDir, { recursive: true });
    for (const f of assetFiles) {
      const srcFile = path.join(backupAssetsDir, f as string);
      const stat = await fs.stat(srcFile);
      if (stat.isFile()) {
        const destFile = path.join(targetAssetsRoot, f as string);
        await fs.mkdir(path.dirname(destFile), { recursive: true });
        await fs.copyFile(srcFile, destFile);
      }
    }
  } catch {
    // No assets to restore
  }

  return {
    success: true,
    manifest,
    restoredStats: manifest.stats,
  };
}

if (process.argv[1] && process.argv[1].endsWith("restore.ts")) {
  const targetDir = process.argv[2];
  if (!targetDir) {
    console.error("Usage: npx tsx scripts/restore.ts <path-to-backup-dir>");
    process.exit(1);
  }

  restoreBackup(targetDir)
    .then(({ manifest }) => {
      console.log(`[Verso Restore] Successfully restored backup from: ${targetDir}`);
      console.log(`[Verso Restore] Restored stats:`, manifest.stats);
    })
    .catch((err) => {
      console.error("[Verso Restore] Failed:", err);
      process.exit(1);
    });
}
