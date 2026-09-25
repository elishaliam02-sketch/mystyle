/**
 * How a coach builds a session: a fixed shape of movement slots — the main
 * lift first, then the second compound, then the accessories — and for each
 * slot a short list of exercises that are right for this person's level.
 *
 * The old generator drew any exercise for a muscle, so a gym plan could open
 * chest day on a band press and hand pull day a close-grip bench (an arm
 * exercise). Here the randomness only ever chooses *within* a slot's list, so
 * every plan is a sensible program and still differs from the next one.
 *
 * Lists are ordered best-first for the gym; the equipment filter removes what
 * the person cannot do (a home plan never sees a machine). When a level has
 * nothing left for the kit, the neighbouring level stands in — beginners reach
 * up one step at most, never to an advanced lift.
 */
import type { Equipment } from "./exercises";
import type { Level } from "./difficulty";

export type SlotId =
  | "hpush" | "chest2" | "chestFly" | "vpush" | "lateral" | "triceps"
  | "vpull" | "hrow" | "rear" | "biceps" | "biceps2"
  | "squat" | "hinge" | "single" | "hamcurl" | "quad" | "glute" | "calves"
  | "core" | "conditioning" | "lowback";

type ByLevel = { beginner: string[]; intermediate: string[]; advanced: string[] };

