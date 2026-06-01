import { useState, useEffect } from 'react'
import './App.css'
import tailorLight from '../../logo/tailor_light.png'
import tailorDark from '../../logo/tailor_dark.png'

// Describes the response shape that comes back from the background router.
interface TailorResponse {
  success: boolean
  text?: string      // ? means optional — present only on success
  error?: string     // present only on failure  }
}
  // Tells the type-checker the runtime global `browser` exists, and the one
  // method we use on it. Mirrors the declare block in background.ts.

interface QueryResponse {
  success: boolean
  text?: string   // present on a good read
  url?: string    // the page we read it from
  error?: string  // present if the read failed
}

declare const browser: {
    runtime: {
      sendMessage(message: unknown): Promise<TailorResponse>
      };
    storage: { 
      local: { 
          get(key: string): 
            Promise<{
              apiKey?: string;
              files?: {name: string, content: string}[];
              theme?: string;    
            }> 
          set(items: { 
              apiKey?: string;
              files?: {name: string, content: string}[];
              theme?: string; 
             }): 
            Promise<void>
      }
    };
    tabs: { 
      query(queryInfo: {
        active: boolean;
        currentWindow: boolean
      }): 
      Promise<{ id?: number }[]>
      sendMessage(tabId: number, message: unknown): Promise<QueryResponse>
    }
}

// New concept: const with 'as const' — freezes the array so TypeScript
// infers literal types instead of widening to string[].
const OPENROUTER_MODELS = [
  // Free tier — no cost, rate-limited. Curated to models large enough to
  // preserve LaTeX structure reliably.
  { value: 'deepseek/deepseek-chat:free',             label: 'DeepSeek V3',            free: true  },
  { value: 'deepseek/deepseek-r1:free',               label: 'DeepSeek R1',            free: true  },
  { value: 'google/gemma-3-27b-it:free',              label: 'Gemma 3 27B',            free: true  },
  { value: 'openai/gpt-oss-120b:free',                label: 'GPT-OSS 120B',           free: true  },
  // Paid tier — one strong option per family
  { value: 'anthropic/claude-opus-4',                 label: 'Claude Opus 4',          free: false },
  { value: 'anthropic/claude-sonnet-4',               label: 'Claude Sonnet 4',        free: false },
  { value: 'openai/gpt-4o',                           label: 'GPT-4o',                 free: false },
  { value: 'google/gemini-2.5-pro',                   label: 'Gemini 2.5 Pro',         free: false },
  { value: 'meta-llama/llama-3.1-405b-instruct',      label: 'Llama 3.1 405B',         free: false },
  { value: 'mistralai/mistral-large',                 label: 'Mistral Large',          free: false },
] as const

const DIRECT_MODELS = [
  // Anthropic
  { value: 'claude-opus-4-8',         label: 'Claude Opus 4',       provider: 'Anthropic' },
  { value: 'claude-sonnet-4-6',       label: 'Claude Sonnet 4',     provider: 'Anthropic' },
  // OpenAI
  { value: 'gpt-4o',                  label: 'GPT-4o',              provider: 'OpenAI'    },
  { value: 'gpt-4o-mini',             label: 'GPT-4o Mini',         provider: 'OpenAI'    },
  // Google
  { value: 'gemini-2.5-pro',          label: 'Gemini 2.5 Pro',      provider: 'Google'    },
  { value: 'gemini-2.5-flash',        label: 'Gemini 2.5 Flash',    provider: 'Google'    },
  // Mistral
  { value: 'mistral-large-latest',    label: 'Mistral Large',       provider: 'Mistral'   },
  // Cohere
  { value: 'command-r-plus',          label: 'Command R+',          provider: 'Cohere'    },
  // Groq
  { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B',       provider: 'Groq'      },
] as const

type ProviderMode = 'openrouter' | 'direct'

// Groups an array by a key, returning a Map of key → items.
function groupBy<T>(items: readonly T[], key: keyof T): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = String(item[key])
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(item)
  }
  return map
}

