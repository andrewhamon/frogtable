import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from 'tailwindcss';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      "/rpc": 'http://localhost:3000',
      "/sse": 'http://localhost:3000',
    }
  },
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  }
})
