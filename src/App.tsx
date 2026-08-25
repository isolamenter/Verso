import { useState, useCallback, useEffect, useRef } from 'react';
import { useManuscript } from './hooks/useManuscript';
import { useCritique } from './hooks/useCritique';
import { useRevision } from './hooks/useRevision';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Studio } from './components/layout/Studio';
import { EditorCanvas } from './components/editor/EditorCanvas';
import { SettingsModal } from './components/settings/SettingsModal';
import { LensEditorModal } from './components/settings/LensEditorModal';
import { PromptLibraryModal } from './components/settings/PromptLibraryModal';
import { RevisionsModal } from './components/settings/RevisionsModal';
import { NotesModal } from './components/settings/NotesModal';
import { ImportAssistantModal } from './components/settings/ImportAssistantModal';
import { applyQuoteReplacement } from './utils/diff';
import type { CritiqueCategory, RevisionSnapshot } from './types';
import { Feather, Plus, Upload, BookOpen, Sparkles, X } from 'lucide-react';

export function App() {
  const {
    isReady,
    project,
    manuscripts,
    manuscript,
    switchManuscript,
    createManuscript,
    importManuscriptFile,
    importSceneFile,
    applyProfilingData,
    scenes,
    activeScene,
    activeSceneId,
    setActiveSceneId,
    stats,
    updateSceneContent,
    addScene,
    deleteScene,
    renameScene,
    updateManuscript,
    settings,
    updateSettings,
  } = useManuscript();

  const {
    lenses,
    activeLensId,
    setActiveLensId,
    saveLenses,
    promptTemplates,
    activeTemplateId,
    setActiveTemplateId,
    savePromptTemplates,
    contextConfig,
    setContextConfig,
    critiqueSummary,
    annotations,
    isCritiqueLoading,
    runSelectionCritique,
    updateAnnotationStatus,
    coldReaderReport,
    isColdReaderLoading,
    runColdRead,
    intentEvaluation,
    isIntentLoading,
    runIntentEvaluation,
    compareReport,
    isCompareLoading,
    runVersionCompare,
    chatHistory,
    isAskLoading,
    askQuestion,
    isProfilingLoading,
    runManuscriptProfile,
  } = useCritique(settings, manuscript, scenes, activeScene);

  const {
    revisions,
    addRevision,
    restoreRevisionAtomic,
    renameRevision,
    deleteRevision,
  } = useRevision(activeSceneId);

  // UI layout states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isStudioOpen, setIsStudioOpen] = useState(true);
  const [studioTab, setStudioTab] = useState<
    'critique' | 'cold_reader' | 'intent' | 'compare' | 'ask'
  >('critique');
  const [activeSelectedText, setActiveSelectedText] = useState('');
  const [activeAnnotationQuote, setActiveAnnotationQuote] = useState<string | null>(null);

  // Welcome / Empty State Local State
  const [newTitleInput, setNewTitleInput] = useState('');
  const emptyFileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Import Assistant & Notifications
  const [isImportAssistantOpen, setIsImportAssistantOpen] = useState(false);
  const [importBanner, setImportBanner] = useState<{ title: string; wordCount: number } | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLensEditorOpen, setIsLensEditorOpen] = useState(false);
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(false);
  const [isRevisionsOpen, setIsRevisionsOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [notesDefaultTab, setNotesDefaultTab] = useState<'characters' | 'motifs'>('characters');

  // Handle floating selection action
  const handleSelectionAction = useCallback(
    (category: CritiqueCategory, selectedText: string, range: { from: number; to: number }) => {
      setActiveSelectedText(selectedText);
      setIsStudioOpen(true);

      if (category === 'ask') {
        setStudioTab('ask');
      } else {
        setStudioTab('critique');
        runSelectionCritique(category, selectedText, range);
      }
    },
    [runSelectionCritique]
  );

  // Accept an AI annotation replacement with range-aware safety
  const handleAcceptAnnotation = useCallback(
    async (
      annotationId: string,
      replacementText: string,
      type: 'minimal' | 'moderate' | 'radical'
    ) => {
      if (!activeScene) return;
      const targetAnn = annotations.find((a) => a.id === annotationId);
      if (!targetAnn) return;

      if (targetAnn.isStale) {
        if (!confirm('注意：正文近期发生过编辑，该批注原始锚点已标记为过期。是否仍尝试在此场景中匹配替换？')) {
          return;
        }
      }

      const { success, newContent, isAmbiguous } = applyQuoteReplacement(
        activeScene.content,
        targetAnn.quote,
        replacementText,
        targetAnn.range
      );

      if (success) {
        updateSceneContent(newContent);
        await updateAnnotationStatus(annotationId, 'accepted', type);

        // Record literary revision snapshot
        await addRevision(
          newContent,
          `采纳 ${targetAnn.category} 建议 (${type}): “${targetAnn.quote.slice(0, 12)}...” → “${replacementText.slice(0, 12)}...”`,
          'ai_accepted'
        );
      } else {
        if (isAmbiguous) {
          alert('采纳拦截：该引用文段在当前场景中存在多处完全相同的重复出现，无法唯一定位。请在正文中重新精确选中文段后再行采纳，以防止误改其他段落。');
        } else {
          alert('无法在正文中唯一定位该片段，可能文本在此期间已被手动大幅改写或删除。');
        }
      }
    },
    [annotations, activeScene, updateSceneContent, updateAnnotationStatus, addRevision]
  );

  // Reject an AI annotation
  const handleRejectAnnotation = useCallback(
    async (annotationId: string) => {
      await updateAnnotationStatus(annotationId, 'rejected');
    },
    [updateAnnotationStatus]
  );

  // Safe atomic restore
  const handleRestoreRevision = useCallback(
    async (targetRev: RevisionSnapshot) => {
      if (!activeScene) return;
      await restoreRevisionAtomic(targetRev, activeScene.content, (newContent) => {
        updateSceneContent(newContent);
      });
    },
    [restoreRevisionAtomic, activeScene, updateSceneContent]
  );

  // Quick create from welcome screen
  const handleQuickCreate = () => {
    const title = newTitleInput.trim() || '我的第一篇书稿';
    createManuscript(title, 'short_story', '');
    setNewTitleInput('');
  };

  // Unified file import handler with error trapping & notification trigger
  const handleImportFile = useCallback(
    async (file: File, isNewManuscript: boolean) => {
      try {
        if (isNewManuscript || !manuscript) {
          const res = await importManuscriptFile(file);
          if (res) {
            setImportBanner({
              title: res.manuscript.title,
              wordCount: res.scene.content.length,
            });
          }
        } else {
          const res = await importSceneFile(file);
          if (res) {
            setImportBanner({
              title: res.scene.title,
              wordCount: res.scene.content.length,
            });
          }
        }
      } catch (err: any) {
        alert(err.message || '文件解析与导入失败');
      }
    },
    [manuscript, importManuscriptFile, importSceneFile]
  );

  // Drag and drop handler for importing file (.txt, .md, .docx)
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const lower = file.name.toLowerCase();
      if (
        lower.endsWith('.txt') ||
        lower.endsWith('.md') ||
        lower.endsWith('.docx') ||
        lower.endsWith('.doc')
      ) {
        await handleImportFile(file, !manuscript);
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
      if (cmdKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsStudioOpen((prev) => !prev);
      }
      if (cmdKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        updateSettings({ ...settings, focusMode: !settings.focusMode });
      }
      if (cmdKey && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        if (activeScene) {
          addRevision(activeScene.content, '手动保存里程碑快照', 'checkpoint');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings, updateSettings, addRevision, activeScene]);

  // First-time onboarding: prompt user to set up API Key / Profile if none exists
  useEffect(() => {
    if (isReady && settings.profiles.length === 0) {
      setIsSettingsOpen(true);
    }
  }, [isReady, settings.profiles.length]);

  if (!isReady) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-paper text-ink">
        <div className="w-8 h-8 border-2 border-cinnabar border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-serif text-sm text-ink-muted">Verso 正在展开稿纸……</p>
      </div>
    );
  }

  const activeProfile =
    settings.profiles.find((p) => p.id === settings.activeProfileId) || settings.profiles[0];

  const isFocusMode = settings.focusMode;

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden bg-paper ${
        settings.paperTheme === 'ink' ? 'dark' : ''
      }`}
    >
      {/* Top Header */}
      {!isFocusMode && (
        <Header
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isStudioOpen={isStudioOpen}
          onToggleStudio={() => setIsStudioOpen(!isStudioOpen)}
          sceneTitle={activeScene ? activeScene.title : manuscript?.title || 'Verso'}
          stats={stats}
          paperTheme={settings.paperTheme}
          onThemeChange={(theme) => updateSettings({ ...settings, paperTheme: theme })}
          typography={settings.typography}
          onTypographyChange={(typo) => updateSettings({ ...settings, typography: typo })}
          typewriterMode={settings.typewriterMode}
          onToggleTypewriter={() =>
            updateSettings({ ...settings, typewriterMode: !settings.typewriterMode })
          }
          focusMode={settings.focusMode}
          onToggleFocus={() => updateSettings({ ...settings, focusMode: !settings.focusMode })}
          isLocalOnly={settings.localOnlyMode}
          activeProfileName={activeProfile?.name || '未配置'}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Main Workspace (3 Columns) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Column: Manuscripts & Outline */}
        {!isFocusMode && (
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            project={project}
            manuscripts={manuscripts}
            manuscript={manuscript}
            onSwitchManuscript={switchManuscript}
            onCreateManuscript={createManuscript}
            onImportManuscriptFile={(file) => handleImportFile(file, true)}
            onImportSceneFile={(file) => handleImportFile(file, false)}
            onOpenImportAssistant={() => setIsImportAssistantOpen(true)}
            scenes={scenes}
            activeSceneId={activeSceneId}
            onSelectScene={setActiveSceneId}
            onAddScene={addScene}
            onDeleteScene={deleteScene}
            onRenameScene={renameScene}
            onOpenRevisions={() => setIsRevisionsOpen(true)}
            onOpenCharacterNotes={() => {
              setNotesDefaultTab('characters');
              setIsNotesOpen(true);
            }}
            onOpenMotifs={() => {
              setNotesDefaultTab('motifs');
              setIsNotesOpen(true);
            }}
            onOpenPromptLibrary={() => setIsPromptLibraryOpen(true)}
          />
        )}

        {/* Center Column: TipTap Writing Canvas or Welcome Screen */}
        <main
          className="flex-1 flex flex-col min-w-0 overflow-hidden relative"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
        >
          {/* Drag Overlay Hint */}
          {isDraggingOver && (
            <div className="absolute inset-0 z-50 bg-paper/90 backdrop-blur-xs border-2 border-dashed border-cinnabar flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
              <Upload className="w-10 h-10 text-cinnabar animate-bounce mb-3" />
              <h3 className="font-serif text-lg font-bold text-ink">松开鼠标以导入文稿</h3>
              <p className="mt-1 font-serif text-xs text-ink-muted">
                支持 .txt、.md 纯文本或 .docx Word 文档，将自动解析为文稿正文。
              </p>
            </div>
          )}

          {activeScene ? (
            <EditorCanvas
              content={activeScene.content}
              onChange={updateSceneContent}
              onSelectionAction={handleSelectionAction}
              activeAnnotationQuote={activeAnnotationQuote}
              paperTheme={settings.paperTheme}
              typography={settings.typography}
              fontSize={settings.fontSize}
              lineHeight={settings.lineHeight}
              typewriterMode={settings.typewriterMode}
              focusMode={settings.focusMode}
            />
          ) : (
            /* Welcome / Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto font-serif select-none">
              <div className="max-w-md w-full text-center space-y-6 animate-in fade-in duration-300">
                <div className="w-14 h-14 mx-auto rounded-full bg-paper-sunken flex items-center justify-center border border-line">
                  <Feather className="w-7 h-7 text-cinnabar" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-bold tracking-wide text-ink font-serif">
                    展开稿纸，开始写作
                  </h2>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Verso 是面向严肃文学创作者的沉浸式工作台。零预置项目，所有文本完全在本地浏览器存储，由您自主掌控。
                  </p>
                </div>

                <div className="p-4 bg-paper-sunken rounded-lg border border-line space-y-3.5 text-left">
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      新建文稿篇名
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="例如：《暮色与归人》或《第一章》"
                        value={newTitleInput}
                        onChange={(e) => setNewTitleInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQuickCreate()}
                        className="flex-1 p-2 text-xs bg-paper border border-line-strong rounded focus:outline-none focus:border-cinnabar text-ink"
                        autoFocus
                      />
                      <button
                        onClick={handleQuickCreate}
                        className="px-3.5 py-2 bg-cinnabar hover:bg-cinnabar-strong text-white text-xs font-medium rounded transition-colors flex items-center space-x-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>开启创作</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 text-xs text-ink-faint">
                    <div className="h-px bg-line flex-1" />
                    <span>或者</span>
                    <div className="h-px bg-line flex-1" />
                  </div>

                  {/* Hidden file input */}
                  <input
                    ref={emptyFileInputRef}
                    type="file"
                    accept=".txt,.md,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportFile(file, true);
                      if (e.target) e.target.value = '';
                    }}
                  />

                  <button
                    onClick={() => emptyFileInputRef.current?.click()}
                    className="w-full py-2 px-3 border border-line-strong hover:border-cinnabar bg-paper hover:bg-paper-raise rounded text-xs font-medium text-ink transition-colors flex items-center justify-center space-x-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-cinnabar" />
                    <span>导入本地文件 (.txt / .md / .docx)</span>
                  </button>

                  <p className="text-[11px] text-ink-faint text-center">
                    您也可以直接将 .txt、.md 或 .docx 文件拖拽到此处
                  </p>
                </div>

                <div className="flex items-center justify-center space-x-4 text-[11px] text-ink-muted">
                  <span className="flex items-center space-x-1">
                    <BookOpen className="w-3.5 h-3.5 text-cinnabar" />
                    <span>本地沙箱存储</span>
                  </span>
                  <span>·</span>
                  <span className="flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-cinnabar" />
                    <span>多视角严肃文学审校</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right Column: Literary Studio */}
        {!isFocusMode && (
          <Studio
            isOpen={isStudioOpen}
            onClose={() => setIsStudioOpen(false)}
            activeTab={studioTab}
            onTabChange={setStudioTab}
            critiqueSummary={critiqueSummary}
            annotations={annotations}
            onAcceptAnnotation={handleAcceptAnnotation}
            onRejectAnnotation={handleRejectAnnotation}
            onLocateQuote={(quote) => setActiveAnnotationQuote(quote)}
            isCritiqueLoading={isCritiqueLoading}
            coldReaderReport={coldReaderReport}
            onTriggerColdRead={runColdRead}
            isColdReaderLoading={isColdReaderLoading}
            currentSceneTitle={activeScene ? activeScene.title : manuscript?.title || '未选择场景'}
            intentEvaluation={intentEvaluation}
            onEvaluateIntent={runIntentEvaluation}
            isIntentLoading={isIntentLoading}
            compareReport={compareReport}
            onCompareVersions={runVersionCompare}
            isCompareLoading={isCompareLoading}
            currentSceneContent={activeScene ? activeScene.content : ''}
            revisions={revisions}
            chatHistory={chatHistory}
            onAskQuestion={(q) => askQuestion(q, activeSelectedText)}
            isAskLoading={isAskLoading}
            selectedText={activeSelectedText}
            lenses={lenses}
            activeLensId={activeLensId}
            onSelectLens={setActiveLensId}
            onOpenLensEditor={() => setIsLensEditorOpen(true)}
            promptTemplates={promptTemplates}
            activeTemplateId={activeTemplateId}
            onSelectTemplate={setActiveTemplateId}
            manuscript={manuscript}
            scenes={scenes}
            currentScene={activeScene}
            contextConfig={contextConfig}
            onContextConfigChange={setContextConfig}
          />
        )}
      </div>

      {/* Floating Import Assistant Banner */}
      {importBanner && (
        <div className="fixed bottom-6 right-6 z-40 bg-paper-raise border border-cinnabar/40 shadow-xl rounded-lg p-4 max-w-sm font-serif text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2.5">
              <Sparkles className="w-4 h-4 text-cinnabar shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-ink">
                  《{importBanner.title}》导入完成
                </div>
                <p className="text-ink-muted text-[11px] mt-0.5 leading-relaxed">
                  已载入 ~{importBanner.wordCount} 字。是否启动 AI 进行文学建档（自动提取人物小传、意象网络与分场建议）？
                </p>
              </div>
            </div>
            <button
              onClick={() => setImportBanner(null)}
              className="text-ink-faint hover:text-ink ml-2 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-end space-x-2">
            <button
              onClick={() => setImportBanner(null)}
              className="px-2.5 py-1 text-[11px] text-ink-muted hover:text-ink"
            >
              稍后自行整理
            </button>
            <button
              onClick={() => {
                setImportBanner(null);
                setIsImportAssistantOpen(true);
              }}
              className="px-3 py-1 bg-cinnabar hover:bg-cinnabar-strong text-white text-[11px] font-medium rounded shadow-xs flex items-center space-x-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>启动智能建档</span>
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={updateSettings}
      />

      <LensEditorModal
        isOpen={isLensEditorOpen}
        onClose={() => setIsLensEditorOpen(false)}
        lenses={lenses}
        onSaveLenses={saveLenses}
      />

      <PromptLibraryModal
        isOpen={isPromptLibraryOpen}
        onClose={() => setIsPromptLibraryOpen(false)}
        templates={promptTemplates}
        onSaveTemplates={savePromptTemplates}
      />

      <RevisionsModal
        isOpen={isRevisionsOpen}
        onClose={() => setIsRevisionsOpen(false)}
        revisions={revisions}
        currentContent={activeScene ? activeScene.content : ''}
        onRestoreRevision={handleRestoreRevision}
        onCreateCheckpoint={(desc) => {
          if (activeScene) {
            addRevision(activeScene.content, desc, 'checkpoint');
          }
        }}
        onRenameRevision={renameRevision}
        onDeleteRevision={deleteRevision}
      />

      <NotesModal
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
        manuscript={manuscript}
        onUpdateManuscript={updateManuscript}
        defaultTab={notesDefaultTab}
      />

      <ImportAssistantModal
        isOpen={isImportAssistantOpen}
        onClose={() => setIsImportAssistantOpen(false)}
        manuscript={manuscript}
        sceneContent={activeScene ? activeScene.content : ''}
        isLoading={isProfilingLoading}
        onRunProfile={runManuscriptProfile}
        onApplyProfile={applyProfilingData}
      />
    </div>
  );
}

export default App;
