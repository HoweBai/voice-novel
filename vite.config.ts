import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        // AI 分析一章可能耗时数分钟，禁用代理超时
        timeout: 0,
        proxyTimeout: 0,
      },
      '/audio': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
