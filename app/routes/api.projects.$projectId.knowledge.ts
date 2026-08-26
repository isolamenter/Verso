import { knowledgeService } from "../../server/domain";
import type { KnowledgeKind } from "../../shared/schemas/knowledge";

export async function loader({
  params,
}: {
  params: { projectId: string };
}) {
  const { projectId } = params;
  if (!projectId) {
    return new Response("Missing projectId", { status: 400 });
  }

  const result = await knowledgeService.getKnowledgeTree(projectId);
  return result;
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
    if (intent === "create_node") {
      const kind = (formData.get("kind") as KnowledgeKind) || "custom";
      const title = formData.get("title") as string;
      const content = (formData.get("content") as string) || "";
      const summary = (formData.get("summary") as string) || undefined;

      if (!title) {
        return { error: "Title is required" };
      }

      const node = await knowledgeService.createNode({
        projectId,
        kind,
        title,
        content,
        summary,
      });

      return { success: true, node };
    }

    if (intent === "update_node") {
      const nodeId = formData.get("nodeId") as string;
      const title = (formData.get("title") as string) || undefined;
      const content = (formData.get("content") as string) || undefined;
      const summary = (formData.get("summary") as string) || undefined;

      if (!nodeId) {
        return { error: "nodeId is required" };
      }

      const result = await knowledgeService.updateNode(nodeId, projectId, {
        title,
        content,
        summary,
      });

      return { success: true, node: result.node, revision: result.revision };
    }

    if (intent === "archive_node") {
      const nodeId = formData.get("nodeId") as string;
      if (!nodeId) {
        return { error: "nodeId is required" };
      }

      await knowledgeService.archiveNode(nodeId, projectId);
      return { success: true };
    }

    return { error: `Unknown intent: ${intent}` };
  } catch (err: any) {
    return { error: err.message || "Failed to process knowledge action" };
  }
}
