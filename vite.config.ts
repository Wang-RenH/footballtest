import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

/** 浏览器无法直连多数 AI API（CORS），开发/预览走本地代理 */
const aiProxy = {
  '/ai-proxy/deepseek': {
    target: 'https://api.deepseek.com',
    changeOrigin: true,
    secure: true,
    timeout: 180_000,
    proxyTimeout: 180_000,
    rewrite: (p: string) => p.replace(/^\/ai-proxy\/deepseek/, ''),
  },
  '/ai-proxy/mimo': {
    target: 'https://api.xiaomimimo.com',
    changeOrigin: true,
    secure: true,
    timeout: 180_000,
    proxyTimeout: 180_000,
    rewrite: (p: string) => p.replace(/^\/ai-proxy\/mimo/, ''),
  },
  '/ai-proxy/glm': {
    target: 'https://open.bigmodel.cn',
    changeOrigin: true,
    secure: true,
    timeout: 180_000,
    proxyTimeout: 180_000,
    rewrite: (p: string) => p.replace(/^\/ai-proxy\/glm/, ''),
  },
  '/ai-proxy/minimax': {
    target: 'https://api.minimaxi.com',
    changeOrigin: true,
    secure: true,
    timeout: 180_000,
    proxyTimeout: 180_000,
    rewrite: (p: string) => p.replace(/^\/ai-proxy\/minimax/, ''),
  },
}

export default defineConfig({
  // 默认 /（自建服务器）。仅 GitHub Actions 设 GITHUB_PAGES=true 时用子路径。
  base: process.env.GITHUB_PAGES === 'true' ? '/footballtest/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(root, './src'),
    },
  },
  server: {
    proxy: aiProxy,
  },
  preview: {
    proxy: aiProxy,
  },
})
