import type { MainGoal } from "@/types/models";

/**
 * What someone said they came here for.
 *
 * Setup asks this and several answers are allowed, because "save money" and
 * "stop wondering where it went" are the same person. It is not decoration:
 * `pickOwwyMessage` ends on the chosen focus, and Ask Owwy is told about it,
 * so the answer changes what Owwy says. Editable later in Settings.
 */
export const MAIN_GOALS: { value: MainGoal; emoji: string; label: string; hint: string }[] = [
  { value: "save", emoji: "🐷", label: "Save money", hint: "Build up savings for something" },
  { value: "control", emoji: "🧭", label: "Control spending", hint: "Stop wondering where it went" },
  { value: "debt", emoji: "🪜", label: "Pay off debt", hint: "Get to zero, step by step" },
  { value: "understand", emoji: "🔍", label: "Understand my finances", hint: "See the full picture" },
  { value: "other", emoji: "✨", label: "Something else", hint: "Owwy will adapt" },
];

export function mainGoalLabel(goal: MainGoal): string {
  return MAIN_GOALS.find((g) => g.value === goal)?.label ?? "Understand my finances";
}

/** Summary for a settings row, e.g. "Save money and 2 more". */
export function describeMainGoals(goals: readonly MainGoal[]): string {
  if (!goals.length) return "Not set";
  const [first, ...rest] = goals;
  return rest.length ? `${mainGoalLabel(first)} and ${rest.length} more` : mainGoalLabel(first);
}

/**
 * Toggling an answer, keeping at least one.
 *
 * "Nothing matters right now" isn't an answer the question can take, so the
 * last remaining choice stays put rather than leaving Owwy with no focus.
 */
export function toggleMainGoal(goals: readonly MainGoal[], goal: MainGoal): MainGoal[] {
  if (!goals.includes(goal)) return [...goals, goal];
  return goals.length > 1 ? goals.filter((g) => g !== goal) : [...goals];
}
