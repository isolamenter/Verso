import { z } from "zod";

export const WorkModeSchema = z.enum(["write", "review", "structure"]);
export type WorkMode = z.infer<typeof WorkModeSchema>;

// A task always names the saved text it works on. Background access is separate
// from the text the author permits the assistant to change.
export const TaskRequestSchema = z
  .object({
    mode: WorkModeSchema,
    scope: z.enum(["selection", "scene", "project"]),
    sceneId: z.string().optional(),
    revisionMap: z.record(z.string(), z.string()),
    selection: z
      .object({
        from: z.number().int().nonnegative(),
        to: z.number().int().positive(),
        text: z.string().min(1),
      })
      .optional(),
    objective: z.string().default(""),
    preserve: z.string().default(""),
    participation: z.enum(["discuss", "suggest", "draft"]).default("discuss"),
    background: z.enum(["none", "scene", "project"]).default("scene"),
    useKnowledge: z.boolean().default(false),
    useMemory: z.boolean().default(false),
    useMedia: z.boolean().default(false),
    coldRead: z.boolean().default(false),
    continueRunId: z.string().optional(),
  })
  .superRefine((task, ctx) => {
    if (task.scope !== "project" && !task.sceneId)
      ctx.addIssue({ code: "custom", message: "请选择目标章节" });
    if (
      task.scope === "selection" &&
      (!task.selection || task.selection.to <= task.selection.from)
    )
      ctx.addIssue({ code: "custom", message: "请重新选择正文段落" });
  });
export type TaskRequest = z.infer<typeof TaskRequestSchema>;

export interface TaskSceneSnapshot {
  id: string;
  manuscriptId: string;
  title: string;
  revisionId: string;
  revisionNumber: number;
  text: string;
  from: number;
  to: number;
  genre?: string;
  planned?: boolean;
  summary?: string;
  structureStale?: boolean;
}
export interface TaskSnapshot extends TaskRequest {
  scenes: TaskSceneSnapshot[];
  modelEndpoint: string;
}
export interface TaskCoverage {
  scenes: Array<{
    id: string;
    title: string;
    revisionId: string;
    revisionNumber: number;
    read: number;
    total: number;
    summaryUsed?: boolean;
  }>;
  complete: boolean;
  stopReason?: string;
}

export function taskLabel(
  task: Pick<TaskRequest, "scope" | "sceneId">,
  scenes: Array<{ id: string; title: string }>,
) {
  return task.scope === "project"
    ? "整部作品"
    : `${scenes.find((s) => s.id === task.sceneId)?.title || "目标章节"}${task.scope === "selection" ? "的选中段落" : ""}`;
}
