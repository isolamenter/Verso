import { assetService } from "../../server/domain";

export async function action({
  params,
}: {
  params: { projectId: string; assetId: string };
}) {
  const { projectId, assetId } = params;
  if (!projectId || !assetId) {
    return new Response("Missing parameters", { status: 400 });
  }

  try {
    const result = await assetService.retryIngestion(assetId, projectId);
    return { success: true, asset: result.asset, domainJobId: result.domainJobId };
  } catch (err: any) {
    return { error: err.message || "Failed to retry asset ingestion" };
  }
}

