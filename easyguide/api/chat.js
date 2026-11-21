'use strict';

/*
 * EasyGuide API proxy (Vercel serverless function).
 * Keeps your API key on the server and keeps the system prompt out of the
 * browser, so the endpoint can't be used as a free general chatbot.
 *
 * Two providers are supported, chosen with LLM_PROVIDER:
 *
 *  1) anthropic (default)
 *       ANTHROPIC_API_KEY   required
 *       CLAUDE_MODEL        optional (default claude-sonnet-5-5)
 *
 *  2) openai  (any OpenAI-compatible "chat/completions" endpoint, e.g. ILMU if it offers one)
 *       LLM_BASE_URL        required, e.g. https://your-provider.example/v1
 *       LLM_API_KEY         required
 *       LLM_MODEL           required, the model name your provider gives you
 *       LLM_VISION          optional, "false" if the model can't read images (default true)
 *
 *  Both:  RATE_LIMIT  requests per IP per 10 minutes (default 40)
 */

const MAX_IMAGE_B64 = 3900000; // Vercel request bodies are limited to ~4.5 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const SYSTEM = `You are EasyGuide, a warm and very patient helper for older adults who are not comfortable with technology. Many of them are university lecturers and teachers who use apps and websites for teaching and daily life: Zoom, Microsoft Teams, Google Meet, PowerPoint, Moodle, Google Classroom, email, WhatsApp, online banking, government and university websites, and ordinary web browsing.

OUTPUT FORMAT
Reply with ONE JSON object and nothing else (no markdown, no code fences):
{"title": string, "steps": string[], "tip": string, "warning": string, "ask": string}
- title: at most 8 words, says what the steps achieve.
- steps: 3 to 8 steps. ONE single action per step. Start each with a verb. Each step under 30 words.
- tip: one short helpful extra, or "".
- warning: a safety warning (see SAFETY), or "".
- ask: only if the question is too unclear to answer. Then steps must be [] and ask must be ONE simple question. Otherwise "".

STYLE
- Plain, short sentences. No jargon. If a technical word is unavoidable, explain it in brackets.
- Never sound condescending. Never say "simply" or "just" or "obviously".
- Tell the person WHERE to look ("at the bottom of the window", "top right corner") and name each button or text exactly as it appears on screen.
- Write every text value in the reply language you are given. If a button label is shown on the person's screen in another language, use that label exactly. Otherwise give the English label in brackets, e.g. "Share Screen".

SCREENSHOTS
- If a screenshot or photo is attached, study it carefully. Base your steps on what you can actually see: colours, positions, labels. Do not mention a button you cannot see.
- If the screenshot does not show the screen needed for the task, say what to open first and ask for a new screenshot in the tip.
- If the picture is blurry or cut off, say so kindly in "ask" and explain how to take a clearer one.

ACCURACY
- Menus and button names change between versions and devices. If you are not certain of an exact label, say "look for something like ..." instead of guessing. Never invent buttons or menu items.
- You cannot browse the internet or open links. For a website you cannot see, give steps that work on most sites and invite the person to add a screenshot so you can point to the exact button.
- If the person says the previous steps did not work, do not repeat them. Ask what they see now or use the new screenshot, and give different steps.

SAFETY (very important - these users are common targets of scams)
- Never ask for, or tell the person to type into this chat, passwords, card numbers, PINs or OTP/TAC codes. If a screenshot shows any, tell them kindly to hide such details next time.
- If the question or screenshot involves paying money, entering a password or bank details, or looks like a scam or phishing (urgent threats, prizes, unknown links, look-alike website addresses, requests for OTP/TAC codes, remote-access apps, someone pretending to be a bank, police or government officer), set "warning" with a clear plain explanation and what to do instead: close the page, type the official address yourself, phone the organisation using the number on their official card or letter, never share OTP/TAC codes, and ask a trusted family member. Otherwise set warning to "".
- Do not give medical, legal or financial advice. Stay on helping them use apps and websites.

