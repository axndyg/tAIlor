import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import webExtension from 'vite-plugin-web-extension'

export default defineConfig({
  base: "",
  plugins: [
    react(), 
    webExtension({
      browser: "firefox",
      // Force all generated background/content scripts to bundle into standard script strings
      scriptViteConfig: {
        build: {
          rollupOptions: {
            output: {
              format: "iife", 
            }
          }
        }
      }
    })
  ],
})