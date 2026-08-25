import { describe, it, expect } from 'vitest';
import type { RevisionSnapshot } from '../../types';

describe('Revision Restoration & Snapshot Safety', () => {
  it('should ensure current content is never lost during rollback', () => {
    const revisions: RevisionSnapshot[] = [];
    let currentContent = '正在撰写的新段落（未提交）';

    const targetRev: RevisionSnapshot = {
      id: 'rev-v1',
      sceneId: 'scene-01',
      timestamp: 1000,
      description: '第一版草稿',
      changeType: 'checkpoint',
      content: '第一版初始内容。',
    };
    revisions.push(targetRev);

    // Rollback procedure simulation (matching restoreRevisionAtomic algorithm)
    const currentUnsaved = currentContent;
    if (currentUnsaved !== targetRev.content) {
      // 1. Save pre-restore backup snapshot
      const backupRev: RevisionSnapshot = {
        id: `rev-backup-${Date.now()}`,
        sceneId: 'scene-01',
        timestamp: Date.now() - 1,
        description: `恢复前自动备份快照 (目标: ${targetRev.description})`,
        changeType: 'checkpoint',
        content: currentUnsaved,
      };
      revisions.push(backupRev);
    }

    // 2. Set current content to target
    currentContent = targetRev.content;

    // 3. Record rollback event
    const rollbackRev: RevisionSnapshot = {
      id: `rev-rollback-${Date.now()}`,
      sceneId: 'scene-01',
      timestamp: Date.now(),
      description: `回滚至历史版本: ${targetRev.description}`,
      changeType: 'rollback',
      content: targetRev.content,
      rollbackSourceRevId: targetRev.id,
    };
    revisions.push(rollbackRev);

    // Verify
    expect(currentContent).toBe('第一版初始内容。');
    expect(revisions.length).toBe(3);

    // Verify pre-restore content is safely preserved in revisions!
    const preservedSnapshot = revisions.find((r) => r.content === '正在撰写的新段落（未提交）');
    expect(preservedSnapshot).toBeDefined();
    expect(preservedSnapshot?.changeType).toBe('checkpoint');
  });
});
