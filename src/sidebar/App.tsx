import { useState, useEffect } from 'react'
import './App.css'
import tailorLight from '../../logo/tailor_light.png'
import tailorDark from '../../logo/tailor_dark.png'

// New concept: const with 'as const' — freezes the array so TypeScript
// infers literal types instead of widening to string[].
const OPENROUTER_MODELS = [
  // Free tier — no cost, rate-limited
  { value: 'meta-llama/llama-3.1-8b-instruct:free',   label: 'Llama 3.1 8B',          free: true  },
  { value: 'meta-llama/llama-3.2-3b-instruct:free',   label: 'Llama 3.2 3B',          free: true  },
  { value: 'google/gemma-3-12b-it:free',              label: 'Gemma 3 12B',            free: true  },
  { value: 'google/gemma-3-27b-it:free',              label: 'Gemma 3 27B',            free: true  },
  { value: 'mistralai/mistral-7b-instruct:free',      label: 'Mistral 7B',             free: true  },
  { value: 'qwen/qwen-2.5-7b-instruct:free',          label: 'Qwen 2.5 7B',            free: true  },
  { value: 'deepseek/deepseek-chat:free',             label: 'DeepSeek V3',            free: true  },
  { value: 'deepseek/deepseek-r1:free',               label: 'DeepSeek R1',            free: true  },
  { value: 'microsoft/phi-3-medium-128k-instruct:free', label: 'Phi-3 Medium 128K',   free: true  },
  { value: 'openrouter/owl-alpha',                      label: 'Owl Alpha',              free: true  },
  { value: 'nvidia/nemotron-3-super-120b-a12b:free',    label: 'Nemotron 3 Super 120B',  free: true  },
  { value: 'openai/gpt-oss-120b:free',                  label: 'GPT-OSS 120B',           free: true  },
  { value: 'openai/gpt-oss-20b:free',                   label: 'GPT-OSS 20B',            free: true  },
  { value: 'google/gemma-4-31b-it:free',                label: 'Gemma 4 31B',            free: true  },
  // Paid tier
  { value: 'anthropic/claude-opus-4',                 label: 'Claude Opus 4',          free: false },
  { value: 'anthropic/claude-sonnet-4',               label: 'Claude Sonnet 4',        free: false },
  { value: 'anthropic/claude-haiku-3-5',              label: 'Claude Haiku 3.5',       free: false },
  { value: 'openai/gpt-4o',                           label: 'GPT-4o',                 free: false },
  { value: 'openai/gpt-4o-mini',                      label: 'GPT-4o Mini',            free: false },
  { value: 'openai/o3-mini',                          label: 'o3-mini',                free: false },
  { value: 'google/gemini-2.5-pro',                   label: 'Gemini 2.5 Pro',         free: false },
  { value: 'google/gemini-2.5-flash',                 label: 'Gemini 2.5 Flash',       free: false },
  { value: 'meta-llama/llama-3.1-70b-instruct',       label: 'Llama 3.1 70B',          free: false },
  { value: 'meta-llama/llama-3.1-405b-instruct',      label: 'Llama 3.1 405B',         free: false },
  { value: 'mistralai/mistral-large',                 label: 'Mistral Large',          free: false },
  { value: 'cohere/command-r-plus',                   label: 'Command R+',             free: false },
] as const

const DIRECT_MODELS = [
  // Anthropic
  { value: 'claude-opus-4-8',         label: 'Claude Opus 4',       provider: 'Anthropic' },
  { value: 'claude-sonnet-4-6',       label: 'Claude Sonnet 4',     provider: 'Anthropic' },
  { value: 'claude-haiku-4-5',        label: 'Claude Haiku 4',      provider: 'Anthropic' },
  // OpenAI
  { value: 'gpt-4o',                  label: 'GPT-4o',              provider: 'OpenAI'    },
  { value: 'gpt-4o-mini',             label: 'GPT-4o Mini',         provider: 'OpenAI'    },
  { value: 'o3-mini',                 label: 'o3-mini',             provider: 'OpenAI'    },
  // Google
  { value: 'gemini-2.5-pro',          label: 'Gemini 2.5 Pro',      provider: 'Google'    },
  { value: 'gemini-2.5-flash',        label: 'Gemini 2.5 Flash',    provider: 'Google'    },
  // Mistral
  { value: 'mistral-large-latest',    label: 'Mistral Large',       provider: 'Mistral'   },
  { value: 'mistral-small-latest',    label: 'Mistral Small',       provider: 'Mistral'   },
  // Cohere
  { value: 'command-r-plus',          label: 'Command R+',          provider: 'Cohere'    },
  { value: 'command-r',               label: 'Command R',           provider: 'Cohere'    },
  // Groq
  { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B',       provider: 'Groq'      },
  { value: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B',        provider: 'Groq'      },
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

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [files, setFiles] = useState<File[]>([])
  const [showKey, setShowKey] = useState(false)
  const [providerMode, setProviderMode] = useState<ProviderMode>('openrouter')
  const [model, setModel] = useState<string>(OPENROUTER_MODELS[0].value)

  const [instructions, setInstructions] = useState<string>('')
  const [apiKey, setApiKey] = useState<string>('')
  const [jobDescription, setJobDescription] = useState<string>('')
  
  const [errors, setErrors] = useState<{ files?: string; apiKey?: string }>({})


  function switchProvider(mode: ProviderMode) {
    setProviderMode(mode)
    setModel(mode === 'openrouter' ? OPENROUTER_MODELS[0].value : DIRECT_MODELS[0].value)
  }

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
  }, [theme])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? [])
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...incoming.filter(f => !existing.has(f.name))]
    })
    e.target.value = ''
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  function handleTailor() {
    const next: typeof errors = {}
    if (files.length === 0)   next.files  = 'Upload at least one resume file.'
    if (apiKey.trim() === '') next.apiKey = 'Enter your API key.'

    setErrors(next)                          // replaces the whole object
    if (Object.keys(next).length > 0) return // any error → stop

    console.log({ files, instructions, model, apiKey, jobDescription })
  }

  return ( 
    <div id="sidebar" data-theme={theme}>
      <header>
        <span className="wordmark">t<span className="wordmark-ai">AI</span>lor</span>
        <button
          className="logo-toggle"
          onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
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
            onChange={e => setApiKey(e.target.value)}
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

      <button className="primary-btn" onClick={() =>  handleTailor()}>Tailor Resume</button>

      <section>
        <span className="section-label">Output</span>
        <div className="output-area" />
        <button className="secondary-btn">↓ Download</button>
      </section>

      <section className="fallback-section">
        <span className="fallback-label">⚠ No job posting detected</span>
        <textarea 
          placeholder="paste job description here..." 
          value={jobDescription}
          onChange={e => setJobDescription(e.target.value)}
          />
      </section>

    </div>
  )
}

export default App
