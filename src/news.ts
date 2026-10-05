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
  id: "2026-10-05",
  he: [
    "האפליקציה נפתחת ועובדת גם בלי אינטרנט — במטוס, במרתף או בקליטה חלשה. כל מה שרושמים נשמר במכשיר.",
    "תזכורות בלחיצה אחת מדף הבית. באייפון: מוסיפים את האפליקציה למסך הבית (שיתוף ← \"הוסף למסך הבית\"), ומפעילים.",
    "לכל הרגל אפשר לבחור באילו ימים הוא — ימי מנוחה לא שוברים את הרצף. ויומן האוכל מגיע עד שבוע אחורה.",
  ],
  en: [
    "The app opens and works with no internet — on a plane, in a basement, on a weak signal. Everything you log stays on the device.",
    "Reminders in one tap from the home screen. On iPhone: add the app to the home screen (Share → \"Add to Home Screen\"), then turn them on.",
    "Choose the days each habit is on — rest days don't break the streak. And the food diary reaches back a week.",
  ],
};

/** Whether the card should show, given the id the person last dismissed. */
export function newsUnseen(seenId: string | null, news: News = NEWS): boolean {
  return seenId !== news.id;
}
