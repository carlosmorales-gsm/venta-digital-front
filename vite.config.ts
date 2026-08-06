import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Evita CORS en local: el front llama /api → backend :3022
      '/api': {
        target: 'http://localhost:3022',
        changeOrigin: true,
      },
    },
  },
})
