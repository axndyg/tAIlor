# CLAUDE.md — tAIlor

## Living Document Directive
Maintain this document across sessions. At session end, propose updates
reflecting what was accomplished, problems encountered, and next steps.
Do not edit without explicit user approval. Surface all proposed changes
as an itemized list and wait for confirmation before writing.

## Exit Protocol
Append to your first response each session and to any response with
pending CLAUDE.md changes:

  — type "lets quit" to review and approve session changes to CLAUDE.md

On "lets quit": surface all proposed changes as an itemized list and
wait for explicit approval before writing.

## Model Directive
— Per-task assignments (task diversity detected):
- Architectural decisions, API integration design, extension manifest
  structure → operate using: claude-opus-4-5
- Feature implementation, TypeScript authoring, React components,
  debugging → operate using: claude-sonnet-4-5
- Documentation, comments, minor edits, formatting → operate using:
  claude-haiku-4-5
- Default (all other tasks) → operate using: claude-sonnet-4-5

Basis: generator-recommended based on task diversity.
Note: User retains authority to override any assignment.

## Learner Context
User background: HTML/CSS fluent (basic). TypeScript, React,
WebExtension APIs (Firefox) — all new territory. User has brief React
exposure. User explicitly wants to learn all three, with particular
emphasis on WebExtension APIs as the most transferable skill.

Learning log: see GROWTH.md. Study guide: see LESSONPLAN.md.

**Critical teaching directive:** When the user requests a feature,
do NOT write the full implementation unprompted. Instead: explain the
concept, identify the relevant APIs or patterns, ask the user to attempt
a draft, then guide corrections. Write complete code only when the user
is explicitly stuck after attempting.

Maintain GROWTH.md as a living document:
- Session 1: create GROWTH.md. Record stated familiarity per technology
  as the established baseline.
- Each session: append concepts introduced, demonstrated, or confirmed
  understood. Never overwrite prior entries.
- Structure: Established Baseline → Growth Log (per-session entries)
  → Concepts Introduced (exposure only) → Concepts to Introduce Next.

Maintain LESSONPLAN.md as a living document derived from GROWTH.md:
- Session 1: create LESSONPLAN.md. Generate a progressive,
  chapter-structured study guide calibrated to the user's baseline.
  Cover only concepts needed to understand and build this extension,
  in the order they arise.
- Format: textbook style. Each chapter: plain-English motivation →
  analogy to HTML/CSS equivalents the user already knows → how it
  appears in this project → short exercise or reflection prompt.
  Use headers, callout blocks, and code snippets generously.
  Write for a curious human reading outside of sessions.
- Each session: append new chapters for concepts introduced. Update
  existing chapters only to add clarity — never remove content.

Both GROWTH.md and LESSONPLAN.md must be added to .gitignore.

When writing or explaining code:
- Briefly explain why a pattern is used for concepts new to the user
  — one sentence is sufficient
- Relate TypeScript types to HTML attribute constraints where natural;
  relate React components to reusable HTML blocks where natural;
  relate extension message passing to browser event listeners
- Flag first-time concepts inline: "New concept: X — [plain-English
  explanation]"
- Prioritize readable code over terse cleverness
- Do not over-explain HTML/CSS territory the user has confirmed fluent

## Technology Stack
Status: APPROVED — active (confirmed Session 5)

- Language: TypeScript — type safety catches errors at write-time
  rather than runtime; central to user's learning goal
- UI Framework: React — component model maps cleanly to the sidebar UI;
  aligns with user's desire to deepen existing exposure
- Extension Target: Firefox (WebExtension API / Manifest V2) — broadest
  compatibility for Firefox; simpler permissions model than Chrome MV3
- Extension UI Type: sidebar_action — persistent panel alongside the
  page, not a toolbar popup (browser_action)
- Build Tool: Vite + vite-plugin-web-extension — handles TypeScript
  compilation and extension bundling without manual webpack config
