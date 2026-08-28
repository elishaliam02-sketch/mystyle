import { supportEn } from "./content.en";
import { supportHe } from "./content.he";
import type { SupportCategory, SupportContent, SupportLibrary } from "./types";

const LIBRARIES: Record<string, SupportLibrary> = { he: supportHe, en: supportEn };

/**
 * Words that place a habit in a category, in both languages. Hebrew is matched
 * on substrings because prefixes (ל־, ב־, ה־) and suffixes attach to the word
 * itself, so "להליכה" has to match "הליכ".
 */
const KEYWORDS: { category: SupportCategory; words: string[] }[] = [
  { category: "snacking", words: ["נשנוש", "לנשנש", "חטיף", "חטיפים", "במבה", "שוקולד", "מתוק", "קינוח", "נשבר", "פיצוח", "snack", "crisps", "sweets", "chocolate", "dessert", "crav"] },
  { category: "cleanEating", words: ["נקי", "נקייה", "בריא", "ירק", "ירקות", "פרי", "פירות", "סוכר", "מטוגן", "ג׳אנק", "ג'אנק", "מעובד", "סלט", "קולה", "clean", "healthy", "veg", "salad", "sugar", "fried", "junk", "processed", "fruit"] },
  { category: "portions", words: ["כמות", "כמויות", "מנה", "תוספת", "צלחת", "לאכול פחות", "פחות אוכל", "לאט", "portion", "second helping", "smaller plate", "eat less", "slowly"] },
  { category: "water", words: ["מים", "כוס", "לשתות", "שתייה", "water", "glass", "drink", "hydrat"] },
  { category: "movement", words: ["הליכ", "ללכת", "לצעוד", "צעד", "ריצה", "לרוץ", "כושר", "אימון", "מדרגות", "לזוז", "תנועה", "אופניים", "שחייה", "walk", "run", "gym", "workout", "stairs", "step", "move", "cycl", "swim", "exercis"] },
  { category: "sleep", words: ["לישון", "שינה", "מיטה", "להירדם", "לקום מוקדם", "sleep", "bed", "asleep", "nap", "wake up early"] },
  { category: "screens", words: ["מסך", "מסכים", "טלפון", "טיקטוק", "אינסטגרם", "סקרול", "screen", "phone", "tiktok", "instagram", "scroll"] },
  { category: "mealStructure", words: ["ארוח", "ארוחת בוקר", "ארוחת צהריים", "ארוחת ערב", "לדלג", "להכין אוכל", "לבשל", "מסודר", "שעות קבועות", "meal", "breakfast", "lunch", "dinner", "skip", "cook", "meal prep"] },
];

/**
 * Reads what the user wrote and picks the world it belongs to. Every category
 * is scored — matched keywords add their length, so longer (more specific)
 * words weigh more — and the best score wins. First-match ordering was wrong
 * here: one generic word could shadow a habit's real subject.
 */
export function detectCategory(title: string): SupportCategory {
  const text = title.toLowerCase();
  let best: SupportCategory = "general";
  let bestScore = 0;
  for (const { category, words } of KEYWORDS) {
    let score = 0;
    for (const w of words) {
      if (text.includes(w.toLowerCase())) score += w.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }
  return best;
}

export function getSupport(category: SupportCategory, locale: string): SupportContent {
  const library = LIBRARIES[locale] ?? supportEn;
  return library[category];
}

export type { SupportCategory, SupportContent };
