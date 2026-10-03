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
  id: "2026-10-03c",
  he: [
    "חדש: לכל הרגל אפשר לבחור באילו ימים הוא — \"חדר כושר א׳ ג׳ ה׳\". ימי המנוחה לא שוברים את הרצף, לא נספרים כפספוס ולא שולחים תזכורת.",
    "תזכורות חכמות יותר: מה שכבר עשית היום — מים שהשלמת, אימון שרשמת, הרגל שסימנת — לא מזכירים לך. נגיעה בתזכורת פותחת את המסך שלה.",
    "הרגלים: רעיונות מוכנים כשמוסיפים הרגל, אפשר לשנות לכל הרגל את שעת היום ולסמן אותו מהדף שלו. תמונות התקדמות עובדות עכשיו גם בדפדפן.",
    "אימון: שינוי תוכנית כבר לא מוחק את היסטוריית האימונים, וטיימר המנוחה מדויק גם כשהמסך כבוי — ורוטט כשהמנוחה נגמרת. בספר המתכונים: \"מה אפשר להכין עכשיו\" ומועדפים.",
  ],
  en: [
    "New: choose which days each habit is on — \"the gym, Sun/Tue/Thu\". Rest days don't break the streak, don't count as a miss and don't send a reminder.",
    "Smarter reminders: anything already done today — water finished, a workout logged, a habit ticked — is not reminded about. Tapping a reminder opens its screen.",
    "Habits: ready-made ideas when you add one, a time of day you can change for each habit, and a tick right from its page. Progress photos now work in the browser too.",
    "Training: changing your plan no longer erases your workout history, and the rest timer keeps true time with the screen off — and buzzes when rest is over. In the recipe book: \"What I can make now\" and favourites.",
  ],
};

/** Whether the card should show, given the id the person last dismissed. */
export function newsUnseen(seenId: string | null, news: News = NEWS): boolean {
  return seenId !== news.id;
}
