import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    cors: true,
    open: false,
    hmr: {
      host: 'localhost',
      clientPort: 3000,
      port: 5173,
      protocol: 'ws',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
})
