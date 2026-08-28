import type { he } from "./he";

export const en: typeof he = {
  meta: { name: "English" },

  tabs: {
    today: "Today",
    checkin: "Recap",
    progress: "Progress",
    profile: "Profile",
  },

  onboarding: {
    stepOf: "Step {step} of {total}",
    next: "Continue",
    back: "Back",
    finish: "Done, let's go",

    step1Title: "What should we call you?",
    step1Body: "Just so we can talk like people. It goes nowhere else.",
    step1Placeholder: "Your name",

    step2Title: "What do you weigh today?",
    step2Body: "Optional — you can skip and add it whenever. Weigh in weekly, not daily.",
    step2Current: "Current weight",
    step2Goal: "Goal (optional)",
    skip: "Skip this",

    step3Title: "Your first habit",
    step3Body: "One. Not three. Pick something so small it would be silly to skip — that's how it sticks.",
    step3Placeholder: "For example: drink a glass of water when I wake up",
    step3Ideas: "Ideas to start from",
    step3When: "Roughly when?",
    step3NeedOne: "Write one habit to continue",

    ideas: {
      water: "Drink a glass of water when I wake up",
      walk: "Go for a 10-minute walk",
      breakfast: "Eat breakfast",
      stairs: "Take the stairs instead of the lift",
      screens: "Screens off half an hour before bed",
      veg: "Add one vegetable to lunch",
    },
  },

  slots: {
    morning: "Morning",
    noon: "Midday",
    evening: "Evening",
    any: "Whenever",
  },

  today: {
    greetingMorning: "Good morning",
    greetingNoon: "Good afternoon",
    greetingEvening: "Good evening",
    greetingNamed: "{greeting}, {name}",

    emptyTitle: "No habits yet",
    emptyBody: "Start with one small one. You can add more later, once the first one sits.",
    emptyCta: "Add your first habit",

    listLabel: "Your habits",
    doneCount: "{done} of {total} today",
    allDone: "All done today. Nice.",

    addCta: "Add a habit",
    holdTitle: "Not the moment to add",
    holdBody: "What you have hasn't settled yet. Give it a few more days — adding now just spreads you thin. If you want to anyway, the button is right there.",
    readyTitle: "You're holding this well",
    readyBody: "If you feel like it, this is a good moment to add one more habit. No obligation.",
  },

  habit: {
    newTitle: "New habit",
    newBody: "In your own words. The smaller and more concrete, the better the odds.",
    placeholder: "What do you want to do?",
    when: "Roughly when?",
    save: "Add",
    cancel: "Cancel",
    remove: "Remove habit",
    removeConfirm: "Remove “{title}”? Your history is kept.",
    removeYes: "Remove",
  },

  checkin: {
    heading: "Today's recap",
    body: "Thirty seconds. That's all.",
    moodQ: "How was it?",
    moodGood: "Good",
    moodOk: "So-so",
    moodHard: "Hard",
    noteQ: "Anything worth remembering?",
    notePlaceholder: "What worked, what didn't, what got in the way",
    save: "Save",
    saved: "Saved. See you tomorrow.",
    edit: "Edit",
    todayDone: "You've recapped today",
    aiNote: "In phase 3 this becomes a real conversation that remembers you and adjusts tomorrow. For now it just saves on your device.",
  },

  progress: {
    heading: "Progress",
    weighTitle: "Weight",
    weighBody: "Once a week is enough. A daily number jumps around and misleads.",
    weighPlaceholder: "kg",
    weighSave: "Save weight",
    weighEmpty: "No weight logged yet.",
    latest: "Latest",
    change: "Since the start",
    trendTitle: "Trend",
    trendNeedMore: "Two weigh-ins are needed before a trend means anything.",
    consistencyTitle: "Consistency this week",
    consistencyValue: "{percent}%",
    consistencyEmpty: "Appears here as soon as you have a habit.",
    checkinsTitle: "Days recapped",
    checkinsValue: "{count} days",
  },

  profile: {
    heading: "Profile",
    nameTitle: "Name",
    namePlaceholder: "Your name",
    goalTitle: "Goal weight",
    goalPlaceholder: "kg",
    languageTitle: "Language",
    languageNote: "Switching language restarts the app to change writing direction.",
    saved: "Saved",
    dangerTitle: "Delete all data",
    dangerBody: "Erases habits, weigh-ins and recaps from this device. No recovery.",
    dangerCta: "Delete everything",
    dangerConfirm: "Delete all data? This cannot be undone.",
    dangerYes: "Delete",
    localNote: "Everything is stored on this device only for now. A cloud account arrives in phase 1.",
  },

  common: {
    cancel: "Cancel",
    restartNeeded: "Restart required",
    restartBody: "Close and reopen the app to apply the new writing direction.",
    ok: "Got it",
  },
};
