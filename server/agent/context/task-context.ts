import {
  agentRepository,
  manuscriptService,
  projectRepository,
} from "../../domain";
import { extractPlainText } from "../../../shared/manuscript";
import {
  TaskRequestSchema,
  type TaskRequest,
  type TaskSnapshot,
} from "../../../shared/schemas/task";
import { skillRuntime } from "../../skills/skill-runtime";
import { env } from "../../config/env";

export function modelProcessingInfo() {
  const url = new URL(env.VERSO_OPENAI_BASE_URL);
  return {
    endpoint: url.origin + url.pathname,
    host: url.host,
    model: env.VERSO_REASONING_MODEL,
    storage: "local" as const,
  };
}

export async function resolveTask(
  projectId: string,
  threadId: string,
  request: TaskRequest,
  skillId?: string,
): Promise<TaskSnapshot> {
  const task = TaskRequestSchema.parse(request);
  const coldRead = task.coldRead || skillId === "cold_reader";
  const thread = await agentRepository.getThreadById(threadId);
  if (!thread || thread.projectId !== projectId)
    throw new Error("对话不属于当前作品");
  const all = (
    await manuscriptService.listManuscriptsWithScenes(projectId)
  ).flatMap((m) => m.scenes.map((s) => ({ ...s, genre: m.genre })));
  const target = all.find((s) => s.id === task.sceneId);
  if (task.scope !== "project" && !target) throw new Error("目标章节不存在");
  const readable =
    task.scope === "project" || task.background === "project"
      ? all
      : target
        ? [target]
        : [];
  const snapshots = [];
  for (const scene of readable) {
    if (
      !scene.currentRevisionId ||
      task.revisionMap[scene.id] !== scene.currentRevisionId
    )
      throw new Error("稿件版本已变化，请保存并刷新本轮范围后重试");
    const revision = await projectRepository.getSceneRevisionById(
      scene.currentRevisionId,
    );
    if (
      !revision ||
      revision.sceneId !== scene.id ||
      revision.projectId !== projectId
    )
      throw new Error("无法读取所选稿件版本");
    const text = extractPlainText(revision.content);
    const selectionOnly =
      task.scope === "selection" &&
      task.background === "none" &&
      scene.id === task.sceneId;
    if (
      scene.id === task.sceneId &&
      task.selection &&
      task.scope === "selection" &&
      (task.selection.to > text.length ||
        text.slice(task.selection.from, task.selection.to) !==
          task.selection.text)
    )
      throw new Error("选区与保存稿件不一致，请重新选择");
    snapshots.push({
      id: scene.id,
      manuscriptId: scene.manuscriptId,
      title: scene.title,
      revisionId: revision.id,
      revisionNumber: revision.revisionNumber,
      genre: coldRead ? undefined : scene.genre,
      planned: coldRead ? undefined : Boolean(scene.metadata.planned),
      summary:
        coldRead || task.mode !== "structure" || task.background === "none"
          ? undefined
          : scene.summary || undefined,
      structureStale: coldRead
        ? undefined
        : scene.metadata.structureBaseRevisionId !== scene.currentRevisionId,
      text,
      from: selectionOnly ? task.selection!.from : 0,
      to: selectionOnly ? task.selection!.to : text.length,
    });
  }
  if (task.continueRunId) {
    const previous = await agentRepository.getRunById(task.continueRunId);
    if (
      !previous ||
      previous.projectId !== projectId ||
      previous.threadId !== threadId
    )
      throw new Error("不能继续其他作品或对话的任务");
  }
  const policy = skillId
    ? skillRuntime.getSkill(skillId).contextPolicy
    : undefined;
  return {
    ...task,
    coldRead,
    preserve: coldRead ? "" : task.preserve,
    useKnowledge:
      !coldRead && task.useKnowledge && (policy?.includeKnowledge ?? true),
    useMemory: !coldRead && task.useMemory && (policy?.includeMemory ?? true),
    useMedia: !coldRead && task.useMedia && (policy?.includeMedia ?? true),
    scenes: snapshots,
    modelEndpoint: modelProcessingInfo().endpoint,
  };
}
