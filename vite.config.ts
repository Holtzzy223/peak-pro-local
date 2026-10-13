import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative paths so the build works under a GitHub Pages project subpath.
  base: './',
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    allowedHosts: ['.trycloudflare.com'],
  },
})
