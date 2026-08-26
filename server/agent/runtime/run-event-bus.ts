import { EventEmitter } from "node:events";
import type { AgentRunEvent } from "../../../shared/schemas/agent";

export class RunEventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  public publish(event: AgentRunEvent): void {
    this.emitter.emit(`run:${event.runId}`, event);
  }

  public subscribe(runId: string, listener: (event: AgentRunEvent) => void): () => void {
    const channel = `run:${runId}`;
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }
}

export const runEventBus = new RunEventBus();

