import { BUILTIN_SKILLS, type BuiltinSkillConfig } from "./definitions";
import type { SkillOverlay } from "../../shared/schemas/skills";

export interface SkillDiscoveryItem {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
}

export class SkillRuntime {
  /**
   * Returns lightweight discovery metadata for all available built-in skills.
   */
  public listDiscoverableSkills(): SkillDiscoveryItem[] {
    return BUILTIN_SKILLS.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      version: s.version,
    }));
  }

  /**
   * Loads full instructions and context policy for a single selected skill.
   */
  public getSkill(skillId: string): BuiltinSkillConfig {
    const skill = BUILTIN_SKILLS.find((s) => s.id === skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }
    return skill;
  }

  /**
   * Assembles the run-specific system prompt applying the skill instructions and optional user overlays.
   */
  public assemblePrompt(skillId: string, overlay?: Partial<SkillOverlay>): {
    systemPrompt: string;
    contextPolicy: BuiltinSkillConfig["contextPolicy"];
    supportedTools: string[];
  } {
    const skill = this.getSkill(skillId);
    let instructions = skill.instructions;

    // Apply structured user overlays if provided (e.g. custom focus / avoidance)
    if (overlay?.focusAreas && overlay.focusAreas.length > 0) {
      instructions += `\n\n【用户重点关注】:\n` + overlay.focusAreas.map((f: string) => `- ${f}`).join("\n");
    }
    if (overlay?.avoidAreas && overlay.avoidAreas.length > 0) {
      instructions += `\n\n【用户明确回避】:\n` + overlay.avoidAreas.map((a: string) => `- ${a}`).join("\n");
    }
    if (overlay?.customInstructions) {
      instructions += `\n\n【用户补充指引】:\n${overlay.customInstructions}`;
    }

    return {
      systemPrompt: instructions,
      contextPolicy: skill.contextPolicy,
      supportedTools: skill.supportedTools,
    };
  }
}

export const skillRuntime = new SkillRuntime();

