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
  id: "2026-10-02",
  he: [
    "התפריט היומי מתחלף באמת: כל ארוחה עוברת על כל המנות שמתאימות לך לפני שמנה חוזרת. גם עם מעט מצרכים — מנה שחסר לה מוצר אחד מסומנת, ובלחיצה הוא נכנס לרשימת המטבח.",
    "חדש בדף היום — \"עכשיו\": מה הכי שווה לעשות בשעה הזו. כוס מים כשאתה מאחור, ההרגל של החלק הזה ביום, שקילה שבועית, אימון כשהשבוע צריך אותו וסיכום ערב — עם כפתור שעושה את זה במקום.",
  ],
  en: [
    "The daily menu really changes now: each meal goes through every dish that suits you before one comes back. Even with a few groceries — a dish one thing short is marked, and one tap adds it to your kitchen list.",
    "New on Today — \"Right now\": what's most worth doing at this hour. A cup of water when you're behind, this part of the day's habit, the weekly weigh-in, a workout when the week needs one and the evening recap — with a button that does it on the spot.",
  ],
};

/** Whether the card should show, given the id the person last dismissed. */
export function newsUnseen(seenId: string | null, news: News = NEWS): boolean {
  return seenId !== news.id;
}
