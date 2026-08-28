export type SupportCategory =
  | "water"
  | "movement"
  | "cleanEating"
  | "mealStructure"
  | "snacking"
  | "portions"
  | "sleep"
  | "screens"
  | "general";

export type Meal = {
  /** Which meal of the day: breakfast, lunch or dinner. */
  slot: string;
  ideas: string[];
};

export type SupportContent = {
  label: string;
  /** One line on why this habit is worth the effort. Never a medical claim. */
  why: string;
  tips: string[];
  /** Suggested "after X" triggers — an existing routine to hang the habit on. */
  anchors: string[];
  /** Smaller versions, offered when the habit is not sticking. */
  smaller: string[];
  meals?: Meal[];
};

export type SupportLibrary = Record<SupportCategory, SupportContent>;
