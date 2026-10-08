import { knowledgeRepository } from "../../server/domain";
import { localAssetStorage } from "../../server/storage/local-asset-storage";

export async function loader({
  params,
}: {
  params: { projectId: string; assetId: string };
}) {
  const asset = await knowledgeRepository.getAssetById(params.assetId);
  if (!asset || asset.projectId !== params.projectId)
    return new Response("File not found", { status: 404 });
  const buffer = await localAssetStorage.getBuffer(asset.storagePath);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(asset.originalFileName)}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
