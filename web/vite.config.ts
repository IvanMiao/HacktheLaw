import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..'] }, allowedHosts: true, proxy: { '/api/realtime': { target: 'http://127.0.0.1:8788', ws: true }, '/api': 'http://127.0.0.1:8787' } },
})
