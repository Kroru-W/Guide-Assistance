# EasyGuide

EasyGuide helps older adults use apps and websites one step at a time. Ask a question by typing or speaking, or attach a screenshot to show what you see. Guides can be read aloud, viewed one step at a time, or printed.

## Run locally

You’ll need Node.js 18 or newer. The app has no npm dependencies to install.

```sh
git clone https://github.com/Kroru-W/Guide-Assistance.git
cd Guide-Assistance/easyguide
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Try **Quick help** for built-in guides on tasks such as sharing your screen, recording a class, and checking a suspicious website. Quick Help works without an API key and is available offline after the app has loaded and cached its files.

### Enable AI answers

For local development, create a file named `.env` inside `easyguide/`. Add your Anthropic API key and restart the dev server.

```dotenv
ANTHROPIC_API_KEY=
```

`CLAUDE_MODEL` overrides the default model. `RATE_LIMIT` sets the per-IP request limit per 10 minutes and defaults to 40. Keep `.env` out of Git. For a [custom chat provider](#custom-chat-provider), use its credentials instead.

### Custom chat provider

The backend also supports OpenAI-compatible Chat Completions endpoints. Use the URL, key, and model ID supplied by your provider.

```dotenv
LLM_PROVIDER=openai
LLM_BASE_URL=https://your-provider.example/v1
LLM_API_KEY=
LLM_MODEL=
```

Set `LLM_VISION=false` for a text-only model. The server then omits screenshot data and asks the model to have the user describe their screen.

## What you can do

- Get help with tools such as Zoom, Teams, Google Meet, PowerPoint, and Moodle.
- Use English, Bahasa Malaysia, Chinese, or Tamil in the app interface and AI answers.
- Enlarge the text, listen to steps, and ask a follow-up with **I’m still stuck**.
- Use built-in guidance for common tasks or install the app from a compatible browser.

The AI works from your question and any screenshot you attach. It cannot open the website for you. Voice input and installation depend on the browser. Avoid including passwords, bank details, or one-time codes in anything you send to an AI provider.

## Repository layout

| File | Purpose |
| --- | --- |
| [`easyguide/index.html`](easyguide/index.html) | App interface, built-in guides, languages, voice, and screenshot handling |
| [`easyguide/api/chat.js`](easyguide/api/chat.js) | Server-side AI requests and guide instructions |
| [`easyguide/dev-server.js`](easyguide/dev-server.js) | Local web server used by `npm run dev` |
| [`easyguide/manifest.json`](easyguide/manifest.json) and [`easyguide/sw.js`](easyguide/sw.js) | App installation and offline caching |
| [`easyguide/vercel.json`](easyguide/vercel.json) | Vercel function configuration |

## Deploy to Vercel

Import the GitHub repository in Vercel and choose `easyguide` as the project’s Root Directory. Add `ANTHROPIC_API_KEY` or the custom provider variables in the Vercel project’s environment settings, then deploy. Use the HTTPS deployment URL when testing on a phone.