/** For each slot, what each level does — gym choices first, home ones after. */
export const SLOT_OPTIONS: Record<SlotId, ByLevel> = {
  hpush: {
    beginner: ["machine-chest-press", "db-bench", "smith-bench", "pushup", "incline-pushup", "band-chest-press"],
    intermediate: ["bench-press", "db-bench", "incline-press", "incline-barbell", "pushup", "wide-pushup"],
    advanced: ["bench-press", "incline-barbell", "incline-press", "db-bench", "decline-pushup", "diamond-pushup"],
  },
  // The second chest movement is a press; the fly has its own slot, so a push
  // day is never two flyes and no second press.
  chest2: {
    beginner: ["machine-chest-press", "incline-pushup", "db-bench", "smith-bench"],
    intermediate: ["incline-press", "incline-barbell", "smith-bench", "wide-pushup", "machine-chest-press"],
    advanced: ["incline-press", "incline-barbell", "dips", "decline-db-press", "decline-pushup"],
  },
  chestFly: {
    beginner: ["pec-deck", "cable-crossover", "chest-fly"],
    intermediate: ["cable-crossover", "chest-fly", "incline-cable-fly", "pec-deck"],
    advanced: ["incline-cable-fly", "cable-crossover", "chest-fly", "pec-deck"],
  },
  vpush: {
    beginner: ["machine-shoulder-press", "seated-db-press", "db-shoulder-press", "smith-ohp"],
    intermediate: ["db-shoulder-press", "seated-db-press", "machine-shoulder-press", "arnold-press", "smith-ohp", "pike-pushup"],
    advanced: ["db-shoulder-press", "arnold-press", "smith-ohp", "seated-db-press", "machine-shoulder-press", "pike-pushup"],
  },
  lateral: {
    beginner: ["lateral-raise", "cable-lateral", "band-lateral"],
    intermediate: ["lateral-raise", "cable-lateral", "band-lateral"],
    advanced: ["cable-lateral", "lateral-raise", "band-lateral"],
  },
  triceps: {
    beginner: ["triceps-pushdown", "rope-pushdown", "overhead-triceps", "triceps-kickback", "bench-dip"],
    intermediate: ["rope-pushdown", "skullcrusher", "overhead-triceps", "close-grip-bench", "triceps-pushdown", "bench-dip"],
    advanced: ["close-grip-bench", "dips", "skullcrusher", "rope-pushdown", "overhead-triceps", "diamond-pushup"],
  },
  vpull: {
    // A beginner with no machine rows under a table before a pull-up.
    beginner: ["lat-pulldown", "close-pulldown", "inverted-row"],
    intermediate: ["lat-pulldown", "chinup", "close-pulldown", "inverted-row"],
    advanced: ["pullup", "chinup", "lat-pulldown"],
  },
  hrow: {
    beginner: ["seated-row", "chest-supported-row", "db-row", "inverted-row"],
    intermediate: ["bent-row", "db-row", "t-bar-row", "seated-row", "chest-supported-row", "inverted-row"],
    advanced: ["bent-row", "t-bar-row", "db-row", "inverted-row"],
  },
  rear: {
    beginner: ["face-pull", "reverse-pec-deck", "rear-delt-fly"],
    intermediate: ["face-pull", "reverse-pec-deck", "rear-delt-fly", "cable-rear-delt"],
    advanced: ["face-pull", "cable-rear-delt", "rear-delt-fly", "reverse-pec-deck"],
  },
  biceps: {
    beginner: ["biceps-curl", "cable-curl", "machine-curl", "preacher-curl"],
    intermediate: ["barbell-curl", "biceps-curl", "incline-db-curl", "ez-curl", "cable-curl"],
    advanced: ["barbell-curl", "incline-db-curl", "ez-curl", "biceps-curl", "cable-curl"],
  },
  biceps2: {
    beginner: ["hammer-curl", "concentration-curl", "cable-curl"],
    intermediate: ["hammer-curl", "preacher-curl", "concentration-curl", "cable-curl"],
    advanced: ["hammer-curl", "preacher-curl", "concentration-curl", "cable-curl"],
  },
  squat: {
    beginner: ["leg-press", "goblet-squat", "smith-squat", "air-squat"],
    intermediate: ["squat", "hack-squat", "leg-press", "goblet-squat", "box-squat", "air-squat"],
    advanced: ["squat", "front-squat", "hack-squat", "air-squat"],
  },
  hinge: {
    beginner: ["back-extension", "glute-bridge"],
    intermediate: ["rdl", "trap-bar-deadlift", "stiff-leg-deadlift", "glute-bridge"],
    advanced: ["deadlift", "rdl", "sumo-deadlift", "trap-bar-deadlift"],
  },
  single: {
    beginner: ["step-up", "bw-lunge", "reverse-lunge"],
    intermediate: ["walking-lunge", "bulgarian-split-squat", "reverse-lunge", "lunge", "step-up", "bw-lunge"],
    advanced: ["bulgarian-split-squat", "walking-lunge", "reverse-lunge", "lunge", "bw-lunge"],
  },
  hamcurl: {
    beginner: ["lying-leg-curl", "seated-leg-curl", "glute-bridge"],
    intermediate: ["lying-leg-curl", "seated-leg-curl", "glute-bridge"],
    advanced: ["lying-leg-curl", "seated-leg-curl", "glute-bridge"],
  },
  quad: {
    beginner: ["leg-extension", "goblet-squat", "air-squat"],
    intermediate: ["leg-extension", "goblet-squat", "air-squat"],
    advanced: ["leg-extension", "goblet-squat", "air-squat"],
  },
  glute: {
    beginner: ["glute-bridge", "cable-kickback"],
    intermediate: ["hip-thrust", "cable-kickback", "glute-bridge", "single-leg-hip-thrust"],
    advanced: ["hip-thrust", "single-leg-hip-thrust", "cable-kickback"],
  },
  calves: {
    beginner: ["standing-calf", "seated-calf-raise", "calf-raise"],
    intermediate: ["standing-calf", "seated-calf-raise", "calf-raise"],
    advanced: ["standing-calf", "seated-calf-raise", "calf-raise"],
  },
  core: {
    beginner: ["plank", "crunch", "cable-crunch", "side-plank", "reverse-crunch"],
    intermediate: ["hanging-knee-raise", "cable-crunch", "plank", "side-plank", "bicycle-crunch", "reverse-crunch"],
    advanced: ["hanging-leg-raise", "ab-wheel", "hanging-knee-raise", "cable-crunch", "plank"],
  },
  lowback: {
    beginner: ["back-extension", "superman"],
    intermediate: ["back-extension", "superman"],
    advanced: ["back-extension", "superman"],
  },
  conditioning: {
    beginner: ["step-up"],
    intermediate: ["kb-swing", "step-up"],
    advanced: ["kb-swing", "step-up"],
  },
};

