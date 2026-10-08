import { agentRuntime } from "../../server/agent/runtime/agent-runtime";
import { agentRepository, projectRepository } from "../../server/domain";
import { TaskRequestSchema } from "../../shared/schemas/task";
import { modelProcessingInfo } from "../../server/agent/context/task-context";
import { z } from "zod";

export async function loader({
  params,
}: {
  params: { projectId: string; threadId: string };
}) {
  const thread = await agentRepository.getThreadById(params.threadId);
  if (!thread || thread.projectId !== params.projectId)
    return Response.json({ error: "对话不存在" }, { status: 404 });
  const runs = await agentRepository.listRunsByThread(thread.id);
  const receipts = await Promise.all(
    runs.map(async (run) => {
      const receipt = await agentRepository.getContextReceiptByRunId(run.id);
      return receipt
        ? {
            runId: run.id,
            receipt,
            items: await agentRepository.listContextReceiptItems(receipt.id),
          }
        : null;
    }),
  );
  return {
    messages: await agentRepository.listMessagesByThread(thread.id),
    runs,
    receipts: receipts.filter(Boolean),
  };
}
export async function action({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string; threadId: string };
}) {
  try {
    const input = z
      .object({
        prompt: z.string().trim().min(1),
        task: TaskRequestSchema,
        skillId: z.string().optional(),
      })
      .parse(await request.json());
    const settings = await projectRepository.getProjectSettings(
      params.projectId,
    );
    if (settings?.metadata.confirmedEndpoint !== modelProcessingInfo().endpoint)
      return Response.json(
        { error: "请先确认本作品的模型处理方与发送规则" },
        { status: 409 },
      );
    const result = await agentRuntime.startRun({
      projectId: params.projectId,
      threadId: params.threadId,
      userPrompt: input.prompt,
      task: input.task,
      skillId: input.skillId,
    });
    return { success: true, runId: result.run.id };
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "任务提交失败" },
      { status: 400 },
    );
  }
}
