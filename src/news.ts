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
  id: "2026-10-03",
  he: [
    "התפריט היומי מתחלף באמת: כל ארוחה עוברת על כל המנות שמתאימות לך לפני שמנה חוזרת. מנה שחסר לה מוצר אחד מסומנת, ובלחיצה הוא נכנס לרשימת המטבח.",
    "תזכורות חכמות יותר: מה שכבר עשית היום — מים שהשלמת, אימון שרשמת, הרגל שסימנת — לא מזכירים לך. נגיעה בתזכורת פותחת את המסך שלה.",
    "הרגלים: רעיונות מוכנים כשמוסיפים הרגל, אפשר לשנות לכל הרגל את שעת היום ולסמן אותו מהדף שלו. תמונות התקדמות עובדות עכשיו גם בדפדפן.",
  ],
  en: [
    "The daily menu really changes now: each meal goes through every dish that suits you before one comes back. A dish one thing short is marked, and one tap adds it to your kitchen list.",
    "Smarter reminders: anything already done today — water finished, a workout logged, a habit ticked — is not reminded about. Tapping a reminder opens its screen.",
    "Habits: ready-made ideas when you add one, a time of day you can change for each habit, and a tick right from its page. Progress photos now work in the browser too.",
  ],
};

/** Whether the card should show, given the id the person last dismissed. */
export function newsUnseen(seenId: string | null, news: News = NEWS): boolean {
  return seenId !== news.id;
}
