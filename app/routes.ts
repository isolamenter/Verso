import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("projects/:projectId", "routes/projects.$projectId.tsx"),
  route("api/runs/:runId/events", "routes/api.runs.$runId.events.ts"),
  route("api/runs/:runId/cancel", "routes/api.runs.$runId.cancel.ts"),
  route("api/projects/:projectId/threads/:threadId/messages", "routes/api.projects.$projectId.threads.$threadId.messages.ts"),
  route("api/projects/:projectId/changesets", "routes/api.projects.$projectId.changesets.ts"),
  route("api/projects/:projectId/knowledge", "routes/api.projects.$projectId.knowledge.ts"),
  route("api/projects/:projectId/assets", "routes/api.projects.$projectId.assets.ts"),
  route("api/projects/:projectId/assets/:assetId/retry", "routes/api.projects.$projectId.assets.$assetId.retry.ts"),
  route("api/projects/:projectId/memory", "routes/api.projects.$projectId.memory.ts"),
  route("api/skills", "routes/api.skills.ts"),
  route("api/health/live", "routes/api.health.live.ts"),
  route("api/health/ready", "routes/api.health.ready.ts"),
  route("api/models/capabilities", "routes/api.models.capabilities.ts"),
  route("api/preferences/locale", "routes/api.preferences.locale.ts"),
] satisfies RouteConfig;

