import { agentRuntime } from "../../server/agent/runtime/agent-runtime";
import { agentRepository } from "../../server/domain";

export async function loader({
  params,
}: {
  params: { projectId: string; threadId: string };
}) {
  const { threadId } = params;
  if (!threadId) {
    return new Response("Missing threadId", { status: 400 });
  }

  const messages = await agentRepository.listMessagesByThread(threadId);
  return { messages };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string; threadId: string };
}) {
  const { projectId, threadId } = params;
  if (!projectId || !threadId) {
    return new Response("Missing projectId or threadId", { status: 400 });
  }

  const formData = await request.formData();
  const prompt = formData.get("prompt") as string;
  const attachedQuote = (formData.get("attachedQuote") as string) || undefined;
  const rawSkillId = formData.get("skillId");
  let skillId: string | undefined = undefined;
  if (typeof rawSkillId === "string" && rawSkillId.trim() && rawSkillId !== "default") {
    skillId = rawSkillId.trim();
  }

  if (!prompt && !attachedQuote) {
    return { error: "Prompt or attachedQuote required" };
  }

  // Persist active skill on thread for lineage consistency
  try {
    await agentRepository.updateThread(threadId, {
      activeSkillId: skillId || null,
    });
  } catch (err) {
    console.warn(`[MessagesAction] Failed to update thread activeSkillId:`, err);
  }

  const result = await agentRuntime.startRun({
    projectId,
    threadId,
    userPrompt: prompt || "请分析所选引文并提出改进建议。",
    attachedQuote,
    skillId,
  });

  return {
    success: true,
    runId: result.run.id,
  };
}

