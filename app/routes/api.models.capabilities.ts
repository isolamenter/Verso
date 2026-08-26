import { capabilityProbe } from "../../server/models";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "true" || url.searchParams.get("force") === "true";

  const capabilities = await capabilityProbe.probeCapabilities(refresh);

  return Response.json(capabilities, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30",
    },
  });
}

