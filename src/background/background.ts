// New concept: declare const — tells TypeScript "this global exists at runtime
// but isn't in our lib files; trust us on its shape."
// Firefox injects `browser` into extension contexts; we declare only what we use.
declare const browser: {
  runtime: {
    onMessage: {
      addListener(
        cb: (message: unknown) => Promise<TailorResponse> | undefined
      ): void
    }
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

type ProviderMode = 'openrouter' | 'direct'

// The sidebar sends this message when the user clicks "Tailor Resume".
interface TailorMessage {
  type: 'TAILOR_REQUEST'
  model: string
  providerMode: ProviderMode
  apiKey: string
  systemPrompt: string
  userMessage: string
}

interface TailorResponse {
  success: boolean
  text?: string
  error?: string
}

// New concept: interface — describes the *shape* a value must have, like an
// HTML element's required attributes. Every provider adapter must match this.
interface ProviderAdapter {
  url(model: string, apiKey: string): string
  headers(apiKey: string): Record<string, string>
  body(model: string, system: string, user: string): unknown
  parseText(data: unknown): string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Narrow unknown API responses to typed shapes we expect.
// These casts are safe because we only call parseText after a 2xx response.
type OpenAIData   = { choices: { message: { content: string } }[] }
type AnthropicData = { content: { text: string }[] }
type GoogleData   = { candidates: { content: { parts: { text: string }[] } }[] }
type CohereData   = { message: { content: { text: string }[] } }

// Factory: builds an adapter for any API that speaks the OpenAI chat format.
// New concept: a function that *returns* an object — a common pattern for
// creating multiple instances that share behaviour but differ in one value.
function openAIAdapter(baseUrl: string, extraHeaders: Record<string, string> = {}): ProviderAdapter {
  return {
    url:     ()       => `${baseUrl}/chat/completions`,
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, ...extraHeaders }),
    body:    (model, system, user) => ({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   },
      ],
    }),
    parseText: (data) => (data as OpenAIData).choices[0].message.content,
  }
}

// ── Provider adapters ────────────────────────────────────────────────────────

const adapters = {
  // ── OpenRouter ─────────────────────────────────────────────────────────────
  // Unified gateway; model ID already encodes the underlying provider.
  // Extra headers are optional but help OpenRouter track usage per app.
  openrouter: openAIAdapter('https://openrouter.ai/api/v1', {
    'HTTP-Referer': 'moz-extension://tailor',
    'X-Title':      'tAIlor',
  }),

  // ── Direct: OpenAI-compatible ──────────────────────────────────────────────
  openai:   openAIAdapter('https://api.openai.com/v1'),
  mistral:  openAIAdapter('https://api.mistral.ai/v1'),
  groq:     openAIAdapter('https://api.groq.com/openai/v1'),

  // ── Direct: Anthropic ──────────────────────────────────────────────────────
  // Different auth header name, requires explicit max_tokens, system is
  // a top-level field rather than a message role.
  anthropic: {
    url:     ()       => 'https://api.anthropic.com/v1/messages',
    headers: (apiKey) => ({
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    }),
    body: (model, system, user) => ({
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    parseText: (data) => (data as AnthropicData).content[0].text,
  } satisfies ProviderAdapter,

  // ── Direct: Google Gemini ──────────────────────────────────────────────────
  // API key goes in the URL query string, not a header.
  // System instructions use a separate top-level field.
  google: {
    url:     (model, apiKey) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    headers: () => ({}),
    body:    (_model, system, user) => ({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
    }),
    parseText: (data) =>
      (data as GoogleData).candidates[0].content.parts[0].text,
  } satisfies ProviderAdapter,

  // ── Direct: Cohere ─────────────────────────────────────────────────────────
  // v2 API; response nests text one level deeper than OpenAI.
  cohere: {
    url:     ()       => 'https://api.cohere.com/v2/chat',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    body:    (model, system, user) => ({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   },
      ],
    }),
    parseText: (data) => (data as CohereData).message.content[0].text,
  } satisfies ProviderAdapter,
} as const

// ── Provider detection (direct mode) ─────────────────────────────────────────

// New concept: keyof typeof — produces the union type of an object's keys,
// e.g. 'openrouter' | 'openai' | 'anthropic' | ... This lets TypeScript
// verify our lookup is safe rather than accepting any string.
type AdapterKey = keyof typeof adapters

function detectProvider(model: string): AdapterKey {
  if (model.startsWith('claude-'))          return 'anthropic'
  if (model.startsWith('gpt-') ||
      model.startsWith('o3')   ||
      model.startsWith('o1'))               return 'openai'
  if (model.startsWith('gemini-'))          return 'google'
  if (model.startsWith('mistral-') ||
      model.startsWith('codestral-'))       return 'mistral'
  if (model.startsWith('command-'))        return 'cohere'
  if (model.includes('llama') ||
      model.includes('mixtral'))            return 'groq'
  throw new Error(`[tAIlor] Unrecognised model for direct routing: ${model}`)
}

// ── Request router ────────────────────────────────────────────────────────────

async function routeRequest(msg: TailorMessage): Promise<TailorResponse> {
  const key = msg.providerMode === 'openrouter'
    ? 'openrouter'
    : detectProvider(msg.model)

  const adapter = adapters[key]

  const url  = adapter.url(msg.model, msg.apiKey)
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adapter.headers(msg.apiKey) },
    body:    JSON.stringify(adapter.body(msg.model, msg.systemPrompt, msg.userMessage)),
  })

  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText)
    throw new Error(`${resp.status} from ${key}: ${detail}`)
  }

  const data = await resp.json() as unknown
  return { success: true, text: adapter.parseText(data) }
}

// ── Message listener ──────────────────────────────────────────────────────────

// New concept: addListener with a Promise return.
// Firefox uses the returned Promise to send the async response back to the
// caller — the equivalent of reply() in a browser event listener pattern.
browser.runtime.onMessage.addListener((message) => {
  const msg = message as TailorMessage
  if (msg.type !== 'TAILOR_REQUEST') return undefined

  return routeRequest(msg)
    .catch((err: unknown) => ({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }))
})

console.debug('[tAIlor] background ready — router loaded')
