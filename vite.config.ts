import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 项目页部署在 /仓库名/ 子路径下，请与 GitHub 仓库名一致
  base: '/my-first-app/',
})
