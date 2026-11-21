# EasyGuide: step-by-step tech help for seniors

A PWA that helps older adults (built around a visiting business lecturer) use **apps and websites**: Zoom, Teams, Google Meet, PowerPoint, Moodle, Google Classroom, online banking, government sites, plain web browsing.

They ask by **voice or typing**, or **snap a screenshot / photo of their screen**. EasyGuide replies with **one big step at a time**, can **read it aloud**, and warns about **scams**.

## Features

- Voice question (Web Speech API) and read-aloud (speech synthesis)
- Screenshot or photo upload; paste with Ctrl+V on desktop. The AI points to the exact button it can see
- Works for **any app or website**: pick a chip, or type a website address / app name
- One step per screen, progress dots, "See all steps", Print (a take-home cheat sheet)
- "I'm still stuck" keeps the conversation, so follow-ups get *different* steps
- Scam and phishing warnings built into the AI instructions (OTP/TAC codes, look-alike addresses, fake bank calls)
- UI in English, Bahasa Malaysia, 中文, தமிழ். The AI answers in the chosen language
- Text size A− / A+, big buttons, high contrast
- 6 **built-in guides** that work offline with no AI (share screen, record, mute, bigger text, safe website, open website)
- Installable PWA with service worker

## Run it locally (2 minutes)

Needs Node 18+ (no npm install required).

```bash
cp .env.example .env        # then paste your Anthropic API key into .env
node dev-server.js
# open http://localhost:3000
```

Without a key, the built-in Quick help still works; AI answers need the key.

## Deploy so judges (and the lecturer's phone) can open a link

PWA install, microphone and camera all need **HTTPS**, so testing on a phone means deploying.

```bash
npm i -g vercel
vercel            # follow the prompts in this folder
```

Then in the Vercel dashboard: **Project → Settings → Environment Variables → add `ANTHROPIC_API_KEY`** (Production), and redeploy with `vercel --prod`.
Your key stays on the server. The browser only talks to `/api/chat`.

Optional env vars: `CLAUDE_MODEL` (default `claude-sonnet-5-5`), `RATE_LIMIT` (requests per IP per 10 min, default 40).

### Using a different AI provider (e.g. ILMU)

The backend can talk to any OpenAI-compatible `chat/completions` API. Set these instead of `ANTHROPIC_API_KEY`, in `.env` locally or in Vercel's Environment Variables:

```
LLM_PROVIDER=openai
LLM_BASE_URL=https://your-provider.example/v1
LLM_API_KEY=...
LLM_MODEL=model-name-from-your-provider
LLM_VISION=false      # only if the model cannot read images
```

Check your provider's docs for the exact base URL and model name. If the model cannot read images, set `LLM_VISION=false`: screenshots are then skipped and the AI asks the person to describe their screen, so the screenshot demo will not work. Remove `LLM_PROVIDER` to go back to Claude.

## 90-second demo

1. Open the app on a phone. Tap the **language** to switch to BM or 中文 (judges notice).
2. Pick **Zoom**, tap the mic, ask: "How do I record the class?" The AI answers in big steps. Tap **Read aloud**.
3. Open a real Zoom window (or a university website), tap **Add a screenshot**, photograph the screen: "I'm lost." It names the exact button.
4. Pick **A website**, type a bank address, and ask "Is it safe to enter my password here?" Show the scam warning.
5. Tap **Install app** to show it on the home screen.
6. Close with the lecturer's own story: "We built this because Prof. ___ told us ___."

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole front end (UI, voice, screenshots, languages, built-in guides) |
| `api/chat.js` | Serverless proxy to the Claude API; holds the system prompt, safety rules, rate limit |
| `sw.js`, `manifest.json`, `icon-*.png` | PWA install and offline shell |
| `dev-server.js` | Local server (no dependencies) |
| `vercel.json`, `package.json` | Deployment config |

## Customize

- **Add built-in guides**: add an entry to the `QUICK` array in `index.html` (label in 4 languages, steps, optional tip/warning).
- **Change AI behaviour**: edit `SYSTEM` in `api/chat.js`, for example add the specific platforms your lecturer's universities use.
- **Add a language**: add to `I18N` and `LANGS` in `index.html`, plus an `<option>` in the language select.

## Honest limits

- The AI **cannot open or browse websites**. For a website it works from what the person types and from screenshots. That is why the screenshot flow matters.
- Menus change between app versions. The AI is told to say "look for something like…" when unsure; the built-in guides are written the same way. **Check your top 3 demo flows on the real apps before presenting.**
- Voice input uses the browser's speech recognition: best on Chrome/Android; patchy on iPhone Safari and Firefox. Typing always works. Test on the lecturer's own device early.
- The rate limiter is in-memory and best-effort. For a real launch, add proper auth and a durable limiter.
- Screenshots go to the Claude API to answer the question and are not stored by this app. Tell users not to include passwords or bank details in photos.
