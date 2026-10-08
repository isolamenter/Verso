UPDATE taste_entries SET status = 'candidate', updated_at = NOW() WHERE explicitness = 'inferred' AND status = 'active' AND last_confirmed_at IS NULL;
--> statement-breakpoint
UPDATE scene_revisions SET change_type = 'ai_accepted' WHERE change_type = 'agent_applied';
