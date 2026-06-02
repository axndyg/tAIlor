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
              providerMode?: ProviderMode;
              model?: string;
              instructions?: string;
              filesCollapsed?: boolean;
            }>
          set(items: {
              apiKey?: string;
              files?: {name: string, content: string}[];
              theme?: string;
              providerMode?: ProviderMode;
              model?: string;
              instructions?: string;
              filesCollapsed?: boolean;
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
      // Injects a script file into a tab on demand (activeTab permission).
      executeScript(tabId: number, details: { file: string }): Promise<unknown[]>
    }
}

// New concept: const with 'as const' — freezes the array so TypeScript
// infers literal types instead of widening to string[].
const OPENROUTER_MODELS = [
  // Free tier — no cost, rate-limited. Pruned to the only free model that
  // reliably returns usable LaTeX in testing; the others (DeepSeek V3/R1,
  // Gemma 3 27B) failed to follow the structure/output contract.
  { value: 'openai/gpt-oss-120b:free',                label: 'GPT-OSS 120B',           free: true  },
  // Paid tier — one strong option per family
  { value: 'anthropic/claude-opus-4',                 label: 'Claude Opus 4',          free: false },
  { value: 'anthropic/claude-sonnet-4',               label: 'Claude Sonnet 4',        free: false },
  { value: 'openai/gpt-4o',                           label: 'GPT-4o',                 free: false },
  { value: 'google/gemini-2.5-pro',                   label: 'Gemini 2.5 Pro',         free: false },
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
- The resume is provided as one or more .tex files. Each file is labeled in the user message by a comment line of the form "% --- file: <filename> ---" immediately preceding its contents.
- Produce a SINGLE, self-contained .tex file that compiles on its own in Overleaf with no external file dependencies.
- Resolve modular structure by inlining. Whenever a file references another provided file via \\input{...} or \\include{...}, replace that command, in place, with the full body of the referenced file. Match references to files by basename — ignore any directory path and the optional .tex extension. For example, \\input{_header} is satisfied by the file _header.tex, and \\input{sections/education} is satisfied by education.tex.
- A referenced file may itself contain \\input/\\include of other provided files; resolve these recursively until no reference to a provided file remains.
- If an \\input/\\include points to a file that was NOT provided, leave the command untouched.
- The "main" file is the one containing \\documentclass and \\begin{document}; it defines the overall structure. Inline the other provided files into it at their reference points.
- Preserve the document's preamble, packages, custom commands/macros, section structure, and ordering exactly.
- Modify only the text content of bullets, summaries, and descriptions.

Length and density — hard constraints:
- The final document MUST fit on exactly ONE page. This is non-negotiable. If content would overflow onto a second page, tighten wording until it fits — shorten or merge the least job-relevant bullets first. Never reduce the document to a partial page by deleting whole sections; preserve all sections and entries while trimming prose.
- Each bullet must cover at least 80% of the available line width — never write a bullet so short it leaves excessive trailing white space on a single line.
- If a bullet wraps to a second line, that second line must also cover at least 80% of the line width. Never leave a second line that contains only one to three words.
- If a wrapped bullet would produce a weak second line, either expand the phrasing to fill it properly (using real, non-fabricated detail from the original resume), or condense the bullet to fit cleanly on one line.
- Countable proxy for line width (you cannot see the rendered page, so reason in words): assuming a standard single-column resume at roughly 10–11pt with typical margins, one full line holds about 14–18 words. Use this to self-check — a bullet occupying a single line should land near 14–18 words; a bullet that wraps should leave its final line in that same 14–18 word range, never trailing off after 1–3 words. If the document's geometry clearly differs (smaller font, wider text block, indented bullets), or the user instructions specify a different target, adjust this word count proportionally.
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

  // Tailor-run progress. `loading` disables the button + drives the spinner;
  // `status` is the human-readable phase shown beside it ("Reading page…" etc).
  const [loading, setLoading] = useState<boolean>(false)
  const [status, setStatus] = useState<string>('')

  // Whether the uploaded-file list is folded away (useful when many files).
  const [filesCollapsed, setFilesCollapsed] = useState<boolean>(false)

  // Animated ". . ." shown in the output box while the model is working.
  const [dots, setDots] = useState<string>('')

  const [errors, setErrors] = useState<{ files?: string; apiKey?: string; llmCall?: string; queryCall?: string }>({})


  function switchProvider(mode: ProviderMode) {
    setProviderMode(mode)
    const nextModel = mode === 'openrouter' ? OPENROUTER_MODELS[0].value : DIRECT_MODELS[0].value
    setModel(nextModel)
    browser.storage.local.set({ providerMode: mode, model: nextModel })
  }

  function selectModel(value: string) {
    setModel(value)
    browser.storage.local.set({ model: value })
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

  // While a tailor run is in flight, cycle ". " → ". . " → ". . . " in the
  // output box so it's clear the model is still working. setInterval ticks the
  // frame; the cleanup clears it when `loading` flips back to false.
  useEffect(() => {
    if (!loading) { setDots(''); return }
    const frames = ['', '.', '. .', '. . .']
    let i = 0
    setDots(frames[0])
    const id = setInterval(() => {
      i = (i + 1) % frames.length
      setDots(frames[i])
    }, 550)
    return () => clearInterval(id)
  }, [loading])


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

  useEffect(() => {
    async function loadProvider() {
      const savedMode  = (await browser.storage.local.get('providerMode')).providerMode
      const savedModel = (await browser.storage.local.get('model')).model
      if (savedMode) setProviderMode(savedMode)
      // Fall back to the saved mode's default model if no model was stored.
      if (savedModel) setModel(savedModel)
      else if (savedMode === 'direct') setModel(DIRECT_MODELS[0].value)
    }
    loadProvider()
  }, [])

  useEffect(() => {
    async function loadInstructions() {
      const callLocal = await browser.storage.local.get('instructions')
      setInstructions(callLocal.instructions ? callLocal.instructions : '')
    }
    loadInstructions()
  }, [])

  useEffect(() => {
    async function loadFilesCollapsed() {
      const callLocal = await browser.storage.local.get('filesCollapsed')
      setFilesCollapsed(callLocal.filesCollapsed === true)
    }
    loadFilesCollapsed()
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
  //
  // The content script is no longer injected into every page declaratively —
  // it's injected on demand here. We try messaging first; if no listener
  // answers (first read on this tab, or the page was navigated since), we
  // executeScript to inject it, then retry once. This keeps tAIlor off every
  // site until the moment it actually needs to read one.
  async function queryPage(): Promise<string | undefined> {
    const activeTab = await browser.tabs.query({ active: true, currentWindow: true })
    // ?. handles an empty array; === undefined (not !tabId) so a real id of 0 survives.
    const tabId = activeTab[0]?.id
    if (tabId === undefined) return

    async function ask(): Promise<string | undefined> {
      const response = await browser.tabs.sendMessage(tabId!, { type: 'QUERY_REQUEST' })
      return response.success ? response.text : undefined
    }

    try {
      return await ask()
    } catch {
      // No content script listening yet → inject it, then ask once more.
      try {
        await browser.tabs.executeScript(tabId, { file: 'src/content/content.js' })
        return await ask()
      } catch {
        // Injection itself failed: about:/PDF/view-source pages, addons.mozilla.org,
        // or activeTab not granted for this tab. Fall back to manual paste.
        return undefined
      }
    }
  }


  // Saves the current output to a .tex file. Builds a Blob, points a temporary
  // <a download> at an object URL, clicks it, then revokes the URL. Only valid
  // output (a successful response, no error showing) is downloadable.
  function handleDownload() {
    if (!output || errors.llmCall) return

    // Name after the first uploaded file's basename, else a sensible default.
    const base = files[0]?.name.replace(/\.(tex|pdf)$/i, '') ?? 'resume'
    const filename = `${base}_tailored.tex`

    const blob = new Blob([output], { type: 'text/x-tex' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Friendly label for the currently-selected model, for the progress text.
  function modelLabel(): string {
    const all = [...OPENROUTER_MODELS, ...DIRECT_MODELS]
    return all.find(m => m.value === model)?.label ?? model
  }

  async function handleTailor() {
    if (loading) return                      // ignore re-clicks mid-run
    await browser.storage.local.set({apiKey: apiKey})
    const next: typeof errors = {}
    if (files.length === 0) next.files  = 'Upload at least one resume file.'
    if (apiKey.trim() === '') next.apiKey = 'Enter your API key.'

    setLoading(true)
    try {
      // The box is the source of truth. If it's empty, lazily auto-read the page
      // before giving up. Hold the result in a LOCAL var: setJobDescription won't
      // update the `jobDescription` variable within this same run (React state is
      // a snapshot), so the request below must read the local value, not state.
      let job = jobDescription.trim()
      if (job === '' && files.length !== 0 && apiKey.trim() !== '') {
        setStatus('Reading the current page…')
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

      setStatus(`Tailoring with ${modelLabel()}…`)
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
    } finally {
      // Always release the button + clear the phase text, success or failure.
      setLoading(false)
      setStatus('')
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
          accept=".tex"
          onChange={handleFileChange}
        />
        {files.length > 0 && (
          <>
            <button
              className="files-bar"
              onClick={() => {
                const nextCollapsed = !filesCollapsed
                setFilesCollapsed(nextCollapsed)
                browser.storage.local.set({ filesCollapsed: nextCollapsed })
              }}
              aria-expanded={!filesCollapsed}
            >
              <span className={`files-chevron ${filesCollapsed ? 'collapsed' : ''}`}>▾</span>
              <span>{files.length} file{files.length > 1 ? 's' : ''}</span>
            </button>
            {!filesCollapsed && (
              <ul className="file-list">
                {files.map((file, i) => (
                  <li key={i}>
                    <span>{file.name}</span>
                    <button onClick={() => removeFile(i)} aria-label={`remove ${file.name}`}>×</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
         {errors.files && <p className="field-error">{errors.files}</p>}
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
          <select value={model} onChange={e => selectModel(e.target.value)}>
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
          <select value={model} onChange={e => selectModel(e.target.value)}>
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

          
      <section>
        <span className="section-label">Tailor Instructions</span>
        <textarea
          placeholder="e.g. emphasize leadership, keep to one page..."
          value={instructions}
          onChange={e => {
            setInstructions(e.target.value)
            browser.storage.local.set({ instructions: e.target.value })
          }}
        />
      </section>

      <button className="primary-btn" onClick={() => handleTailor()} disabled={loading}>
        {loading ? (
          <span className="btn-loading">
            <span className="spinner" />
            {status || 'Tailoring…'}
          </span>
        ) : 'Tailor Resume'}
      </button>

      <section>
        <span className="section-label">Output</span>
        <textarea
        className={`output-area ${errors.llmCall ? "field-border-error" : ""}`}
        value={errors.llmCall ? errors.llmCall : (loading ? dots : output)}
        readOnly
        />

        <button
          className="secondary-btn"
          onClick={handleDownload}
          disabled={!output || !!errors.llmCall}
        >↓ Download</button>
      </section>

    </div>
  )
}

export default App
