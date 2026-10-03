import { SKILL_ORDER, SKILLS, type SkillId } from "../skills/skills";
import { TOOL_ORDER, TOOLS, type ToolId } from "./tools";

/** Anything in the toolbar: a terrain tool (drag over tiles) or a skill (click a lemming). */
export type ActionId = ToolId | SkillId;

export const ACTION_ORDER: readonly ActionId[] = [...TOOL_ORDER, ...SKILL_ORDER];

export function isSkill(id: ActionId): id is SkillId {
  return id in SKILLS;
}

/** Display name, hint and key binding, whichever kind of action it is. */
export function actionInfo(id: ActionId): { name: string; key: string; hint: string } {
  return isSkill(id) ? SKILLS[id] : TOOLS[id];
}
