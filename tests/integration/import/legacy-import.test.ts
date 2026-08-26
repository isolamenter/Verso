import { describe, it, expect } from "vitest";
import {
  legacyImportService,
  projectRepository,
  knowledgeRepository,
} from "../../../server/domain";
import { action as importAction } from "../../../app/routes/api.import.legacy";

describe("E19 — One-Time Legacy Import and Cutover", () => {
  const sampleLegacyPayload = {
    projectTitle: "长夜余火 (旧版迁移)",
    projectDescription: "旧版历史作品数据",
    manuscripts: [
      {
        title: "第一卷：荒野的呼唤",
        description: "旧版卷一",
        scenes: [
          {
            title: "第一章：灰土上的流浪者",
            content: "狂风呼啸过锈迹斑斑的钢铁残骸，卷起漫天沙尘。",
            summary: "主角登场荒野",
            pov: "商见曜",
            order: 0,
          },
          {
            title: "第二章：机械僧侣",
            content: "在废弃的加油站旁，一位身披袈裟的机械人正在合十诵经。",
            summary: "遭遇机械僧侣",
            pov: "蒋白棉",
            order: 1,
          },
        ],
      },
    ],
    notes: [
      {
        title: "商见曜",
        content: "【人物设定】\n红石集孤儿，性格多变，拥有多种思维人格。",
        category: "character",
      },
      {
        title: "心智网络法则",
        content: "【世界观设定】\n旧世界毁灭后残留的潜意识海洋与觉醒者能力体系。",
        category: "world_rule",
      },
    ],
    customLenses: [
      {
        name: "废土冷硬风格透镜",
        focus: ["强化铁锈与风沙的质感", "凸显末世生存张力"],
        avoid: ["避免出现温情浪漫主义修饰"],
      },
    ],
  };

  it("calculates accurate dry-run inventory and validates security constraints", () => {
    const dryRun = legacyImportService.dryRun(sampleLegacyPayload);

    expect(dryRun.valid).toBe(true);
    expect(dryRun.projectTitle).toBe("长夜余火 (旧版迁移)");
    expect(dryRun.manuscriptCount).toBe(1);
    expect(dryRun.sceneCount).toBe(2);
    expect(dryRun.noteCount).toBe(2);
    expect(dryRun.customLensCount).toBe(1);
    expect(dryRun.totalWordCount).toBeGreaterThan(0);
    expect(dryRun.warnings.some((w) => w.includes("API Key"))).toBe(true);
  });

  it("executes transactional import, creating baseline revisions and knowledge hierarchy", async () => {
    const result = await legacyImportService.executeImport(sampleLegacyPayload);

    expect(result.success).toBe(true);
    expect(result.projectId).toBeDefined();
    expect(result.sceneCount).toBe(2);
    expect(result.knowledgeCount).toBe(2);

    // 1. Verify Project
    const project = await projectRepository.getProjectById(result.projectId);
    expect(project?.title).toBe("长夜余火 (旧版迁移)");

    // 2. Verify Manuscript & Scenes
    const manuscripts = await projectRepository.listManuscriptsByProject(result.projectId);
    expect(manuscripts.length).toBe(1);

    const scenes = await projectRepository.listScenesByManuscript(manuscripts[0].id);
    expect(scenes.length).toBe(2);
    expect(scenes[0].title).toBe("第一章：灰土上的流浪者");

    // 3. Verify Baseline Revisions
    const revs = await projectRepository.listSceneRevisions(scenes[0].id);
    expect(revs.length).toBe(1);
    expect(revs[0].changeType).toBe("imported_primary");
    expect(revs[0].revisionNumber).toBe(1);

    // 4. Verify Knowledge Nodes
    const nodes = await knowledgeRepository.listNodesByProject(result.projectId);
    expect(nodes.length).toBe(2);
    const charNode = nodes.find((n) => n.kind === "character");
    expect(charNode?.title).toBe("商见曜");
    expect(charNode?.authority).toBe("imported_primary");
  });

  it("handles legacy import API actions", async () => {
    const req = new Request("http://127.0.0.1:4173/api/import/legacy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "dry_run",
        payload: sampleLegacyPayload,
      }),
    });

    const res = (await importAction({ request: req })) as { success: boolean; result: any };
    expect(res.success).toBe(true);
    expect(res.result.manuscriptCount).toBe(1);
    expect(res.result.sceneCount).toBe(2);
  });
});
