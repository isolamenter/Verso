import { describe, it, expect } from "vitest";
import {
  projectRepository,
  manuscriptService,
  changeSetService,
  changeSetRepository,
  agentRepository,
} from "../../../server/domain";
import { proposalToolsEngine } from "../../../server/agent/tools/proposal-tools";

describe("Scene Splits Tooling and Atomic Transactional Apply", () => {
  it("proposes scene splits, generates split_scene ChangeSet, and applies atomically", async () => {
    const project = await projectRepository.createProject({ title: "Split Test Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "正文第一卷" });

    const fullManuscriptContent = `第一场 破晓时分
晨光透过破旧的窗纸洒在桌面上。林远揉了揉干涩的眼眶，炭笔已经在草图上画了整整一夜。

第二场 渡口密会
正午时分，江面上的雾气散尽。渡口停靠着三艘乌篷船，水手们低头擦拭着缆绳。陈先生撑着一把油纸伞从石阶上走下来。

第三场 潜入藏书楼
子夜，城中钟楼敲响了十二下。阴云遮蔽了残月，一道黑影顺着飞檐翻入了藏书楼的西阁。`;

    // Target scene to split (Order 1)
    const sceneToSplit = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "完整长卷",
      content: fullManuscriptContent,
      order: 1,
    });

    // Existing subsequent scene (Order 2) - should be shifted when splits are applied
    const existingSubsequentScene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "尾声备忘",
      content: "这是原本排在后面的场景。",
      order: 2,
    });

    const thread = await agentRepository.createThread({ projectId: project.id, title: "Thread" });
    const run = await agentRepository.createRun({ threadId: thread.id, projectId: project.id });

    const ctx = {
      projectId: project.id,
      runId: run.id,
      threadId: thread.id,
    };

    // 1. Call proposeSceneSplits via proposal tool
    const proposalRes = await proposalToolsEngine.proposeSceneSplits(
      {
        sceneId: sceneToSplit.id,
        changeSetTitle: "正文三场细化拆分",
        changeSetObjective: "将长卷文稿按自然时空转换为三场独立场景",
        splits: [
          {
            title: "第一场 破晓时分",
            summary: "清晨案头长夜绘图",
            startQuote: "第一场 破晓时分",
          },
          {
            title: "第二场 渡口密会",
            summary: "正午渡口与陈先生接头",
            startQuote: "第二场 渡口密会",
          },
          {
            title: "第三场 潜入藏书楼",
            summary: "子夜翻墙潜入藏书楼西阁",
            startQuote: "第三场 潜入藏书楼",
          },
        ],
        rationale: "依据时空三段式转折切分，符合叙事悬念递进",
      },
      ctx
    );

    expect(proposalRes.success).toBe(true);
    expect(proposalRes.sceneCount).toBe(3);
    expect(proposalRes.coverage).toBe(1);
    expect(proposalRes.status).toBe("proposed");

    // Verify scene is NOT modified before apply
    const sceneBefore = await manuscriptService.getSceneById(sceneToSplit.id, project.id);
    expect(sceneBefore?.content).toBe(fullManuscriptContent);

    // 2. Validate operations in ChangeSet
    const valRes = await changeSetService.validateChangeSet(proposalRes.changeSetId, project.id);
    expect(valRes.isValid).toBe(true);
    expect(valRes.conflictCount).toBe(0);

    // 3. Apply ChangeSet atomically
    const applyRes = await changeSetService.applyChangeSet(proposalRes.changeSetId, project.id);
    expect(applyRes.success).toBe(true);
    expect(applyRes.applyAttempt.status).toBe("success");

    // 4. Verify all scenes in the manuscript
    const updatedScenes = await projectRepository.listScenesByManuscript(manuscript.id);
    // Original 2 scenes (sceneToSplit + existingSubsequentScene) become 4 scenes (3 splits + 1 shifted existing)
    expect(updatedScenes).toHaveLength(4);

    // Order 1: updated sceneToSplit
    expect(updatedScenes[0].id).toBe(sceneToSplit.id);
    expect(updatedScenes[0].order).toBe(1);
    expect(updatedScenes[0].title).toBe("第一场 破晓时分");
    expect(updatedScenes[0].content).toContain("晨光透过破旧的窗纸洒在桌面上");
    expect(updatedScenes[0].content).not.toContain("第二场 渡口密会");

    // Order 2: new scene (second split)
    expect(updatedScenes[1].order).toBe(2);
    expect(updatedScenes[1].title).toBe("第二场 渡口密会");
    expect(updatedScenes[1].content).toContain("陈先生撑着一把油纸伞从石阶上走下来");
    expect(updatedScenes[1].content).not.toContain("第三场 潜入藏书楼");

    // Order 3: new scene (third split)
    expect(updatedScenes[2].order).toBe(3);
    expect(updatedScenes[2].title).toBe("第三场 潜入藏书楼");
    expect(updatedScenes[2].content).toContain("翻入了藏书楼的西阁");

    // Order 4: existingSubsequentScene (shifted from order 2 to order 4)
    expect(updatedScenes[3].id).toBe(existingSubsequentScene.id);
    expect(updatedScenes[3].order).toBe(4);
    expect(updatedScenes[3].title).toBe("尾声备忘");

    // 5. Verify revision history created
    const firstSceneRevisions = await manuscriptService.listSceneRevisions(sceneToSplit.id, project.id);
    expect(firstSceneRevisions.length).toBeGreaterThanOrEqual(1);
    expect(firstSceneRevisions[0].changeType).toBe("agent_applied");

    const secondSceneRevisions = await manuscriptService.listSceneRevisions(updatedScenes[1].id, project.id);
    expect(secondSceneRevisions.length).toBe(1);
    expect(secondSceneRevisions[0].changeType).toBe("agent_applied");

    // 6. Verify ChangeSet record is marked applied
    const updatedChangeSet = await changeSetRepository.getChangeSetById(proposalRes.changeSetId);
    expect(updatedChangeSet?.status).toBe("applied");
  });
});

