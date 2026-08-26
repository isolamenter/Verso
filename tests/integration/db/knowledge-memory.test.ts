import { describe, it, expect, afterEach } from "vitest";
import {
  projectRepository,
  knowledgeRepository,
  memoryRepository,
  skillRepository,
} from "../../../server/domain";
import { db } from "../../../server/db/client";
import { skillDefinitions } from "../../../server/db/schema";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

describe("Knowledge, Memory, and Skill Repositories Integration", () => {
  const createdProjectIds: string[] = [];
  const createdSkillIds: string[] = [];

  afterEach(async () => {
    for (const id of createdProjectIds) {
      try {
        await projectRepository.deleteProject(id);
      } catch {
        // ignore cleanup error
      }
    }
    createdProjectIds.length = 0;

    for (const id of createdSkillIds) {
      try {
        await db.delete(skillDefinitions).where(eq(skillDefinitions.id, id));
      } catch {
        // ignore cleanup error
      }
    }
    createdSkillIds.length = 0;
  });

  it("manages hierarchical knowledge nodes, assets, and relations", async () => {
    const proj = await projectRepository.createProject({ title: "Knowledge Project" });
    createdProjectIds.push(proj.id);

    // 1. Create root creative vision node
    const visionNode = await knowledgeRepository.createNode({
      projectId: proj.id,
      kind: "creative_vision",
      title: "Core Aesthetic Principle",
      content: "Sparse, tactile realism with deep epistemic ambiguity.",
      authority: "user_authored_locked",
      isPinned: true,
    });
    expect(visionNode.id).toBeDefined();
    expect(visionNode.isPinned).toBe(true);

    // 2. Create child character node
    const characterNode = await knowledgeRepository.createNode({
      projectId: proj.id,
      parentId: visionNode.id,
      kind: "character",
      title: "Cobbler Lin",
      content: "An aging craftsman who speaks in terse, rhythmic phrases.",
      summary: "Protagonist of chapter 1.",
      authority: "user_authored_locked",
    });
    expect(characterNode.parentId).toBe(visionNode.id);

    // 3. Create knowledge asset & chunk
    const fakeSha = crypto.createHash("sha256").update("sample_file_content").digest("hex");
    const asset = await knowledgeRepository.createAsset({
      projectId: proj.id,
      nodeId: characterNode.id,
      sha256: fakeSha,
      storagePath: `assets/${fakeSha}.pdf`,
      originalFileName: "character_backstory.pdf",
      mimeType: "application/pdf",
      byteSize: 1024,
    });
    expect(asset.sha256).toBe(fakeSha);

    // 4. Create knowledge relation
    const relation = await knowledgeRepository.createRelation({
      projectId: proj.id,
      sourceNodeId: characterNode.id,
      targetNodeId: visionNode.id,
      relationType: "explains",
      description: "Lin embodies the restraint and tactile focus of the aesthetic vision.",
    });
    expect(relation.id).toBeDefined();

    const relations = await knowledgeRepository.listRelationsForNode(characterNode.id);
    expect(relations.length).toBe(1);
  });

  it("performs pgvector similarity search on knowledge chunks", async () => {
    const proj = await projectRepository.createProject({ title: "Vector Search Project" });
    createdProjectIds.push(proj.id);

    const node = await knowledgeRepository.createNode({
      projectId: proj.id,
      kind: "research_note",
      title: "Historical Tools Research",
      content: "Notes on vintage cobbler awls and leather tanning.",
    });

    // Create 1536-dimensional mock embeddings
    const embeddingA = new Array(1536).fill(0);
    embeddingA[0] = 1.0; // vector along axis 0

    const embeddingB = new Array(1536).fill(0);
    embeddingB[1] = 1.0; // vector along axis 1

    const chunkA = await knowledgeRepository.createChunk({
      projectId: proj.id,
      nodeId: node.id,
      chunkIndex: 0,
      content: "Cobbler awls were made of hardened steel.",
      embedding: embeddingA,
    });

    const chunkB = await knowledgeRepository.createChunk({
      projectId: proj.id,
      nodeId: node.id,
      chunkIndex: 1,
      content: "Tanning processes required oak bark extracts.",
      embedding: embeddingB,
    });

    expect(chunkB.id).toBeDefined();

    // Query with a vector closest to embeddingA
    const queryEmbedding = new Array(1536).fill(0);
    queryEmbedding[0] = 0.9;
    queryEmbedding[1] = 0.1;

    const results = await knowledgeRepository.searchSimilarChunks(proj.id, queryEmbedding, 2);
    expect(results.length).toBe(2);
    // Nearest neighbor should be chunkA
    expect(results[0].chunk.id).toBe(chunkA.id);
    expect(results[0].distance).toBeLessThan(results[1].distance);
  });

  it("manages memory entries, vector search, taste learning, and revisions", async () => {
    // 1. Create Workspace Memory Entry
    const memoryVector = new Array(1536).fill(0);
    memoryVector[5] = 1.0;

    const memEntry = await memoryRepository.createMemoryEntry({
      scope: "workspace",
      layer: "taste_profile",
      key: "adverb_restraint",
      content: "Strictly avoid modifying emotional verbs with generic adverbs.",
      embedding: memoryVector,
      confidence: 0.9,
    });
    expect(memEntry.id).toBeDefined();

    // 2. Attach evidence to memory entry
    const evidence = await memoryRepository.createMemoryEvidence({
      memoryEntryId: memEntry.id,
      sourceType: "change_review",
      quote: "Removed 'angrily shouted' -> 'shouted'",
      weight: 1.0,
    });
    expect(evidence.id).toBeDefined();

    // 3. Search similar memory
    const queryVec = new Array(1536).fill(0);
    queryVec[5] = 0.8;
    const memResults = await memoryRepository.searchSimilarMemory(queryVec, "workspace");
    expect(memResults.length).toBeGreaterThanOrEqual(1);
    expect(memResults[0].entry.id).toBe(memEntry.id);

    // 4. Create Taste Entry
    const taste = await memoryRepository.createTasteEntry({
      scope: "workspace",
      dimension: "intervention_strength",
      preference: "Subtractive and surgical; prioritize cuts over rewrites.",
      conditions: ["draft_mode == 'critique'"],
      antiPreferences: ["radical re-hallucination of plot"],
      confidence: 0.85,
      status: "active",
      explicitness: "explicit",
    });
    expect(taste.id).toBeDefined();
    expect(taste.dimension).toBe("intervention_strength");

    // 5. Track Taste Revision
    const tasteRev = await memoryRepository.createMemoryRevision({
      tasteEntryId: taste.id,
      revisionNumber: 1,
      previousState: {},
      newState: { preference: taste.preference },
      changeReason: "Initial explicit preference declaration",
    });
    expect(tasteRev.id).toBeDefined();
    expect(tasteRev.revisionNumber).toBe(1);

    // Cleanup
    await memoryRepository.deleteMemoryEntry(memEntry.id);
    await memoryRepository.deleteTasteEntry(taste.id);
  });

  it("handles Skill definitions, versions, and user overlays", async () => {
    const testSkillId = "test_critique_dialogue_" + Date.now();
    createdSkillIds.push(testSkillId);

    // 1. Upsert Skill Definition
    const skill = await skillRepository.upsertSkillDefinition({
      id: testSkillId,
      name: "Dialogue and Subtext Critique",
      description: "Examines dialogue authenticity, subtext, and information dumps.",
      category: "critique",
      isBuiltIn: true,
    });
    expect(skill.id).toBe(testSkillId);

    // 2. Create Skill Version
    const version = await skillRepository.createSkillVersion({
      skillId: skill.id,
      version: "1.0.0",
      instructions: "Critique the provided scene dialogue focusing on unspoken power dynamics.",
      outputSchema: { type: "object" },
      contextPolicy: { maxTokens: 4000 },
    });
    expect(version.version).toBe("1.0.0");

    // 3. Create User Overlay
    const overlay = await skillRepository.upsertSkillOverlay({
      skillId: skill.id,
      customName: "My Snappy Dialogue Filter",
      focusAreas: ["rhythm", "slang accuracy"],
      avoidAreas: ["formal exposition"],
      preferredStrength: "high",
    });
    expect(overlay.id).toBeDefined();
    expect(overlay.customName).toBe("My Snappy Dialogue Filter");
  });
});

