import { describe, it, expect, beforeAll } from "vitest";
import { pool, checkDatabaseHealth } from "../../../server/db/client";
import { projectRepository } from "../../../server/domain";
import crypto from "node:crypto";

describe("Database Schema and Constraint Integration", () => {
  beforeAll(async () => {
    const health = await checkDatabaseHealth();
    expect(health.status).toBe("healthy");
    expect(health.hasVectorExtension).toBe(true);
  });

  it("verifies all core domain tables exist in public schema", async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      const tableNames = result.rows.map((r) => r.table_name);

      const expectedTables = [
        "system_metadata",
        "workspace_settings",
        "projects",
        "project_settings",
        "manuscripts",
        "scenes",
        "scene_revisions",
        "agent_threads",
        "agent_messages",
        "agent_runs",
        "agent_run_events",
        "agent_artifacts",
        "context_receipts",
        "context_receipt_items",
        "change_sets",
        "change_operations",
        "change_reviews",
        "change_apply_attempts",
        "knowledge_nodes",
        "knowledge_assets",
        "knowledge_artifacts",
        "knowledge_chunks",
        "knowledge_relations",
        "knowledge_revisions",
        "media_segments",
        "ingestion_jobs",
        "memory_entries",
        "memory_evidence",
        "taste_entries",
        "taste_entry_evidence",
        "memory_revisions",
        "skill_definitions",
        "skill_versions",
        "skill_overlays",
        "skill_invocations",
        "literary_annotations",
        "margin_notes",
        "import_jobs",
      ];

      for (const table of expectedTables) {
        expect(tableNames).toContain(table);
      }
    } finally {
      client.release();
    }
  });

  it("verifies vector columns exist on knowledge_chunks and memory_entries", async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT table_name, column_name, udt_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name = 'embedding';
      `);
      const tablesWithVector = result.rows.map((r) => ({
        table: r.table_name,
        type: r.udt_name,
      }));

      expect(tablesWithVector).toContainEqual({ table: "knowledge_chunks", type: "vector" });
      expect(tablesWithVector).toContainEqual({ table: "memory_entries", type: "vector" });
    } finally {
      client.release();
    }
  });

  it("verifies foreign key constraints reject invalid references", async () => {
    const client = await pool.connect();
    try {
      const nonExistentProjectId = crypto.randomUUID();
      // Inserting a manuscript with non-existent projectId must throw foreign key violation (23503)
      await expect(
        client.query(
          `INSERT INTO manuscripts (id, project_id, title, genre) VALUES ($1, $2, $3, $4)`,
          [crypto.randomUUID(), nonExistentProjectId, "Orphan Manuscript", "novel"]
        )
      ).rejects.toThrow();
    } finally {
      client.release();
    }
  });

  it("verifies cascade deletion when a project is deleted", async () => {
    const proj = await projectRepository.createProject({
      title: "Test Cascade Project",
    });

    const manu = await projectRepository.createManuscript({
      projectId: proj.id,
      title: "Cascade Manuscript",
    });

    const scene = await projectRepository.createScene({
      manuscriptId: manu.id,
      projectId: proj.id,
      title: "Cascade Scene",
      content: "Content to be deleted on cascade",
    });

    // Delete project
    await projectRepository.deleteProject(proj.id);

    // Verify manuscript and scene are removed via CASCADE
    const fetchedManu = await projectRepository.getManuscriptById(manu.id);
    const fetchedScene = await projectRepository.getSceneById(scene.id);
    expect(fetchedManu).toBeNull();
    expect(fetchedScene).toBeNull();
  });
});

