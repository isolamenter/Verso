import { db } from "../db/client";
import {
  workspaceSettings,
  projects,
  projectSettings,
  manuscripts,
  scenes,
  sceneRevisions,
  literaryAnnotations,
  marginNotes,
  importJobs,
  changeSets,
} from "../db/schema";
import { eq, desc, asc, and, inArray } from "drizzle-orm";
import type { IProjectRepository } from "./types";
import type {
  Project,
  ProjectSummary,
  CreateProjectInput,
  UpdateProjectInput,
  Manuscript,
  CreateManuscriptInput,
  UpdateManuscriptInput,
  Scene,
  CreateSceneInput,
  UpdateSceneInput,
  SceneRevision,
  CreateSceneRevisionInput,
  WorkspaceSettings,
  ProjectSettings,
} from "../../shared/schemas/project";
import type {
  LiteraryAnnotation,
  CreateLiteraryAnnotationInput,
  MarginNote,
  CreateMarginNoteInput,
  ImportJob,
  CreateImportJobInput,
} from "../../shared/schemas/literary";
import { createSceneRevisionAtomic } from "./transaction-helper";
import crypto from "node:crypto";

export class ProjectRepository implements IProjectRepository {
  async getWorkspaceSettings(): Promise<WorkspaceSettings> {
    const [settings] = await db.select().from(workspaceSettings).limit(1);
    if (settings) {
      return settings as unknown as WorkspaceSettings;
    }
    const [created] = await db
      .insert(workspaceSettings)
      .values({ id: "default", defaultLocale: "zh-CN", theme: "system" })
      .returning();
    return created as unknown as WorkspaceSettings;
  }

  async updateWorkspaceSettings(
    input: Partial<WorkspaceSettings>,
  ): Promise<WorkspaceSettings> {
    const existing = await this.getWorkspaceSettings();
    const [updated] = await db
      .update(workspaceSettings)
      .set({
        defaultLocale: input.defaultLocale,
        theme: input.theme,
        activeProjectId: input.activeProjectId,
        metadata: input.metadata,
        updatedAt: new Date(),
      })
      .where(eq(workspaceSettings.id, existing.id))
      .returning();
    return updated as unknown as WorkspaceSettings;
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const id = input.id ?? crypto.randomUUID();
    const [project] = await db
      .insert(projects)
      .values({
        id,
        title: input.title,
        description: input.description,
        pinned: input.pinned ?? false,
        metadata: input.metadata ?? {},
      })
      .returning();
    return project as unknown as Project;
  }

