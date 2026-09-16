import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // 0.0.0.0: accesible desde celulares en la misma red Wi‑Fi
    host: true,
    port: 5173,
    open: true,
    proxy: {
      // El teléfono pega al front; Vite reenvía /api al backend local
      '/api': {
        target: 'https://api-venta-digital.gsanmartin.net',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': {
        target: 'https://api-venta-digital.gsanmartin.net',
        changeOrigin: true,
      },
    },
  },
})
