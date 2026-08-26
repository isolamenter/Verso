import { describe, it, expect, vi, beforeEach } from "vitest";
import { projectRepository, agentRepository } from "../../../server/domain";
import { agentRuntime } from "../../../server/agent/runtime/agent-runtime";
import { loader as runEventsLoader } from "../../../app/routes/api.runs.$runId.events";
import { action as cancelRunAction } from "../../../app/routes/api.runs.$runId.cancel";
import { reasoningModel } from "../../../server/models";

describe("E10 — Threads, Runs, Events, and Resumable SSE", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("persists run events with monotonic sequence numbers and completes run", async () => {
    const project = await projectRepository.createProject({ title: "Agent Run Project" });
    const thread = await agentRepository.createThread({
      projectId: project.id,
      title: "Main Thread",
    });

    // Mock reasoningModel.stream to emit thought and text deltas
    vi.spyOn(reasoningModel, "stream").mockImplementation(async function* () {
      yield { type: "thought_delta", delta: "分析当前写作意图..." };
      yield { type: "text_delta", delta: "这里建议调整句式，" };
      yield { type: "text_delta", delta: "强化景物衬托。" };
    });

    const { run } = await agentRuntime.startRun({
      projectId: project.id,
      threadId: thread.id,
      userPrompt: "如何改善这段描写？",
      attachedQuote: "窗外的雨落在青石板上。",
    });

    // Allow background loop to complete
    let updatedRun = await agentRepository.getRunById(run.id);
    const start = Date.now();
    while (updatedRun && updatedRun.status === "executing" && Date.now() - start < 3000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      updatedRun = await agentRepository.getRunById(run.id);
    }

    // Verify Run status
    expect(updatedRun?.status).toBe("completed");

    // Verify messages created (User message + Assistant message)
    const messages = await agentRepository.listMessagesByThread(thread.id);
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("如何改善这段描写？");
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toBe("这里建议调整句式，强化景物衬托。");

    // Verify events persisted with monotonic sequence numbers
    const events = await agentRepository.listRunEvents(run.id);
    expect(events.length).toBeGreaterThanOrEqual(4);
    
    // Check monotonic sequence numbers
    for (let i = 0; i < events.length; i++) {
      expect(events[i].sequenceNumber).toBe(i + 1);
    }

    expect(events[0].type).toBe("status_change");
    expect(events.some((e) => e.type === "thought_delta")).toBe(true);
    expect(events.some((e) => e.type === "text_delta")).toBe(true);
    expect(events[events.length - 1].type).toBe("status_change");
    expect(events[events.length - 1].payload.status).toBe("completed");
  });

  it("replays past events via SSE endpoint using Last-Event-ID header", async () => {
    const project = await projectRepository.createProject({ title: "SSE Replay Project" });
    const thread = await agentRepository.createThread({ projectId: project.id, title: "Thread" });
    const run = await agentRepository.createRun({
      threadId: thread.id,
      projectId: project.id,
      status: "completed",
    });

    // Create 3 events
    await agentRepository.createRunEvent({
      runId: run.id,
      threadId: thread.id,
      projectId: project.id,
      sequenceNumber: 1,
      type: "status_change",
      payload: { status: "planning" },
    });

    await agentRepository.createRunEvent({
      runId: run.id,
      threadId: thread.id,
      projectId: project.id,
      sequenceNumber: 2,
      type: "text_delta",
      payload: { delta: "第一段回复" },
    });

    await agentRepository.createRunEvent({
      runId: run.id,
      threadId: thread.id,
      projectId: project.id,
      sequenceNumber: 3,
      type: "status_change",
      payload: { status: "completed" },
    });

    // Request with Last-Event-ID: 1 (should only get events 2 and 3)
    const req = new Request(`http://127.0.0.1:4173/api/runs/${run.id}/events`, {
      headers: {
        "Last-Event-ID": "1",
      },
    });

    const res = await runEventsLoader({ request: req, params: { runId: run.id } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    const text = await res.text();
    expect(text).not.toContain("id: 1\n");
    expect(text).toContain("id: 2\nevent: text_delta\ndata: {\"delta\":\"第一段回复\"}");
    expect(text).toContain("id: 3\nevent: status_change\ndata: {\"status\":\"completed\"}");
  });

  it("handles cooperative cancellation idempotently", async () => {
    const project = await projectRepository.createProject({ title: "Cancel Test Project" });
    const thread = await agentRepository.createThread({ projectId: project.id, title: "Thread" });

    // Mock long-running stream that checks abort signal
    vi.spyOn(reasoningModel, "stream").mockImplementation(async function* (_input, options) {
      yield { type: "text_delta", delta: "第一部分开始..." };
      // Wait for cancellation
      for (let i = 0; i < 20; i++) {
        if (options?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      yield { type: "text_delta", delta: "永远不会执行到的第二部分" };
    });

    const { run } = await agentRuntime.startRun({
      projectId: project.id,
      threadId: thread.id,
      userPrompt: "开始长任务",
    });

    // Let it start
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Cancel the run via endpoint action
    const cancelRes = await cancelRunAction({ params: { runId: run.id } });
    expect(cancelRes).toEqual({ success: true, cancelled: true });

    // Wait for abort handler to complete
    await new Promise((resolve) => setTimeout(resolve, 80));

    const updatedRun = await agentRepository.getRunById(run.id);
    expect(updatedRun?.status).toBe("cancelled");

    const events = await agentRepository.listRunEvents(run.id);
    const cancelEvent = events.find(
      (e) => e.type === "status_change" && e.payload.status === "cancelled"
    );
    expect(cancelEvent).toBeDefined();
  });
});
