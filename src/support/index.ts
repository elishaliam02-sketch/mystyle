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
  // Ordered most specific first: "לאכול נקי" must land on cleanEating, not on
  // mealStructure, even though both would match the word "לאכול".
  { category: "snacking", words: ["נשנוש", "לנשנש", "חטיף", "חטיפים", "במבה", "שוקולד", "מתוק", "נשבר", "פיצוח", "snack", "crisps", "sweets", "chocolate", "crav"] },
  { category: "cleanEating", words: ["נקי", "נקייה", "בריא", "ירק", "ירקות", "פרי", "פירות", "סוכר", "מטוגן", "ג׳אנק", "ג'אנק", "מעובד", "סלט", "clean", "healthy", "veg", "salad", "sugar", "fried", "junk", "processed", "fruit"] },
  { category: "portions", words: ["כמות", "כמויות", "מנה", "תוספת", "צלחת", "פחות לאכול", "portion", "second helping", "plate size", "smaller plate"] },
  { category: "water", words: ["מים", "כוס", "לשתות", "שתייה", "water", "glass", "drink", "hydrat"] },
  { category: "movement", words: ["הליכ", "ללכת", "לצעוד", "צעד", "ריצה", "לרוץ", "כושר", "אימון", "מדרגות", "לזוז", "תנועה", "אופניים", "שחייה", "walk", "run", "gym", "workout", "stairs", "step", "move", "cycl", "swim", "exercis"] },
  { category: "sleep", words: ["לישון", "שינה", "מיטה", "להירדם", "sleep", "bed", "asleep", "nap"] },
  { category: "screens", words: ["מסך", "מסכים", "טלפון", "טיקטוק", "אינסטגרם", "סקרול", "screen", "phone", "tiktok", "instagram", "scroll"] },
  { category: "mealStructure", words: ["ארוח", "לאכול", "בוקר", "צהריים", "ערב", "לדלג", "להכין אוכל", "meal", "breakfast", "lunch", "dinner", "eat", "skip"] },
];

/** Reads what the user wrote and picks the world it belongs to. */
export function detectCategory(title: string): SupportCategory {
  const text = title.toLowerCase();
  for (const { category, words } of KEYWORDS) {
    if (words.some((w) => text.includes(w.toLowerCase()))) return category;
  }
  return "general";
}

export function getSupport(category: SupportCategory, locale: string): SupportContent {
  const library = LIBRARIES[locale] ?? supportEn;
  return library[category];
}

export type { SupportCategory, SupportContent };
