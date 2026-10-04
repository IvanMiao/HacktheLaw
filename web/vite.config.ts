import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { dominoApi } from './server/api.js'

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), dominoApi()],
    server: {
      fs: { allow: ['..'] },
      allowedHosts: true,
      proxy: {
        '/api/realtime': { target: `http://127.0.0.1:${process.env.VOICE_REALTIME_PORT ?? 8788}`, ws: true },
        '/api/intent': `http://127.0.0.1:${process.env.VOICE_PORT ?? 8787}`,
        '/api/transcribe': `http://127.0.0.1:${process.env.VOICE_PORT ?? 8787}`,
        '/api/status': `http://127.0.0.1:${process.env.VOICE_PORT ?? 8787}`,
      },
    },
  }
})
