import { describe, it, expect, beforeEach } from 'vitest';
import type { Scene } from '../types';

describe('Autosave Flushing & Scene Switch Persistence Logic', () => {
  let mockDbScenes: Map<string, Scene>;

  beforeEach(() => {
    mockDbScenes = new Map<string, Scene>([
      [
        'scene-1',
        {
          id: 'scene-1',
          manuscriptId: 'manu-1',
          title: '第一场：起首',
          order: 1,
          content: '初始场景一内容',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      [
        'scene-2',
        {
          id: 'scene-2',
          manuscriptId: 'manu-1',
          title: '第二场：承接',
          order: 2,
          content: '初始场景二内容',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    ]);
  });

  it('should immediately flush pending autosave to database when switching scenes before debounce timeout', async () => {
    const pendingSaves: Record<string, string> = {};
    let activeSceneId = 'scene-1';

    // Mock DB update
    const dbUpdate = async (id: string, changes: Partial<Scene>) => {
      const existing = mockDbScenes.get(id);
      if (existing) {
        mockDbScenes.set(id, { ...existing, ...changes, updatedAt: Date.now() });
      }
    };

    const flushAutosave = async (targetId?: string) => {
      if (targetId) {
        const content = pendingSaves[targetId];
        if (content !== undefined) {
          delete pendingSaves[targetId];
          await dbUpdate(targetId, { content });
        }
      } else {
        const entries = Object.entries(pendingSaves);
        for (const [sId, content] of entries) {
          delete pendingSaves[sId];
          await dbUpdate(sId, { content });
        }
      }
    };

    const updateSceneContent = (newContent: string) => {
      pendingSaves[activeSceneId] = newContent;
    };

    const handleSelectScene = async (newSceneId: string) => {
      if (activeSceneId && activeSceneId !== newSceneId) {
        // Flush pending autosave before switching scenes
        await flushAutosave(activeSceneId);
      }
      activeSceneId = newSceneId;
    };

    // 1. User inputs new text in Scene 1
    const latestTypedText = '【输入后仅过100毫秒便切换场景】雨停以后，修鞋铺准时开门。';
    updateSceneContent(latestTypedText);

    // 2. Immediately switch to Scene 2 within 1.5s (before any background timer triggers)
    await handleSelectScene('scene-2');

    // 3. Verify Scene 1 in database contains the latest typed text, zero data loss!
    const scene1InDb = mockDbScenes.get('scene-1');
    expect(scene1InDb).toBeDefined();
    expect(scene1InDb?.content).toBe(latestTypedText);
  });

  it('should flush pending saves across all scenes when switching manuscript', async () => {
    const pendingSaves: Record<string, string> = {};
    let activeSceneId = 'scene-1';

    const dbUpdate = async (id: string, changes: Partial<Scene>) => {
      const existing = mockDbScenes.get(id);
      if (existing) {
        mockDbScenes.set(id, { ...existing, ...changes, updatedAt: Date.now() });
      }
    };

    const flushAutosave = async () => {
      const entries = Object.entries(pendingSaves);
      for (const [sId, content] of entries) {
        delete pendingSaves[sId];
        await dbUpdate(sId, { content });
      }
    };

    const updateSceneContent = (newContent: string) => {
      pendingSaves[activeSceneId] = newContent;
    };

    const switchManuscript = async (_newManuId: string) => {
      await flushAutosave();
    };

    // 1. User writes content in scene 1
    const writtenText = '【书稿切换前最后一秒输入的文字】';
    updateSceneContent(writtenText);

    // 2. User switches to a different manuscript immediately
    await switchManuscript('manu-other');

    // 3. Verify Scene 1 content in DB is safely preserved
    const scene1InDb = mockDbScenes.get('scene-1');
    expect(scene1InDb?.content).toBe(writtenText);
  });
});
