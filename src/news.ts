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
  id: "2026-09-24",
  he: [
    "תמונות אמיתיות לכל תרגיל — ובהסבר, תמונת התחלה ותמונת סיום.",
    "תוכנית אימון לפי רמה: מתחיל, בינוני או מתקדם (\"שנה תוכנית\").",
    "צילום אמיתי לכל ארוחה, גם ל\"המנה שלך\".",
    "עוזר חדש: \"צריך עזרה?\" עונה איפה הכול ולוקח אותך לשם.",
    "מחשבון הקלוריות מראה גם פחמימות ושומן.",
  ],
  en: [
    "A real photo for every exercise — and start and finish frames in its explanation.",
    "Workout plans by level: beginner, intermediate or advanced (\"Change plan\").",
    "A real photo for every meal, your plate included.",
    "New guide: \"Need help?\" answers where everything is and takes you there.",
    "The calorie calculator now shows carbs and fat too.",
  ],
};

/** Whether the card should show, given the id the person last dismissed. */
export function newsUnseen(seenId: string | null, news: News = NEWS): boolean {
  return seenId !== news.id;
}