  async getProjectById(id: string): Promise<Project | null> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    return (project as unknown as Project) ?? null;
  }

  async listProjects(
    options: { includeArchived?: boolean } = {},
  ): Promise<Project[]> {
    if (options.includeArchived) {
      const rows = await db
        .select()
        .from(projects)
        .orderBy(desc(projects.updatedAt));
      return rows as unknown as Project[];
    }
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.archived, false))
      .orderBy(desc(projects.updatedAt));
    return rows as unknown as Project[];
  }

  async listProjectsWithSummary(
    options: { includeArchived?: boolean } = {},
  ): Promise<ProjectSummary[]> {
    const projectList = await this.listProjects(options);
    const results: ProjectSummary[] = [];

    for (const proj of projectList) {
      const projManuscripts = await db
        .select()
        .from(manuscripts)
        .where(eq(manuscripts.projectId, proj.id))
        .orderBy(asc(manuscripts.order));

      const projScenes = await db
        .select({ id: scenes.id })
        .from(scenes)
        .where(eq(scenes.projectId, proj.id));

      const openChanges = await db
        .select({ id: changeSets.id })
        .from(changeSets)
        .where(
          and(
            eq(changeSets.projectId, proj.id),
            inArray(changeSets.status, ["proposed", "needs_rebase"]),
          ),
        );

      results.push({
        ...proj,
        manuscriptCount: projManuscripts.length,
        sceneCount: projScenes.length,
        unresolvedChangesCount: openChanges.length,
        latestManuscriptTitle: projManuscripts[0]?.title ?? null,
      });
    }

    return results;
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();
    if (!project) {
      throw new Error(`Project not found: ${id}`);
    }
    return project as unknown as Project;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getProjectSettings(projectId: string): Promise<ProjectSettings | null> {
    const [settings] = await db
      .select()
      .from(projectSettings)
      .where(eq(projectSettings.projectId, projectId));
    return (settings as unknown as ProjectSettings) ?? null;
  }

  async upsertProjectSettings(
    projectId: string,
    input: Partial<ProjectSettings>,
  ): Promise<ProjectSettings> {
    const id = input.id ?? crypto.randomUUID();
    const [settings] = await db
      .insert(projectSettings)
      .values({
        id,
        projectId,
        locale: input.locale,
        contextBudget: input.contextBudget,
        tonePreferences: input.tonePreferences ?? {},
        rules: input.rules ?? [],
        metadata: input.metadata ?? {},
      })
      .onConflictDoUpdate({
        target: projectSettings.projectId,
        set: {
          locale: input.locale,
          contextBudget: input.contextBudget,
          tonePreferences: input.tonePreferences,
          rules: input.rules,
          metadata: input.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();
    return settings as unknown as ProjectSettings;
  }

  async createManuscript(input: CreateManuscriptInput): Promise<Manuscript> {
    const id = input.id ?? crypto.randomUUID();
    const [manuscript] = await db
      .insert(manuscripts)
      .values({
        id,
        projectId: input.projectId,
        title: input.title,
        genre: input.genre ?? "novel",
        order: input.order ?? 0,
        status: input.status ?? "active",
        metadata: input.metadata ?? {},
      })
      .returning();
    return manuscript as unknown as Manuscript;
  }

  async getManuscriptById(id: string): Promise<Manuscript | null> {
    const [manuscript] = await db
      .select()
      .from(manuscripts)
      .where(eq(manuscripts.id, id));
    return (manuscript as unknown as Manuscript) ?? null;
  }

  async listManuscriptsByProject(projectId: string): Promise<Manuscript[]> {
    const rows = await db
      .select()
      .from(manuscripts)
      .where(eq(manuscripts.projectId, projectId))
      .orderBy(asc(manuscripts.order));
    return rows as unknown as Manuscript[];
  }

  async updateManuscript(
    id: string,
    input: UpdateManuscriptInput,
  ): Promise<Manuscript> {
    const [manuscript] = await db
      .update(manuscripts)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(manuscripts.id, id))
      .returning();
    if (!manuscript) {
      throw new Error(`Manuscript not found: ${id}`);
    }
    return manuscript as unknown as Manuscript;
  }

  async deleteManuscript(id: string): Promise<boolean> {
    const result = await db.delete(manuscripts).where(eq(manuscripts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createScene(input: CreateSceneInput): Promise<Scene> {
    const id = input.id ?? crypto.randomUUID();
    const content = input.content ?? "";
    const characterCount = content.length;

    await db.insert(scenes).values({
      id,
      manuscriptId: input.manuscriptId,
      projectId: input.projectId,
      title: input.title,
      order: input.order ?? 0,
      content,
      pov: input.pov,
      location: input.location,
      timeframe: input.timeframe,
      summary: input.summary,
      characterCount,
      metadata: input.metadata ?? {},
    });

    // Create initial revision
    const initialRevId = crypto.randomUUID();
    await db.insert(sceneRevisions).values({
      id: initialRevId,
      sceneId: id,
      projectId: input.projectId,
      revisionNumber: 1,
      changeType: "initial",
      description: "Initial scene creation",
      content,
      characterCount,
      metadata: {},
    });

    // Update scene's currentRevisionId
    const [updatedScene] = await db
      .update(scenes)
      .set({ currentRevisionId: initialRevId })
      .where(eq(scenes.id, id))
      .returning();

    return updatedScene as unknown as Scene;
  }

  async getSceneById(id: string): Promise<Scene | null> {
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, id));
    return (scene as unknown as Scene) ?? null;
  }

  async listScenesByManuscript(manuscriptId: string): Promise<Scene[]> {
    const rows = await db
      .select()
      .from(scenes)
      .where(eq(scenes.manuscriptId, manuscriptId))
      .orderBy(asc(scenes.order));
    return rows as unknown as Scene[];
  }

  async listScenesByProject(projectId: string): Promise<Scene[]> {
    const rows = await db
      .select()
      .from(scenes)
      .where(eq(scenes.projectId, projectId))
      .orderBy(asc(scenes.order));
    return rows as unknown as Scene[];
  }

  async updateScene(id: string, input: UpdateSceneInput): Promise<Scene> {
    const [scene] = await db
      .update(scenes)
      .set({
        ...input,
        characterCount:
          input.content !== undefined
            ? input.content.length
            : input.characterCount,
        updatedAt: new Date(),
      })
      .where(eq(scenes.id, id))
      .returning();
    if (!scene) {
      throw new Error(`Scene not found: ${id}`);
    }
    return scene as unknown as Scene;
  }

  async deleteScene(id: string): Promise<boolean> {
    const result = await db.delete(scenes).where(eq(scenes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createSceneRevision(
    input: CreateSceneRevisionInput,
  ): Promise<SceneRevision> {
    return await createSceneRevisionAtomic({
      sceneId: input.sceneId,
      projectId: input.projectId,
      changeType: input.changeType,
      description: input.description,
      content: input.content,
      diffSummary: input.diffSummary,
      rollbackSourceRevId: input.rollbackSourceRevId,
      appliedChangeSetId: input.appliedChangeSetId,
      metadata: input.metadata,
    });
  }

  async getSceneRevisionById(id: string): Promise<SceneRevision | null> {
    const [rev] = await db
      .select()
      .from(sceneRevisions)
      .where(eq(sceneRevisions.id, id));
    return (rev as unknown as SceneRevision) ?? null;
  }

  async getLatestSceneRevision(sceneId: string): Promise<SceneRevision | null> {
    const [rev] = await db
      .select()
      .from(sceneRevisions)
      .where(eq(sceneRevisions.sceneId, sceneId))
      .orderBy(desc(sceneRevisions.revisionNumber))
      .limit(1);
    return (rev as unknown as SceneRevision) ?? null;
  }

  async listSceneRevisions(sceneId: string): Promise<SceneRevision[]> {
    const rows = await db
      .select()
      .from(sceneRevisions)
      .where(eq(sceneRevisions.sceneId, sceneId))
      .orderBy(desc(sceneRevisions.revisionNumber));
    return rows as unknown as SceneRevision[];
  }

  async createLiteraryAnnotation(
    input: CreateLiteraryAnnotationInput,
  ): Promise<LiteraryAnnotation> {
    const id = input.id ?? crypto.randomUUID();
    const [anno] = await db
      .insert(literaryAnnotations)
      .values({
        id,
        sceneId: input.sceneId,
        projectId: input.projectId,
        category: input.category,
        severity: input.severity,
        rangeFrom: input.rangeFrom,
        rangeTo: input.rangeTo,
        quote: input.quote,
        diagnosis: input.diagnosis,
        literaryTradeoff: input.literaryTradeoff,
        suggestion: input.suggestion,
        replacement: input.replacement ?? null,
        appliedReplacementType: input.appliedReplacementType,
        status: input.status ?? "pending",
        isStale: input.isStale ?? false,
        metadata: input.metadata ?? {},
      })
      .returning();
    return anno as unknown as LiteraryAnnotation;
  }

  async listLiteraryAnnotationsByScene(
    sceneId: string,
  ): Promise<LiteraryAnnotation[]> {
    const rows = await db
      .select()
      .from(literaryAnnotations)
      .where(eq(literaryAnnotations.sceneId, sceneId))
      .orderBy(asc(literaryAnnotations.createdAt));
    return rows as unknown as LiteraryAnnotation[];
  }

  async listLiteraryAnnotationsByProject(
    projectId: string,
  ): Promise<LiteraryAnnotation[]> {
    const rows = await db
      .select()
      .from(literaryAnnotations)
      .where(eq(literaryAnnotations.projectId, projectId))
      .orderBy(asc(literaryAnnotations.createdAt));
    return rows as unknown as LiteraryAnnotation[];
  }

  async deleteLiteraryAnnotation(id: string): Promise<boolean> {
    const result = await db
      .delete(literaryAnnotations)
      .where(eq(literaryAnnotations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createMarginNote(input: CreateMarginNoteInput): Promise<MarginNote> {
    const id = input.id ?? crypto.randomUUID();
    const [note] = await db
      .insert(marginNotes)
      .values({
        id,
        sceneId: input.sceneId,
        projectId: input.projectId,
        author: input.author,
        rangeFrom: input.rangeFrom,
        rangeTo: input.rangeTo,
        quote: input.quote,
        content: input.content,
        resolved: input.resolved ?? false,
        metadata: input.metadata ?? {},
      })
      .returning();
    return note as unknown as MarginNote;
  }

  async listMarginNotesByScene(sceneId: string): Promise<MarginNote[]> {
    const rows = await db
      .select()
      .from(marginNotes)
      .where(eq(marginNotes.sceneId, sceneId))
      .orderBy(asc(marginNotes.createdAt));
    return rows as unknown as MarginNote[];
  }

  async deleteMarginNote(id: string): Promise<boolean> {
    const result = await db.delete(marginNotes).where(eq(marginNotes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createImportJob(input: CreateImportJobInput): Promise<ImportJob> {
    const id = input.id ?? crypto.randomUUID();
    const [job] = await db
      .insert(importJobs)
      .values({
        id,
        projectId: input.projectId,
        sourceType: input.sourceType,
        status: input.status ?? "pending",
        importedCounts: input.importedCounts ?? {},
        metadata: input.metadata ?? {},
      })
      .returning();
    return job as unknown as ImportJob;
  }

  async getImportJobById(id: string): Promise<ImportJob | null> {
    const [job] = await db
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, id));
    return (job as unknown as ImportJob) ?? null;
  }
}
