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
  id: "2026-09-24-b",
  he: [
    "תוכנית אימון חדשה לגמרי: נבנית כמו אצל מאמן — תרגיל מרכזי ראשון, ואחריו תרגילי עזר שמתאימים לרמה שלך.",
    "\"תוכנית חדשה\" מחליפה עכשיו תמיד את התרגילים באמת, לפי הרמה והמטרה.",
    "רשימת המקרר מזהה הרבה יותר: רבים, שגיאות כתיב, פרגיות, שניצל, סטייק ועוד.",
    "התמונה של \"המנה שלך\" מתאימה למנה העיקרית (סלמון מקבל סלמון).",
    "מים: אפשר להגדיר גודל כוס משלך (\"משלי\").",
  ],
  en: [
    "A brand-new workout plan: built like a coach's — the main lift first, then accessories that fit your level.",
    "\"New plan\" now always really changes the exercises, by level and goal.",
    "The fridge list recognises far more: plurals, typos, and more foods.",
    "\"Your plate\" wears a photo of its main ingredient (salmon gets salmon).",
    "Water: set your own cup size (\"Mine\").",
  ],
};

/** Whether the card should show, given the id the person last dismissed. */
export function newsUnseen(seenId: string | null, news: News = NEWS): boolean {
  return seenId !== news.id;
}
