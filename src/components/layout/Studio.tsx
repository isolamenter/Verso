import React from 'react';
import type {
  LiteraryAnnotation,
  ColdReaderReport,
  IntentEvaluation,
  VersionCompareReport,
  LiteraryLens,
  PromptTemplate,
  ContextSelectionConfig,
  Manuscript,
  Scene,
  RevisionSnapshot,
  StudioTab,
  SceneDraftParams,
  SceneDraftResult
} from '../../types';
import { DraftView } from '../studio/DraftView';
import { CritiqueView } from '../studio/CritiqueView';
import { ColdReaderView } from '../studio/ColdReaderView';
import { IntentView } from '../studio/IntentView';
import { CompareView } from '../studio/CompareView';
import { AskView } from '../studio/AskView';
import { LensSelector } from '../studio/LensSelector';
import { ContextInspector } from '../studio/ContextInspector';
import {
  PenTool,
  FileText,
  BookOpen,
  Target,
  Columns,
  HelpCircle,
  ChevronRight
} from 'lucide-react';

interface StudioProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
  // Draft data
  draftResult: SceneDraftResult | null;
  draftStreamingText: string;
  isDraftLoading: boolean;
  onGenerateDraft: (params: SceneDraftParams) => Promise<SceneDraftResult>;
  onAbortDraft: () => void;
  onApplyDraftToScene: (content: string, mode: 'replace' | 'append') => void;
  onSaveDraftAsRevision: (content: string, description: string) => void;
  onUpdateSceneSummary?: (sceneId: string, summary: string) => void;
  // Critique data
  critiqueSummary?: string;
  annotations: LiteraryAnnotation[];
  onAcceptAnnotation: (
    annotationId: string,
    replacementText: string,
    type: 'minimal' | 'moderate' | 'radical'
  ) => void;
  onRejectAnnotation: (annotationId: string) => void;
  onLocateQuote: (quote: string) => void;
  isCritiqueLoading: boolean;
  // Cold reader data
  coldReaderReport: ColdReaderReport | null;
  onTriggerColdRead: () => void;
  isColdReaderLoading: boolean;
  currentSceneTitle: string;
  // Intent data
  intentEvaluation: IntentEvaluation | null;
  onEvaluateIntent: (intentText: string) => void;
  isIntentLoading: boolean;
  // Compare data
  compareReport: VersionCompareReport | null;
  onCompareVersions: (nameA: string, textA: string, nameB: string, textB: string) => void;
  isCompareLoading: boolean;
  currentSceneContent: string;
  revisions: RevisionSnapshot[];
  // Ask data
  chatHistory: { role: 'user' | 'assistant'; content: string }[];
  onAskQuestion: (question: string) => void;
  isAskLoading: boolean;
  selectedText: string;
  // Lenses & Templates
  lenses: LiteraryLens[];
  activeLensId: string | null;
  onSelectLens: (lensId: string | null) => void;
  onOpenLensEditor: () => void;
  promptTemplates: PromptTemplate[];
  activeTemplateId: string | null;
  onSelectTemplate: (templateId: string | null) => void;
  // Context & Manuscript
  manuscript: Manuscript | null;
  scenes: Scene[];
  currentScene: Scene | null;
  contextConfig: ContextSelectionConfig;
  onContextConfigChange: (config: ContextSelectionConfig) => void;
}

