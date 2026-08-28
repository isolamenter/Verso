import { describe, it, expect, vi, beforeEach } from "vitest";
import { projectRepository, agentRepository, changeSetRepository } from "../../../server/domain";
import { agentRuntime } from "../../../server/agent/runtime/agent-runtime";
import { reasoningModel } from "../../../server/models";

describe("Agent Tool Execution — propose_scene_splits in Agent Run", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("invokes propose_scene_splits tool during an agent run and emits change_set event", async () => {
    const project = await projectRepository.createProject({ title: "Agent Split Project" });
    const manuscript = await projectRepository.createManuscript({ projectId: project.id, title: "卷一" });
    const scene = await projectRepository.createScene({
      manuscriptId: manuscript.id,
      projectId: project.id,
      title: "长卷正文",
      content: `前篇：灯火微明
秋风卷起庭院里的落叶，石桌上摆着一局残棋。

后篇：风雪夜归
多年以后，当他再次推开这扇木门时，庭院里已覆满了白雪。`,
      order: 1,
    });

    const thread = await agentRepository.createThread({
      projectId: project.id,
      title: "分场探讨",
    });

    let turnCount = 0;
    // Mock reasoningModel.stream: turn 1 calls propose_scene_splits, turn 2 returns text summary
    vi.spyOn(reasoningModel, "stream").mockImplementation(async function* () {
      turnCount++;
      if (turnCount === 1) {
        yield { type: "thought_delta", delta: "正在分析时空跨度，准备出具分场方案..." };
        yield {
          type: "tool_call_complete",
          index: 0,
          toolCall: {
            id: "call_split_1",
            type: "function",
            function: {
              name: "propose_scene_splits",
              arguments: JSON.stringify({
                sceneId: scene.id,
                changeSetTitle: "前后篇两场划分",
                changeSetObjective: "根据多年时空跨度拆分为两场",
                splits: [
                  {
                    title: "前篇：灯火微明",
                    summary: "秋夜庭院残棋",
                    startQuote: "前篇：灯火微明",
                  },
                  {
                    title: "后篇：风雪夜归",
                    summary: "多年后风雪重归故地",
                    startQuote: "后篇：风雪夜归",
                  },
                ],
                rationale: "文中有明显'多年以后'的时空跃迁，切断为两场更为克制沉郁。",
              }),
            },
          },
        };
      } else {
        yield { type: "text_delta", delta: "已为您将文稿切分为两场，并出具了分场案卷。" };
      }
    });

    const { run } = await agentRuntime.startRun({
      projectId: project.id,
      threadId: thread.id,
      userPrompt: "请帮我把当前这篇文稿切分为不同场景",
    });

    // Wait for run loop to complete
    let updatedRun = await agentRepository.getRunById(run.id);
    const start = Date.now();
    while (updatedRun && updatedRun.status === "executing" && Date.now() - start < 3000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      updatedRun = await agentRepository.getRunById(run.id);
    }

    expect(updatedRun?.status).toBe("completed");

    // Verify events
    const events = await agentRepository.listRunEvents(run.id);
    const toolCallEvent = events.find((e) => e.type === "tool_call");
    const toolResultEvent = events.find((e) => e.type === "tool_result");
    const changeSetEvent = events.find((e) => e.type === "change_set");

    expect(toolCallEvent).toBeDefined();
    expect(toolCallEvent?.payload.name).toBe("propose_scene_splits");

    expect(toolResultEvent).toBeDefined();
    expect((toolResultEvent?.payload.result as any)?.success).toBe(true);
    expect((toolResultEvent?.payload.result as any)?.sceneCount).toBe(2);

    expect(changeSetEvent).toBeDefined();
    expect(changeSetEvent?.payload.operationType).toBe("split_scene");
    expect(changeSetEvent?.payload.sceneCount).toBe(2);

    // Verify ChangeSet was persisted in DB
    const changeSetId = changeSetEvent?.payload.changeSetId as string;
    expect(changeSetId).toBeDefined();
    const changeSet = await changeSetRepository.getChangeSetById(changeSetId);
    expect(changeSet).toBeDefined();
    expect(changeSet?.title).toBe("前后篇两场划分");

    // Verify assistant message
    const messages = await agentRepository.listMessagesByThread(thread.id);
    const assistantMsg = messages.find((m) => m.role === "assistant");
    expect(assistantMsg?.content).toContain("已为您将文稿切分为两场");
  });
});
