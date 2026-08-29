# להריץ ולעדכן את MyStyle

מדריך צעד אחר צעד. אם שלב נכשל — תעתיק לי את הודעת השגיאה במלואה.

## הפקודה שתשתמש בה הכי הרבה

אחרי שינוי בקוד, כדי לשלוח אותו לטלפון בלי לבנות מחדש:

```bash
cd $HOME\Documents\mystyle   # Windows
git pull
npx eas-cli update --branch preview --message "מה השתנה"
```

סגור ופתח את האפליקציה בטלפון — העדכון שם.

**מתי זה לא מספיק:** שינוי באייקון, במסך הפתיחה, או הוספת יכולת שדורשת קוד נייטיב (מצלמה, בלוטות'). אז צריך בנייה מלאה:

```bash
npx eas-cli build --platform android --profile preview
```


## פעם אחת בלבד: התקנת הכלים

### 1. Homebrew
מנהל החבילות של מק. פתח את אפליקציית **Terminal** והדבק:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

בסוף ההתקנה הוא ידפיס שתי שורות שמתחילות ב-`echo`. **תריץ אותן** — בלעדיהן המחשב לא ימצא את `brew`.
לבדיקה: `brew --version` צריך להדפיס מספר גרסה.

### 2. Node
```bash
brew install node
```
לבדיקה: `node -v` צריך להדפיס `v22` ומעלה.

### 3. Git
```bash
brew install git
```

### 4. Xcode — רק כדי להריץ סימולטור אייפון
מה-**App Store**, חפש `Xcode` והתקן. זו הורדה גדולה (כמה עשרות ג'יגה) — תתחיל אותה ותעשה משהו אחר.
אחרי ההתקנה, פתח את Xcode פעם אחת, אשר את תנאי השימוש, והמתן שיסיים להתקין רכיבים. ואז:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -runFirstLaunch
```

> **אפשר גם בלי Xcode.** התקן את האפליקציה **Expo Go** מה-App Store בטלפון שלך, וסרוק את הקוד שמופיע במסך כשמריצים `npm start`. זה הכי מהיר להתחלה.

## להריץ את הפרויקט

```bash
git clone https://github.com/elishaliam02-sketch/mystyle.git
cd mystyle
npm install
npm start
```

במסך שנפתח:

| מקש | מה קורה |
|---|---|
| `i` | פותח סימולטור אייפון (דורש Xcode) |
| `a` | פותח אמולטור אנדרואיד |
| `w` | פותח בדפדפן — הכי מהיר לבדיקה חטופה |
| `r` | טוען מחדש |
| `Ctrl+C` | עוצר |

לבדיקה בטלפון האמיתי: התקן **Expo Go**, ודא שהטלפון והמק על אותה רשת Wi-Fi, וסרוק את הקוד.

## מה אמור לקרות

ארבעה טאבים למטה: **היום · שיחה · התקדמות · פרופיל**.
אם הטלפון שלך בעברית — הכול בעברית ומיושר לימין. באנגלית — הפוך.
בטאב **פרופיל** אפשר להחליף שפה; האפליקציה תבקש הפעלה מחדש כדי להחליף כיוון כתיבה. זה מכוון, לא באג.

מסגרות בצבע חרדל על המסך מסמנות חלקים שעוד לא נבנו, עם מספר השלב במפת הדרך שבו הם ייבנו.

## תקלות נפוצות

**`command not found: brew`** — לא הרצת את שורות ה-`echo` שההתקנה הדפיסה. סגור ופתח את Terminal ונסה שוב.

**`npm install` נכשל** — מחק והתקן מחדש:
```bash
rm -rf node_modules package-lock.json && npm install
```

**המסך לבן או תקוע** — נקה את המטמון של המהדר:
```bash
npx expo start --clear
```

**Expo Go לא מוצא את המק** — כמעט תמיד רשתות שונות, או רשת אורחים שחוסמת. חבר את שניהם לאותו Wi-Fi, או הרץ `npx expo start --tunnel`.

## מה עוד תצטרך לפתוח (לא עכשיו — לפי מפת הדרך)

| שירות | מתי | עלות |
|---|---|---|
| [Expo](https://expo.dev) | שלב 0 | חינם |
| [Supabase](https://supabase.com) | שלב 1 | חינם בהתחלה |
| [Anthropic Console](https://console.anthropic.com) | שלב 3 | לפי שימוש |
| [Apple Developer](https://developer.apple.com/programs/) | שלב 5 | $99 לשנה |
| [Google Play Console](https://play.google.com/console/signup) | שלב 5 | $25 חד-פעמי |
