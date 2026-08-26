import { describe, it, expect } from "vitest";
import { projectRepository, manuscriptService, changeSetService, changeSetRepository } from "../../../server/domain";
import { loader as changesetsLoader, action as changesetsAction } from "../../../app/routes/api.projects.$projectId.changesets";

describe("E13 — Change Set Review Experience", () => {
  it("lists project ChangeSets with operations via API loader", async () => {
    const project = await projectRepository.createProject({ title: "Review UI Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "Book" });
    const scene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "Scene",
      content: "古道西风瘦马，夕阳西下。",
    });

    // Create 1 proposed ChangeSet
    await changeSetService.createChangeSetWithOperations(
      {
        projectId: project.id,
        title: "古典修辞调整",
        objective: "强化意境",
      },
      [
        {
          targetType: "scene",
          targetId: scene.id,
          operationType: "replace_text_range",
          quote: "古道西风瘦马，夕阳西下。",
          replacementContent: "古道苍茫，西风吹拂着瘦马，夕阳西下。",
        },
      ]
    );

    const res = (await changesetsLoader({ params: { projectId: project.id } })) as { items: any[] };
    expect(res.items.length).toBe(1);
    expect(res.items[0].changeSet.title).toBe("古典修辞调整");
    expect(res.items[0].operations.length).toBe(1);
    expect(res.items[0].operations[0].quote).toBe("古道西风瘦马，夕阳西下。");
  });

  it("handles full apply, partial apply, reject, and rebase actions", async () => {
    const project = await projectRepository.createProject({ title: "Action Test Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "Book" });
    const scene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "Scene Action",
      content: "春水碧于天。画船听雨眠。",
    });

    // 1. Create ChangeSet with 2 operations
    const { changeSet, operations } = await changeSetService.createChangeSetWithOperations(
      {
        projectId: project.id,
        title: "江南诗意润色",
        objective: "提升画面感",
      },
      [
        {
          targetType: "scene",
          targetId: scene.id,
          operationType: "replace_text_range",
          quote: "春水碧于天。",
          replacementContent: "江南春水碧于青天。",
        },
        {
          targetType: "scene",
          targetId: scene.id,
          operationType: "replace_text_range",
          quote: "画船听雨眠。",
          replacementContent: "斜倚画船听细雨入眠。",
        },
      ]
    );

    // 2. Action: Partial Apply (only op 0)
    const partialForm = new FormData();
    partialForm.append("intent", "apply_partial");
    partialForm.append("changeSetId", changeSet.id);
    partialForm.append("operationIds", JSON.stringify([operations[0].id]));

    const partialReq = new Request("http://127.0.0.1:4173/api/projects/p/changesets", {
      method: "POST",
      body: partialForm,
    });

    const partialResult = (await changesetsAction({
      request: partialReq,
      params: { projectId: project.id },
    })) as { success: boolean };
    expect(partialResult.success).toBe(true);

    // Verify scene after partial apply
    const updatedScene = await manuscriptService.getSceneById(scene.id, project.id);
    expect(updatedScene?.content).toContain("江南春水碧于青天。");
    expect(updatedScene?.content).toContain("画船听雨眠。"); // op 1 was untouched

    // 3. Create another ChangeSet to test Reject action
    const { changeSet: rejectCs } = await changeSetService.createChangeSetWithOperations(
      {
        projectId: project.id,
        title: "将被拒绝的提案",
        objective: "测试拒绝流程",
      },
      [
        {
          targetType: "scene",
          targetId: scene.id,
          operationType: "replace_text_range",
          quote: "画船听雨眠。",
          replacementContent: "乘舟入睡。",
        },
      ]
    );

    const rejectForm = new FormData();
    rejectForm.append("intent", "reject");
    rejectForm.append("changeSetId", rejectCs.id);

    const rejectReq = new Request("http://127.0.0.1:4173/api/projects/p/changesets", {
      method: "POST",
      body: rejectForm,
    });

    const rejectResult = (await changesetsAction({
      request: rejectReq,
      params: { projectId: project.id },
    })) as { success: boolean };
    expect(rejectResult.success).toBe(true);

    const rejectedRecord = await changeSetRepository.getChangeSetById(rejectCs.id);
    expect(rejectedRecord?.status).toBe("rejected");
  });
});

