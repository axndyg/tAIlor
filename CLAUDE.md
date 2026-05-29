# CLAUDE.md — Resume Tailor

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
Status: PENDING USER APPROVAL

- Language: TypeScript — type safety catches errors at write-time
  rather than runtime; central to user's learning goal
- UI Framework: React — component model maps cleanly to the four-panel
  UI; aligns with user's desire to deepen existing exposure
- Extension Target: Firefox (WebExtension API / Manifest V2) — broadest
  compatibility for Firefox; simpler permissions model than Chrome MV3
- Build Tool: Vite + vite-plugin-web-extension — handles TypeScript
  compilation and extension bundling without manual webpack config
- PDF Parsing: pdfjs-dist (Mozilla's PDF.js) — reads PDF text content
  client-side; no server required; fallback path only
- LLM Integration: Anthropic SDK (user-supplied API key stored in
  extension storage) — direct API calls from background script

Approve or amend before Claude Code treats these as active constraints.

## Project Purpose
A Firefox browser extension that accepts a user's LaTeX resume (one or
more .tex files) plus a job description and an accompanying prompt, then
uses an LLM to rewrite the resume content within the existing LaTeX
structure and returns modified .tex output. Success: user pastes
generated output directly into Overleaf with no manual reformatting.

## Project Description
Four-panel extension popup UI:
1. File input panel — accepts multiple .tex files (primary) or a single
   .pdf (fallback, lower fidelity; user notified of limitation)
2. Job description panel — paste or upload job posting text
3. Accompanying prompt panel — freeform user instructions to the LLM
   (e.g. formatting constraints, tone, emphasis)
4. Output panel — displays LLM-generated modified .tex content; includes
   model selector and API key settings

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
- [ ] To be populated

### Problems to Polish
- [ ] To be populated

### Future Steps
- [ ] Scaffold Firefox extension with Vite + vite-plugin-web-extension
- [ ] Build four-panel React UI (file input, job description, prompt,
  output)
- [ ] Implement .tex file ingestion and bundling
- [ ] Implement PDF fallback via PDF.js with fidelity warning
- [ ] Wire Anthropic API calls from background script
- [ ] Add API key input and browser.storage.local persistence
- [ ] Add model selector to output panel
- [ ] Test LaTeX output round-trip with Overleaf

## Session History
### Session 1 — 2026-05-28
Initial generation. Project defined as Firefox browser extension for
LLM-assisted LaTeX resume tailoring. Learner context active across
TypeScript, React, and WebExtension APIs. Technology stack pending
user approval.
