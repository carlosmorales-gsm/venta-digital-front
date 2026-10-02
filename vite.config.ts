import { copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

const rootDir = dirname(fileURLToPath(import.meta.url))

function pdfWorkerAsJs(): Plugin {
  const src = resolve(
    rootDir,
    'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
  )
  const copyTo = (dest: string) => {
    if (!existsSync(src)) return
    copyFileSync(src, dest)
  }
  return {
    name: 'pdf-worker-as-js',
    closeBundle() {
      copyTo(resolve(rootDir, 'dist/pdf.worker.min.js'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), pdfWorkerAsJs()],
  server: {
    // 0.0.0.0: accesible desde celulares en la misma red Wi‑Fi
    host: true,
    port: 5173,
    open: true,
    proxy: {
      // El front llama /api; Vite reenvía al back de producción
      '/api': {
        target: 'http://localhost:3022',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:3022',
        changeOrigin: true,
      },
    },
  },
})
