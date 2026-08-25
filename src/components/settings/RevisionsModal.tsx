import React, { useState } from 'react';
import type { RevisionSnapshot } from '../../types';
import { computeCharacterDiff } from '../../utils/diff';
import {
  X,
  History,
  RotateCcw,
  Plus,
  FileText,
  CheckCircle2,
  Scissors,
  Edit2,
  Trash2,
  Check
} from 'lucide-react';

interface RevisionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  revisions: RevisionSnapshot[];
  currentContent: string;
  onRestoreRevision: (targetRev: RevisionSnapshot) => void;
  onCreateCheckpoint: (description: string) => void;
  onRenameRevision?: (revId: string, newDesc: string) => void;
  onDeleteRevision?: (revId: string) => void;
}

export const RevisionsModal: React.FC<RevisionsModalProps> = ({
  isOpen,
  onClose,
  revisions,
  currentContent,
  onRestoreRevision,
  onCreateCheckpoint,
  onRenameRevision,
  onDeleteRevision,
}) => {
  const [selectedRevId, setSelectedRevId] = useState<string>(revisions[0]?.id || '');
  const [checkpointDesc, setCheckpointDesc] = useState('');
  const [showCreateCheckpoint, setShowCreateCheckpoint] = useState(false);
  const [editingRevId, setEditingRevId] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  if (!isOpen) return null;

  const filteredRevisions = revisions.filter((r) => {
    if (typeFilter === 'all') return true;
    return r.changeType === typeFilter;
  });

  const selectedRev =
    filteredRevisions.find((r) => r.id === selectedRevId) ||
    filteredRevisions[0] ||
    revisions[0];

  const handleCreate = () => {
    if (!checkpointDesc.trim()) return;
    onCreateCheckpoint(checkpointDesc.trim());
    setCheckpointDesc('');
    setShowCreateCheckpoint(false);
  };

  const handleStartRename = (e: React.MouseEvent, rev: RevisionSnapshot) => {
    e.stopPropagation();
    setEditingRevId(rev.id);
    setEditingDesc(rev.description);
  };

  const handleSaveRename = (e: React.MouseEvent, revId: string) => {
    e.stopPropagation();
    if (editingDesc.trim() && onRenameRevision) {
      onRenameRevision(revId, editingDesc.trim());
    }
    setEditingRevId(null);
  };

  const handleDelete = (e: React.MouseEvent, revId: string, desc: string) => {
    e.stopPropagation();
    if (confirm(`确认删除快照「${desc}」吗？`) && onDeleteRevision) {
      onDeleteRevision(revId);
    }
  };

  const getChangeTypeIcon = (type: RevisionSnapshot['changeType']) => {
    switch (type) {
      case 'ai_accepted':
        return <CheckCircle2 className="w-3.5 h-3.5 text-ok" />;
      case 'cut':
        return <Scissors className="w-3.5 h-3.5 text-danger" />;
      case 'checkpoint':
        return <History className="w-3.5 h-3.5 text-cinnabar" />;
      case 'rollback':
        return <RotateCcw className="w-3.5 h-3.5 text-ink-muted" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-ink-muted" />;
    }
  };

  const diffTokens = selectedRev
    ? computeCharacterDiff(selectedRev.content, currentContent)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-paper rounded-lg shadow-xl border border-line flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-cinnabar" />
            <h2 className="font-serif text-sm font-bold text-ink">
              修订单与文学版本历史 (Manuscript Revisions)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-ink-muted hover:text-ink rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-5 py-2 bg-paper-sunken/50 border-b border-line flex items-center justify-between text-xs font-serif">
          <div className="flex items-center space-x-2">
            <span className="text-ink-muted text-[11px]">版本筛选:</span>
            {['all', 'checkpoint', 'manual_edit', 'ai_accepted', 'rollback'].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  typeFilter === type
                    ? 'bg-ink text-paper'
                    : 'text-ink-muted hover:bg-paper-sunken'
                }`}
              >
                {type === 'all'
                  ? '全部'
                  : type === 'checkpoint'
                  ? '手动快照'
                  : type === 'manual_edit'
                  ? '人工编辑'
                  : type === 'ai_accepted'
                  ? 'AI 采纳'
                  : '回滚历史'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCreateCheckpoint(!showCreateCheckpoint)}
            className="flex items-center space-x-1 text-cinnabar hover:text-ink text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建快照</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-3 gap-4 font-serif text-xs">
          {/* Left Timeline */}
          <div className="border-r border-line pr-3 space-y-2">
            {showCreateCheckpoint && (
              <div className="p-2.5 bg-paper-sunken rounded border border-line space-y-2 mb-2">
                <input
                  type="text"
                  placeholder="快照说明 (如: 完成第一节初修)"
                  value={checkpointDesc}
                  onChange={(e) => setCheckpointDesc(e.target.value)}
                  className="w-full p-1.5 text-xs bg-paper border border-line-strong rounded focus:outline-none"
                  autoFocus
                />
                <div className="flex justify-end space-x-1">
                  <button
                    onClick={() => setShowCreateCheckpoint(false)}
                    className="px-2 py-0.5 text-[11px] text-ink-muted"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreate}
                    className="px-2.5 py-0.5 text-[11px] bg-cinnabar text-white rounded"
                  >
                    保存快照
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
              {filteredRevisions.map((rev) => {
                const isSelected = rev.id === (selectedRev?.id || '');
                const isEditing = editingRevId === rev.id;
                const timeStr = new Date(rev.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const dateStr = new Date(rev.timestamp).toLocaleDateString([], {
                  month: 'numeric',
                  day: 'numeric',
                });

                return (
                  <div
                    key={rev.id}
                    onClick={() => setSelectedRevId(rev.id)}
                    className={`p-2.5 rounded cursor-pointer transition-colors border group relative ${
                      isSelected
                        ? 'bg-paper-sunken border-cinnabar text-ink'
                        : 'bg-paper border-line text-ink-muted hover:bg-paper-sunken'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-ink-muted mb-1">
                      <span className="flex items-center space-x-1">
                        {getChangeTypeIcon(rev.changeType)}
                        <span className="font-mono">
                          {dateStr} {timeStr}
                        </span>
                      </span>
                      <span className="font-mono text-[9px] opacity-70">
                        {rev.characterCount || rev.content.length} 字
                      </span>
                    </div>

                    {isEditing ? (
                      <div
                        className="flex items-center space-x-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editingDesc}
                          onChange={(e) => setEditingDesc(e.target.value)}
                          className="flex-1 p-1 text-xs bg-paper border border-line-strong rounded text-ink focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={(e) => handleSaveRename(e, rev.id)}
                          className="p-1 text-ok"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-xs truncate pr-1">
                          {rev.description}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity">
                          {onRenameRevision && (
                            <button
                              onClick={(e) => handleStartRename(e, rev)}
                              className="p-0.5 text-ink-muted hover:text-ink"
                              title="重命名快照"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                          {onDeleteRevision && (
                            <button
                              onClick={(e) => handleDelete(e, rev.id, rev.description)}
                              className="p-0.5 text-ink-muted hover:text-danger"
                              title="删除快照"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Diff Viewer */}
          <div className="md:col-span-2 space-y-3 flex flex-col">
            {selectedRev ? (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <div>
                    <h3 className="font-bold text-ink">
                      历史版本 vs 当前正文对比
                    </h3>
                    <p className="text-[10px] text-ink-muted mt-0.5">
                      快照时间: {new Date(selectedRev.timestamp).toLocaleString()} • {selectedRev.description}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `确认恢复至版本「${selectedRev.description}」吗？系统已为您自动备份当前正文。`
                        )
                      ) {
                        onRestoreRevision(selectedRev);
                        onClose();
                      }
                    }}
                    className="flex items-center space-x-1 px-3 py-1 text-xs bg-paper-sunken hover:bg-line text-ink rounded transition-colors font-medium shadow-xs"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>恢复此版本</span>
                  </button>
                </div>

                <div className="flex-1 p-3 bg-paper rounded border border-line overflow-y-auto max-h-[55vh] leading-relaxed text-xs">
                  {diffTokens.map((token, i) => {
                    if (token.type === 'delete') {
                      return (
                        <del
                          key={i}
                          className="bg-danger/15 text-danger line-through decoration-danger mx-0.5 px-0.5 rounded-xs"
                        >
                          {token.text}
                        </del>
                      );
                    }
                    if (token.type === 'insert') {
                      return (
                        <ins
                          key={i}
                          className="bg-ok/15 text-ok no-underline font-medium mx-0.5 px-0.5 rounded-xs"
                        >
                          {token.text}
                        </ins>
                      );
                    }
                    return (
                      <span key={i} className="text-ink">
                        {token.text}
                      </span>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-ink-muted">请选择一个历史版本查看</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
