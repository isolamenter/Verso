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

  const statusRef = useRef("idle");
  const eventSourceRef = useRef<EventSource | null>(null);
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

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
      setIsStreaming(false);
      setStatus("idle");
      return;
    }

    setStreamedText("");
    setStreamedThought("");
    setIsStreaming(true);
    setStatus("planning");
    statusRef.current = "planning";
    setEvents([]);

    const es = new EventSource(`/api/runs/${runId}/events`);
    eventSourceRef.current = es;

    const closeStream = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsStreaming(false);
    };

    const handleStatusChange = (e: MessageEvent) => {
      try {
        const payload = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        setEvents((prev) => [...prev, { type: "status_change", ...payload }]);

        const newStatus = payload.status;
        if (newStatus) {
          statusRef.current = newStatus;
          setStatus(newStatus);
          if (newStatus === "completed") {
            closeStream();
            onCompletedRef.current?.();
          } else if (newStatus === "cancelled") {
            closeStream();
          } else if (newStatus === "failed") {
            closeStream();
            onErrorRef.current?.(payload.error || "Agent run failed");
          }
        }
      } catch (err) {
        console.error("Failed to parse status_change event:", err);
      }
    };

    const handleTextDelta = (e: MessageEvent) => {
      try {
        const payload = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        setEvents((prev) => [...prev, { type: "text_delta", ...payload }]);
        const delta = payload.delta ?? payload.textDelta ?? "";
        if (delta) {
          setStreamedText((prev) => prev + delta);
        }
      } catch (err) {
        console.error("Failed to parse text_delta event:", err);
      }
    };

    const handleThoughtDelta = (e: MessageEvent) => {
      try {
        const payload = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        setEvents((prev) => [...prev, { type: "thought_delta", ...payload }]);
        const delta = payload.delta ?? payload.textDelta ?? "";
        if (delta) {
          setStreamedThought((prev) => prev + delta);
        }
      } catch (err) {
        console.error("Failed to parse thought_delta event:", err);
      }
    };

    const handleErrorEvent = (e: MessageEvent) => {
      try {
        const payload = typeof e.data === "string" ? JSON.parse(e.data) : e.data || {};
        const errMessage = payload?.error || payload?.message || "Agent run failed";
        setEvents((prev) => [...prev, { type: "run_error", error: errMessage }]);
        statusRef.current = "failed";
        setStatus("failed");
        closeStream();
        onErrorRef.current?.(errMessage);
      } catch (err) {
        console.error("Failed to parse error event:", err);
        statusRef.current = "failed";
        setStatus("failed");
        closeStream();
        onErrorRef.current?.("Agent run failed");
      }
    };

    const handleGenericEvent = (type: string) => (e: MessageEvent) => {
      try {
        const payload = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        setEvents((prev) => [...prev, { type, ...payload }]);
      } catch {}
    };

    // Generic fallback for untyped SSE messages
    es.onmessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data.type === "text_delta" || (data.delta && !data.status)) {
          handleTextDelta(e);
        } else if (data.type === "thought_delta") {
          handleThoughtDelta(e);
        } else if (data.type === "status_change" || data.status) {
          handleStatusChange(e);
        } else if (data.type === "error" || data.type === "run_error" || data.error) {
          handleErrorEvent(e);
        }
      } catch {}
    };

    es.addEventListener("status_change", handleStatusChange);
    es.addEventListener("text_delta", handleTextDelta);
    es.addEventListener("thought_delta", handleThoughtDelta);
    es.addEventListener("error", handleErrorEvent);
    es.addEventListener("run_error", handleErrorEvent);
    es.addEventListener("artifact", handleGenericEvent("artifact"));
    es.addEventListener("receipt", handleGenericEvent("receipt"));
    es.addEventListener("change_set", handleGenericEvent("change_set"));

    es.onerror = () => {
      if (eventSourceRef.current) {
        const lastStatus = statusRef.current;
        closeStream();
        if (lastStatus !== "completed" && lastStatus !== "cancelled" && lastStatus !== "failed") {
          statusRef.current = "failed";
          setStatus("failed");
          onErrorRef.current?.("模型请求连接异常中断或处理失败");
        }
      }
    };

    return () => {
      closeStream();
    };
  }, [runId]);

  return {
    streamedText,
    streamedThought,
    isStreaming,
    status,
    events,
    cancel,
  };
}

