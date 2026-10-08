import { z } from "zod";
import {
  knowledgeService,
  knowledgeRepository,
  projectRepository,
} from "../../server/domain";
import { KnowledgeKindEnum } from "../../shared/schemas/knowledge";

export async function loader({ params }: { params: { projectId: string } }) {
  const tree = await knowledgeService.getKnowledgeTree(params.projectId);
  const assets = await knowledgeRepository.listAssetsByProject(
    params.projectId,
  );
  const sources = [];
  for (const asset of assets) {
    const artifacts = await knowledgeRepository.listArtifactsByAsset(asset.id);
    for (const nodeId of new Set(
      [asset.nodeId, ...artifacts.map((a) => a.nodeId)].filter(Boolean),
    ))
      sources.push({
        nodeId,
        assetId: asset.id,
        filename: asset.originalFileName,
      });
  }
  return { ...tree, sources };
}
export async function action({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  try {
    const input = z
      .discriminatedUnion("intent", [
        z.object({ intent: z.literal("archive_node"), nodeId: z.string() }),
        z.object({
          intent: z.enum(["create_node", "update_node"]),
          nodeId: z.string().optional(),
          kind: KnowledgeKindEnum,
          title: z.string().min(1),
          content: z.string(),
          role: z.enum(["setting", "material", "pending"]),
          source: z.string(),
          sourceLocator: z.string(),
          conditions: z.string(),
          sceneId: z.string().optional(),
          confirmed: z.boolean(),
        }),
      ])
      .parse(await request.json());
    if (input.intent === "archive_node") {
      await knowledgeService.archiveNode(input.nodeId, params.projectId);
      return { success: true };
    }
    if (input.sceneId) {
      const scene = await projectRepository.getSceneById(input.sceneId);
      if (!scene || scene.projectId !== params.projectId)
        throw new Error("适用章节不属于此作品");
    }
    const metadata = {
      role: input.role,
      source: input.source,
      sourceLocator: input.sourceLocator,
      conditions: input.conditions,
    };
    const status =
      input.confirmed && input.role !== "pending" ? "active" : "draft";
    if (input.intent === "update_node") {
      if (!input.nodeId) throw new Error("请选择资料");
      const existing = await knowledgeRepository.getNodeById(input.nodeId);
      const result = await knowledgeService.updateNode(
        input.nodeId,
        params.projectId,
        {
          title: input.title,
          content: input.content,
          status,
          authority: "user_corrected",
          metadata: { ...existing?.metadata, ...metadata },
        },
      );
      // Scope changes accompany the explicit author edit.
      await knowledgeRepository.updateNode(input.nodeId, {
        sceneId: input.sceneId || null,
      });
      return { success: true, ...result };
    }
    const node = await knowledgeService.createNode({
      projectId: params.projectId,
      kind: input.kind,
      title: input.title,
      content: input.content,
      status,
      sceneId: input.sceneId,
      metadata,
    });
    return { success: true, node };
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "资料操作失败" },
      { status: 400 },
    );
  }
}
