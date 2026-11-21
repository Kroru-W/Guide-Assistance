# EasyGuide

EasyGuide helps older adults use apps and websites with one instruction at a time. It offers guided AI answers, six built-in Quick Help guides, larger text controls, and read-aloud support.

## Use the website

1. Under **What are you using?**, pick an app such as Zoom, Teams, or Google Meet. You can also type a website address or app name.
2. Under **What do you need help with?**, type a question, tap **Speak**, or choose **Add a screenshot or photo**. For example, ask “How do I share my screen in Google Meet?”
3. Select **Help me**. Use **Next** or **Back** to move through the answer, **Read aloud** to hear it, or **See all steps** to view the full guide. Select **I’m still stuck** to ask a follow-up.

Use **Quick help** for screen sharing, recording a class, muting participants, enlarging web text, checking a suspicious website, or opening a website. These guides work without an API key and are available offline after the site caches its files. The interface supports English, Bahasa Malaysia, Simplified Chinese, and Tamil. The built-in guide instructions are in English.

Voice input, read-aloud voices, and app installation depend on the browser. Screenshot help needs a vision-capable provider. Avoid including passwords, bank details, or one-time codes in your questions or screenshots.

## Run locally

You’ll need Node.js 18 or newer. There are no npm dependencies to install.

```sh
git clone https://github.com/Kroru-W/Guide-Assistance.git
cd Guide-Assistance/easyguide
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You can try Quick Help immediately. AI answers require a provider key.

## Configure AI answers

### Gemini in the current local build

For the build that includes `easyguide/.env.example`, copy that template to `.env` inside `easyguide/`. Set a key from [Google AI Studio](https://aistudio.google.com/apikey), then restart `npm run dev`.

```dotenv
LLM_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
```

The current local setup uses Gemini 3.5 Flash-Lite for quicker answers. The Gemini backend defaults to `gemini-3.8-flash` when `GEMINI_MODEL` is unset. Gemini supports questions with screenshots or photos.

### ILMU Chat API

In the same build, select ILMU and add an API key from the [ILMU Console](https://console.ilmu.ai/).

```dotenv
LLM_PROVIDER=ilmu
ILMU_API_KEY=
ILMU_MODEL=nemo-super
```

This ILMU setup handles text questions. If someone attaches an image, EasyGuide omits it from the provider request and asks the model to have them describe the screen.

### Provider setup for GitHub main

The current `main` branch uses the original provider setup. To enable AI there, create `easyguide/.env` with `ANTHROPIC_API_KEY`, then restart the server. To use a custom Chat Completions provider, set `LLM_PROVIDER=openai`, `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`. Set `LLM_VISION=false` for text-only models.

Keep `.env` out of Git. The browser sends requests to `/api/chat`, which uses the provider key on the server.

## Repository layout

| File | Purpose |
| --- | --- |
| [`easyguide/index.html`](easyguide/index.html) | Website interface, built-in guides, languages, voice, and screenshots |
| [`easyguide/api/chat.js`](easyguide/api/chat.js) | Server-side AI requests and guide instructions |
| [`easyguide/dev-server.js`](easyguide/dev-server.js) | Local server started by `npm run dev` |
| [`easyguide/manifest.json`](easyguide/manifest.json) and [`easyguide/sw.js`](easyguide/sw.js) | App installation and offline caching |
| [`easyguide/vercel.json`](easyguide/vercel.json) | Vercel function configuration |

## Deploy to Vercel

Set the project’s Root Directory to `easyguide`. Add the environment variables for the provider supported by the branch you’re deploying, then deploy. Use the HTTPS deployment URL to test on a phone.
