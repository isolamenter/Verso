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

export interface BackupManifest {
  version: string;
  appVersion: string;
  createdAt: string;
  checksum: string;
  stats: Record<string, number>;
}

export async function createBackup(outputDir?: string): Promise<{
  backupPath: string;
  manifest: BackupManifest;
}> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetDir = outputDir || path.resolve(process.cwd(), "data/backups", `backup-${timestamp}`);
  await fs.mkdir(targetDir, { recursive: true });

  // 1. Dump database tables
  const dbData = {
    projects: await db.select().from(projects),
    manuscripts: await db.select().from(manuscripts),
    scenes: await db.select().from(scenes),
    sceneRevisions: await db.select().from(sceneRevisions),
    knowledgeNodes: await db.select().from(knowledgeNodes),
    knowledgeRevisions: await db.select().from(knowledgeRevisions),
    knowledgeAssets: await db.select().from(knowledgeAssets),
    mediaSegments: await db.select().from(mediaSegments),
    memoryEntries: await db.select().from(memoryEntries),
    memoryEvidence: await db.select().from(memoryEvidence),
    tasteEntries: await db.select().from(tasteEntries),
    tasteEntryEvidence: await db.select().from(tasteEntryEvidence),
    skillDefinitions: await db.select().from(skillDefinitions),
    skillOverlays: await db.select().from(skillOverlays),
    agentThreads: await db.select().from(agentThreads),
    agentMessages: await db.select().from(agentMessages),
    agentRuns: await db.select().from(agentRuns),
    changeSets: await db.select().from(changeSets),
    changeOperations: await db.select().from(changeOperations),
  };

  const dbJson = JSON.stringify(dbData, null, 2);
  const dbPath = path.join(targetDir, "database.json");
  await fs.writeFile(dbPath, dbJson, "utf-8");

  // 2. Backup content-addressed storage assets
  const assetsSrcDir = path.resolve(path.join(env.VERSO_DATA_DIR, "assets"));
  const assetsTargetDir = path.join(targetDir, "assets");
  await fs.mkdir(assetsTargetDir, { recursive: true });

  try {
    const assetFiles = await fs.readdir(assetsSrcDir, { recursive: true });
    for (const f of assetFiles) {
      const srcFile = path.join(assetsSrcDir, f as string);
      const stat = await fs.stat(srcFile);
      if (stat.isFile()) {
        const destFile = path.join(assetsTargetDir, f as string);
        await fs.mkdir(path.dirname(destFile), { recursive: true });
        await fs.copyFile(srcFile, destFile);
      }
    }
  } catch {
    // Assets dir might be empty
  }

  // 3. Compute manifest checksum
  const dbChecksum = crypto.createHash("sha256").update(dbJson).digest("hex");

  const manifest: BackupManifest = {
    version: "2.0.0",
    appVersion: "verso-2.0-agentic",
    createdAt: new Date().toISOString(),
    checksum: dbChecksum,
    stats: {
      projects: dbData.projects.length,
      manuscripts: dbData.manuscripts.length,
      scenes: dbData.scenes.length,
      sceneRevisions: dbData.sceneRevisions.length,
      knowledgeNodes: dbData.knowledgeNodes.length,
      knowledgeAssets: dbData.knowledgeAssets.length,
      memoryEntries: dbData.memoryEntries.length,
      tasteEntries: dbData.tasteEntries.length,
      changeSets: dbData.changeSets.length,
    },
  };

  const manifestPath = path.join(targetDir, "manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  return { backupPath: targetDir, manifest };
}

if (process.argv[1] && process.argv[1].endsWith("backup.ts")) {
  createBackup()
    .then(({ backupPath, manifest }) => {
      console.log(`[Verso Backup] Successfully created backup at: ${backupPath}`);
      console.log(`[Verso Backup] Manifest:`, manifest);
    })
    .catch((err) => {
      console.error("[Verso Backup] Failed:", err);
      process.exit(1);
    });
}
