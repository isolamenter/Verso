import { useState, useEffect, useCallback, useRef } from 'react';
import { db, initDatabase } from '../db';
import type { Project, Manuscript, Scene, AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../db/initialData';
import { calculateEditorStats } from '../utils/diff';
import { extractPlainText } from '../utils/textProjection';
import { parseUploadedFile } from '../utils/fileImporter';

export function useManuscript() {
  const [isReady, setIsReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string>('');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const autoSaveTimerRef = useRef<any>(null);
  const snapshotTimerRef = useRef<any>(null);
  const lastSnapshotMapRef = useRef<Record<string, string>>({});
  const pendingSavesRef = useRef<Record<string, string>>({});
  const activeSceneIdRef = useRef<string>('');

  useEffect(() => {
    activeSceneIdRef.current = activeSceneId;
  }, [activeSceneId]);

  // Flush pending autosaves immediately to database
  const flushAutosave = useCallback(async (targetSceneId?: string) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (targetSceneId) {
      const content = pendingSavesRef.current[targetSceneId];
      if (content !== undefined) {
        delete pendingSavesRef.current[targetSceneId];
        await db.scenes.update(targetSceneId, {
          content,
          updatedAt: Date.now(),
        });
      }
    } else {
      const entries = Object.entries(pendingSavesRef.current);
      pendingSavesRef.current = {};
      for (const [sId, content] of entries) {
        await db.scenes.update(sId, {
          content,
          updatedAt: Date.now(),
        });
      }
    }
  }, []);

  // Flush pending saves on pagehide/beforeunload/unmount
  useEffect(() => {
    const handleUnload = () => {
      const entries = Object.entries(pendingSavesRef.current);
      if (entries.length > 0) {
        for (const [sId, content] of entries) {
          db.scenes.update(sId, { content, updatedAt: Date.now() }).catch(() => {});
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      flushAutosave();
    };
  }, [flushAutosave]);

  // Initialize DB & load data
  useEffect(() => {
    async function loadData() {
      await initDatabase();
      const loadedProjects = await db.projects.toArray();
      const loadedManuscripts = await db.manuscripts.toArray();
      const loadedSettings = await db.settings.get('appSettings');

      if (loadedProjects.length > 0) {
        setProjects(loadedProjects);
        setProject(loadedProjects[0]);
      } else {
        setProjects([]);
        setProject(null);
      }

      if (loadedManuscripts.length > 0) {
        setManuscripts(loadedManuscripts);
        const activeManu = loadedManuscripts[0];
        setManuscript(activeManu);

        const loadedScenes = await db.scenes
          .where('manuscriptId')
          .equals(activeManu.id)
          .sortBy('order');

        if (loadedScenes.length > 0) {
          setScenes(loadedScenes);
          setActiveSceneId(loadedScenes[0].id);
          activeSceneIdRef.current = loadedScenes[0].id;
          loadedScenes.forEach((sc) => {
            lastSnapshotMapRef.current[sc.id] = sc.content;
          });
        } else {
          setScenes([]);
          setActiveSceneId('');
          activeSceneIdRef.current = '';
        }
      } else {
        setManuscripts([]);
        setManuscript(null);
        setScenes([]);
        setActiveSceneId('');
        activeSceneIdRef.current = '';
      }

      if (loadedSettings && loadedSettings.value) {
        setSettings(loadedSettings.value);
      }
      setIsReady(true);
    }
    loadData();
  }, []);

  const activeScene: Scene | null =
    scenes.find((s) => s.id === activeSceneId) || (scenes.length > 0 ? scenes[0] : null);

  const stats = calculateEditorStats(activeScene?.content || '');

  // Update active scene content with continuous autosave & smart literary revision snapshotting
  const updateSceneContent = useCallback(
    (newContent: string) => {
      const currentId = activeSceneIdRef.current;
      if (!currentId) return;

      setScenes((prev) =>
        prev.map((s) =>
          s.id === currentId ? { ...s, content: newContent, updatedAt: Date.now() } : s
        )
      );

      // Record pending save for this scene
      pendingSavesRef.current[currentId] = newContent;

      // 1. Debounced Continuous Autosave (1.5s)
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(async () => {
        const toSave = pendingSavesRef.current[currentId];
        if (toSave !== undefined) {
          delete pendingSavesRef.current[currentId];
          await db.scenes.update(currentId, {
            content: toSave,
            updatedAt: Date.now(),
          });
        }
      }, settings.autoSaveIntervalMs || 1500);

      // 2. Intelligent Literary Revision Snapshot on typing pause (30s) purely time-debounced
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = setTimeout(async () => {
        const lastSaved = lastSnapshotMapRef.current[currentId] || '';
        const newContentPlain = extractPlainText(newContent);

        if (newContent !== lastSaved) {
          lastSnapshotMapRef.current[currentId] = newContent;
          await db.revisions.add({
            id: `rev-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sceneId: currentId,
            timestamp: Date.now(),
            description: `写作会话停顿自动快照 (~${newContentPlain.length} 字)`,
            changeType: 'manual_edit',
            content: newContent,
            characterCount: newContentPlain.length,
          });
        }
      }, settings.autoSnapshotIntervalMs || 30000);
    },
    [settings.autoSaveIntervalMs, settings.autoSnapshotIntervalMs]
  );

  // Switch Scene with pre-switch autosave flush
  const handleSelectScene = useCallback(
    async (sceneId: string) => {
      const currentId = activeSceneIdRef.current;
      if (currentId && currentId !== sceneId) {
        await flushAutosave(currentId);
      }
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
      setActiveSceneId(sceneId);
      activeSceneIdRef.current = sceneId;
    },
    [flushAutosave]
  );

  // Switch Manuscript with pre-switch flush
  const switchManuscript = useCallback(
    async (manuId: string) => {
      await flushAutosave();
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);

      const target = manuscripts.find((m) => m.id === manuId);
      if (!target) return;
      setManuscript(target);

      const loadedScenes = await db.scenes
        .where('manuscriptId')
        .equals(manuId)
        .sortBy('order');

      setScenes(loadedScenes);
      if (loadedScenes.length > 0) {
        setActiveSceneId(loadedScenes[0].id);
        activeSceneIdRef.current = loadedScenes[0].id;
        loadedScenes.forEach((sc) => {
          if (!lastSnapshotMapRef.current[sc.id]) {
            lastSnapshotMapRef.current[sc.id] = sc.content;
          }
        });
      } else {
        setActiveSceneId('');
        activeSceneIdRef.current = '';
      }
    },
    [manuscripts, flushAutosave]
  );

  // Create new Project & Manuscript
  const createProject = useCallback(
    async (title: string, description: string = '') => {
      const newProj: Project = {
        id: `proj-${Date.now()}`,
        title: title || '新项目',
        description,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.projects.add(newProj);
      setProjects((prev) => [...prev, newProj]);
      setProject(newProj);
      return newProj;
    },
    []
  );

  // Create new Manuscript (auto creates project if none exists)
  const createManuscript = useCallback(
    async (title: string, genre: Manuscript['genre'] = 'short_story', synopsis: string = '') => {
      let currentProject = project;
      if (!currentProject) {
        const newProj: Project = {
          id: `proj-${Date.now()}`,
          title: title || '我的创作项目',
          description: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await db.projects.add(newProj);
        setProjects([newProj]);
        setProject(newProj);
        currentProject = newProj;
      }

      const newManu: Manuscript = {
        id: `manu-${Date.now()}`,
        projectId: currentProject.id,
        title: title || '新书稿',
        genre,
        synopsis,
        motifs: [],
        characters: [],
        notes: '',
        themeAnalysis: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const firstScene: Scene = {
        id: `scene-${Date.now()}`,
        manuscriptId: newManu.id,
        title: '第一场：起首',
        order: 1,
        content: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.manuscripts.add(newManu);
      await db.scenes.add(firstScene);

      setManuscripts((prev) => [...prev, newManu]);
      setManuscript(newManu);
      setScenes([firstScene]);
      lastSnapshotMapRef.current[firstScene.id] = '';
      handleSelectScene(firstScene.id);
    },
    [project, handleSelectScene]
  );

  // Import a local file (.txt, .md, or .docx) as a new Manuscript
  const importManuscriptFile = useCallback(
    async (file: File) => {
      const { title, content } = await parseUploadedFile(file);

      let currentProject = project;
      if (!currentProject) {
        const newProj: Project = {
          id: `proj-${Date.now()}`,
          title: `${title} 项目`,
          description: `从本地文件《${file.name}》导入`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await db.projects.add(newProj);
        setProjects([newProj]);
        setProject(newProj);
        currentProject = newProj;
      }

      const newManu: Manuscript = {
        id: `manu-${Date.now()}`,
        projectId: currentProject.id,
        title,
        genre: 'short_story',
        synopsis: '',
        motifs: [],
        characters: [],
        notes: '',
        themeAnalysis: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const firstScene: Scene = {
        id: `scene-${Date.now()}`,
        manuscriptId: newManu.id,
        title: '第一场',
        order: 1,
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.manuscripts.add(newManu);
      await db.scenes.add(firstScene);

      setManuscripts((prev) => [...prev, newManu]);
      setManuscript(newManu);
      setScenes([firstScene]);
      lastSnapshotMapRef.current[firstScene.id] = content;
      handleSelectScene(firstScene.id);

      return { manuscript: newManu, scene: firstScene };
    },
    [project, handleSelectScene]
  );

  // Import a local file (.txt, .md, or .docx) as a new Scene in current Manuscript
  const importSceneFile = useCallback(
    async (file: File) => {
      if (!manuscript) {
        return importManuscriptFile(file);
      }

      const { title, content } = await parseUploadedFile(file);
      const newOrder = scenes.length + 1;
      const newScene: Scene = {
        id: `scene-${Date.now()}`,
        manuscriptId: manuscript.id,
        title: title || `第 ${newOrder} 场`,
        order: newOrder,
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.scenes.add(newScene);
      lastSnapshotMapRef.current[newScene.id] = content;
      setScenes((prev) => [...prev, newScene]);
      handleSelectScene(newScene.id);

      return { manuscript, scene: newScene };
    },
    [manuscript, scenes.length, importManuscriptFile, handleSelectScene]
  );

  // Update manuscript info (e.g. characters / motifs)
  const updateManuscript = useCallback(
    async (updates: Partial<Manuscript>) => {
      if (!manuscript) return;
      setManuscript((prev) => (prev ? { ...prev, ...updates, updatedAt: Date.now() } : null));
      setManuscripts((prev) =>
        prev.map((m) => (m.id === manuscript.id ? { ...m, ...updates, updatedAt: Date.now() } : m))
      );
      await db.manuscripts.update(manuscript.id, { ...updates, updatedAt: Date.now() });
    },
    [manuscript]
  );

  // Replace the manuscript's scenes with AI scene split suggestions (destructive)
  const applySceneSplits = useCallback(
    async (
      targetManuscriptId: string,
      sceneSplits: { title: string; content: string; summary?: string }[]
    ) => {
      if (!sceneSplits || sceneSplits.length <= 1) return;

      await flushAutosave();

      const currentManuScenes = await db.scenes
        .where('manuscriptId')
        .equals(targetManuscriptId)
        .sortBy('order');

      for (const s of currentManuScenes) {
        await db.scenes.delete(s.id);
        delete lastSnapshotMapRef.current[s.id];
      }

      const newCreatedScenes: Scene[] = [];
      for (let i = 0; i < sceneSplits.length; i++) {
        const split = sceneSplits[i];
        const newScene: Scene = {
          id: `scene-${Date.now()}-${i}`,
          manuscriptId: targetManuscriptId,
          title: split.title || `第 ${i + 1} 场`,
          order: i + 1,
          content: split.content,
          summary: split.summary,
          createdAt: Date.now() + i,
          updatedAt: Date.now() + i,
        };
        await db.scenes.add(newScene);
        newCreatedScenes.push(newScene);
        lastSnapshotMapRef.current[newScene.id] = newScene.content;
      }

      setScenes(newCreatedScenes);
      if (newCreatedScenes.length > 0) {
        handleSelectScene(newCreatedScenes[0].id);
      }
    },
    [flushAutosave, handleSelectScene]
  );

  // Add new scene
  const addScene = useCallback(async () => {
    if (!manuscript) return;
    const newOrder = scenes.length + 1;
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      manuscriptId: manuscript.id,
      title: `第 ${newOrder} 场：未命名场景`,
      order: newOrder,
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.scenes.add(newScene);
    lastSnapshotMapRef.current[newScene.id] = '';
    setScenes((prev) => [...prev, newScene]);
    handleSelectScene(newScene.id);
  }, [manuscript, scenes.length, handleSelectScene]);

  // Delete scene
  const deleteScene = useCallback(
    async (sceneId: string) => {
      await db.scenes.delete(sceneId);
      await db.revisions.where('sceneId').equals(sceneId).delete();
      delete lastSnapshotMapRef.current[sceneId];
      const nextScenes = scenes.filter((s) => s.id !== sceneId);
      setScenes(nextScenes);
      if (activeSceneId === sceneId) {
        if (nextScenes.length > 0) {
          handleSelectScene(nextScenes[0].id);
        } else {
          setActiveSceneId('');
          activeSceneIdRef.current = '';
        }
      }
    },
    [activeSceneId, scenes, handleSelectScene]
  );

  // Rename scene
  const renameScene = useCallback(async (sceneId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, title: newTitle.trim() } : s))
    );
    await db.scenes.update(sceneId, { title: newTitle.trim(), updatedAt: Date.now() });
  }, []);

  // Update scene metadata (e.g. summary, pov, location, timeframe, title)
  const updateSceneMetadata = useCallback(
    async (sceneId: string, updates: Partial<Scene>) => {
      setScenes((prev) =>
        prev.map((s) => (s.id === sceneId ? { ...s, ...updates, updatedAt: Date.now() } : s))
      );
      await db.scenes.update(sceneId, { ...updates, updatedAt: Date.now() });
    },
    []
  );

  // Update settings
  const updateSettings = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await db.settings.put({ key: 'appSettings', value: newSettings });
  }, []);

  return {
    isReady,
    projects,
    project,
    setProject,
    createProject,
    manuscripts,
    manuscript,
    switchManuscript,
    createManuscript,
    importManuscriptFile,
    importSceneFile,
    applySceneSplits,
    scenes,
    activeScene,
    activeSceneId,
    setActiveSceneId: handleSelectScene,
    stats,
    updateSceneContent,
    flushAutosave,
    addScene,
    deleteScene,
    renameScene,
    updateSceneMetadata,
    updateManuscript,
    settings,
    updateSettings,
  };
}