If the message is not about using an app, website or device, politely say in "ask" that you can only help with using apps and websites, and ask what they would like to do on their device.`;

// ---- tiny in-memory rate limit (best effort; resets when the function cold-starts) ----
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const max = Number(process.env.RATE_LIMIT || 40);
  const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > max;
}

const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, n);

// ---- request building (Anthropic message format is the internal format) ----
function buildMessages(body) {
  const messages = [];
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  for (const h of history) {
    if (h && (h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string') {
      messages.push({ role: h.role, content: clip(h.text, 3000) });
    }
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();

  const lang = clip(body.language || 'English', 40);
  const tool = clip(body.tool, 80);
  const site = clip(body.site, 200);
  const question = clip(body.question, 1500);

  const context =
    'Reply language: ' + lang + '\n' +
    (tool ? 'App or website the person is using: ' + tool + '\n' : '') +
    (site ? 'Website address or app name they typed: ' + site + '\n' : '') +
    '\nThe person says:\n' + question;

  const content = [];
  const img = body.image;
  if (img && typeof img === 'object' && typeof img.data === 'string' && img.data.length > 0) {
    if (!ALLOWED_IMAGE_TYPES.includes(img.media_type)) return { error: 'That picture type is not supported.' };
    if (img.data.length > MAX_IMAGE_B64) return { error: 'That picture is too large. Please try a smaller one.' };
    content.push({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } });
  }
  content.push({ type: 'text', text: context });
  messages.push({ role: 'user', content });
  return { messages };
}

// Convert to the OpenAI chat format. If the model can't see images, drop them and tell the model.
function toOpenAI(messages, vision) {
  const out = [{ role: 'system', content: SYSTEM }];
  for (const m of messages) {
    if (typeof m.content === 'string') { out.push({ role: m.role, content: m.content }); continue; }
    const parts = [];
    let dropped = false;
    for (const c of m.content) {
      if (c.type === 'image') {
        if (vision) parts.push({ type: 'image_url', image_url: { url: 'data:' + c.source.media_type + ';base64,' + c.source.data } });
        else dropped = true;
      } else if (c.type === 'text') {
        parts.push({ type: 'text', text: c.text });
      }
    }
    if (dropped) {
      parts.push({ type: 'text', text: '(The person attached a screenshot, but you cannot see images. Say so kindly in "ask" and ask them to describe what they see on the screen.)' });
    }
    out.push({ role: m.role, content: parts });
  }
  return out;
}

// ---- providers ----
// LLM_PROVIDER = gemini | ilmu | openai | anthropic (default)
// gemini and ilmu are shortcuts for the "openai" style API with their own variable names.
function getConfig() {
  const provider = String(process.env.LLM_PROVIDER || 'anthropic').toLowerCase().trim();
  const vision = String(process.env.LLM_VISION || 'true').toLowerCase() !== 'false';
  const trim = (u) => String(u || '').trim().replace(/\/+$/, '');
  const val = (v) => String(v || '').trim().replace(/^["']|["']$/g, '');

  if (provider === 'gemini') {
    return {
      provider: 'openai', name: 'gemini', keyVar: 'GEMINI_API_KEY', vision,
      baseUrl: trim(process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai'),
      key: val(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
      model: val(process.env.GEMINI_MODEL) || 'gemini-3.8-flash'
    };
  }
  if (provider === 'ilmu') {
    return {
      provider: 'openai', name: 'ilmu', keyVar: 'ILMU_API_KEY', vision,
      baseUrl: trim(process.env.ILMU_BASE_URL || 'https://api.ilmu.ai/v1'),
      key: val(process.env.ILMU_API_KEY),
      model: val(process.env.ILMU_MODEL)
    };
  }
  if (provider === 'openai') {
    return {
      provider: 'openai', name: 'openai', keyVar: 'LLM_API_KEY', vision,
      baseUrl: trim(process.env.LLM_BASE_URL),
      key: val(process.env.LLM_API_KEY),
      model: val(process.env.LLM_MODEL)
    };
  }
  return { provider: 'anthropic', name: 'anthropic', keyVar: 'ANTHROPIC_API_KEY', key: val(process.env.ANTHROPIC_API_KEY), model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5' };
}

function configError(cfg) {
  if (!cfg.key) return 'LLM_PROVIDER is "' + cfg.name + '" but ' + cfg.keyVar + ' is empty. Put your key in the .env file (same folder as dev-server.js), save it, and restart the server.';
  if (cfg.provider === 'openai' && !cfg.baseUrl) return 'No base URL set for provider "' + cfg.name + '" (LLM_BASE_URL).';
  if (!cfg.model) return 'No model name set for provider "' + cfg.name + '" (check the *_MODEL line in .env).';
  return null;
}

async function callProvider(cfg, messages, signal) {
  if (cfg.provider === 'openai') {
    const url = /\/chat\/completions$/.test(cfg.baseUrl) ? cfg.baseUrl : cfg.baseUrl + '/chat/completions';
    const r = await fetch(url, {
      method: 'POST',
      signal,
      headers: { Authorization: 'Bearer ' + cfg.key, 'content-type': 'application/json' },
      body: JSON.stringify(Object.assign(
        // Thinking models (e.g. Gemini) can spend part of the limit on reasoning, so allow plenty.
        { model: cfg.model, max_tokens: Number(process.env.LLM_MAX_TOKENS || 4000), temperature: 0.3, messages: toOpenAI(messages, cfg.vision) },
        process.env.LLM_REASONING_EFFORT ? { reasoning_effort: process.env.LLM_REASONING_EFFORT } : {}
      ))
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data) { console.error('LLM API error', r.status, JSON.stringify(data)); return null; }
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    let text = msg && msg.content;
    if (Array.isArray(text)) text = text.map((p) => (p && p.text) || '').join('\n');
    return String(text || '').trim();
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: cfg.model, max_tokens: 1200, system: SYSTEM, messages })
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data) { console.error('Anthropic API error', r.status, JSON.stringify(data)); return null; }
  return (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cfg = getConfig();
  const missing = configError(cfg);
  if (missing) { console.error('[EasyGuide] ' + missing); return res.status(500).json({ error: missing }); }

  const body = req.body;
  if (!body || typeof body !== 'object' || !clip(body.question, 1500).trim()) {
    return res.status(400).json({ error: 'Please send a question.' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    (req.socket && req.socket.remoteAddress) || 'unknown';
  if (limited(ip)) return res.status(429).json({ error: 'Too many requests. Please wait a few minutes and try again.' });

  const built = buildMessages(body);
  if (built.error) return res.status(400).json({ error: built.error });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const text = await callProvider(cfg, built.messages, controller.signal);
    if (text === null) return res.status(502).json({ error: 'The AI service had a problem. Please try again.' });
    if (!text) return res.status(502).json({ error: 'The AI service sent an empty answer. Please try again.' });
    return res.status(200).json({ text });
  } catch (err) {
    console.error('Proxy error', err && err.message);
    return res.status(502).json({ error: 'The AI service had a problem. Please try again.' });
  } finally {
    clearTimeout(timer);
  }
};

// exported for tests
module.exports.buildMessages = buildMessages;
module.exports.toOpenAI = toOpenAI;
module.exports.SYSTEM = SYSTEM;
module.exports.getConfig = getConfig;
module.exports.configError = configError;
