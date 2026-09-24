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
  | "hpush" | "chest2" | "vpush" | "lateral" | "triceps"
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
  chest2: {
    beginner: ["pec-deck", "cable-crossover", "chest-fly", "incline-pushup"],
    intermediate: ["incline-press", "chest-fly", "cable-crossover", "incline-cable-fly", "pec-deck", "wide-pushup"],
    advanced: ["incline-press", "dips", "incline-cable-fly", "cable-crossover", "decline-db-press", "decline-pushup"],
  },
  vpush: {
    beginner: ["machine-shoulder-press", "seated-db-press", "db-shoulder-press", "smith-ohp"],
    intermediate: ["db-shoulder-press", "ohp", "seated-db-press", "arnold-press", "pike-pushup"],
    advanced: ["ohp", "push-press", "arnold-press", "db-shoulder-press", "pike-pushup"],
  },
  lateral: {
    beginner: ["lateral-raise", "machine-lateral", "cable-lateral", "band-lateral"],
    intermediate: ["lateral-raise", "cable-lateral", "machine-lateral", "band-lateral"],
    advanced: ["cable-lateral", "lateral-raise", "machine-lateral", "band-lateral"],
  },
  triceps: {
    beginner: ["triceps-pushdown", "rope-pushdown", "overhead-triceps", "triceps-kickback", "bench-dip"],
    intermediate: ["rope-pushdown", "skullcrusher", "overhead-triceps", "close-grip-bench", "triceps-pushdown", "bench-dip"],
    advanced: ["close-grip-bench", "dips", "skullcrusher", "jm-press", "db-overhead-extension", "diamond-pushup"],
  },
  vpull: {
    beginner: ["lat-pulldown", "wide-pulldown", "close-pulldown", "band-pulldown"],
    intermediate: ["lat-pulldown", "chinup", "wide-pulldown", "close-pulldown", "band-pulldown"],
    advanced: ["pullup", "chinup", "wide-pulldown", "lat-pulldown"],
  },
  hrow: {
    beginner: ["seated-row", "machine-row", "chest-supported-row", "db-row", "inverted-row"],
    intermediate: ["bent-row", "db-row", "t-bar-row", "seated-row", "chest-supported-row", "inverted-row"],
    advanced: ["bent-row", "pendlay-row", "t-bar-row", "kroc-row", "seal-row", "inverted-row"],
  },
  rear: {
    beginner: ["face-pull", "reverse-pec-deck", "rear-delt-fly"],
    intermediate: ["face-pull", "reverse-pec-deck", "rear-delt-fly", "cable-rear-delt"],
    advanced: ["face-pull", "cable-rear-delt", "rear-delt-fly", "reverse-pec-deck"],
  },
  biceps: {
    beginner: ["biceps-curl", "cable-curl", "machine-curl", "preacher-curl", "band-curl"],
    intermediate: ["barbell-curl", "biceps-curl", "incline-db-curl", "ez-curl", "cable-curl", "band-curl"],
    advanced: ["barbell-curl", "incline-db-curl", "spider-curl", "ez-curl", "drag-curl"],
  },
  biceps2: {
    beginner: ["hammer-curl", "concentration-curl", "cable-curl"],
    intermediate: ["hammer-curl", "preacher-curl", "concentration-curl", "cable-curl"],
    advanced: ["hammer-curl", "zottman-curl", "preacher-curl", "spider-curl"],
  },
  squat: {
    beginner: ["leg-press", "goblet-squat", "smith-squat", "air-squat"],
    intermediate: ["squat", "hack-squat", "leg-press", "goblet-squat", "box-squat"],
    advanced: ["squat", "front-squat", "hack-squat", "box-squat", "pistol-squat"],
  },
  hinge: {
    beginner: ["kb-deadlift", "back-extension", "glute-bridge"],
    intermediate: ["rdl", "trap-bar-deadlift", "stiff-leg-deadlift", "single-leg-rdl", "kb-deadlift"],
    advanced: ["deadlift", "rdl", "sumo-deadlift", "trap-bar-deadlift", "single-leg-rdl"],
  },
  single: {
    beginner: ["step-up", "bw-lunge", "reverse-lunge", "wall-sit"],
    intermediate: ["walking-lunge", "bulgarian-split-squat", "reverse-lunge", "lunge", "step-up"],
    advanced: ["bulgarian-split-squat", "walking-lunge", "reverse-lunge", "pistol-squat"],
  },
  hamcurl: {
    beginner: ["lying-leg-curl", "seated-leg-curl", "leg-curl", "glute-bridge"],
    intermediate: ["lying-leg-curl", "seated-leg-curl", "leg-curl", "single-leg-rdl"],
    advanced: ["nordic-curl", "lying-leg-curl", "seated-leg-curl", "glute-ham-raise"],
  },
  quad: {
    beginner: ["leg-extension", "wall-sit"],
    intermediate: ["leg-extension", "wall-sit", "goblet-squat"],
    advanced: ["leg-extension", "sissy-squat", "jump-squat"],
  },
  glute: {
    beginner: ["glute-bridge", "cable-kickback", "abductor-machine", "banded-walk"],
    intermediate: ["hip-thrust", "cable-kickback", "single-leg-hip-thrust", "banded-walk"],
    advanced: ["hip-thrust", "single-leg-hip-thrust", "cable-kickback"],
  },
  calves: {
    beginner: ["standing-calf", "seated-calf-raise", "calf-raise"],
    intermediate: ["standing-calf", "seated-calf-raise", "donkey-calf", "calf-raise"],
    advanced: ["standing-calf", "donkey-calf", "seated-calf-raise", "calf-raise"],
  },
  core: {
    beginner: ["plank", "dead-bug", "cable-crunch", "side-plank", "reverse-crunch"],
    intermediate: ["hanging-knee-raise", "cable-crunch", "pallof-press", "woodchop", "side-plank", "bicycle-crunch"],
    advanced: ["hanging-leg-raise", "ab-wheel", "toes-to-bar", "l-sit", "cable-crunch"],
  },
  lowback: {
    beginner: ["back-extension", "superman"],
    intermediate: ["back-extension", "superman"],
    advanced: ["good-morning", "back-extension", "superman"],
  },
  conditioning: {
    beginner: ["mountain-climber", "step-up"],
    intermediate: ["kb-swing", "burpee", "mountain-climber"],
    advanced: ["burpee", "thruster", "devil-press", "kb-swing"],
  },
};

