import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    // Mesmo domínio em dev e na Vercel: /api vai para a API Hono (apps/api, porta 3000).
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: { environment: 'happy-dom' },
})
