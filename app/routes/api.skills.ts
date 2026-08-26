import { skillRuntime } from "../../server/skills/skill-runtime";

export async function loader() {
  const skills = skillRuntime.listDiscoverableSkills();
  return { skills };
}

