import { describe, it, expect } from "vitest";
import { skillRuntime } from "../../../server/skills/skill-runtime";
import { loader as skillsLoader } from "../../../app/routes/api.skills";

describe("E17 — Progressive Skill Runtime and Legacy Feature Conversion", () => {
  it("provides lightweight discovery metadata for all mapped skills", async () => {
    const skills = skillRuntime.listDiscoverableSkills();
    expect(skills.length).toBeGreaterThanOrEqual(6);

    const ids = skills.map((s) => s.id);
    expect(ids).toContain("cold_reader");
    expect(ids).toContain("literary_critique");
    expect(ids).toContain("scene_drafting");
    expect(ids).toContain("prose_expansion");
    expect(ids).toContain("character_profiler");
    expect(ids).toContain("revision_comparison");

    // Discovery items should not contain massive instruction text
    expect((skills[0] as any).instructions).toBeUndefined();
  });

  it("enforces Cold Reader strict isolation policy", async () => {
    const { systemPrompt, contextPolicy, supportedTools } = skillRuntime.assemblePrompt("cold_reader");

    expect(systemPrompt).toContain("冷读体验官");
    expect(contextPolicy.includeKnowledge).toBe(false);
    expect(contextPolicy.includeMemory).toBe(false);
    expect(contextPolicy.includeMedia).toBe(false);
    expect(supportedTools).toContain("propose_text_change");
    expect(supportedTools).not.toContain("search_knowledge");
  });

  it("applies structured user overlays safely", async () => {
    const { systemPrompt } = skillRuntime.assemblePrompt("scene_drafting", {
      focusAreas: ["强化雨夜凄清的氛围", "凸显主角内心的犹疑"],
      avoidAreas: ["避免出现任何现代科技词汇", "避免直接说教"],
    });

    expect(systemPrompt).toContain("文学创作助手");
    expect(systemPrompt).toContain("【用户重点关注】:");
    expect(systemPrompt).toContain("强化雨夜凄清的氛围");
    expect(systemPrompt).toContain("【用户明确回避】:");
    expect(systemPrompt).toContain("避免出现任何现代科技词汇");
  });

  it("exposes skills via API loader", async () => {
    const res = await skillsLoader();
    expect(res.skills.length).toBeGreaterThanOrEqual(6);
  });
});
