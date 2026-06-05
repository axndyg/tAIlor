# tAIlor

A Firefox sidebar extension that tailors your LaTeX resume to a job posting.
Drop in your `.tex` file(s), let it read the job description off the current
tab, and get back a single, Overleaf-ready `.tex` rewritten to foreground the
strengths that matter for that role — without inventing experience or touching
your document's structure.

Live on the [Firefox Add-Ons](https://addons.mozilla.org/en-US/firefox/addon/tailor2/).

---

## ⚠️ Read this first: how model access works

tAIlor calls a large language model to do the rewriting. **It talks to models
over a developer API, using an API key that you provide.** This is the one
thing worth understanding before you start, because it trips people up:

> **A consumer subscription (Claude Pro, ChatGPT Plus, Gemini Advanced) cannot
> be connected to this — or any — third-party app.** Those plans are for the
> provider's own chat website only. They include no API access and issue no API
> key. The API is a separate product on separate, pay-as-you-go billing.

So there is no "log in with my Claude Pro account" option, and there can't be.
What you *can* do falls into three lanes:

| You want… | Use | Cost |
|---|---|---|
| **Zero spend, just works** | OpenRouter **free tier** (GPT-OSS 120B) | Free, rate-limited, lower fidelity |
| **One key for every model** | OpenRouter **paid** (Claude, GPT-4o, Gemini, Llama, Mistral…) | Pay-as-you-go |
| **A specific provider directly** | **Direct API** key (Anthropic, OpenAI, Google, Mistral, Cohere, Groq) | Pay-as-you-go |

**If you specifically want Claude doing the tailoring,** put a few dollars of
credit on an Anthropic API key at
[console.anthropic.com](https://console.anthropic.com) and use the **Direct
API** path. This is separate from (and on top of) a Claude Pro subscription —
but it's cheap: a single resume-sized tailor run is typically **a cent or two**.

Your key is stored locally in `browser.storage.local` and is sent only to the
provider you choose. There is no backend server.

---

## Features

- **LaTeX-native.** Upload one or more `.tex` files. The model rewrites only
  the prose (bullets, summaries, descriptions) and preserves your preamble,
  packages, custom macros, sections, and ordering exactly.
- **Multi-file inlining.** Modular resumes work: `\input{_header}` and
  `\input{sections/education}` are resolved by inlining the matching uploaded
  file, producing one self-contained `.tex` that compiles on its own.
- **Automatic job detection.** A content script reads the current tab's text so
  you don't have to copy-paste the posting. If it can't (PDFs, `about:` pages,
  a tab opened before the extension loaded), a manual paste box appears.
- **One-page / density guidance.** The system prompt pushes for a single page
  and full-width bullets (no orphaned one-to-three-word wrapped lines). See
  *Known limitations* — this is model guidance, not a hard guarantee.
- **Provider + model selector** with sensible curated lists, an API-key field
  with show/hide, light/dark theme, and a download button for the result.
- **State persists** across sessions: API key, uploaded files, theme, provider
  choice, selected model, and your tailor instructions.

## Usage

1. **Choose a provider** (OpenRouter or Direct API) and **a model**.
2. **Paste your API key.** (Free GPT-OSS 120B via OpenRouter still needs a free
   OpenRouter key.)
3. **Upload your resume `.tex` file(s).** For a modular resume, upload the main
   file *and* every file it `\input`s/`\include`s.
4. *(Optional)* Add **Tailor Instructions** (tone, emphasis, constraints).
5. Open the **job posting** in the active tab — tAIlor reads it automatically —
   or paste it into the Job Description box.
6. Click **Tailor Resume.** Progress shows while the model runs.
7. **Download** the result as a `.tex` and open it in Overleaf.

> **PDF resumes** are a planned lower-fidelity fallback (the model reconstructs
> LaTeX from extracted text). The reliable path is `.tex` in, `.tex` out.

## Install / build

This is a Manifest V2 Firefox extension built with Vite +
`vite-plugin-web-extension`.

```bash
npm install
npm run build:xpi      # produces a loadable tailor.xpi
```

Then load it in Firefox:

1. Go to `about:debugging` → **This Firefox**.
2. **Load Temporary Add-on…** and select `tailor.xpi`.
3. Open the sidebar (View → Sidebar, or the sidebar toggle).

> **Why `build:xpi` and not the unpacked `dist/`?** iCloud Drive interferes with
> Firefox's unpacked-extension loader for this project's path, and `npm run dev`
> tries to launch Chromium (which rejects MV2). Building the `.xpi` sidesteps
> both. If a tab was open *before* you loaded the extension, reload it so the
> content script gets injected.

## How it works

Two-agent design, no server — all model calls originate in the background
script:

- **QUERY agent** — a content script reads the active tab's DOM text and returns
  it to the sidebar as the job description. *(Stage A, the raw scrape, is wired;
  an LLM distillation pass — Stage B — is planned.)*
- **CURATE agent** — the background script sends your bundled resume + job
  description + instructions to the chosen model and returns the rewritten
  `.tex`. Its system prompt lives in [`CURATE_c.md`](./CURATE_c.md).

The background script routes every provider through a small adapter layer
(OpenAI-compatible, Anthropic, Google, Cohere) so one code path serves them all.

## Known limitations

- **One-page and bullet-width rules are guidance, not guarantees.** The model
  works on text and never sees the rendered PDF, so it estimates layout. Results
  vary by model (stronger models follow it better) and by template (custom or
  multi-column styles are harder). A future compile-measure-retry loop would be
  needed for a true guarantee.
- **Subscriptions aren't API access** — see the section at the top.
- **Free-tier models are lower fidelity** and may not always honor the output
  contract; the paid/direct paths are noticeably more reliable.
- **`textContent` scraping misses interaction-gated text** (click-to-expand
  "see more" sections). Paste manually if the posting is incomplete.

## Tech stack

TypeScript · React · Vite + `vite-plugin-web-extension` · Firefox WebExtension
(Manifest V2, `sidebar_action`). PDF parsing via `pdfjs-dist` is planned for the
fallback path.
