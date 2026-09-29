/**
 * What changed in the latest update, told once.
 *
 * Updates arrive silently over the air, so without this a person opens the app
 * and has no way to know the workout now asks for their level or that the
 * photos are back. The Today screen shows this card until it is dismissed;
 * bumping `id` shows the next one. Pure data — the card is WhatsNew.tsx.
 */
export type News = { id: string; he: string[]; en: string[] };

export const NEWS: News = {
  id: "2026-09-29",
  he: [
    "אימון כמו ב-Hevy: בוחרים איזה יום עושים, לוחצים \"התחל אימון\" — והשעון רץ. רואים סטים ונפח בזמן אמת, ובסוף מקבלים סיכום עם זמן, נפח, שיאים אישיים וקלוריות.",
    "היסטוריית אימונים: כל אימון נשמר עם כמה זמן לקח וכמה הרמת.",
    "הקלוריות דינמיות: אימון וצעדים מעל 5,000 מוסיפים ליעד של היום, והיעד השבועי ממשיך להתכוונן לפי השקילות — בחיטוב ובמסה.",
    "צילום ארוחה עובד עכשיו גם בגרסאות קודמות של האפליקציה, בלי להתקין מחדש ובלי קריסה.",
  ],
  en: [
    "Workouts like Hevy: pick which day you're doing, tap \"Start workout\" — and the clock runs. See sets and volume live, and finish with a summary of time, volume, PRs and calories.",
    "Workout history: every session is saved with how long it took and how much you lifted.",
    "Dynamic calories: workouts and steps above 5,000 add to today's target, and the weekly target keeps adjusting to your weigh-ins — on a cut and on a bulk.",
    "Meal photos now work on older versions of the app too — no reinstall, no crash.",
  ],
};

/** Whether the card should show, given the id the person last dismissed. */
export function newsUnseen(seenId: string | null, news: News = NEWS): boolean {
  return seenId !== news.id;
}
