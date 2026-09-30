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
  id: "2026-09-30",
  he: [
    "צילום אוכל לא קורס יותר: התמונה נקראת בגודל קטן בלי לטעון את כולה לזיכרון, ואם הטלפון סגר את האפליקציה בזמן שהמצלמה פתוחה — היא חוזרת ישר לזיהוי עם התמונה.",
    "כל מנה שהצילום מזהה נספרת עכשיו — גם פאד תאי, חצ׳אפורי או פו — עם הערכה לפי סוג המנה.",
    "התפריט שלך להיום: ארוחת בוקר, צהריים, ערב ונשנוש — רק ממה שיש לך בבית, בגודל שמתאים ליעד של היום. אפשר להחליף מנה, לשדרג אותה עם מה שיש, או להוסיף מתכון מהספר.",
    "המאמן באימון: ליד כל תרגיל — כמה להרים היום ולמה (מוסיפים משקל, עוד חזרה, או מורידים כשנתקעים), וסיכום שבועי של האימונים.",
  ],
  en: [
    "Meal photos no longer crash the app: the picture is read small without loading all of it into memory, and if the phone closed the app while the camera was open, it comes straight back to the scanner with the photo.",
    "Every dish the camera recognises can now be counted — pad thai, khachapuri or pho too — with an estimate by the kind of dish.",
    "Your menu for today: breakfast, lunch, dinner and a snack — only from what you have at home, sized to today's target. Swap a meal, upgrade it with what you have, or add a recipe from the book.",
    "The workout coach: beside every exercise, what to lift today and why (add weight, one more rep, or back off when stuck), plus a weekly summary.",
  ],
};

/** Whether the card should show, given the id the person last dismissed. */
export function newsUnseen(seenId: string | null, news: News = NEWS): boolean {
  return seenId !== news.id;
}
