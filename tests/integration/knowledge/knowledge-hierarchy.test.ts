import { describe, it, expect } from "vitest";
import { projectRepository, knowledgeService, knowledgeRepository } from "../../../server/domain";
import { loader as knowledgeLoader, action as knowledgeAction } from "../../../app/routes/api.projects.$projectId.knowledge";

describe("E14 — Text Knowledge Hierarchy and Knowledge Change Sets", () => {
  it("creates user-authored nodes with authority and monotonic revision records", async () => {
    const project = await projectRepository.createProject({ title: "Knowledge Tree Project" });

    // 1. Create character node
    const charNode = await knowledgeService.createNode({
      projectId: project.id,
      kind: "character",
      title: "楚留香",
      summary: "盗帅夜留香，威名震八方",
      content: "轻功绝顶，为人风流倜傥，从不下杀手。",
    });

    expect(charNode.id).toBeDefined();
    expect(charNode.authority).toBe("user_authored_locked");
    expect(charNode.status).toBe("active");

    // Check initial revision
    const revisions1 = await knowledgeRepository.listRevisionsByNode(charNode.id);
    expect(revisions1.length).toBe(1);
    expect(revisions1[0].revisionNumber).toBe(1);
    expect(revisions1[0].changeType).toBe("initial");

    // 2. Update character node
    const { node: updatedNode, revision: rev2 } = await knowledgeService.updateNode(
      charNode.id,
      project.id,
      {
        summary: "天下第一神偷与侦探",
        content: "轻功天下第一，兼具名侦探般敏锐的洞察力。",
      }
    );

    expect(updatedNode.summary).toBe("天下第一神偷与侦探");
    expect(rev2.revisionNumber).toBe(2);
    expect(rev2.changeType).toBe("manual_edit");

    // 3. Create a world rule node and link relation
    const ruleNode = await knowledgeService.createNode({
      projectId: project.id,
      kind: "world_rule",
      title: "弹指神通与踏月留香",
      content: "踏月留香是楚留香独创轻功步法。",
    });

    const relation = await knowledgeService.createRelation({
      projectId: project.id,
      sourceNodeId: charNode.id,
      targetNodeId: ruleNode.id,
      relationType: "references",
      description: "掌握该绝顶轻功",
    });

    expect(relation.id).toBeDefined();
    expect(relation.relationType).toBe("references");

    // 4. Retrieve structured knowledge tree
    const tree = await knowledgeService.getKnowledgeTree(project.id);
    expect(tree.nodes.length).toBe(2);
    expect(tree.categories["character"].length).toBe(1);
    expect(tree.categories["world_rule"].length).toBe(1);
    expect(tree.relations.length).toBe(1);
  });

  it("handles API route loader and actions (create, update, archive)", async () => {
    const project = await projectRepository.createProject({ title: "Knowledge API Project" });

    // 1. Create node via API action
    const createForm = new FormData();
    createForm.append("intent", "create_node");
    createForm.append("kind", "location");
    createForm.append("title", "万梅山庄");
    createForm.append("content", "西门吹雪隐居之所，庄外梅花千树。");
    createForm.append("summary", "西门吹雪山庄");

    const createReq = new Request("http://127.0.0.1:4173/api/projects/p/knowledge", {
      method: "POST",
      body: createForm,
    });

    const createRes = (await knowledgeAction({
      request: createReq,
      params: { projectId: project.id },
    })) as { success: boolean; node: any };

    expect(createRes.success).toBe(true);
    expect(createRes.node.title).toBe("万梅山庄");
    const createdId = createRes.node.id;

    // 2. Load knowledge via API loader
    const loadRes = (await knowledgeLoader({ params: { projectId: project.id } })) as {
      nodes: any[];
      categories: Record<string, any[]>;
    };
    expect(loadRes.nodes.length).toBe(1);
    expect(loadRes.categories["location"]?.length).toBe(1);

    // 3. Update node via API action
    const updateForm = new FormData();
    updateForm.append("intent", "update_node");
    updateForm.append("nodeId", createdId);
    updateForm.append("content", "万梅山庄，雪落梅开，剑气凌厉。");

    const updateReq = new Request("http://127.0.0.1:4173/api/projects/p/knowledge", {
      method: "POST",
      body: updateForm,
    });

    const updateRes = (await knowledgeAction({
      request: updateReq,
      params: { projectId: project.id },
    })) as { success: boolean; node: any };

    expect(updateRes.success).toBe(true);
    expect(updateRes.node.content).toContain("雪落梅开");

    // 4. Archive node via API action
    const archiveForm = new FormData();
    archiveForm.append("intent", "archive_node");
    archiveForm.append("nodeId", createdId);

    const archiveReq = new Request("http://127.0.0.1:4173/api/projects/p/knowledge", {
      method: "POST",
      body: archiveForm,
    });

    const archiveRes = (await knowledgeAction({
      request: archiveReq,
      params: { projectId: project.id },
    })) as { success: boolean };

    expect(archiveRes.success).toBe(true);

    // 5. Verify active tree excludes archived node
    const treeAfterArchive = (await knowledgeLoader({ params: { projectId: project.id } })) as {
      nodes: any[];
    };
    expect(treeAfterArchive.nodes.length).toBe(0);
  });
});