// The stable directive sent in every request's `system` field — mirror of the
// Directive section in CURATE_c.md. The variable inputs (resume, job
// description, instructions) are assembled separately in assembleUserMessage.
// New concept: a backtick `template literal` preserves newlines verbatim, so
// the prompt's formatting survives exactly as written.
const CURATE_SYSTEM_PROMPT = `You are a resume tailorer. Your role is to reframe a provided resume toward a specific job description — without inventing experience or removing existing content.

Core principle: Every bullet point in the resume represents a real strength. Your job is to identify which angle of that strength is most relevant to the job description, and reframe the bullet to lead with that angle, using the language and priorities of the job posting.

Reframing rules:
- If a strength maps directly to the job, foreground it explicitly using the job posting's vocabulary.
- If a strength does not map directly, find the transferable angle and frame it toward the job's domain. Do not omit it.
- Where a bullet already leads with a concrete result, preserve that. Otherwise, prefer leading with the outcome the job posting would value, followed by how it was achieved.

Hard constraints:
- Never fabricate experience, metrics, skills, or technologies not present in the original resume.
- Do not alter dates, job titles, company names, degrees, or institution names.
- Do not rename sections, reorder sections, or change the document structure.

LaTeX preservation:
- The resume is provided as a single .tex file or a collection of .tex files.
- Preserve the document's preamble, packages, custom commands/macros, section structure, and ordering exactly.
- Modify only the text content of bullets, summaries, and descriptions.
- Produce a single resulting .tex file. If multiple files were provided, merge them into one self-contained document that compiles independently.

Output format — read carefully:
Output only the raw LaTeX source of the single resulting .tex file. No markdown code fences. No preamble sentence, no commentary, no explanation, no closing remark. Your entire response, from the first character to the last, must be valid LaTeX that compiles as-is in Overleaf.`

