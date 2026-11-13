import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Use the IPv4 literal by default: on Windows `localhost` can resolve to ::1
  // while uvicorn binds 127.0.0.1, which turns every proxied API call into 404.
  server: { proxy: { '/api': process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000' } },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/setupTests.js' },
})
