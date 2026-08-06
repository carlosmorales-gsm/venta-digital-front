import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      // 127.0.0.1 evita fallos de IPv6 (::1) con localhost en Windows
      '/api': {
        target: 'http://127.0.0.1:3022',
        changeOrigin: true,
      },
    },
  },
})
