import { describe, it, expect } from "vitest";
import {
  projectRepository,
  knowledgeService,
  agentRepository,
  hierarchicalRetriever,
} from "../../../server/domain";
import { ContextReceiptBuilder } from "../../../server/agent/context/context-receipt-builder";

describe("E16 — Hierarchical Retrieval and Complete Context Receipts", () => {
  it("prevents scene-local leakage, ranks by authority/pins/relevance, and records ContextReceipt", async () => {
    const project = await projectRepository.createProject({ title: "Retrieval Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "Book" });
    const scene1 = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "Scene 1",
    });
    const scene2 = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "Scene 2",
    });

    // 1. Create nodes:
    // Node A: Scene-1 local character secret
    const nodeA = await knowledgeService.createNode({
      projectId: project.id,
      sceneId: scene1.id,
      kind: "character",
      title: "第一幕局部线索",
      content: "只有第一幕才出现的专属伏笔，绝不可泄漏给第二幕。",
    });

    // Node B: Pinned project-wide locked lore
    const nodeB = await knowledgeService.createNode({
      projectId: project.id,
      kind: "world_rule",
      title: "世界核心法则",
      content: "全书通用的世界观设定与物理规律。",
      isPinned: true,
      authority: "user_authored_locked",
    });

    // Node C: Agent unreviewed background
    const nodeC = await knowledgeService.createNode({
      projectId: project.id,
      kind: "location",
      title: "背景城市介绍",
      content: "繁华喧嚣的东方都市，高楼林立，车水马龙。".repeat(10),
      summary: "繁华东方都市",
      authority: "agent_unreviewed",
    });

    expect(nodeC.id).toBeDefined();

    const thread = await agentRepository.createThread({ projectId: project.id, title: "Thread" });
    const run = await agentRepository.createRun({ threadId: thread.id, projectId: project.id });
    const receiptBuilder = new ContextReceiptBuilder(run.id, thread.id, project.id);

    // 2. Query retrieval targeted at Scene 2 (with small token budget)
    const result = await hierarchicalRetriever.retrieveContext({
      projectId: project.id,
      sceneId: scene2.id,
      query: "世界核心法则",
      maxTokens: 50,
      receiptBuilder,
    });

    // Node A must NOT be in full or summary nodes (scope mismatch)
    expect(result.fullNodes.some((n) => n.id === nodeA.id)).toBe(false);
    expect(result.summaryNodes.some((s) => s.node.id === nodeA.id)).toBe(false);
    expect(result.excludedNodes.some((e) => e.node.id === nodeA.id && e.reason === "scene_scope_mismatch")).toBe(true);

    // Node B (pinned, locked authority, matching query) must be in fullNodes
    expect(result.fullNodes.some((n) => n.id === nodeB.id)).toBe(true);

    // 3. Finalize Context Receipt
    const { receipt, items } = await receiptBuilder.finalize();
    expect(receipt.id).toBeDefined();
    expect(items.length).toBeGreaterThanOrEqual(3);

    // Verify receipt items include full, summary, or excluded statuses
    const nodeBItem = items.find((it) => it.resourceId === nodeB.id);
    expect(nodeBItem?.inclusionMode).toBe("full");

    const nodeAItem = items.find((it) => it.resourceId === nodeA.id);
    expect(nodeAItem?.inclusionMode).toBe("excluded");
    expect(nodeAItem?.exclusionReason).toBe("scene_scope_mismatch");
  });
});

