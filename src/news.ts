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
  id: "2026-09-24-c",
  he: [
    "המטבח מכיר עכשיו מעל 300 מאכלים: פלאפל, שווארמה, סביח, בורקס, פיצה, סושי, משקאות, מתוקים, תבלינים ועוד.",
    "\"המנה שלך\" מוצגת בתמונות אמיתיות של המצרכים שלך עצמם, ומשתנה בכל פעם שהרשימה משתנה.",
    "גרמים או יחידות: כפתור בכל מנה, וכל מצרך מראה כמה קלוריות הוא. הסכום תמיד מסתדר.",
    "\"רשום משהו שאכלת\": בוחרים כמות (חצי, מנה, מנה וחצי, 2) או מקלידים גרמים.",
    "כשר, צמחוני וללא גלוטן אפשר לסמן יחד, ו\"בא לי לאכול\" מזהיר כשמאכל לא מתאים.",
  ],
  en: [
    "The kitchen now knows 300+ foods: falafel, shawarma, sabich, bourekas, pizza, sushi, drinks, sweets, spices and more.",
    "\"Your plate\" is shown with real photos of your own ingredients, and changes whenever your list does.",
    "Grams or household units: a switch on every dish, and each ingredient shows its calories. The total always adds up.",
    "\"Log something you ate\": pick an amount (half, one, one and a half, two) or type grams.",
    "Kosher, vegetarian and gluten-free can be combined, and \"I feel like eating\" warns when a food doesn't fit.",
  ],
};

/** Whether the card should show, given the id the person last dismissed. */
export function newsUnseen(seenId: string | null, news: News = NEWS): boolean {
  return seenId !== news.id;
}
