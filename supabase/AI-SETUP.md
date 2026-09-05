# Switching on the AI (free)

The app works fully without this. Turning it on adds two things:
**calorie counting from a meal photo**, and a coach that answers in free text
instead of from the built-in answers.

It costs nothing on Google's free tier. Your key never goes into the app — it
lives on the server, so nobody can pull it out of the APK.

## 1. Get a Gemini key (free, no credit card)

1. Open <https://aistudio.google.com/apikey>
2. Sign in with a Google account.
3. **Create API key** → copy it.

## 2. Put the key on the server (never in the app)

In the Supabase dashboard for this project:

1. **Edge Functions** → **Secrets**
2. Add: name `GEMINI_API_KEY`, value = the key you copied.

## 3. Deploy the function

The function's code is in `supabase/functions/ai/index.ts`.

- From the dashboard: **Edge Functions** → **Deploy a new function** → name it
  exactly `ai` → paste the file's contents.
- Or with the CLI: `supabase functions deploy ai`

That's it. The app finds it on its own.

## What you get, and the limits

- Google's free tier is Flash-only and capped per day (roughly a few hundred
  requests). **That cap is shared by everyone using the app**, and a photo costs
  one request — fine for you and a handful of testers, not for thousands.
- When the cap is spent, or there is no signal, the app says so and falls back
  to the on-device coach and the manual food search. Nothing breaks.
- A photo estimate is an estimate: a picture cannot show oil, sauces or the
  weight of what is underneath. The list is always shown before anything is
  written to the diary, so it can be judged and cancelled.
- Meal photos are sent to Google to be read. Progress photos in the Progress
  corner are **not** — those never leave the phone.

## Using Anthropic instead

Set `ANTHROPIC_API_KEY` instead of `GEMINI_API_KEY`. There is no free tier, and
photo reading is disabled on that path.
