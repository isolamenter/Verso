import { agentRuntime } from "../../server/agent/runtime/agent-runtime";

export async function action({
  params,
}: {
  params: { runId: string };
}) {
  const runId = params.runId;
  if (!runId) {
    return new Response("Missing runId", { status: 400 });
  }

  const cancelled = await agentRuntime.cancelRun(runId);
  return { success: true, cancelled };
}

