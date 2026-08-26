import { agentRepository } from "../../server/domain";
import { runEventBus } from "../../server/agent/runtime/run-event-bus";
import type { AgentRunEvent } from "../../shared/schemas/agent";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { runId: string };
}) {
  const runId = params.runId;
  if (!runId) {
    return new Response("Missing runId", { status: 400 });
  }

  const run = await agentRepository.getRunById(runId);
  if (!run) {
    return new Response("Run not found", { status: 404 });
  }

  // Parse Last-Event-ID or query parameter
  const url = new URL(request.url);
  const lastEventHeader = request.headers.get("Last-Event-ID");
  const afterParam = url.searchParams.get("after");
  const lastEventId = lastEventHeader
    ? parseInt(lastEventHeader, 10)
    : afterParam
    ? parseInt(afterParam, 10)
    : undefined;

  // Create SSE stream
  const encoder = new TextEncoder();
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: AgentRunEvent) => {
        if (isClosed) return;
        try {
          const sseChunk = `id: ${event.sequenceNumber}\nevent: ${event.type}\ndata: ${JSON.stringify(
            event.payload
          )}\n\n`;
          controller.enqueue(encoder.encode(sseChunk));
        } catch {
          cleanup();
        }
      };

      // 1. Replay past events
      const pastEvents = await agentRepository.listRunEvents(runId, lastEventId);
      for (const ev of pastEvents) {
        sendEvent(ev);
      }

      // If run already finished and all events are replayed, close immediately
      const currentRun = await agentRepository.getRunById(runId);
      if (
        currentRun &&
        (currentRun.status === "completed" ||
          currentRun.status === "cancelled" ||
          currentRun.status === "failed")
      ) {
        if (!isClosed) {
          isClosed = true;
          controller.close();
        }
        return;
      }

      // 2. Subscribe to live events
      const unsubscribe = runEventBus.subscribe(runId, (event: AgentRunEvent) => {
        sendEvent(event);

        if (
          event.type === "status_change" &&
          (event.payload.status === "completed" ||
            event.payload.status === "cancelled" ||
            event.payload.status === "failed")
        ) {
          cleanup();
        }
      });

      const cleanup = () => {
        if (!isClosed) {
          isClosed = true;
          unsubscribe();
          try {
            controller.close();
          } catch {}
        }
      };

      // Handle client disconnection
      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
