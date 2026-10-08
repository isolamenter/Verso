import { z } from "zod";
import { manuscriptService, projectRepository } from "../../server/domain";
import { RevisionConflictError } from "../../server/domain/manuscripts/manuscript-service";

const Input = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("save"),
    content: z.string(),
    title: z.string().min(1).optional(),
    expectedBaseRevisionId: z.string(),
    description: z.string().optional(),
    checkpoint: z.boolean().optional(),
  }),
  z.object({
    intent: z.literal("restore"),
    revisionId: z.string(),
    expectedBaseRevisionId: z.string(),
  }),
  z.object({
    intent: z.literal("structure"),
    title: z.string().min(1),
    summary: z.string(),
    pov: z.string(),
    timeframe: z.string(),
    location: z.string(),
    planned: z.boolean(),
    expectedBaseRevisionId: z.string(),
  }),
]);
export async function loader({
  params,
}: {
  params: { projectId: string; sceneId: string };
}) {
  const scene = await manuscriptService.getSceneById(
    params.sceneId,
    params.projectId,
  );
  if (!scene) return Response.json({ error: "章节不存在" }, { status: 404 });
  return {
    scene,
    revisions: await manuscriptService.listSceneRevisions(
      params.sceneId,
      params.projectId,
    ),
  };
}
export async function action({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string; sceneId: string };
}) {
  try {
    const input = Input.parse(await request.json());
    const scene = await manuscriptService.getSceneById(
      params.sceneId,
      params.projectId,
    );
    if (!scene) return Response.json({ error: "章节不存在" }, { status: 404 });
    if (scene.currentRevisionId !== input.expectedBaseRevisionId)
      throw new RevisionConflictError(
        scene.id,
        input.expectedBaseRevisionId,
        scene.currentRevisionId || "",
      );
    if (input.intent === "save")
      return {
        success: true,
        ...(await manuscriptService.saveSceneContent(
          scene.id,
          params.projectId,
          input.content,
          {
            expectedBaseRevisionId: input.expectedBaseRevisionId,
            changeType: input.checkpoint ? "checkpoint" : "manual_edit",
            description: input.description || "手动保存",
            title: input.title,
          },
        )),
      };
    if (input.intent === "restore")
      return {
        success: true,
        ...(await manuscriptService.restoreSceneRevision(
          scene.id,
          params.projectId,
          input.revisionId,
          input.expectedBaseRevisionId,
        )),
      };
    const updated = await projectRepository.updateScene(scene.id, {
      title: input.title,
      summary: input.summary,
      pov: input.pov,
      timeframe: input.timeframe,
      location: input.location,
      metadata: {
        ...scene.metadata,
        planned: input.planned,
        structureBaseRevisionId: input.expectedBaseRevisionId,
      },
    });
    return { success: true, scene: updated };
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof RevisionConflictError
            ? "正文已在其他操作中更新。你的编辑仍保留，请比对最新稿件后再保存。"
            : err instanceof Error
              ? err.message
              : "操作失败",
      },
      { status: err instanceof RevisionConflictError ? 409 : 400 },
    );
  }
}