- PDF Parsing: pdfjs-dist (Mozilla's PDF.js) — reads PDF text content
  client-side; no server required; fallback path only
- LLM Integration: Anthropic SDK (user-supplied API key stored in
  extension storage) — direct API calls from background script

Approve or amend before Claude Code treats these as active constraints.

## Project Purpose
A Firefox browser sidebar extension that accepts a user's LaTeX resume
(.tex files or .pdf fallback) and an accompanying prompt, automatically
reads the current tab's webpage to extract a job posting via the QUERY
agent, then uses the CURATE agent to rewrite the resume content within
the existing LaTeX structure. Returns modified .tex (or .pdf) output for
direct use in Overleaf with no manual reformatting.

## Project Description
Sidebar extension UI (sidebar_action, lives alongside the webpage):

1. Resume upload — dropdown accepting multiple .tex files (primary) or
   a single .pdf (fallback, lower fidelity; user notified of limitation)
2. Accompanying prompt — freeform text instructions to the LLM
   (e.g. formatting constraints, tone, emphasis)
3. Model selector — dropdown to choose which LLM / API to call
4. API key input — user-supplied key stored in browser.storage.local
5. Output + download area — displays generated .tex or .pdf; download
   button for the result

Job description source (implicit, no dedicated panel):
- Primary: QUERY agent automatically reads the current tab's webpage
  and extracts the job posting
- Fallback: if QUERY fails to detect a job posting, a manual input box
  appears for the user to paste the job description directly

Two-agent architecture:
- QUERY agent — content script reads current tab DOM; LLM extracts and
  distills the job posting; instructions live in QUERY_c.md
- CURATE agent — background script sends resume + job posting + prompt
  to LLM; rewrites resume within existing LaTeX structure; instructions
  live in CURATE_c.md

LaTeX path: all uploaded .tex files are bundled and sent as full context.
LLM rewrites only relevant sections and returns modified file content.
PDF path: LLM reads content only; outputs reconstructed LaTeX (lower
fidelity; flagged to user).

API key is user-supplied and stored in browser.storage.local. No backend
server. All LLM calls originate from the extension background script.

## Task Board
> Orientation context only. Do not act on any item without explicit
> user instruction.

### Accomplished
- [x] User drafted manifest.json with all five required sections
  (manifest_version, sidebar_action, permissions, background,
  content_scripts). Structure is correct.
- [x] Scaffold Firefox extension with Vite + vite-plugin-web-extension
- [x] Build sidebar React UI (resume upload, prompt, model selector,
  API key input, output area, QUERY fallback input)
- [x] Style sidebar GUI — sol theme active (amber/violet); five theme
  variants saved in themes/ (gitignored as local reference)
- [x] Build pipeline fixed — `npm run build:xpi` produces a loadable
  `tailor.xpi`; logo images bundled via ES module imports; background
  script switched to `background.page` format; gecko id added
- [x] Wire sidebar ↔ background message passing (`TAILOR_REQUEST`
  round-trip); confirmed working against live OpenRouter + Anthropic APIs
- [x] `.tex` ingestion + delimited user-message assembly
  (`assembleUserMessage`: resume / job_description / user_instructions)
- [x] Output display — read-only monospace textarea; shared error/success
  state, red border on failure, self-clears each run
- [x] Prune model lists to curated, capable options per provider
- [x] Author CURATE_c.md (system directive + user-message assembly spec)
- [x] Persist sidebar state (API key, uploaded resumes, theme) in
  browser.storage.local; refactored files state from File[] →
  {name, content}[] for serializability
- [x] QUERY agent Stage A — content script reads current tab DOM
  (textContent) and returns { success, text, url }; sidebar queryPage()
  finds the active tab and messages it, with try/catch for tabs lacking
  a content script

### Problems to Polish
- [ ] `npm run dev` UI preview: navigate to
  `localhost:5173/src/sidebar/sidebar.html` — web-ext-run fails
  (Chromium rejects MV2); real extension testing uses `npm run build:xpi`
  then load `tailor.xpi` in about:debugging
- [ ] iCloud Drive interferes with Firefox loading unpacked `dist/`
  directly — workaround is `npm run build:xpi`; permanent fix is moving
  project out of `~/Documents/` to a non-iCloud path
- [ ] Logo SVG yin/yang halves are swapped in light mode (--logo-yin
  and --logo-yang values reversed in the light theme block in App.css)
- [ ] Dock button only affects localhost preview — Firefox controls
  actual sidebar panel position; no WebExtension API for this

### Future Steps
- Step 2: Wire LLM functionality
  - [x] Implement .tex file ingestion and bundling
  - [x] Wire LLM API calls from background script (all providers, not just
    Anthropic — adapter router + provider detection)
  - [x] Display tailored output / errors in the output box
  - [x] Implement content script to read current tab page content (QUERY)
    — Stage A only (raw textContent scrape); LLM distillation is Stage B, pending
  - [ ] Implement PDF fallback via PDF.js with fidelity warning
  - [x] Add browser.storage.local persistence (API key, uploaded files, theme)
  - [~] Connect QUERY agent output to CURATE agent input — raw textContent
    scrape now flows sidebar → jobDescription → assembleUserMessage → CURATE;
    LLM distillation (Stage B) still pending
  - [ ] Wire the Download button to save the output .tex
- Step 3: Author agent context files
  - [x] Write CURATE_c.md — system prompt for resume rewriting
  - [ ] Write QUERY_c.md — system prompt for job posting extraction
  - [ ] Test LaTeX output round-trip with Overleaf

## Session History
### Session 7 — 2026-06-01
Wired the QUERY agent's **Stage A**: the content script reads the current tab's
DOM and returns it to the sidebar. `content.ts` listens for `QUERY_REQUEST` and
replies `{ success, text, url }` (a wrapper, not a bare string). The sidebar's
`queryPage()` finds the active tab via `tabs.query({active, currentWindow})` and
messages its content script with `tabs.sendMessage`, wrapped in try/catch (tabs
without a content script — about:/PDF/pre-existing — reject with "receiving end
does not exist").

Auto-read fires at two moments with different contracts: on **mount** (silent,
best-effort, fills only an empty box) and on the **Tailor click** (required —
nags via `queryCall` if still empty). A single `jobDescription` state is the
source of truth; a local `job` var carries freshly-detected text past React's
state snapshot into the request. Switched the scrape from `innerText` to
`textContent` (capture generously, let Stage B filter). Also clear field-border
errors on input. Verified live against a Handshake posting (loaded `.xpi`);
reconfirmed the content-script-injection-timing gotcha (a tab opened before the
extension loads has no listener until reloaded).

Committed as `79c34f2` (content.ts, App.tsx, App.css).

Next: QUERY Stage B (distill the `textContent` scrape via the LLM + `QUERY_c.md`);
optionally `tabs.onActivated` to re-read on tab switch; Download button still
inert. Known limit: `textContent` misses interaction-gated (click-to-expand) text.

### Session 6 — 2026-06-01
Added `browser.storage.local` persistence for three pieces of sidebar state.
The hand-written `declare const browser` block was widened to type
`storage.local.get/set` over `{ apiKey, files, theme }`. API key saves on the
Tailor click and loads on mount; theme saves on the logo toggle; files save on
add/remove. Persisting files forced a refactor of `files` state from `File[]`
to `{ name, content }[]` — `File` objects aren't serializable, so resumes are
stored as pre-read text (which also let `assembleUserMessage` drop its per-call
`File.text()`).

Teaching highlights: serializability (why a live `File` can't be stored);
"React state is a snapshot, not a live variable" (stale-`files` save bug — fixed
by computing `updated` once and using it for both `setState` and the storage
write); spread-vs-nest (`[...files, ...newFiles]`); and the recurring lesson that
the narrow hand-written `browser` declaration must be widened for each new API
surface. Several bugs were copy-paste setter/key mismatches (`setApiKey` vs
`setFiles`, `get('apiKey')` vs `get('theme')`) — caught via `tsc`.

Next: QUERY content script (read current tab DOM) + `QUERY_c.md`, and wiring the
Download button to save output `.tex`. PDF.js fallback still open.

### Session 5 — 2026-06-01
Wired the LLM round-trip end to end (Step 2 core). The sidebar's
`handleTailor` now reads uploaded `.tex` files (`File.text()` + `Promise.all`),
assembles a delimited user message (`<resume>` / `<job_description>` /
`<user_instructions>`), and sends a `TAILOR_REQUEST` to the background router
via `browser.runtime.sendMessage`. Confirmed working against live OpenRouter
and Anthropic endpoints — a 401 from a fake key proved the full chain
(message passing → adapter routing → provider detection → fetch → response
round-trip). Tailored LaTeX / errors now render in a read-only monospace
output textarea (shared error/success state, red border on failure).

Authored CURATE_c.md: the stable system directive (reframe-not-fabricate,
LaTeX preservation, strict output hygiene — no markdown fences/commentary)
plus a spec for how the user message is assembled in code. `CURATE_SYSTEM_PROMPT`
in App.tsx mirrors that directive.

Teaching highlight: debugged a "nothing renders" bug that was actually React
state immutability — mutating the `errors` object already held in state and
re-setting the same reference made React bail out of the re-render (`Object.is`
reference comparison). Fixed by spreading into a new object
(`setErrors({ ...next, llmCall })`). Clarified that mutating a *fresh* local
object before its first `setState` is fine; the rule only bites when you mutate
an object already in state.

Also pruned the model lists (dropped tiny/speculative free models) and
centered the provider toggle button text.

Next: pick up the remaining Step 2 items — API key persistence
(`storage.local`), the QUERY content script, PDF.js fallback, and wiring the
Download button. GROWTH.md / LESSONPLAN.md were missing this session (lost off
iCloud, never committed since gitignored) and were recreated.

### Session 4 — 2026-05-30
Resolved build pipeline and Firefox extension loading issues. Root cause
of all "can't find file" errors: iCloud Drive interferes with Firefox's
unpacked extension directory loader for freshly-written files. Workaround:
`npm run build:xpi` packages dist/ into tailor.xpi which Firefox loads fine.

Key fixes applied this session:
- Logo images switched from raw string literals to ES module imports so
  Vite knows to bundle them into dist/
- Background script changed from `background.scripts` array to
  `background.page` format — Vite's IIFE output conflicted with Firefox's
  auto-generated background page; using a real HTML entry point sidesteps this
- `public/` folder restored (favicon.svg, icons.svg must live there to
  reach dist/ — Vite only copies public/ verbatim, not arbitrary files)
- `browser_specific_settings` gecko id added to manifest
- Learned: vite-plugin-web-extension only outputs files it explicitly
  processes as TypeScript entry points; everything else must be in public/

Next: Step 2, wiring LLM functionality. Recommend moving project out of
~/Documents/ to a non-iCloud path before starting Step 2.

### Session 3 — 2026-05-29
Styled the sidebar GUI. Five theme variants built (tealcoral, midnight,
dusk, bloom, sol); sol (amber light / violet dark) selected as active.
Yin-yang logo made dynamic via CSS variables (--logo-yin, --logo-yang)
so swapping a theme block in App.css automatically updates logo colors.
Theme toggle moved onto the logo itself — clicking the yin-yang switches
light/dark. Eye toggle added to API key input. File list with × removal
wired via useState. Dock toggle button added (preview only — Firefox
controls actual sidebar position). useEffect syncs data-theme to
document.body so root/body background extends the theme color edge to edge.

Logo-yin/yang values are swapped in the light theme block — flagged for
next session. Next: Step 2, wiring LLM functionality.

### Session 2 — 2026-05-29
Vite build pipeline established with vite-plugin-web-extension. Three-entry-point
source structure created (sidebar/, background/, content/). Sidebar GUI shell
built in App.tsx with all six sections from spec: file upload (.tex/.pdf),
tailor instructions, model selector, API key, output area, fallback job
description input. LESSONPLAN.md created (overdue from Session 1).

Key friction point: npm run dev triggers web-ext-run which tries to launch
Chromium — fails because MV2 is unsupported in Chrome. Workaround established:
use localhost:5173/src/sidebar/sidebar.html directly. npm audit warnings noted
as dev-only, documented in LESSONPLAN.md.

Next session: CSS styling (Step 1.5) before wiring LLM logic.

### Session 1 — 2026-05-28
Initial generation. Project defined as Firefox browser extension for
LLM-assisted LaTeX resume tailoring. Learner context active across
TypeScript, React, and WebExtension APIs. Technology stack pending
user approval.

Design clarified via annotated screenshot. Extension confirmed as a
sidebar (sidebar_action), not a toolbar popup. Job description is read
automatically from the current tab via QUERY agent; manual paste input
serves as fallback if detection fails. Original four-panel description
superseded by revised sidebar layout. Two-agent architecture established
(QUERY + CURATE), each guided by a dedicated context file. Three-step
build plan confirmed: (1) GUI shell, (2) LLM wiring, (3) agent prompts.

User read MDN WebExtension tutorial and drafted manifest.json
independently — all five required sections present and correctly
structured. Match pattern syntax (scheme://host/path) explained. Two
fixes identified for next session: match pattern and script filenames.
