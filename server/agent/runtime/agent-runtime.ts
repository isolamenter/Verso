import { agentRepository } from "../../domain";
import { reasoningModel } from "../../models";
import { runEventBus } from "./run-event-bus";
import type { AgentRun, AgentRunEvent, AgentRunEventType } from "../../../shared/schemas/agent";
import type { ModelMessage } from "../../../shared/schemas/model-capabilities";

export interface StartRunOptions {
  projectId: string;
  threadId: string;
  userPrompt: string;
  attachedQuote?: string;
  skillId?: string;
  modelRole?: string;
  systemPrompt?: string;
}

export class AgentRuntime {
  private activeRuns: Map<string, AbortController> = new Map();

  /**
   * Persists an event to the database before broadcasting it via the event bus.
   */
  public async emitEvent(
    runId: string,
    threadId: string,
    projectId: string,
    type: AgentRunEventType,
    payload: Record<string, unknown>
  ): Promise<AgentRunEvent> {
    const event = await agentRepository.createRunEvent({
      runId,
      threadId,
      projectId,
      type,
      payload,
    });

    runEventBus.publish(event);
    return event;
  }

  /**
   * Starts an asynchronous agent run for a thread with streaming SSE events.
   */
  public async startRun(options: StartRunOptions): Promise<{ run: AgentRun }> {
    const { projectId, threadId, userPrompt, attachedQuote, skillId, modelRole, systemPrompt } = options;

    // 1. Create User Message in Thread
    await agentRepository.createMessage({
      threadId,
      projectId,
      role: "user",
      content: userPrompt,
      metadata: attachedQuote ? { attachedQuote } : {},
    });

    // 2. Create Agent Run
    const run = await agentRepository.createRun({
      threadId,
      projectId,
      skillId,
      modelRole: modelRole ?? "reasoning",
      status: "queued",
    });

    // 3. Emit run_started status event
    await this.emitEvent(run.id, threadId, projectId, "status_change", {
      status: "planning",
    });

    const abortController = new AbortController();
    this.activeRuns.set(run.id, abortController);

    // Execute run in background
    this.executeRunLoop(run, threadId, projectId, userPrompt, attachedQuote, systemPrompt, abortController).catch(
      async (err) => {
        console.error(`[AgentRuntime] Run ${run.id} failed with error:`, err);
      }
    );

    return { run };
  }

  private async executeRunLoop(
    run: AgentRun,
    threadId: string,
    projectId: string,
    userPrompt: string,
    attachedQuote?: string,
    systemPrompt?: string,
    abortController?: AbortController
  ): Promise<void> {
    const runId = run.id;

    try {
      await agentRepository.updateRun(runId, {
        status: "executing",
        startedAt: new Date().toISOString(),
      });

      await this.emitEvent(runId, threadId, projectId, "status_change", {
        status: "executing",
      });

      // Prepare conversation messages
      const messages: ModelMessage[] = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }

      let contentToSend = userPrompt;
      if (attachedQuote) {
        contentToSend = `【参考引文】\n"${attachedQuote}"\n\n【创作要求】\n${userPrompt}`;
      }
      messages.push({ role: "user", content: contentToSend });

      let accumulatedText = "";
      let accumulatedThought = "";

      const stream = reasoningModel.stream(
        {
          messages,
        },
        {
          signal: abortController?.signal,
        }
      );

      for await (const chunk of stream) {
        if (abortController?.signal.aborted) {
          throw new DOMException("The user aborted a request.", "AbortError");
        }

        if (chunk.type === "thought_delta" && chunk.delta) {
          accumulatedThought += chunk.delta;
          await this.emitEvent(runId, threadId, projectId, "thought_delta", {
            delta: chunk.delta,
          });
        } else if (chunk.type === "text_delta" && chunk.delta) {
          accumulatedText += chunk.delta;
          await this.emitEvent(runId, threadId, projectId, "text_delta", {
            delta: chunk.delta,
          });
        }
      }

      // Persist assistant message
      await agentRepository.createMessage({
        threadId,
        projectId,
        role: "assistant",
        content: accumulatedText,
        metadata: {
          runId,
          thought: accumulatedThought || undefined,
        },
      });

      // Mark run completed
      await agentRepository.updateRun(runId, {
        status: "completed",
        completedAt: new Date().toISOString(),
      });

      await this.emitEvent(runId, threadId, projectId, "status_change", {
        status: "completed",
      });
    } catch (err: any) {
      if (err.name === "AbortError" || abortController?.signal.aborted) {
        await agentRepository.updateRun(runId, {
          status: "cancelled",
          completedAt: new Date().toISOString(),
        });

        await this.emitEvent(runId, threadId, projectId, "status_change", {
          status: "cancelled",
        });
      } else {
        await agentRepository.updateRun(runId, {
          status: "failed",
          error: err.message,
          completedAt: new Date().toISOString(),
        });

        await this.emitEvent(runId, threadId, projectId, "error", {
          error: err.message,
        });
      }
    } finally {
      this.activeRuns.delete(runId);
    }
  }

  /**
   * Idempotent cooperative cancellation of an active run.
   */
  public async cancelRun(runId: string): Promise<boolean> {
    const controller = this.activeRuns.get(runId);
    if (controller) {
      controller.abort();
      return true;
    }

    const run = await agentRepository.getRunById(runId);
    if (run && run.status !== "completed" && run.status !== "cancelled" && run.status !== "failed") {
      await agentRepository.updateRun(runId, {
        status: "cancelled",
        completedAt: new Date().toISOString(),
      });

      await this.emitEvent(runId, run.threadId, run.projectId, "status_change", {
        status: "cancelled",
      });
      return true;
    }

    return false;
  }
}

export const agentRuntime = new AgentRuntime();
