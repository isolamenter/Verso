import { z } from "zod";
import { agentRepository } from "../../server/domain";
import { selectDraft } from "../../server/domain/writing-service";

export async function loader({ params }: { params: { projectId: string } }) {
  const threads = await agentRepository.listThreadsByProject(params.projectId);
  const artifacts = (
    await Promise.all(
      threads.map((t) => agentRepository.listArtifactsByThread(t.id)),
    )
  )
    .flat()
    .filter((a) => a.type === "scene_draft");
  return { artifacts };
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
        artifactId: z.string(),
        disposition: z.enum(["adopted", "material", "dismissed"]),
        sceneId: z.string().optional(),
        expectedBaseRevisionId: z.string().optional(),
        selectedText: z.string().optional(),
      })
      .parse(await request.json());
    return await selectDraft(
      params.projectId,
      input.artifactId,
      input.disposition,
      input.sceneId,
      input.expectedBaseRevisionId,
      input.selectedText,
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "处理试写失败" },
      { status: 400 },
    );
  }
}
