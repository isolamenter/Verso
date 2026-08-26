import { legacyImportService } from "../../server/domain";

export async function action({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const { intent, payload } = body;

    if (!payload) {
      return new Response(JSON.stringify({ error: "Payload is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (intent === "dry_run") {
      const result = legacyImportService.dryRun(payload);
      return { success: true, result };
    }

    if (intent === "execute") {
      const result = await legacyImportService.executeImport(payload);
      return { success: true, result };
    }

    return new Response(JSON.stringify({ error: `Unsupported intent: ${intent}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Failed to process legacy import" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

