import { projectRepository, manuscriptService } from "../../server/domain";
import { exportCleanDocx } from "../../server/domain/manuscripts/export-docx";

export async function loader({ params }: { params: { projectId: string } }) {
  const project = await projectRepository.getProjectById(params.projectId);
  if (!project) return Response.json({ error: "作品不存在" }, { status: 404 });
  const manuscripts = await manuscriptService.listManuscriptsWithScenes(
    params.projectId,
  );
  const buffer = await exportCleanDocx(project.title, manuscripts);
  const filename = encodeURIComponent(
    `${project.title.replace(/[\\/:*?"<>|]/g, "_")}.docx`,
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "Cache-Control": "no-store",
    },
  });
}