export const Studio: React.FC<StudioProps> = ({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  draftResult,
  draftStreamingText,
  isDraftLoading,
  onGenerateDraft,
  onAbortDraft,
  onApplyDraftToScene,
  onSaveDraftAsRevision,
  onUpdateSceneSummary,
  critiqueSummary,
  annotations,
  onAcceptAnnotation,
  onRejectAnnotation,
  onLocateQuote,
  isCritiqueLoading,
  coldReaderReport,
  onTriggerColdRead,
  isColdReaderLoading,
  currentSceneTitle,
  intentEvaluation,
  onEvaluateIntent,
  isIntentLoading,
  compareReport,
  onCompareVersions,
  isCompareLoading,
  currentSceneContent,
  revisions,
  chatHistory,
  onAskQuestion,
  isAskLoading,
  selectedText,
  lenses,
  activeLensId,
  onSelectLens,
  onOpenLensEditor,
  manuscript,
  scenes,
  currentScene,
  contextConfig,
  onContextConfigChange,
}) => {
  if (!isOpen) return null;

  const tabs: {
    id: StudioTab;
    label: string;
    icon: React.ComponentType<any>;
  }[] = [
    { id: 'draft', label: '场景起草', icon: PenTool },
    { id: 'critique', label: '审读批注', icon: FileText },
    { id: 'cold_reader', label: '冷读盲审', icon: BookOpen },
    { id: 'intent', label: '意图比对', icon: Target },
    { id: 'compare', label: '版本取舍', icon: Columns },
    { id: 'ask', label: '编辑讨论', icon: HelpCircle },
  ];

  return (
    <aside className="w-96 border-l border-line bg-paper flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center space-x-2">
          <span className="font-serif text-sm font-semibold tracking-wide text-ink">
            文学编辑室
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-ink-muted hover:text-ink rounded transition-colors"
          title="收起右栏 (Cmd/Ctrl + J)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs — underline index, cinnabar marks the active editorial tab */}
      <div className="grid grid-cols-6 border-b border-line bg-paper">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`relative flex items-center justify-center space-x-1 py-2.5 px-0.5 text-[11px] transition-colors font-serif border-b-2 whitespace-nowrap ${
              activeTab === id
                ? 'border-cinnabar text-ink font-medium'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
            title={label}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Lens Selector Banner (Hide for Cold Reader to enforce isolation) */}
      {activeTab !== 'cold_reader' && (
        <div className="px-4 py-2.5 border-b border-line bg-paper">
          <LensSelector
            lenses={lenses}
            activeLensId={activeLensId}
            onSelectLens={onSelectLens}
            onOpenLensEditor={onOpenLensEditor}
          />
        </div>
      )}

      {/* Main Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'draft' && (
          <DraftView
            currentScene={currentScene}
            manuscript={manuscript}
            scenes={scenes}
            selectedText={selectedText}
            draftResult={draftResult}
            draftStreamingText={draftStreamingText}
            isLoading={isDraftLoading}
            onGenerateDraft={onGenerateDraft}
            onAbortDraft={onAbortDraft}
            onApplyDraftToScene={onApplyDraftToScene}
            onSaveDraftAsRevision={onSaveDraftAsRevision}
            onUpdateSceneSummary={onUpdateSceneSummary}
          />
        )}

        {activeTab === 'critique' && (
          <CritiqueView
            summary={critiqueSummary}
            annotations={annotations}
            onAcceptAnnotation={onAcceptAnnotation}
            onRejectAnnotation={onRejectAnnotation}
            onLocateQuote={onLocateQuote}
            isLoading={isCritiqueLoading}
          />
        )}

        {activeTab === 'cold_reader' && (
          <ColdReaderView
            report={coldReaderReport}
            onTriggerColdRead={onTriggerColdRead}
            isLoading={isColdReaderLoading}
            currentSceneTitle={currentSceneTitle}
          />
        )}

        {activeTab === 'intent' && (
          <IntentView
            evaluation={intentEvaluation}
            onEvaluateIntent={onEvaluateIntent}
            isLoading={isIntentLoading}
          />
        )}

        {activeTab === 'compare' && (
          <CompareView
            report={compareReport}
            onCompareVersions={onCompareVersions}
            isLoading={isCompareLoading}
            revisions={revisions}
            currentContent={currentSceneContent}
          />
        )}

        {activeTab === 'ask' && (
          <AskView
            onAsk={onAskQuestion}
            isLoading={isAskLoading}
            selectedText={selectedText}
            chatHistory={chatHistory}
          />
        )}
      </div>

      {/* Bottom Context Inspector */}
      <div className="p-3 border-t border-line bg-paper">
        <ContextInspector
          config={contextConfig}
          onChange={onContextConfigChange}
          manuscript={manuscript}
          scenes={scenes}
          currentScene={currentScene}
          selectedText={selectedText}
          isColdReadTab={activeTab === 'cold_reader'}
        />
      </div>
    </aside>
  );
};
