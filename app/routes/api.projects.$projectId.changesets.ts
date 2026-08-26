import { changeSetRepository, changeSetService } from "../../server/domain";

export async function loader({
  params,
}: {
  params: { projectId: string };
}) {
  const { projectId } = params;
  if (!projectId) {
    return new Response("Missing projectId", { status: 400 });
  }

  const changeSets = await changeSetRepository.listChangeSetsByProject(projectId);
  const items = [];

  for (const cs of changeSets) {
    const operations = await changeSetRepository.listOperationsByChangeSet(cs.id);
    items.push({ changeSet: cs, operations });
  }

  return { items };
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
  const changeSetId = formData.get("changeSetId") as string;

  if (!changeSetId) {
    return { error: "Missing changeSetId" };
  }

  try {
    if (intent === "apply_all") {
      const res = await changeSetService.applyChangeSet(changeSetId, projectId);
      return { success: true, attempt: res.applyAttempt };
    }

    if (intent === "apply_partial") {
      const opIdsRaw = formData.get("operationIds") as string;
      const opIds = JSON.parse(opIdsRaw || "[]");
      const derived = await changeSetService.createDerivedChangeSet(changeSetId, opIds, projectId);
      const res = await changeSetService.applyChangeSet(derived.derivedChangeSet.id, projectId);
      return { success: true, attempt: res.applyAttempt };
    }

    if (intent === "reject") {
      await changeSetRepository.updateChangeSet(changeSetId, { status: "rejected" });
      return { success: true };
    }

    if (intent === "rebase") {
      const val = await changeSetService.validateChangeSet(changeSetId, projectId);
      return { success: true, validation: val };
    }

    return { error: `Unknown intent: ${intent}` };
  } catch (err: any) {
    return { error: err.message || "Failed to process change set action" };
  }
}

