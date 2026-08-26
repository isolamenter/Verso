CREATE TABLE IF NOT EXISTS "system_metadata" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manuscripts" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"genre" text DEFAULT 'novel' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"locale" text,
	"context_budget" integer,
	"tone_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"archived" boolean DEFAULT false NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"scene_id" text NOT NULL,
	"project_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"change_type" text NOT NULL,
	"description" text NOT NULL,
	"content" text NOT NULL,
	"diff_summary" text,
	"character_count" integer DEFAULT 0 NOT NULL,
	"rollback_source_rev_id" text,
	"applied_change_set_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"manuscriptId" text NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"pov" text,
	"location" text,
	"timeframe" text,
	"summary" text,
	"character_count" integer DEFAULT 0 NOT NULL,
	"current_revision_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"default_locale" text DEFAULT 'zh-CN' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"active_project_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"project_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"structured_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"locale" text DEFAULT 'zh-CN' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"project_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"sequence_number" integer NOT NULL,
	"run_id" text,
	"skill_id" text,
	"target_scene_id" text,
	"target_revision_id" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_run_events" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"project_id" text NOT NULL,
	"sequence_number" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"project_id" text NOT NULL,
	"skill_id" text,
	"skill_version" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"model_role" text,
	"model_id" text,
	"target_resource" jsonb,
	"context_receipt_id" text,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_scene_id" text,
	"active_skill_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_receipt_items" (
	"id" text PRIMARY KEY NOT NULL,
	"context_receipt_id" text NOT NULL,
	"project_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"tier" integer NOT NULL,
	"inclusion_mode" text NOT NULL,
	"exclusion_reason" text,
	"estimated_tokens" integer,
	"content_snippet" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"project_id" text NOT NULL,
	"skill_id" text,
	"skill_version" text,
	"total_tokens_approx" integer,
	"tier_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_apply_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"change_set_id" text NOT NULL,
	"project_id" text NOT NULL,
	"status" text NOT NULL,
	"resulting_revision_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"change_set_id" text NOT NULL,
	"project_id" text NOT NULL,
	"sequence_number" integer NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"base_revision_id" text,
	"operation_type" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"quote" text,
	"prefix_anchor" text,
	"suffix_anchor" text,
	"original_checksum" text,
	"range_from" integer,
	"range_to" integer,
	"replacement_content" text,
	"literary_tradeoff" text,
	"structured_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"validation_result" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"change_set_id" text NOT NULL,
	"project_id" text NOT NULL,
	"operation_id" text,
	"decision" text NOT NULL,
	"user_feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"thread_id" text,
	"run_id" text,
	"title" text NOT NULL,
	"objective" text NOT NULL,
	"rationale" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"base_revision_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"context_receipt_id" text,
	"skill_invocation_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applied_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"node_id" text,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"pg_boss_job_id" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"node_id" text NOT NULL,
	"asset_id" text,
	"layer" text NOT NULL,
	"generator_type" text NOT NULL,
	"generator_model" text,
	"generator_version" text,
	"content" text NOT NULL,
	"structured_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" double precision,
	"is_user_corrected" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"node_id" text,
	"sha256" text NOT NULL,
	"storage_path" text NOT NULL,
	"original_file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"node_id" text NOT NULL,
	"artifact_id" text,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"source_locator" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"manuscript_id" text,
	"scene_id" text,
	"parent_id" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"summary" text,
	"authority" text DEFAULT 'user_authored_locked' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"language" text DEFAULT 'zh-CN' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"source_node_id" text NOT NULL,
	"target_node_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"description" text,
	"confidence" double precision,
	"is_user_confirmed" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"node_id" text NOT NULL,
	"project_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"change_type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_segments" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"project_id" text NOT NULL,
	"segment_type" text NOT NULL,
	"start_time_ms" integer,
	"end_time_ms" integer,
	"page_number" integer,
	"storage_path" text,
	"transcript" text,
	"visual_description" text,
	"speakers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"scope" text NOT NULL,
	"scope_id" text,
	"layer" text NOT NULL,
	"key" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"confidence" double precision DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"memory_entry_id" text NOT NULL,
	"project_id" text,
	"source_type" text NOT NULL,
	"source_id" text,
	"quote" text,
	"weight" double precision DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"memory_entry_id" text,
	"taste_entry_id" text,
	"revision_number" integer NOT NULL,
	"previous_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"new_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"change_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taste_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text DEFAULT 'workspace' NOT NULL,
	"scope_id" text,
	"dimension" text NOT NULL,
	"preference" text NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"anti_preferences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"explicitness" text DEFAULT 'inferred' NOT NULL,
	"first_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"supersedes_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taste_entry_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"taste_entry_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"quote" text,
	"weight" double precision DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"is_built_in" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_invocations" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"skill_version_id" text,
	"overlay_id" text,
	"invocation_mode" text NOT NULL,
	"resolved_parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_overlays" (
	"id" text PRIMARY KEY NOT NULL,
	"skill_id" text NOT NULL,
	"project_id" text,
	"custom_name" text,
	"focus_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avoid_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_strength" text,
	"custom_instructions" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"skill_id" text NOT NULL,
	"version" text NOT NULL,
	"manifest" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"instructions" text NOT NULL,
	"output_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"context_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"source_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"imported_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "literary_annotations" (
	"id" text PRIMARY KEY NOT NULL,
	"scene_id" text NOT NULL,
	"project_id" text NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"range_from" integer,
	"range_to" integer,
	"quote" text NOT NULL,
	"diagnosis" text NOT NULL,
	"literary_tradeoff" text,
	"suggestion" text,
	"replacement" jsonb,
	"applied_replacement_type" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_stale" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "margin_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"scene_id" text NOT NULL,
	"project_id" text NOT NULL,
	"author" text NOT NULL,
	"range_from" integer NOT NULL,
	"range_to" integer NOT NULL,
	"quote" text NOT NULL,
	"content" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manuscripts" ADD CONSTRAINT "manuscripts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_settings" ADD CONSTRAINT "project_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_revisions" ADD CONSTRAINT "scene_revisions_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_revisions" ADD CONSTRAINT "scene_revisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_manuscriptId_manuscripts_id_fk" FOREIGN KEY ("manuscriptId") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_artifacts" ADD CONSTRAINT "agent_artifacts_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_artifacts" ADD CONSTRAINT "agent_artifacts_thread_id_agent_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."agent_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_artifacts" ADD CONSTRAINT "agent_artifacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_thread_id_agent_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."agent_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run_events" ADD CONSTRAINT "agent_run_events_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run_events" ADD CONSTRAINT "agent_run_events_thread_id_agent_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."agent_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run_events" ADD CONSTRAINT "agent_run_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_thread_id_agent_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."agent_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_receipt_items" ADD CONSTRAINT "context_receipt_items_context_receipt_id_context_receipts_id_fk" FOREIGN KEY ("context_receipt_id") REFERENCES "public"."context_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_receipt_items" ADD CONSTRAINT "context_receipt_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_receipts" ADD CONSTRAINT "context_receipts_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_receipts" ADD CONSTRAINT "context_receipts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_apply_attempts" ADD CONSTRAINT "change_apply_attempts_change_set_id_change_sets_id_fk" FOREIGN KEY ("change_set_id") REFERENCES "public"."change_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_apply_attempts" ADD CONSTRAINT "change_apply_attempts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_operations" ADD CONSTRAINT "change_operations_change_set_id_change_sets_id_fk" FOREIGN KEY ("change_set_id") REFERENCES "public"."change_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_operations" ADD CONSTRAINT "change_operations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_reviews" ADD CONSTRAINT "change_reviews_change_set_id_change_sets_id_fk" FOREIGN KEY ("change_set_id") REFERENCES "public"."change_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_reviews" ADD CONSTRAINT "change_reviews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_reviews" ADD CONSTRAINT "change_reviews_operation_id_change_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."change_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_thread_id_agent_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."agent_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_asset_id_knowledge_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."knowledge_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_artifacts" ADD CONSTRAINT "knowledge_artifacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_artifacts" ADD CONSTRAINT "knowledge_artifacts_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_artifacts" ADD CONSTRAINT "knowledge_artifacts_asset_id_knowledge_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."knowledge_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_assets" ADD CONSTRAINT "knowledge_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_assets" ADD CONSTRAINT "knowledge_assets_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_artifact_id_knowledge_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."knowledge_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_relations" ADD CONSTRAINT "knowledge_relations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_relations" ADD CONSTRAINT "knowledge_relations_source_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_relations" ADD CONSTRAINT "knowledge_relations_target_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_revisions" ADD CONSTRAINT "knowledge_revisions_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_revisions" ADD CONSTRAINT "knowledge_revisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_segments" ADD CONSTRAINT "media_segments_asset_id_knowledge_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."knowledge_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_segments" ADD CONSTRAINT "media_segments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_entries" ADD CONSTRAINT "memory_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_evidence" ADD CONSTRAINT "memory_evidence_memory_entry_id_memory_entries_id_fk" FOREIGN KEY ("memory_entry_id") REFERENCES "public"."memory_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_evidence" ADD CONSTRAINT "memory_evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_revisions" ADD CONSTRAINT "memory_revisions_memory_entry_id_memory_entries_id_fk" FOREIGN KEY ("memory_entry_id") REFERENCES "public"."memory_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_revisions" ADD CONSTRAINT "memory_revisions_taste_entry_id_taste_entries_id_fk" FOREIGN KEY ("taste_entry_id") REFERENCES "public"."taste_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_entry_evidence" ADD CONSTRAINT "taste_entry_evidence_taste_entry_id_taste_entries_id_fk" FOREIGN KEY ("taste_entry_id") REFERENCES "public"."taste_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_invocations" ADD CONSTRAINT "skill_invocations_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_invocations" ADD CONSTRAINT "skill_invocations_skill_id_skill_definitions_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_invocations" ADD CONSTRAINT "skill_invocations_skill_version_id_skill_versions_id_fk" FOREIGN KEY ("skill_version_id") REFERENCES "public"."skill_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_invocations" ADD CONSTRAINT "skill_invocations_overlay_id_skill_overlays_id_fk" FOREIGN KEY ("overlay_id") REFERENCES "public"."skill_overlays"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_overlays" ADD CONSTRAINT "skill_overlays_skill_id_skill_definitions_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_overlays" ADD CONSTRAINT "skill_overlays_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_skill_id_skill_definitions_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "literary_annotations" ADD CONSTRAINT "literary_annotations_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "literary_annotations" ADD CONSTRAINT "literary_annotations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "margin_notes" ADD CONSTRAINT "margin_notes_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "margin_notes" ADD CONSTRAINT "margin_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manuscripts_project_id_idx" ON "manuscripts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "manuscripts_order_idx" ON "manuscripts" USING btree ("project_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "project_settings_project_id_unique" ON "project_settings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_archived_idx" ON "projects" USING btree ("archived");--> statement-breakpoint
CREATE INDEX "projects_updated_at_idx" ON "projects" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "scene_revisions_scene_id_idx" ON "scene_revisions" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "scene_revisions_project_id_idx" ON "scene_revisions" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scene_revisions_scene_number_unique" ON "scene_revisions" USING btree ("scene_id","revision_number");--> statement-breakpoint
CREATE INDEX "scenes_manuscript_id_idx" ON "scenes" USING btree ("manuscriptId");--> statement-breakpoint
CREATE INDEX "scenes_project_id_idx" ON "scenes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "scenes_order_idx" ON "scenes" USING btree ("manuscriptId","order");--> statement-breakpoint
CREATE INDEX "agent_artifacts_run_id_idx" ON "agent_artifacts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "agent_artifacts_project_id_idx" ON "agent_artifacts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "agent_messages_thread_id_idx" ON "agent_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "agent_messages_project_id_idx" ON "agent_messages" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_messages_thread_seq_unique" ON "agent_messages" USING btree ("thread_id","sequence_number");--> statement-breakpoint
CREATE INDEX "agent_run_events_run_id_idx" ON "agent_run_events" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_run_events_run_seq_unique" ON "agent_run_events" USING btree ("run_id","sequence_number");--> statement-breakpoint
CREATE INDEX "agent_runs_thread_id_idx" ON "agent_runs" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "agent_runs_project_id_idx" ON "agent_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "agent_runs_status_idx" ON "agent_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_threads_project_id_idx" ON "agent_threads" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "agent_threads_updated_at_idx" ON "agent_threads" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "context_receipt_items_receipt_id_idx" ON "context_receipt_items" USING btree ("context_receipt_id");--> statement-breakpoint
CREATE INDEX "context_receipt_items_project_id_idx" ON "context_receipt_items" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "context_receipts_run_id_unique" ON "context_receipts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "context_receipts_project_id_idx" ON "context_receipts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "change_apply_attempts_change_set_id_idx" ON "change_apply_attempts" USING btree ("change_set_id");--> statement-breakpoint
CREATE INDEX "change_apply_attempts_project_id_idx" ON "change_apply_attempts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "change_operations_change_set_id_idx" ON "change_operations" USING btree ("change_set_id");--> statement-breakpoint
CREATE INDEX "change_operations_project_id_idx" ON "change_operations" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "change_operations_set_seq_unique" ON "change_operations" USING btree ("change_set_id","sequence_number");--> statement-breakpoint
CREATE INDEX "change_reviews_change_set_id_idx" ON "change_reviews" USING btree ("change_set_id");--> statement-breakpoint
CREATE INDEX "change_reviews_project_id_idx" ON "change_reviews" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "change_sets_project_id_idx" ON "change_sets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "change_sets_status_idx" ON "change_sets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "change_sets_thread_id_idx" ON "change_sets" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "ingestion_jobs_project_id_idx" ON "ingestion_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ingestion_jobs_status_idx" ON "ingestion_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ingestion_jobs_asset_id_idx" ON "ingestion_jobs" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "knowledge_artifacts_node_id_idx" ON "knowledge_artifacts" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "knowledge_artifacts_layer_idx" ON "knowledge_artifacts" USING btree ("layer");--> statement-breakpoint
CREATE INDEX "knowledge_assets_project_id_idx" ON "knowledge_assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "knowledge_assets_sha256_idx" ON "knowledge_assets" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_node_id_idx" ON "knowledge_chunks" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_project_id_idx" ON "knowledge_chunks" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_node_idx_unique" ON "knowledge_chunks" USING btree ("node_id","chunk_index");--> statement-breakpoint
CREATE INDEX "knowledge_nodes_project_id_idx" ON "knowledge_nodes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "knowledge_nodes_kind_idx" ON "knowledge_nodes" USING btree ("project_id","kind");--> statement-breakpoint
CREATE INDEX "knowledge_nodes_parent_id_idx" ON "knowledge_nodes" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "knowledge_relations_source_idx" ON "knowledge_relations" USING btree ("source_node_id");--> statement-breakpoint
CREATE INDEX "knowledge_relations_target_idx" ON "knowledge_relations" USING btree ("target_node_id");--> statement-breakpoint
CREATE INDEX "knowledge_relations_project_id_idx" ON "knowledge_relations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "knowledge_revisions_node_id_idx" ON "knowledge_revisions" USING btree ("node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_revisions_node_number_unique" ON "knowledge_revisions" USING btree ("node_id","revision_number");--> statement-breakpoint
CREATE INDEX "media_segments_asset_id_idx" ON "media_segments" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "media_segments_project_id_idx" ON "media_segments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "memory_entries_project_id_idx" ON "memory_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "memory_entries_scope_layer_idx" ON "memory_entries" USING btree ("scope","layer");--> statement-breakpoint
CREATE INDEX "memory_entries_status_idx" ON "memory_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "memory_evidence_entry_id_idx" ON "memory_evidence" USING btree ("memory_entry_id");--> statement-breakpoint
CREATE INDEX "memory_evidence_project_id_idx" ON "memory_evidence" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "memory_revisions_memory_entry_idx" ON "memory_revisions" USING btree ("memory_entry_id");--> statement-breakpoint
CREATE INDEX "memory_revisions_taste_entry_idx" ON "memory_revisions" USING btree ("taste_entry_id");--> statement-breakpoint
CREATE INDEX "taste_entries_scope_idx" ON "taste_entries" USING btree ("scope","scope_id");--> statement-breakpoint
CREATE INDEX "taste_entries_dimension_idx" ON "taste_entries" USING btree ("dimension");--> statement-breakpoint
CREATE INDEX "taste_entries_status_idx" ON "taste_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "taste_entry_evidence_taste_entry_id_idx" ON "taste_entry_evidence" USING btree ("taste_entry_id");--> statement-breakpoint
CREATE INDEX "skill_definitions_category_idx" ON "skill_definitions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "skill_invocations_run_id_idx" ON "skill_invocations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "skill_invocations_skill_id_idx" ON "skill_invocations" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "skill_overlays_skill_id_idx" ON "skill_overlays" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "skill_overlays_project_id_idx" ON "skill_overlays" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "skill_versions_skill_id_idx" ON "skill_versions" USING btree ("skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_versions_skill_ver_unique" ON "skill_versions" USING btree ("skill_id","version");--> statement-breakpoint
CREATE INDEX "import_jobs_project_id_idx" ON "import_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "import_jobs_status_idx" ON "import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "literary_annotations_scene_id_idx" ON "literary_annotations" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "literary_annotations_project_id_idx" ON "literary_annotations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "literary_annotations_status_idx" ON "literary_annotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "margin_notes_scene_id_idx" ON "margin_notes" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "margin_notes_project_id_idx" ON "margin_notes" USING btree ("project_id");