import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'path'

const root = path.resolve(__dirname, 'src/renderer')

delete process.env.ELECTRON_RUN_AS_NODE

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: path.resolve(__dirname, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist/main'),
          },
        },
      },
      preload: {
        input: path.resolve(__dirname, 'src/main/preload.ts'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist/main'),
          },
        },
      },
    }),
  ],
  root,
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'src/renderer/index.html'),
        tray: path.resolve(__dirname, 'src/renderer/tray.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  publicDir: path.resolve(__dirname, 'src/renderer/public'),
  server: {
    port: 5174,
  },
})
