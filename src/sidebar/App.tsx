import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [files, setFiles] = useState<File[]>([])
  const [showKey, setShowKey] = useState(false)

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

  return ( 
    <div id="sidebar" data-theme={theme}>
      <header>
        <span className="wordmark">t<span className="wordmark-ai">AI</span>lor</span>
        <button
          className="logo-toggle"
          onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
          aria-label="toggle theme"
        >
          <img src={theme === 'light' ? '../../logo/tailor_light.png' : '../../logo/tailor_dark.png'} height="30" width="30" />
        </button>
      </header>

      <section>
        <span className="section-label">Upload Resume</span>
        <label className="file-btn" htmlFor="myFile">+ choose files</label>
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
      </section>

      <section>
        <span className="section-label">Tailor Instructions</span>
        <textarea placeholder="e.g. emphasize leadership, keep to one page..." />
      </section>

      <section>
        <span className="section-label">Model</span>
        <select name="llms" id="llms">
          <option>Claude</option>
          <option>Gemini</option>
          <option>ChatGPT</option>
          <option>Other</option>
        </select>
        <span className="section-label">API Key</span>
        <div className="key-wrap">
          <input type={showKey ? 'text' : 'password'} placeholder="sk-..." />
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
      </section>

      <button className="primary-btn">Tailor Resume</button>

      <section>
        <span className="section-label">Output</span>
        <div className="output-area" />
        <button className="secondary-btn">↓ Download</button>
      </section>

      <section className="fallback-section">
        <span className="fallback-label">⚠ No job posting detected</span>
        <textarea placeholder="paste job description here..." />
      </section>

    </div>
  )
}

export default App
