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
  id: "2026-09-25",
  he: [
    "חדש בהתקדמות: \"מסע ההתקדמות\" — תמונה בשבוע, וליד כל תמונה הממוצע השבועי של המשקל. לפני מול עכשיו, כמה ירדת ובאיזה קצב.",
    "הממוצע השבועי מראה עכשיו את המספר של כל שבוע ואת התאריך שלו.",
    "המאמן עונה על \"מותר לי פיצה?\", \"מה לאכול בערב?\", \"אני רעב\" ו\"כמה זמן עד היעד\" — ורושם כמויות נכון (2 ביצים = 2 ביצים).",
    "המטבח בונה מנה הגיונית אחת, ושמן, מלח ותבלינים נחשבים כמשהו שיש בבית.",
    "באימון פתוח רק היום הבא — המסך קצר ונקי.",
  ],
  en: [
    "New in Progress: the progress journey — a photo a week, each beside the week's average weight. Before vs now, how much and how fast.",
    "The weekly average now shows each week's number and date.",
    "The coach answers \"can I eat pizza?\", \"what should I eat tonight?\", \"I'm hungry\" and \"how long to my goal\" — and logs amounts correctly.",
    "The kitchen builds one coherent plate, and oil, salt and spices count as already at home.",
    "Workout shows only the next day open — a shorter, cleaner screen.",
  ],
};

/** Whether the card should show, given the id the person last dismissed. */
export function newsUnseen(seenId: string | null, news: News = NEWS): boolean {
  return seenId !== news.id;
}
