import { z } from "zod";
import { changeSetRepository, changeSetService } from "../../server/domain";
import { ChangeReviewDecisionEnum } from "../../shared/schemas/changeset";

export async function loader({ params }: { params: { projectId: string } }) {
  const changeSets = await changeSetRepository.listChangeSetsByProject(
    params.projectId,
  );
  return {
    items: await Promise.all(
      changeSets.map(async (changeSet) => ({
        changeSet,
        operations: await changeSetRepository.listOperationsByChangeSet(
          changeSet.id,
        ),
        reviews: await changeSetRepository.listReviewsByChangeSet(changeSet.id),
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
      .object({
        intent: z.enum([
          "apply_all",
          "apply_partial",
          "review",
          "rebase",
          "finish",
        ]),
        changeSetId: z.string(),
        operationIds: z.array(z.string()).optional(),
        operationId: z.string().optional(),
        decision: ChangeReviewDecisionEnum.optional(),
        feedback: z.string().default(""),
      })
      .parse(await request.json());
    const set = await changeSetRepository.getChangeSetById(input.changeSetId);
    if (!set || set.projectId !== params.projectId)
      return Response.json({ error: "案卷不存在" }, { status: 404 });
    if (input.intent === "rebase")
      return {
        success: true,
        validation: await changeSetService.validateChangeSet(
          set.id,
          params.projectId,
        ),
      };
    if (input.intent === "review") {
      const operations = await changeSetRepository.listOperationsByChangeSet(
        set.id,
      );
      const operation = operations.find((op) => op.id === input.operationId);
      if (!operation || operation.status === "applied")
        throw new Error("此修改不能重新决策");
      if (!input.decision || input.decision === "approved")
        throw new Error("采纳必须通过正文应用操作");
      await changeSetRepository.createReview({
        changeSetId: set.id,
        projectId: params.projectId,
        operationId: operation.id,
        decision: input.decision,
        userFeedback: input.feedback,
      });
      const updated = await changeSetRepository.listOperationsByChangeSet(
        set.id,
      );
      if (updated.every((op) => ["applied", "rejected"].includes(op.status)))
        await changeSetRepository.updateChangeSet(set.id, {
          status: updated.some((op) => op.status === "applied")
            ? "partially_approved"
            : "rejected",
        });
      return { success: true };
    }
    if (input.intent === "finish") {
      await changeSetRepository.createReview({
        changeSetId: set.id,
        projectId: params.projectId,
        decision: "revised",
        userFeedback: input.feedback || "作者完成本轮回读",
      });
      await changeSetRepository.updateChangeSet(set.id, {
        metadata: { ...set.metadata, finished: true },
      });
      return { success: true };
    }
    const operations = await changeSetRepository.listOperationsByChangeSet(
      set.id,
    );
    const remaining = operations.filter(
      (op) => !["applied", "rejected"].includes(op.status),
    );
    const ids =
      input.intent === "apply_all"
        ? remaining.map((op) => op.id)
        : input.operationIds || [];
    const useOriginal =
      ids.length === operations.length &&
      operations.every((op) => ids.includes(op.id));
    const derived = useOriginal
      ? undefined
      : await changeSetService.createDerivedChangeSet(
          set.id,
          ids,
          params.projectId,
        );
    const result = await changeSetService.applyChangeSet(
      derived?.derivedChangeSet.id || set.id,
      params.projectId,
    );
    for (const id of ids) {
      await changeSetRepository.createReview({
        changeSetId: set.id,
        projectId: params.projectId,
        operationId: id,
        decision: "approved",
        userFeedback: input.feedback,
      });
      await changeSetRepository.updateOperation(id, { status: "applied" });
    }
    if (derived)
      await changeSetRepository.updateChangeSet(set.id, {
        status: "partially_approved",
      });
    return { success: true, attempt: result.applyAttempt };
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "案卷操作失败" },
      { status: 400 },
    );
  }
}