/** The order each kind of day fills its slots in — the first N are used. */
export const DAY_SLOTS: Record<string, SlotId[]> = {
  push: ["hpush", "vpush", "chest2", "lateral", "triceps", "chest2", "triceps", "core"],
  pull: ["vpull", "hrow", "rear", "biceps", "biceps2", "hrow", "core", "vpull", "lowback"],
  legs: ["squat", "hinge", "single", "hamcurl", "calves", "quad", "core", "glute"],
  upper: ["hpush", "vpull", "vpush", "hrow", "lateral", "biceps", "triceps", "rear"],
  lower: ["squat", "hinge", "single", "hamcurl", "glute", "calves", "core", "quad"],
  fullA: ["squat", "hpush", "vpull", "hinge", "lateral", "core", "biceps", "triceps"],
  fullB: ["hinge", "vpush", "hrow", "single", "chest2", "core", "triceps", "biceps"],
};

/** Which muscle a slot trains, so focus muscles move forward. */
export const SLOT_MUSCLE: Record<SlotId, string> = {
  hpush: "chest", chest2: "chest", vpush: "shoulders", lateral: "shoulders", triceps: "arms",
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
  "plank", "side-plank", "dead-bug", "reverse-crunch", "bicycle-crunch", "hanging-knee-raise",
  "hanging-leg-raise", "toes-to-bar", "ab-wheel", "l-sit", "mountain-climber", "burpee",
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
    const fit = opts[l].filter(allowed);
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
