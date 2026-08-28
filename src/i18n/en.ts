import type { he } from "./he";

export const en: typeof he = {
  meta: { name: "English", dir: "ltr" },

  tabs: {
    today: "Today",
    checkin: "Check-in",
    progress: "Progress",
    profile: "Profile",
  },

  today: {
    greetingMorning: "Good morning",
    greetingEvening: "Good evening",
    heading: "Three things today",
    subheading: "No more than that. If one doesn't happen, we'll talk tonight.",
    tasks: {
      breakfast: "Breakfast before {time}",
      walk: "Walk for {minutes} minutes",
      sleep: "Asleep before {time}",
    },
    doneCount: "{done} of {total} done",
    stubNote: "The routine is fixed for now. From phase 3 it is built from your check-in.",
  },

  checkin: {
    heading: "Evening check-in",
    subheading: "Four questions. Ninety seconds. That's all today asks of you.",
    sampleTitle: "How it will feel",
    q1: "How was today? One line.",
    a1: "Fine until four, then I ate half a bag of crisps",
    q2: "Did the midday walk happen?",
    a2: "Yes, 25 minutes even",
    q3: "Good. That's the third time 4pm has caught you. Tomorrow I'll put something to eat before it, not after.",
    inputPlaceholder: "The conversation opens in phase 3",
    stubNote: "The engine connects in phase 3 of the roadmap.",
  },

  progress: {
    heading: "Progress",
    subheading: "Weigh in once a week. A daily number misleads more than it helps.",
    weighInTitle: "This week's weigh-in",
    weighInCta: "Log weight",
    trendTitle: "Trend — 8 weeks",
    trendNote: "The chart shows a rolling average, not a single reading.",
    streakTitle: "Evening check-ins",
    streakValue: "{days} of 7 days",
    stubNote: "Sample data is replaced with real data in phase 2.",
  },

  profile: {
    heading: "Profile",
    languageTitle: "Language",
    languageNote: "Switching language restarts the app to change writing direction.",
    accountTitle: "Account",
    accountStub: "Sign in with Apple and Google — phase 1",
    notificationsTitle: "Notifications",
    notificationsStub: "Timing engine — phase 4",
    dangerTitle: "Delete account",
    dangerStub: "Erases everything, no recovery — phase 4",
  },

  common: {
    phase: "Phase",
    comingSoon: "In progress",
    restartNeeded: "Restart required",
    restartBody: "Close and reopen the app to apply the new writing direction.",
    ok: "Got it",
  },
};
