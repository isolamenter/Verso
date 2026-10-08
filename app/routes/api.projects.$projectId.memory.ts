import { z } from "zod";
import { memoryService, memoryRepository } from "../../server/domain";

export async function loader({ params }: { params: { projectId: string } }) {
  const tastes = [
    ...(await memoryRepository.listTasteEntries("project", params.projectId)),
    ...(await memoryRepository.listTasteEntries("workspace")),
  ];
  return {
    tastes: await Promise.all(
      tastes.map(async (taste) => ({
        ...taste,
        evidence: await memoryRepository.listEvidenceForTasteEntry(taste.id),
      })),
    ),
  };
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
        z.object({
          intent: z.literal("create"),
          preference: z.string().min(1),
          scope: z.enum(["project", "workspace"]),
          conditions: z.string().default(""),
        }),
        z.object({
          intent: z.enum(["confirm", "disable", "edit"]),
          tasteId: z.string(),
          preference: z.string().min(1).optional(),
          conditions: z.string().optional(),
        }),
      ])
      .parse(await request.json());
    if (input.intent === "create")
      return {
        success: true,
        ...(await memoryService.recordTasteEvidence({
          projectId: params.projectId,
          scope: input.scope,
          scopeId: input.scope === "project" ? params.projectId : undefined,
          dimension: "author_choice",
          preference: input.preference,
          conditions: input.conditions ? [input.conditions] : [],
          sourceType: "explicit_statement",
          quote: input.preference,
        })),
      };
    const existing = await memoryRepository.getTasteEntryById(input.tasteId);
    if (
      !existing ||
      !(
        existing.scope === "workspace" ||
        (existing.scope === "project" && existing.scopeId === params.projectId)
      )
    )
      throw new Error("偏好不属于当前作品");
    const taste = await memoryRepository.updateTasteEntry(existing.id, {
      status: input.intent === "disable" ? "disabled" : "active",
      lastConfirmedAt: new Date().toISOString(),
      preference: input.preference,
      conditions:
        input.conditions !== undefined
          ? input.conditions
            ? [input.conditions]
            : []
          : undefined,
    });
    await memoryRepository.createMemoryRevision({
      tasteEntryId: taste.id,
      previousState: existing,
      newState: taste,
      changeReason: `作者${input.intent}`,
    });
    return { success: true };
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "偏好保存失败" },
      { status: 400 },
    );
  }
}