async function assembleUserMessage(
  files: {name: string, content: string}[],
  jobDescription: string,
  instructions: string,
): Promise<string> {
  const resumeBlock = files
    .map(p => `% --- file: ${p.name} ---\n${p.content}`)
    .join('\n\n')

  const instructionsBlock = instructions === ''
    ? ''
    : `\n\n<user_instructions>\n${instructions}\n</user_instructions>`

  return `<resume>
  ${resumeBlock}
  </resume>

  <job_description>
  ${jobDescription}
  </job_description>${instructionsBlock}`
  }

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [files, setFiles] = useState<{name: string, content: string}[]>([])
  const [showKey, setShowKey] = useState(false)
  const [providerMode, setProviderMode] = useState<ProviderMode>('openrouter')
  const [model, setModel] = useState<string>(OPENROUTER_MODELS[0].value)

  const [instructions, setInstructions] = useState<string>('')
  const [apiKey, setApiKey] = useState<string>('')
  const [jobDescription, setJobDescription]= useState<string>('')

  const [output, setOutput] = useState<string>('')
  
  const [errors, setErrors] = useState<{ files?: string; apiKey?: string; llmCall?: string; queryCall?: string }>({})


  function switchProvider(mode: ProviderMode) {
    setProviderMode(mode)
    setModel(mode === 'openrouter' ? OPENROUTER_MODELS[0].value : DIRECT_MODELS[0].value)
  }

  useEffect(() => {
    async function loadTheme() { 
      const callLocal = await browser.storage.local.get('theme')
      setTheme(callLocal.theme === "dark" ? "dark" : "light")
    }
    loadTheme()
  }, [])

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
  }, [theme])


  useEffect(() => {
    async function loadKey() { 
      const callLocal = await browser.storage.local.get('apiKey')
      setApiKey(callLocal.apiKey ? callLocal.apiKey : '') 
    }
    loadKey()
  }, [])

  useEffect(() => {
    async function loadFiles() {
      const callLocal = await browser.storage.local.get('files')
      setFiles(callLocal.files ? callLocal.files : [])
    }
    loadFiles()
  }, [])

  // On open, auto-read the current tab as the job description (design B): fill
  // the editable box so the user can eyeball/edit before tailoring. If the page
  // can't be read, surface an error asking them to paste it instead.
  // On open, the auto-read is a *convenience fill*, not the primary path:
  // pasting wins. So we only populate an EMPTY box, and stay silent if the read
  // fails (no scary warning at rest — the user can just paste).
  useEffect(() => {
    async function detectJob() {
      const text = await queryPage()
      if (!text) return
      // Functional updater reads the *current* value, not the stale mount-time
      // snapshot — so we never clobber text the user pasted while we were reading.
      setJobDescription(prev => (prev === '' ? text : prev))
    }
    detectJob()
  }, [])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? [])
    const existingFiles = new Set(files.map(f => f.name))
    const incomingFiles = incoming.filter(f => !existingFiles.has(f.name))

    const newFiles = await Promise.all(
      incomingFiles.map(async f => ({
        name: f.name,
        content: await f.text()
      }))
    );
    const updated = [...files, ...newFiles]
    setFiles(updated)
    setErrors((prevErrors => ({...prevErrors, files: ''})))
    e.target.value = ''

    await browser.storage.local.set({ files: updated })
  }

  async function removeFile(index: number) {
    const updated = files.filter((_, i) => i !== index)
    setFiles(updated)
    await browser.storage.local.set({ files: updated })
  }

  // QUERY agent, Stage A caller: ask the active tab's content script to read
  // its DOM. Returns the page text, or undefined if we couldn't read it.
  async function queryPage(): Promise<string | undefined> {
    const activeTab = await browser.tabs.query({ active: true, currentWindow: true })
    // ?. handles an empty array; === undefined (not !tabId) so a real id of 0 survives.
    const tabId = activeTab[0]?.id
    if (tabId === undefined) return

    try {
      const response = await browser.tabs.sendMessage(tabId, { type: 'QUERY_REQUEST' })
      return response.success ? response.text : undefined
    } catch {
      // sendMessage rejects with "receiving end does not exist" when the page
      // has no content script — about: pages, PDFs, or a tab opened before the
      // extension loaded. Treat as "couldn't read" → fall back to manual paste.
      return undefined
    }
  }


  async function handleTailor() {
    await browser.storage.local.set({apiKey: apiKey})
    const next: typeof errors = {}
    if (files.length === 0) next.files  = 'Upload at least one resume file.'
    if (apiKey.trim() === '') next.apiKey = 'Enter your API key.'

    // The box is the source of truth. If it's empty, lazily auto-read the page
    // before giving up. Hold the result in a LOCAL var: setJobDescription won't
    // update the `jobDescription` variable within this same run (React state is
    // a snapshot), so the request below must read the local value, not state.
    let job = jobDescription.trim()
    if (job === '' && files.length !== 0 && apiKey.trim() !== '') {
      const detected = await queryPage()
      if (detected) {
        job = detected
        setJobDescription(detected)   // reflect it in the box for the user
      } else {
        next.queryCall = 'No job description detected — paste it below.'
      }
    }

    setErrors(next)                          // replaces the whole object
    if (Object.keys(next).length > 0) return // any error → stop

    const userMessage = await assembleUserMessage(files, job, instructions)
    const response = await browser.runtime.sendMessage({
      type: 'TAILOR_REQUEST',
      model, providerMode, apiKey,
      systemPrompt: CURATE_SYSTEM_PROMPT,   // the constant
      userMessage,
    })
    if (response.success) { 
      setOutput(response.text ?? '')
    }
    else { 
      setErrors({ ...next, llmCall: response.error ?? '' })
    }
  }

  return ( 
    <div id="sidebar" data-theme={theme}>
      <header>
        <span className="wordmark">t<span className="wordmark-ai">AI</span>lor</span>
        <button
          className="logo-toggle"
          onClick={() => {
            const nextTheme = theme === 'light' ? 'dark' : 'light';
            setTheme(nextTheme);
            browser.storage.local.set({ theme: nextTheme });
          }}
          aria-label="toggle theme"
        >
          <img src={theme === 'light' ? tailorLight : tailorDark} height="30" width="30" />
        </button>
      </header>

      <section>
        <span className="section-label">Upload Resume</span>
        <label className={`file-btn ${errors.files ? 'field-border-error' : ''}`} htmlFor="myFile">+ choose files</label>
        <input
          type="file"
          id="myFile"
          name="filename"
          multiple
          accept=".tex,.pdf"
          onChange={handleFileChange}
        />
        {files.length > 0 && (
          <ul className="file-list">
            {files.map((file, i) => (
              <li key={i}>
                <span>{file.name}</span>
                <button onClick={() => removeFile(i)} aria-label={`remove ${file.name}`}>×</button>
              </li>
            ))}
          </ul>
        )}
         {errors.files && <p className="field-error">{errors.files}</p>}
      </section>

      <section>
        <span className="section-label">Tailor Instructions</span>
        <textarea 
          placeholder="e.g. emphasize leadership, keep to one page..."
          value={instructions}
          onChange={e => setInstructions(e.target.value)} 
        />
      </section>

      <section>
        <span className="section-label">Provider</span>
        <div className="provider-toggle">
          <button
            className={`provider-btn${providerMode === 'openrouter' ? ' active' : ''}`}
            onClick={() => switchProvider('openrouter')}
          >OpenRouter</button>
          <button
            className={`provider-btn${providerMode === 'direct' ? ' active' : ''}`}
            onClick={() => switchProvider('direct')}
          >Direct API</button>
        </div>

        <span className="section-label">Model</span>
        {providerMode === 'openrouter' ? (
          <select value={model} onChange={e => setModel(e.target.value)}>
            <optgroup label="★ Free">
              {OPENROUTER_MODELS.filter(m => m.free).map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </optgroup>
            <optgroup label="Paid">
              {OPENROUTER_MODELS.filter(m => !m.free).map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </optgroup>
          </select>
        ) : (
          <select value={model} onChange={e => setModel(e.target.value)}>
            {Array.from(groupBy(DIRECT_MODELS, 'provider')).map(([provider, models]) => (
              <optgroup key={provider} label={provider}>
                {models.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        )}

        <span className="section-label">API Key</span>
        <div className='key-wrap'>
          <input 
            type={showKey ? 'text' : 'password'}
            placeholder="sk-..."
            className={errors.apiKey ? "field-border-error" : ""}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setErrors((prevErrors) => ({ ...prevErrors, apiKey: '' }));
            }}
           />
          <button
            className="eye-btn"
            onClick={() => setShowKey(s => !s)}
            aria-label={showKey ? 'hide key' : 'show key'}
          >
            {showKey ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            )}
          </button>
        </div>
        {errors.apiKey && <p className="field-error">{errors.apiKey}</p>}
      </section>

      <section className="fallback-section">
        <span className="section-label">Job Description</span>
        {errors.queryCall && (
          <span className="fallback-label">⚠ {errors.queryCall}</span>
        )}
        <textarea
          placeholder="paste job description here..."
          value={jobDescription}
          onChange={e => setJobDescription(e.target.value)}
        />
      </section>

      <button className="primary-btn" onClick={() =>  handleTailor()}>Tailor Resume</button>

      <section>
        <span className="section-label">Output</span>
        <textarea 
        className={`output-area ${errors.llmCall ? "field-border-error" : ""}`}
        value={errors.llmCall ? errors.llmCall : output} 
        readOnly 
        />

        <button className="secondary-btn">↓ Download</button>
      </section>

    </div>
  )
}

export default App
