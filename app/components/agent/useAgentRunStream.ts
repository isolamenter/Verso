import { useState, useEffect, useRef, useCallback } from "react";

export interface UseAgentRunStreamOptions {
  runId: string | null;
  onCompleted?: () => void;
  onError?: (error: string) => void;
}

export interface UseAgentRunStreamResult {
  streamedText: string;
  streamedThought: string;
  isStreaming: boolean;
  status: string;
  events: any[];
  cancel: () => Promise<void>;
}

export function useAgentRunStream({
  runId,
  onCompleted,
  onError,
}: UseAgentRunStreamOptions): UseAgentRunStreamResult {
  const [streamedText, setStreamedText] = useState("");
  const [streamedThought, setStreamedThought] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("idle");
  const [events, setEvents] = useState<any[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);

  const cancel = useCallback(async () => {
    if (!runId) return;
    try {
      await fetch(`/api/runs/${runId}/cancel`, { method: "POST" });
    } catch (err) {
      console.error("Failed to cancel run:", err);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
    setStatus("cancelled");
  }, [runId]);

  useEffect(() => {
    if (!runId) {
      return;
    }

    setStreamedText("");
    setStreamedThought("");
    setIsStreaming(true);
    setStatus("running");

    const es = new EventSource(`/api/runs/${runId}/events`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        setEvents((prev) => [...prev, payload]);

        switch (payload.type) {
          case "status":
            setStatus(payload.status || "running");
            break;
          case "thought_delta":
            setStreamedThought((prev) => prev + (payload.textDelta || ""));
            break;
          case "text_delta":
            setStreamedText((prev) => prev + (payload.textDelta || ""));
            break;
          case "completed":
            setStatus("completed");
            setIsStreaming(false);
            es.close();
            eventSourceRef.current = null;
            onCompleted?.();
            break;
          case "cancelled":
            setStatus("cancelled");
            setIsStreaming(false);
            es.close();
            eventSourceRef.current = null;
            break;
          case "error":
            setStatus("failed");
            setIsStreaming(false);
            es.close();
            eventSourceRef.current = null;
            onError?.(payload.error || "Agent run failed");
            break;
        }
      } catch (err) {
        console.error("Failed to parse SSE event:", err);
      }
    };

    es.onerror = () => {
      setIsStreaming(false);
      es.close();
      eventSourceRef.current = null;
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId, onCompleted, onError]);

  return {
    streamedText,
    streamedThought,
    isStreaming,
    status,
    events,
    cancel,
  };
}

