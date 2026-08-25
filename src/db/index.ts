import Dexie from 'dexie';
import type { Table } from 'dexie';
import type {
  Project,
  Manuscript,
  Scene,
  RevisionSnapshot,
  LiteraryAnnotation,
  LiteraryLens,
  PromptTemplate,
  MarginNote
} from '../types';
import {
  BUILTIN_LENSES,
  BUILTIN_PROMPT_TEMPLATES,
  DEFAULT_SETTINGS
} from './initialData';

export class VersoDatabase extends Dexie {
  projects!: Table<Project, string>;
  manuscripts!: Table<Manuscript, string>;
  scenes!: Table<Scene, string>;
  revisions!: Table<RevisionSnapshot, string>;
  annotations!: Table<LiteraryAnnotation, string>;
  lenses!: Table<LiteraryLens, string>;
  promptTemplates!: Table<PromptTemplate, string>;
  marginNotes!: Table<MarginNote, string>;
  settings!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('VersoDB');
    this.version(2).stores({
      projects: 'id, title, updatedAt',
      manuscripts: 'id, projectId, title, updatedAt',
      scenes: 'id, manuscriptId, order, updatedAt',
      revisions: 'id, sceneId, timestamp, changeType',
      annotations: 'id, sceneId, category, severity, status, createdAt',
      lenses: 'id, isBuiltIn',
      promptTemplates: 'id, category, isBuiltIn',
      marginNotes: 'id, sceneId, author, createdAt',
      settings: 'key'
    });
  }
}

export const db = new VersoDatabase();

export async function initDatabase() {
  // Purge legacy demo project data if present in user's browser IndexedDB
  const legacyDemoProject = await db.projects.get('proj-default-01');
  if (legacyDemoProject) {
    await db.projects.delete('proj-default-01');
    await db.manuscripts.where('projectId').equals('proj-default-01').delete();
    await db.scenes.where('manuscriptId').equals('manu-01').delete();
    await db.revisions.where('sceneId').equals('scene-01').delete();
    await db.revisions.where('sceneId').equals('scene-02').delete();
    await db.annotations.where('sceneId').equals('scene-01').delete();
    await db.annotations.where('sceneId').equals('scene-02').delete();
  }

  // Initialize built-in literary lenses if not already present
  const lensCount = await db.lenses.count();
  if (lensCount === 0) {
    for (const lens of BUILTIN_LENSES) {
      await db.lenses.add(lens);
    }
  }

  // Initialize built-in prompt templates if not already present
  const tmplCount = await db.promptTemplates.count();
  if (tmplCount === 0) {
    for (const tmpl of BUILTIN_PROMPT_TEMPLATES) {
      await db.promptTemplates.add(tmpl);
    }
  }

  // Initialize app settings if not already present, or purge legacy mock engine profiles
  const loadedSettings = await db.settings.get('appSettings');
  if (!loadedSettings || !loadedSettings.value) {
    await db.settings.put({ key: 'appSettings', value: DEFAULT_SETTINGS });
  } else {
    const currentVal = loadedSettings.value;
    const currentProfiles: any[] = currentVal.profiles || [];
    const hasMock = currentProfiles.some(
      (p) => p && (p.providerType === 'mock' || p.id === 'prof-mock')
    );
    if (hasMock) {
      const cleaned = currentProfiles.filter(
        (p) => p && p.providerType !== 'mock' && p.id !== 'prof-mock'
      );
      const activeStillExists = cleaned.some((p) => p.id === currentVal.activeProfileId);
      await db.settings.put({
        key: 'appSettings',
        value: {
          ...currentVal,
          profiles: cleaned,
          activeProfileId: activeStillExists ? currentVal.activeProfileId : (cleaned[0]?.id || ''),
        },
      });
    }
  }
}

/**
 * Resets all local projects, manuscripts, scenes, revisions, annotations, and settings back to a completely clean state.
 */
export async function resetEntireDatabase() {
  await db.projects.clear();
  await db.manuscripts.clear();
  await db.scenes.clear();
  await db.revisions.clear();
  await db.annotations.clear();
  await db.marginNotes.clear();
  await db.settings.clear();
  await db.lenses.clear();
  await db.promptTemplates.clear();

  for (const lens of BUILTIN_LENSES) {
    await db.lenses.add(lens);
  }
  for (const tmpl of BUILTIN_PROMPT_TEMPLATES) {
    await db.promptTemplates.add(tmpl);
  }
  await db.settings.put({ key: 'appSettings', value: DEFAULT_SETTINGS });
}