/** The order each kind of day fills its slots in — the first N are used. */
export const DAY_SLOTS: Record<string, SlotId[]> = {
  push: ["hpush", "vpush", "chest2", "lateral", "triceps", "chestFly", "triceps", "core"],
  pull: ["vpull", "hrow", "hrow", "rear", "biceps", "biceps2", "core", "vpull", "lowback"],
  legs: ["squat", "hinge", "single", "hamcurl", "calves", "quad", "core", "glute"],
  upper: ["hpush", "vpull", "vpush", "hrow", "lateral", "biceps", "triceps", "rear"],
  lower: ["squat", "hinge", "single", "hamcurl", "glute", "calves", "core", "quad"],
  fullA: ["squat", "hpush", "vpull", "hinge", "lateral", "core", "biceps", "triceps"],
  fullB: ["hinge", "vpush", "hrow", "single", "chest2", "core", "triceps", "biceps"],
};

/** Which muscle a slot trains, so focus muscles move forward. */
/** The slots whose moves are the session's big multi-joint lifts — they keep
 * their place at the front whatever muscle the person wants to focus on. */
export const COMPOUND_SLOTS: ReadonlySet<SlotId> = new Set<SlotId>([
  "hpush", "chest2", "vpush", "vpull", "hrow", "squat", "hinge", "single",
]);

/** Moves that need a gym's fixed bench or station — never in a home plan. */
export const GYM_ONLY: ReadonlySet<string> = new Set(["preacher-curl"]);

export const SLOT_MUSCLE: Record<SlotId, string> = {
  hpush: "chest", chest2: "chest", chestFly: "chest", vpush: "shoulders", lateral: "shoulders", triceps: "arms",
  vpull: "back", hrow: "back", rear: "shoulders", biceps: "arms", biceps2: "arms",
  squat: "legs", hinge: "glutes", single: "legs", hamcurl: "legs", quad: "legs", glute: "glutes",
  calves: "legs", core: "core", conditioning: "fullbody", lowback: "back",
};

/**
 * In a gym, a band press or a push-up where a bench and a barbell stand ready
 * reads as a mistake. These bodyweight moves are the exception: they are the
 * gym versions (pull-ups, dips, hanging core work, a finisher).
 */
const GYM_BODYWEIGHT_OK = new Set([
  "pullup", "chinup", "dips", "nordic-curl", "glute-ham-raise", "back-extension",
  "plank", "side-plank", "crunch", "reverse-crunch", "bicycle-crunch", "hanging-knee-raise",
  "hanging-leg-raise", "ab-wheel",
]);

/** The candidates for a slot at a level, in preference order: the level's own
 * list, then — only if the kit leaves it empty — the neighbouring level's.
 * With a full gym, band and bodyweight versions are dropped when a loaded one
 * is available. */
export function slotCandidates(
  slot: SlotId,
  level: Level,
  allowed: (id: string) => boolean,
  gym = false,
  equipmentOf: (id: string) => string | undefined = () => undefined,
): string[] {
  const opts = SLOT_OPTIONS[slot];
  const loaded = (id: string) => {
    const eq = equipmentOf(id);
    return eq !== "band" && (eq !== "bodyweight" || GYM_BODYWEIGHT_OK.has(id));
  };
  const order: Level[] =
    level === "beginner"
      ? ["beginner", "intermediate"]
      : level === "intermediate"
        ? ["intermediate", "beginner", "advanced"]
        : ["advanced", "intermediate"];
  for (const l of order) {
    const fit = opts[l].filter((id) => allowed(id) && (gym || !GYM_ONLY.has(id)));
    if (!fit.length) continue;
    if (gym) {
      const heavy = fit.filter(loaded);
      if (heavy.length) return heavy;
    }
    return fit;
  }
  return [];
}

/** Equipment each kit allows — the same sets the plan uses. */
export type Kit = Set<Equipment>;
