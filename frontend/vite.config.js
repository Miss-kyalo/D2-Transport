import react from '@vitejs/plugin-react'
import process from 'node:process'
import { defineConfig } from 'vite'

const backendTarget = process.env.BACKEND_URL || 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true
      }
    }
  }
})
