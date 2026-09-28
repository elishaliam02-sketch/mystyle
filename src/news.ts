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
  id: "2026-09-28",
  he: [
    "קלוריות היום בראש המסך — בהיום, במטבח ובמחשבון. כל מה שנרשם, מכל מקום, נכנס לאותה ספירה ורואים אותה עולה.",
    "היעד היומי חכם: כל שבוע הוא מתעדכן לבד לפי השקילות שלך — גם בחיטוב וגם במסה. יורד לאט מדי? היעד יורד קצת. עולה מהר מדי? הוא מתכוונן.",
    "המחשבון: מוסיפים אוכל, רואים מיד כמה יישאר, ולוחצים \"הוסף ליומן\" — הכפתור תמיד בהישג יד.",
    "ספר המתכונים נפתח מיד והגלילה חלקה: 137 מתכונים עם הוראות הכנה, טיימר לכל שלב ותמונה לכל מנה.",
    "צילום ארוחה: מזהה את המנה בטלפון, בוחרים כמה אכלת — והקלוריות נכנסות ליום.",
    "האפליקציה מתעדכנת לבד — כשפותחים אותה או חוזרים אליה.",
  ],
  en: [
    "Today's calories lead the screen — on Today, in the kitchen and in the calculator. Whatever is logged, wherever, lands in one total you see climb.",
    "A smart daily target: every week it adjusts itself from your weigh-ins — on a cut and on a bulk. Losing too slowly? It comes down a little. Gaining too fast? It adjusts.",
    "The calculator: add food, see at once what will be left, and tap \"Add to today\" — the button is always in reach.",
    "The recipe book opens instantly and scrolls smoothly: 137 recipes with methods, a timer per step and a photo of every dish.",
    "Meal photos: the phone recognises the dish, you pick how much — and the calories go into the day.",
    "The app updates itself — when you open it or come back to it.",
  ],
};

/** Whether the card should show, given the id the person last dismissed. */
export function newsUnseen(seenId: string | null, news: News = NEWS): boolean {
  return seenId !== news.id;
}
