import { describe, it, expect } from "vitest";
import { projectRepository, memoryService, memoryRepository } from "../../../server/domain";
import { loader as memoryLoader, action as memoryAction } from "../../../app/routes/api.projects.$projectId.memory";

describe("E18 — Hierarchical Memory and Evidence-Backed Taste", () => {
  it("records evidence-backed taste, reinforces confidence, and handles contradiction safely", async () => {
    const project = await projectRepository.createProject({ title: "Taste Project" });

    // 1. Record initial taste evidence from ChangeSet review
    const record1 = await memoryService.recordTasteEvidence({
      projectId: project.id,
      scope: "project",
      dimension: "prose_style",
      preference: "喜好短句利落叙事，避免过多冗长定语",
      antiPreferences: ["通篇使用三层嵌套定语与华丽辞藻堆砌"],
      sourceType: "change_review",
      sourceId: "cs-101",
      quote: "此处修改删除了两处冗余修饰，句式更为干脆有力。",
    });

    expect(record1.isNew).toBe(true);
    expect(record1.taste.dimension).toBe("prose_style");
    expect(record1.taste.confidence).toBe(0.5);
    expect(record1.evidence.sourceType).toBe("change_review");

    // 2. Reinforce same preference with second evidence -> confidence boosts
    const record2 = await memoryService.recordTasteEvidence({
      projectId: project.id,
      scope: "project",
      dimension: "prose_style",
      preference: "喜好短句利落叙事，避免过多冗长定语",
      sourceType: "explicit_statement",
      quote: "请继续保持这种简洁明快的短句节奏。",
    });

    expect(record2.isNew).toBe(false);
    expect(record2.taste.id).toBe(record1.taste.id);
    expect(record2.taste.confidence).toBeGreaterThan(0.5);

    // Verify evidence list
    const evidences = await memoryRepository.listEvidenceForTasteEntry(record1.taste.id);
    expect(evidences.length).toBe(2);

    // 3. Contradictory signal -> marks old as contested, creates superseded entry
    const record3 = await memoryService.recordTasteEvidence({
      projectId: project.id,
      scope: "project",
      dimension: "prose_style",
      preference: "通篇使用三层嵌套定语与华丽辞藻堆砌",
      antiPreferences: ["喜好短句利落叙事，避免过多冗长定语"],
      sourceType: "user_correction",
      quote: "这一章是意识流心理独白，需要繁复华丽的长句烘托幻觉感。",
    });

    expect(record3.isNew).toBe(true);
    expect(record3.taste.supersedesId).toBe(record1.taste.id);

    // Old taste entry should now be contested
    const oldTaste = await memoryRepository.getTasteEntryById(record1.taste.id);
    expect(oldTaste?.status).toBe("contested");

    // 4. Test Scoped Memories and Cold Reader Isolation
    const normalMemories = await memoryService.getScopedMemories({
      projectId: project.id,
      includeTaste: true,
    });
    expect(normalMemories.tastes.length).toBeGreaterThanOrEqual(1);

    const coldReaderMemories = await memoryService.getScopedMemories({
      projectId: project.id,
      includeTaste: false,
    });
    expect(coldReaderMemories.tastes.length).toBe(0);
  });

  it("supports forget actions via API", async () => {
    const project = await projectRepository.createProject({ title: "Memory API Project" });

    const tasteRecord = await memoryService.recordTasteEvidence({
      projectId: project.id,
      scope: "project",
      dimension: "dialogue_style",
      preference: "方言俚语少用",
      sourceType: "explicit_statement",
    });

    // 1. Load via API
    const loadRes = (await memoryLoader({ params: { projectId: project.id } })) as {
      memories: any[];
      tastes: any[];
    };
    expect(loadRes.tastes.some((t: any) => t.id === tasteRecord.taste.id)).toBe(true);

    // 2. Forget taste via action
    const formData = new FormData();
    formData.append("intent", "forget_taste");
    formData.append("tasteId", tasteRecord.taste.id);

    const req = new Request("http://127.0.0.1:4173/api/projects/p/memory", {
      method: "POST",
      body: formData,
    });

    const actionRes = (await memoryAction({
      request: req,
      params: { projectId: project.id },
    })) as { success: boolean };

    expect(actionRes.success).toBe(true);

    // 3. Verify disabled in reload
    const reloaded = (await memoryLoader({ params: { projectId: project.id } })) as {
      memories: any[];
      tastes: any[];
    };
    expect(reloaded.tastes.some((t: any) => t.id === tasteRecord.taste.id)).toBe(false);
  });
});

