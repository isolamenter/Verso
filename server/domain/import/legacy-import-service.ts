import { db } from "../../db/client";
import {
  projects,
  manuscripts,
  scenes,
  sceneRevisions,
  knowledgeNodes,
  knowledgeRevisions,
  skillDefinitions,
  skillOverlays,
  importJobs,
} from "../../db/schema";
import crypto from "node:crypto";
import { BUILTIN_SKILLS } from "../../skills/definitions";

export interface LegacyScenePayload {
  id?: string;
  title: string;
  content: string;
  summary?: string;
  pov?: string;
  order?: number;
}

export interface LegacyManuscriptPayload {
  id?: string;
  title: string;
  description?: string;
  scenes?: LegacyScenePayload[];
}

export interface LegacyNotePayload {
  id?: string;
  title: string;
  content: string;
  category?: string; // character, world, etc.
}

export interface LegacyCustomLensPayload {
  id?: string;
  name: string;
  focus?: string[];
  avoid?: string[];
}

export interface LegacyImportPayload {
  projectTitle: string;
  projectDescription?: string;
  manuscripts: LegacyManuscriptPayload[];
  notes?: LegacyNotePayload[];
  customLenses?: LegacyCustomLensPayload[];
}

export interface DryRunResult {
  valid: boolean;
  projectTitle: string;
  manuscriptCount: number;
  sceneCount: number;
  noteCount: number;
  customLensCount: number;
  totalWordCount: number;
  warnings: string[];
}

export interface ImportExecutionResult {
  success: boolean;
  importJobId: string;
  projectId: string;
  manuscriptIds: string[];
  sceneCount: number;
  knowledgeCount: number;
}

export class LegacyImportService {
  /**
   * Validates a legacy payload and computes a dry-run inventory.
   */
  public dryRun(payload: LegacyImportPayload): DryRunResult {
    const warnings: string[] = [];

    if (!payload.projectTitle || payload.projectTitle.trim().length === 0) {
      warnings.push("缺少项目标题，将使用默认名称");
    }

    let totalScenes = 0;
    let totalWords = 0;

    for (const ms of payload.manuscripts || []) {
      for (const sc of ms.scenes || []) {
        totalScenes++;
        totalWords += (sc.content || "").length;
      }
    }

    warnings.push("安全提醒：所有外部 API Key 与本地模型配置均已被安全过滤，不会导入数据库。");

    return {
      valid: true,
      projectTitle: payload.projectTitle || "已导入旧版书稿项目",
      manuscriptCount: (payload.manuscripts || []).length,
      sceneCount: totalScenes,
      noteCount: (payload.notes || []).length,
      customLensCount: (payload.customLenses || []).length,
      totalWordCount: totalWords,
      warnings,
    };
  }

  /**
   * Executes transactional legacy import preserving entity hierarchy, ordering, and revision baselines.
   */
  public async executeImport(payload: LegacyImportPayload): Promise<ImportExecutionResult> {
    const dry = this.dryRun(payload);
    const importJobId = crypto.randomUUID();
    const projectId = crypto.randomUUID();

    return await db.transaction(async (tx) => {
      // 1. Create Project
      await tx.insert(projects).values({
        id: projectId,
        title: dry.projectTitle,
        description: payload.projectDescription || "从旧版 IndexedDB 迁移导入",
      });

      const manuscriptIds: string[] = [];
      let importedScenesCount = 0;

      // 2. Import Manuscripts & Scenes
      for (let mIdx = 0; mIdx < (payload.manuscripts || []).length; mIdx++) {
        const ms = payload.manuscripts[mIdx];
        const msId = crypto.randomUUID();
        manuscriptIds.push(msId);

        await tx.insert(manuscripts).values({
          id: msId,
          projectId,
          title: ms.title || `书稿 ${mIdx + 1}`,
          genre: "novel",
          order: mIdx,
        });

        const sceneList = ms.scenes || [];
        for (let sIdx = 0; sIdx < sceneList.length; sIdx++) {
          const sc = sceneList[sIdx];
          const scId = crypto.randomUUID();
          const content = sc.content || "";

          await tx.insert(scenes).values({
            id: scId,
            manuscriptId: msId,
            projectId,
            title: sc.title || `场景 ${sIdx + 1}`,
            content,
            characterCount: content.length,
            order: sc.order ?? sIdx,
            summary: sc.summary || "",
            pov: sc.pov || "",
          });

          // Create initial baseline revision
          await tx.insert(sceneRevisions).values({
            id: crypto.randomUUID(),
            sceneId: scId,
            projectId,
            revisionNumber: 1,
            content,
            characterCount: content.length,
            changeType: "imported_primary",
            description: "从旧版 IndexedDB 导入初始版本",
          });

          importedScenesCount++;
        }
      }

      // 3. Import Notes into Knowledge Nodes
      let importedKnowledgeCount = 0;
      for (const note of payload.notes || []) {
        const nodeId = crypto.randomUUID();
        let kind = "custom";
        const cat = (note.category || "").toLowerCase();
        if (cat.includes("char") || cat.includes("人")) kind = "character";
        else if (cat.includes("world") || cat.includes("界") || cat.includes("规")) kind = "world_rule";
        else if (cat.includes("loc") || cat.includes("地")) kind = "location";

        await tx.insert(knowledgeNodes).values({
          id: nodeId,
          projectId,
          kind,
          title: note.title,
          content: note.content,
          authority: "imported_primary",
          status: "active",
        });

        await tx.insert(knowledgeRevisions).values({
          id: crypto.randomUUID(),
          nodeId,
          projectId,
          revisionNumber: 1,
          content: note.content,
          title: note.title,
          changeType: "imported_primary",
        });

        importedKnowledgeCount++;
      }

      // 4. Ensure Skill Definitions exist, then import Custom Lenses into Skill Overlays
      for (const skill of BUILTIN_SKILLS) {
        await tx
          .insert(skillDefinitions)
          .values({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            category: skill.category,
            isBuiltIn: true,
          })
          .onConflictDoNothing();
      }

      for (const lens of payload.customLenses || []) {
        await tx.insert(skillOverlays).values({
          id: crypto.randomUUID(),
          skillId: "literary_critique",
          projectId,
          customName: lens.name,
          focusAreas: lens.focus || [],
          avoidAreas: lens.avoid || [],
          isEnabled: true,
        });
      }

      // 5. Create Import Job Record
      await tx.insert(importJobs).values({
        id: importJobId,
        projectId,
        sourceType: "indexeddb_verso_v2",
        status: "completed",
        importedCounts: {
          manuscripts: manuscriptIds.length,
          scenes: importedScenesCount,
          knowledge: importedKnowledgeCount,
          words: dry.totalWordCount,
        },
        metadata: {
          payloadChecksum: crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
        },
      });

      return {
        success: true,
        importJobId,
        projectId,
        manuscriptIds,
        sceneCount: importedScenesCount,
        knowledgeCount: importedKnowledgeCount,
      };
    });
  }
}

export const legacyImportService = new LegacyImportService();
