import { z } from "zod";
import { projectRepository } from "../../server/domain";
import { modelProcessingInfo } from "../../server/agent/context/task-context";

const SettingsInput = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("save_intent"),
    feeling: z.string(),
    preserve: z.string(),
  }),
  z.object({
    intent: z.literal("resume"),
    sceneId: z.string(),
    mode: z.enum(["write", "review", "structure"]),
    cursor: z.number().int().nonnegative().optional(),
    nextGoal: z.string().optional(),
  }),
  z.object({ intent: z.literal("confirm_processing"), endpoint: z.string() }),
  z.object({
    intent: z.literal("create_chapter"),
    manuscriptId: z.string(),
    title: z.string().min(1),
    planned: z.boolean().default(false),
    content: z.string().default(""),
  }),
  z.object({
    intent: z.literal("create_manuscript"),
    title: z.string().min(1),
  }),
]);

export async function loader({ params }: { params: { projectId: string } }) {
  const settings = await projectRepository.getProjectSettings(params.projectId);
  return { settings, processing: modelProcessingInfo() };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { projectId: string };
}) {
  try {
    const input = SettingsInput.parse(await request.json());
    const settings = await projectRepository.getProjectSettings(
      params.projectId,
    );
    if (!(await projectRepository.getProjectById(params.projectId)))
      return Response.json({ error: "作品不存在" }, { status: 404 });
    if (input.intent === "save_intent")
      await projectRepository.upsertProjectSettings(params.projectId, {
        tonePreferences: { feeling: input.feeling, preserve: input.preserve },
      });
    if (input.intent === "resume") {
      const scene = await projectRepository.getSceneById(input.sceneId);
      if (!scene || scene.projectId !== params.projectId)
        throw new Error("章节不属于当前作品");
      await projectRepository.upsertProjectSettings(params.projectId, {
        metadata: {
          ...settings?.metadata,
          resume: {
            sceneId: input.sceneId,
            mode: input.mode,
            cursor: input.cursor ?? 0,
            nextGoal: input.nextGoal ?? "",
          },
        },
      });
    }
    if (input.intent === "confirm_processing") {
      if (input.endpoint !== modelProcessingInfo().endpoint)
        throw new Error("模型处理方已变化，请重新确认");
      await projectRepository.upsertProjectSettings(params.projectId, {
        metadata: { ...settings?.metadata, confirmedEndpoint: input.endpoint },
      });
    }
    if (input.intent === "create_chapter") {
      const manuscript = (
        await projectRepository.listManuscriptsByProject(params.projectId)
      ).find((m) => m.id === input.manuscriptId);
      if (!manuscript) throw new Error("文稿不属于当前作品");
      const scenes = await projectRepository.listScenesByManuscript(
        manuscript.id,
      );
      const scene = await projectRepository.createScene({
        projectId: params.projectId,
        manuscriptId: manuscript.id,
        title: input.title,
        content: input.content.replace(/\r\n/g, "\n"),
        order: Math.max(0, ...scenes.map((s) => s.order)) + 1,
        metadata: { planned: input.planned },
      });
      return { success: true, scene };
    }
    if (input.intent === "create_manuscript") {
      const current = await projectRepository.listManuscriptsByProject(
        params.projectId,
      );
      const manuscript = await projectRepository.createManuscript({
        projectId: params.projectId,
        title: input.title,
        order: Math.max(0, ...current.map((m) => m.order)) + 1,
        genre: current[0]?.genre || "other",
      });
      return { success: true, manuscript };
    }
    return { success: true };
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "设置保存失败" },
      { status: 400 },
    );
  }
}
