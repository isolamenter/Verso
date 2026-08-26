import { useState, useEffect } from "react";
import { useI18n } from "../../i18n";
import { AgentThreadView } from "../agent/AgentThreadView";
import { useAgentRunStream } from "../agent/useAgentRunStream";
import type { AgentMessage } from "../../../shared/schemas/agent";

export interface AgentPaneProps {
  projectId?: string;
  threadId?: string;
  attachedQuote: string | null;
  onClearAttachedQuote: () => void;
  onSendMessage?: (prompt: string, quote?: string) => void;
}

export function AgentPane({
  projectId,
  threadId,
  attachedQuote,
  onClearAttachedQuote,
  onSendMessage,
}: AgentPaneProps) {
  const { t } = useI18n();
  const [inputPrompt, setInputPrompt] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Load thread messages if threadId is provided
  useEffect(() => {
    if (!projectId || !threadId) return;

    fetch(`/api/projects/${projectId}/threads/${threadId}/messages`)
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data) => {
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      })
      .catch((err) => console.error("Failed to load thread messages:", err));
  }, [projectId, threadId]);

  const { streamedText, streamedThought, isStreaming, status, cancel } = useAgentRunStream({
    runId: activeRunId,
    onCompleted: () => {
      // Reload messages when run completes
      if (projectId && threadId) {
        fetch(`/api/projects/${projectId}/threads/${threadId}/messages`)
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data.messages)) {
              setMessages(data.messages);
            }
          });
      }
      setActiveRunId(null);
    },
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const promptToSend = inputPrompt.trim() || (attachedQuote ? "请根据参考引文提出推敲建议。" : "");
    if (!promptToSend) return;

    const quote = attachedQuote || undefined;
    setInputPrompt("");
    onClearAttachedQuote();

    if (onSendMessage) {
      onSendMessage(promptToSend, quote);
    }

    if (projectId && threadId) {
      // Optimistically add user message
      const tempUserMsg: AgentMessage = {
        id: `temp-${Date.now()}`,
        threadId,
        projectId,
        sequenceNumber: messages.length + 1,
        role: "user",
        content: promptToSend,
        attachments: [],
        metadata: quote ? { attachedQuote: quote } : {},
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      // Start run via API
      try {
        const formData = new FormData();
        formData.append("prompt", promptToSend);
        if (quote) formData.append("attachedQuote", quote);

        const res = await fetch(`/api/projects/${projectId}/threads/${threadId}/messages`, {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.runId) {
            setActiveRunId(data.runId);
          }
        }
      } catch (err) {
        console.error("Failed to start agent run:", err);
      }
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputPrompt(prompt);
  };

  return (
    <aside className="h-full flex flex-col bg-paper-light/40 border-l border-ink-muted/15 font-serif select-none">
      {/* Agent Header */}
      <div className="p-3.5 border-b border-ink-muted/15 bg-paper/80 flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center space-x-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isStreaming ? "bg-cinnabar animate-ping" : "bg-emerald-600 animate-pulse"
            }`}
          />
          <span className="font-medium text-ink">{t("workbench.agentTab")}</span>
        </div>
        <span className="text-[11px] text-ink-muted px-2 py-0.5 rounded bg-ink-muted/10">
          {t("skills.defaultSkill")}
        </span>
      </div>

      {/* Conversation Thread History Area */}
      <AgentThreadView
        messages={messages}
        streamedText={streamedText}
        streamedThought={streamedThought}
        isStreaming={isStreaming}
        status={status}
      />

      {/* Suggestion Prompts when few messages */}
      {messages.length <= 1 && !isStreaming && (
        <div className="px-4 pb-2 space-y-1.5 shrink-0">
          <button
            onClick={() => handleQuickPrompt("推敲当前场景的描写，增强节奏感与文学张力。")}
            className="w-full text-left px-2.5 py-1.5 rounded bg-paper border border-ink-muted/15 hover:border-ink-muted/30 text-[11px] text-ink transition-colors"
          >
            ✦ 推敲节奏与文学张力
          </button>
          <button
            onClick={() => handleQuickPrompt("分析当前人物对白的潜台词与语调一致性。")}
            className="w-full text-left px-2.5 py-1.5 rounded bg-paper border border-ink-muted/15 hover:border-ink-muted/30 text-[11px] text-ink transition-colors"
          >
            ✦ 检查人物对白与潜台词
          </button>
        </div>
      )}

      {/* Persistent Composer at Bottom */}
      <div className="p-4 border-t border-ink-muted/15 bg-paper shrink-0">
        {/* Attached Quote Pill */}
        {attachedQuote && (
          <div className="mb-2.5 p-2 bg-cinnabar/5 border border-cinnabar/20 rounded flex items-start justify-between text-xs animate-fade-in">
            <div className="flex items-start space-x-1.5 flex-1 min-w-0 mr-2">
              <span className="text-cinnabar font-bold text-xs mt-0.5">“</span>
              <p className="text-[11px] text-ink line-clamp-2 italic font-serif">
                {attachedQuote}
              </p>
            </div>
            <button
              onClick={onClearAttachedQuote}
              className="text-ink-muted hover:text-ink text-xs p-0.5 shrink-0"
              title="移除附加引文"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-2">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              disabled={isStreaming}
              placeholder={
                isStreaming ? "助手正在生成回应..." : t("agent.composerPlaceholder")
              }
              className="flex-1 px-3 py-2 text-xs bg-paper-light border border-ink-muted/25 rounded focus:outline-none focus:border-ink font-serif text-ink disabled:opacity-50"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={cancel}
                className="px-3 py-2 bg-cinnabar text-paper text-xs font-serif font-medium rounded shadow-sm hover:bg-cinnabar/90 transition-colors shrink-0"
              >
                停止
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputPrompt.trim() && !attachedQuote}
                className="px-4 py-2 bg-ink text-paper text-xs font-serif font-medium rounded shadow-sm hover:bg-ink/90 disabled:opacity-40 transition-colors shrink-0"
              >
                {t("agent.send")}
              </button>
            )}
          </div>
        </form>
      </div>
    </aside>
  );
}

