import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import webExtension from 'vite-plugin-web-extension'

export default defineConfig({
  base: "",
  plugins: [
    react(), 
    webExtension({
      browser: "firefox",
      // content.ts is no longer a declarative content_script in the manifest —
      // it's injected on demand via tabs.executeScript. The plugin only builds
      // files referenced in the manifest, so list it here to keep it bundled.
      additionalInputs: ["src/content/content.ts"],
    })
  ],
})