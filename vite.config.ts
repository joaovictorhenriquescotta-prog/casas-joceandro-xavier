import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // o processamento do modelo no painel roda num Web Worker com módulos ES
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 2500 },
})
