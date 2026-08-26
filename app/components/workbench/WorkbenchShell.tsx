import { useState, useCallback, useRef, useEffect } from "react";
import { useFetcher } from "react-router";
import { WorkbenchHeader } from "./WorkbenchHeader";
import { MaterialTabs, type MaterialTabType } from "./MaterialTabs";
import { ManuscriptViewer } from "./ManuscriptViewer";
import { ManuscriptEditor } from "./ManuscriptEditor";
import { AgentPane } from "./AgentPane";
import { ChangesTabContent } from "../changes/ChangesTabContent";
import { KnowledgeTabContent } from "../knowledge/KnowledgeTabContent";
import type { Project, Manuscript, Scene } from "../../../shared/schemas/project";
import type { AgentThread } from "../../../shared/schemas/agent";

export interface WorkbenchShellProps {
  project: Project;
  manuscripts: Manuscript[];
  scenes: Scene[];
  activeThread?: AgentThread;
}

export function WorkbenchShell({
  project,
  manuscripts,
  scenes,
  activeThread,
}: WorkbenchShellProps) {
  const fetcher = useFetcher();

  // Active scene selection
  const [activeSceneId, setActiveSceneId] = useState<string>(
    scenes[0]?.id || ""
  );

  // Material pane tab
  const [activeTab, setActiveTab] = useState<MaterialTabType>("manuscript");

  // Manual editing mode
  const [isEditing, setIsEditing] = useState(false);

  // Attached quote in Agent composer
  const [attachedQuote, setAttachedQuote] = useState<string | null>(null);

  // Resizable split pane width state (percentage or pixel)
  const [leftWidthPercent, setLeftWidthPercent] = useState(62);
  const isDraggingRef = useRef(false);

  const activeScene = scenes.find((s) => s.id === activeSceneId) || scenes[0];

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const containerWidth = window.innerWidth;
      const newPercent = (e.clientX / containerWidth) * 100;
      if (newPercent >= 35 && newPercent <= 75) {
        setLeftWidthPercent(newPercent);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleSaveRevision = async (contentJson: string, description?: string) => {
    if (!activeScene) return;

    fetcher.submit(
      {
        intent: "save_scene_revision",
        projectId: project.id,
        sceneId: activeScene.id,
        content: contentJson,
        expectedBaseRevisionId: activeScene.currentRevisionId || "",
        description: description || "手动修改",
      },
      { method: "post" }
    );

    setIsEditing(false);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-paper overflow-hidden font-serif">
      {/* Top Workbench Header */}
      <WorkbenchHeader
        project={project}
        manuscripts={manuscripts}
        scenes={scenes}
        activeSceneId={activeScene?.id || ""}
        onSelectScene={(id: string) => setActiveSceneId(id)}
        currentContent={activeScene?.content || ""}
        isEditing={isEditing}
        onToggleEditMode={() => setIsEditing(!isEditing)}
      />

      {/* Main Two-Pane Split Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Material Pane */}
        <div
          style={{ width: `${leftWidthPercent}%` }}
          className="h-full flex flex-col overflow-hidden bg-paper shrink-0"
        >
          <MaterialTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isEditing={isEditing}
          />

          <div className="flex-1 overflow-y-auto">
            {activeTab === "manuscript" && (
              <>
                {isEditing ? (
                  <ManuscriptEditor
                    initialContent={activeScene?.content || ""}
                    sceneTitle={activeScene?.title || ""}
                    baseRevisionId={activeScene?.currentRevisionId || undefined}
                    onSave={handleSaveRevision}
                    onCancel={() => setIsEditing(false)}
                  />
                ) : (
                  <ManuscriptViewer
                    content={activeScene?.content || ""}
                    sceneTitle={activeScene?.title || ""}
                    onAttachQuoteToAgent={(quote) => setAttachedQuote(quote)}
                    onEnterManualEdit={() => setIsEditing(true)}
                  />
                )}
              </>
            )}

            {activeTab === "knowledge" && (
              <KnowledgeTabContent projectId={project.id} />
            )}

            {activeTab === "changes" && (
              <ChangesTabContent
                projectId={project.id}
                onRefreshProject={() => window.location.reload()}
              />
            )}
          </div>
        </div>

        {/* Resizable Divider Handle */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1.5 h-full bg-ink-muted/10 hover:bg-cinnabar/60 active:bg-cinnabar transition-colors cursor-col-resize shrink-0 z-10 select-none relative group"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Right Agent Pane */}
        <div className="flex-1 h-full overflow-hidden bg-paper-light/30 min-w-[320px]">
          <AgentPane
            projectId={project.id}
            threadId={activeThread?.id}
            attachedQuote={attachedQuote}
            onClearAttachedQuote={() => setAttachedQuote(null)}
          />
        </div>
      </div>
    </div>
  );
}
