import { memoryService } from "../../server/domain";

export async function loader({
  params,
}: {
  params: { projectId: string };
}) {
  const { projectId } = params;
  if (!projectId) {
    return new Response("Missing projectId", { status: 400 });
  }

  const result = await memoryService.getScopedMemories({ projectId });
  return { ...result };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  const { projectId } = params;
  if (!projectId) {
    return new Response("Missing projectId", { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "forget_taste") {
      const tasteId = formData.get("tasteId") as string;
      const hardDelete = formData.get("hardDelete") === "true";
      if (!tasteId) {
        return { error: "tasteId is required" };
      }
      await memoryService.forgetTaste(tasteId, hardDelete);
      return { success: true };
    }

    return { error: `Unsupported intent: ${intent}` };
  } catch (err: any) {
    return { error: err.message || "Failed to perform memory action" };
  }
}

