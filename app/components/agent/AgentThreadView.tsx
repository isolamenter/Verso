import { useState } from "react";
import { useI18n } from "../../i18n";
import type { AgentMessage } from "../../../shared/schemas/agent";

export interface AgentThreadViewProps {
  messages: AgentMessage[];
  streamedText?: string;
  streamedThought?: string;
  isStreaming?: boolean;
  status?: string;
}

export function AgentThreadView({
  messages,
  streamedText,
  streamedThought,
  isStreaming,
  status,
}: AgentThreadViewProps) {
  const { t } = useI18n();
  const [showThoughts, setShowThoughts] = useState(false);

  if (messages.length === 0 && !isStreaming && !streamedText) {
    return (
      <div className="flex-1 p-6 flex flex-col justify-center items-center text-center text-ink-muted font-serif">
        <div className="w-10 h-10 rounded-full bg-cinnabar/10 text-cinnabar flex items-center justify-center font-serif text-lg font-bold mb-3 shadow-xs">
          ✦
        </div>
        <h4 className="text-sm font-semibold text-ink mb-1">Verso 创作助手</h4>
        <p className="text-xs max-w-xs text-ink-muted leading-relaxed font-serif">
          {t("agent.emptyThread")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 font-serif">
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        const meta = (msg.metadata || {}) as Record<string, any>;

        return (
          <div
            key={msg.id}
            className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
          >
            {/* Attached quote if user message */}
            {isUser && meta.attachedQuote && (
              <div className="max-w-[85%] mb-1 px-3 py-1.5 bg-paper-light border border-ink-muted/20 rounded text-[11px] text-ink-muted italic border-l-2 border-l-cinnabar">
                “{meta.attachedQuote}”
              </div>
            )}

            {/* Assistant thought disclosure */}
            {!isUser && meta.thought && (
              <details className="mb-2 max-w-[90%] text-xs text-ink-faint bg-paper-light/50 border border-ink-muted/15 rounded p-2">
                <summary className="cursor-pointer font-medium hover:text-ink select-none">
                  💭 查看推敲思考过程
                </summary>
                <div className="mt-2 text-[11px] whitespace-pre-wrap leading-relaxed text-ink-muted">
                  {meta.thought}
                </div>
              </details>
            )}

            {/* Message Bubble */}
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2.5 text-xs leading-relaxed ${
                isUser
                  ? "bg-ink text-paper"
                  : "bg-paper border border-ink-muted/20 text-ink shadow-2xs whitespace-pre-wrap"
              }`}
            >
              {msg.content}
            </div>
          </div>
        );
      })}

      {/* Live Streaming Assistant Message */}
      {isStreaming && (
        <div className="flex flex-col items-start animate-fade-in">
          {/* Live Thought Stream */}
          {streamedThought && (
            <div className="mb-2 max-w-[90%] text-xs bg-paper-light/80 border border-ink-muted/20 rounded p-2.5 text-ink-muted">
              <div
                className="cursor-pointer font-medium flex items-center justify-between select-none"
                onClick={() => setShowThoughts(!showThoughts)}
              >
                <span className="flex items-center space-x-1.5">
                  <span className="animate-spin text-[10px]">✦</span>
                  <span>正在深度推敲...</span>
                </span>
                <span className="text-[10px]">{showThoughts ? "收起" : "展开"}</span>
              </div>
              {showThoughts && (
                <div className="mt-2 text-[11px] whitespace-pre-wrap text-ink-muted/90 font-mono">
                  {streamedThought}
                </div>
              )}
            </div>
          )}

          {/* Live Text Delta */}
          <div className="max-w-[85%] rounded-lg px-4 py-2.5 text-xs leading-relaxed bg-paper border border-ink-muted/20 text-ink shadow-2xs whitespace-pre-wrap">
            {streamedText || (
              <span className="text-ink-faint italic animate-pulse">
                {status === "planning" ? "正在规划生成..." : "正在生成回应..."}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

