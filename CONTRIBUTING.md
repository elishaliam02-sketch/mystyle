# APEX — dev setup

הקוד של אפליקציית APEX. איך מריצים ומפתחים:

## הרצה מהירה (5 דקות)
צריך **Node.js 20+** מותקן, ואת אפליקציית **Expo Go** בטלפון.

```bash
git clone https://github.com/elishaliam02-sketch/mystyle
cd mystyle
npm install
npx expo start
```

סורקים את ה‑QR עם Expo Go → האפליקציה רצה על הטלפון. כל שינוי בקוד מתעדכן מיד.

## בדיקות (הכל צריך להישאר ירוק)
```bash
npx tsc --noEmit          # בדיקת טיפוסים
node scripts/e2e.mjs      # בדיקות קצה-לקצה (צריך: npx expo export --platform web קודם)
# בדיקות יחידה:
node scripts/run-kitchen-tests.mjs   # וכן run-workout / run-coach / run-health ...
```

## עבודה משותפת (Git)
- כל שינוי ב‑branch משלך: `git checkout -b my-feature`
- דוחפים: `git push -u origin my-feature`
- פותחים **Pull Request** ב‑GitHub. הבעלים מאשר וממזג ל‑main.
- אל תדחוף ישירות ל‑main.

## מבנה
- `app/` — המסכים (expo-router). כל קובץ = מסך/טאב.
- `src/` — המנועים הטהורים (kitchen, workout, coach, health, cloud) + רכיבי UI ב‑`src/components`, עיצוב ב‑`src/theme`, תרגומים ב‑`src/i18n`.
- `scripts/` — מריצי הבדיקות.
- `supabase/` — סכימת השרת + הפונקציה של ה‑AI.

## חשוב — סודות
אין מפתחות סודיים בקוד. מפתח Gemini יושב ב‑Supabase Secrets; טוקן EAS ב‑GitHub Secrets. אל תוסיף אף מפתח סודי לקוד.
