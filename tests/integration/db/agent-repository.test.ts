import { describe, it, expect, afterEach } from "vitest";
import { projectRepository, agentRepository } from "../../../server/domain";

describe("AgentRepository Integration", () => {
  const createdProjectIds: string[] = [];

  afterEach(async () => {
    for (const id of createdProjectIds) {
      try {
        await projectRepository.deleteProject(id);
      } catch {
        // ignore cleanup error
      }
    }
    createdProjectIds.length = 0;
  });

  it("handles threads, sequential messages, runs, and monotonic SSE events", async () => {
    const proj = await projectRepository.createProject({ title: "Agent Run Project" });
    createdProjectIds.push(proj.id);

    // 1. Thread creation
    const thread = await agentRepository.createThread({
      projectId: proj.id,
      title: "Line Edit Discussion",
    });
    expect(thread.id).toBeDefined();

    // 2. Sequential Messages
    const msg1 = await agentRepository.createMessage({
      threadId: thread.id,
      projectId: proj.id,
      role: "user",
      content: "Please critique this paragraph for dialogue subtext.",
    });
    expect(msg1.sequenceNumber).toBe(1);

    const msg2 = await agentRepository.createMessage({
      threadId: thread.id,
      projectId: proj.id,
      role: "assistant",
      content: "I will analyze the hidden tensions in this scene.",
    });
    expect(msg2.sequenceNumber).toBe(2);

    const messages = await agentRepository.listMessagesByThread(thread.id);
    expect(messages.length).toBe(2);
    expect(messages[0].sequenceNumber).toBe(1);
    expect(messages[1].sequenceNumber).toBe(2);

    // 3. Agent Run Lifecycle
    const run = await agentRepository.createRun({
      threadId: thread.id,
      projectId: proj.id,
      skillId: "critique_dialogue",
      status: "planning",
    });
    expect(run.status).toBe("planning");

    const updatedRun = await agentRepository.updateRun(run.id, {
      status: "executing",
      startedAt: new Date(),
    });
    expect(updatedRun.status).toBe("executing");

    // 4. Append Monotonic Run Events (SSE)
    const event1 = await agentRepository.createRunEvent({
      runId: run.id,
      threadId: thread.id,
      projectId: proj.id,
      type: "thought_delta",
      payload: { thought: "Checking power dynamics between character A and B..." },
    });
    expect(event1.sequenceNumber).toBe(1);

    const event2 = await agentRepository.createRunEvent({
      runId: run.id,
      threadId: thread.id,
      projectId: proj.id,
      type: "text_delta",
      payload: { delta: "The dialogue carries strong unstated resentment." },
    });
    expect(event2.sequenceNumber).toBe(2);

    // Test SSE reconnection: list events after sequence 1
    const resumedEvents = await agentRepository.listRunEvents(run.id, 1);
    expect(resumedEvents.length).toBe(1);
    expect(resumedEvents[0].sequenceNumber).toBe(2);
    expect(resumedEvents[0].type).toBe("text_delta");

    // 5. Artifact Creation
    const artifact = await agentRepository.createArtifact({
      runId: run.id,
      threadId: thread.id,
      projectId: proj.id,
      type: "critique_report",
      title: "Dialogue Tension Analysis",
      content: "Detailed critique notes...",
      structuredData: { tensionScore: "high", keySubtext: "Inheritance dispute" },
    });
    expect(artifact.id).toBeDefined();

    // 6. Context Receipt
    const receipt = await agentRepository.createContextReceipt({
      runId: run.id,
      projectId: proj.id,
      skillId: "critique_dialogue",
      totalTokensApprox: 2450,
      tierBreakdown: { tier0: 200, tier1: 1500, tier2: 750, tier3: 0 },
    });
    expect(receipt.id).toBeDefined();

    const receiptItem = await agentRepository.createContextReceiptItem({
      contextReceiptId: receipt.id,
      projectId: proj.id,
      resourceType: "scene",
      resourceId: "scene-123",
      tier: 1,
      inclusionMode: "full",
      estimatedTokens: 1200,
    });
    expect(receiptItem.id).toBeDefined();

    const items = await agentRepository.listContextReceiptItems(receipt.id);
    expect(items.length).toBe(1);
    expect(items[0].resourceType).toBe("scene");
  });
});

