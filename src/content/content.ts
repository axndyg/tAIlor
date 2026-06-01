// content script — QUERY agent, Stage A: read the host page's DOM.
// This script is injected INTO whatever web page is open (see manifest
// content_scripts). It shares that page's DOM but is a *dumb reader*:
// it grabs visible text and hands it back. It never touches the LLM —
// per project rule, all LLM calls live in the background script.

// The message the sidebar sends us. Minimal on purpose: a content script
// doesn't need a model or API key, it just needs to be told "go read."
interface QueryRequest {
  type: 'QUERY_REQUEST'
}

// The reply we send back. A wrapper (not a bare string) so we can grow it
// later — url is here for design/debugging ("we captured this URL but it
// looked wrong"); success/error leave room to report a failed read.
// New concept: this is the *response* shape — deliberately separate from
// QueryRequest, exactly like TailorMessage vs TailorResponse in background.ts.
interface QueryResponse {
  success: boolean
  text?: string   // present on a good read
  url?: string    // the page we read it from
  error?: string  // present if the read failed
}

declare const browser: {
  runtime: {
    onMessage: {
      addListener(
        // The callback returns the *response*, never the request.
        cb: (message: unknown) => Promise<QueryResponse> | undefined
      ): void
    }
  }
}

browser.runtime.onMessage.addListener((message) => {
  const msg = message as QueryRequest
  if (msg.type !== 'QUERY_REQUEST') return undefined

  // textContent = *all* text in the DOM, including content hidden via CSS —
  // noisier than innerText but captures more (e.g. collapsed job descriptions).
  // We capture generously here and let QUERY Stage B (the LLM) filter the noise.
  // textContent can be null on an empty body, so coalesce to ''.
  const text = document.body.textContent ?? ''

  // New concept: Promise.resolve(value) wraps a value we already have in an
  // already-settled Promise. Firefox only delivers a reply if the listener
  // returns a Promise; a plain `return {...}` would be silently dropped.
  return Promise.resolve({
    success: true,
    text,
    url: location.href,   // location.href = the current page's full URL
  })
})

console.debug('[tAIlor] content script ready — QUERY listener loaded')
