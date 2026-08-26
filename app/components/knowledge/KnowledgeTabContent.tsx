import { useState, useEffect, useCallback } from "react";
import { KnowledgeNodeCard } from "./KnowledgeNodeCard";
import { CreateKnowledgeModal } from "./CreateKnowledgeModal";
import { MediaAssetList, type MediaAssetDetail } from "./media/MediaAssetList";
import { AssetUploadModal } from "./media/AssetUploadModal";
import type { KnowledgeNode, KnowledgeKind } from "../../../shared/schemas/knowledge";

export interface KnowledgeTabContentProps {
  projectId: string;
}

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "all", label: "全部素材" },
  { key: "character", label: "人物角色" },
  { key: "world_rule", label: "世界法则" },
  { key: "location", label: "地点背景" },
  { key: "theme", label: "主题意象" },
  { key: "timeline", label: "时间线" },
  { key: "media", label: "多模态资源" },
  { key: "custom", label: "其他" },
];

export function KnowledgeTabContent({ projectId }: KnowledgeTabContentProps) {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [assets, setAssets] = useState<MediaAssetDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<KnowledgeNode | null>(null);

  const loadKnowledge = useCallback(async () => {
    try {
      setIsLoading(true);
      const [knowRes, assetRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/knowledge`),
        fetch(`/api/projects/${projectId}/assets`),
      ]);

      if (knowRes.ok) {
        const data = await knowRes.json();
        if (Array.isArray(data.nodes)) {
          setNodes(data.nodes);
        }
      }

      if (assetRes.ok) {
        const assetData = await assetRes.json();
        if (Array.isArray(assetData.items)) {
          setAssets(assetData.items);
        }
      }
    } catch (err) {
      console.error("Failed to load knowledge & assets:", err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);

  const handleCreateOrUpdate = async (data: {
    kind: KnowledgeKind;
    title: string;
    content: string;
    summary?: string;
    language?: string;
  }) => {
    const formData = new FormData();
    formData.append("intent", editingNode ? "update_node" : "create_node");
    if (editingNode) formData.append("nodeId", editingNode.id);
    formData.append("kind", data.kind);
    formData.append("title", data.title);
    formData.append("content", data.content);
    if (data.summary) formData.append("summary", data.summary);

    const res = await fetch(`/api/projects/${projectId}/knowledge`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      await loadKnowledge();
    }
  };

  const handleArchive = async (nodeId: string) => {
    const formData = new FormData();
    formData.append("intent", "archive_node");
    formData.append("nodeId", nodeId);

    const res = await fetch(`/api/projects/${projectId}/knowledge`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      await loadKnowledge();
    }
  };

  const handleUploadAsset = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/projects/${projectId}/assets`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      await loadKnowledge();
    }
  };

  const handleRetryAsset = async (assetId: string) => {
    const res = await fetch(`/api/projects/${projectId}/assets/${assetId}/retry`, {
      method: "POST",
    });

    if (res.ok) {
      await loadKnowledge();
    }
  };

  const filteredNodes =
    activeCategory === "all"
      ? nodes
      : nodes.filter((n) => n.kind === activeCategory);

  if (isLoading) {
    return (
      <div className="flex-1 p-8 text-center text-xs text-ink-muted font-serif animate-pulse">
        正在加载设定与素材库...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-paper font-serif overflow-hidden">
      {/* Top Header & Categories */}
      <div className="p-4 border-b border-ink-muted/15 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-paper/95 text-xs">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            let count = 0;
            if (cat.key === "all") count = nodes.length;
            else if (cat.key === "media") count = assets.length;
            else count = nodes.filter((n) => n.kind === cat.key).length;

            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-2.5 py-1 rounded text-xs transition-colors shrink-0 ${
                  activeCategory === cat.key
                    ? "bg-ink text-paper font-medium"
                    : "text-ink-muted hover:text-ink bg-paper-light"
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3 py-1.5 bg-paper-light border border-ink-muted/25 rounded text-xs font-medium text-ink hover:bg-paper shadow-2xs transition-colors"
          >
            + 上传素材文件
          </button>
          <button
            onClick={() => {
              setEditingNode(null);
              setIsModalOpen(true);
            }}
            className="px-3 py-1.5 bg-ink text-paper rounded text-xs font-medium hover:bg-ink/90 shadow-xs transition-colors"
          >
            + 新增设定条目
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {activeCategory === "media" ? (
          <MediaAssetList
            assets={assets}
            onRetry={handleRetryAsset}
            onUploadClick={() => setIsUploadModalOpen(true)}
          />
        ) : filteredNodes.length === 0 ? (
          <div className="text-center py-12 text-ink-muted space-y-2">
            <div className="text-2xl">📚</div>
            <p className="text-xs">
              {activeCategory === "all" ? "素材库暂无条目" : "该类别下暂无素材条目"}
            </p>
          </div>
        ) : (
          filteredNodes.map((node) => (
            <KnowledgeNodeCard
              key={node.id}
              node={node}
              onEdit={(n) => {
                setEditingNode(n);
                setIsModalOpen(true);
              }}
              onArchive={handleArchive}
            />
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <CreateKnowledgeModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingNode(null);
        }}
        onSubmit={handleCreateOrUpdate}
        initialNode={editingNode}
      />

      {/* Upload Modal */}
      <AssetUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUploadAsset}
      />
    </div>
  );
}

