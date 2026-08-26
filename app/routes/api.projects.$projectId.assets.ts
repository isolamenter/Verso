import { assetService } from "../../server/domain";

export async function loader({
  params,
}: {
  params: { projectId: string };
}) {
  const { projectId } = params;
  if (!projectId) {
    return new Response("Missing projectId", { status: 400 });
  }

  const items = await assetService.listAssetsWithDetails(projectId);
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

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return { error: "File is required" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await assetService.uploadAsset(
      projectId,
      buffer,
      file.name,
      file.type || "application/octet-stream"
    );

    return { success: true, asset: result.asset, domainJobId: result.domainJobId };
  } catch (err: any) {
    return { error: err.message || "Failed to upload asset" };
  }
}

