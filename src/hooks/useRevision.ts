import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import type { RevisionSnapshot } from '../types';

export function useRevision(sceneId: string) {
  const [revisions, setRevisions] = useState<RevisionSnapshot[]>([]);

  const loadRevisions = useCallback(async () => {
    if (!sceneId) {
      setRevisions([]);
      return;
    }
    const list = await db.revisions
      .where('sceneId')
      .equals(sceneId)
      .reverse()
      .sortBy('timestamp');
    setRevisions(list);
  }, [sceneId]);

  useEffect(() => {
    let isMounted = true;
    if (sceneId) {
      db.revisions
        .where('sceneId')
        .equals(sceneId)
        .reverse()
        .sortBy('timestamp')
        .then((list) => {
          if (isMounted) setRevisions(list);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [sceneId]);

  const addRevision = useCallback(
    async (
      content: string,
      description: string,
      changeType: RevisionSnapshot['changeType'] = 'manual_edit',
      rollbackSourceRevId?: string
    ) => {
      if (!sceneId) return null;
      const newSnapshot: RevisionSnapshot = {
        id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sceneId,
        timestamp: Date.now(),
        description,
        changeType,
        content,
        characterCount: content.length,
        rollbackSourceRevId,
      };

      await db.revisions.add(newSnapshot);
      await loadRevisions();
      return newSnapshot;
    },
    [sceneId, loadRevisions]
  );

  /**
   * Safe Atomic Revision Restore
   * 1. Preserves current uncommitted content as an automatic backup checkpoint.
   * 2. Replaces content with target revision content.
   * 3. Records a rollback revision entry referencing the source snapshot.
   */
  const restoreRevisionAtomic = useCallback(
    async (
      targetRev: RevisionSnapshot,
      currentContent: string,
      onContentRestored: (newContent: string) => void
    ) => {
      if (!sceneId || !targetRev) return;

      await db.transaction('rw', [db.revisions, db.scenes], async () => {
        // 1. Save pre-restore auto-backup checkpoint if current content differs
        if (currentContent.trim() !== targetRev.content.trim()) {
          const backupSnapshot: RevisionSnapshot = {
            id: `rev-backup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sceneId,
            timestamp: Date.now() - 1,
            description: `恢复前自动备份快照 (目标: ${targetRev.description})`,
            changeType: 'checkpoint',
            content: currentContent,
            characterCount: currentContent.length,
          };
          await db.revisions.add(backupSnapshot);
        }

        // 2. Update scene in DB
        await db.scenes.update(sceneId, {
          content: targetRev.content,
          updatedAt: Date.now(),
        });

        // 3. Record rollback event
        const rollbackSnapshot: RevisionSnapshot = {
          id: `rev-rollback-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sceneId,
          timestamp: Date.now(),
          description: `回滚至历史版本: ${targetRev.description}`,
          changeType: 'rollback',
          content: targetRev.content,
          characterCount: targetRev.content.length,
          rollbackSourceRevId: targetRev.id,
        };
        await db.revisions.add(rollbackSnapshot);
      });

      // Update in-memory state
      onContentRestored(targetRev.content);
      await loadRevisions();
    },
    [sceneId, loadRevisions]
  );

  const renameRevision = useCallback(
    async (revId: string, newDescription: string) => {
      if (!revId || !newDescription.trim()) return;
      await db.revisions.update(revId, {
        description: newDescription.trim(),
      });
      await loadRevisions();
    },
    [loadRevisions]
  );

  const deleteRevision = useCallback(
    async (revId: string) => {
      if (!revId) return;
      await db.revisions.delete(revId);
      await loadRevisions();
    },
    [loadRevisions]
  );

  return {
    revisions,
    addRevision,
    restoreRevisionAtomic,
    renameRevision,
    deleteRevision,
    loadRevisions,
  };
}
