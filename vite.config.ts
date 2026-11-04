import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // dev: chuyển tiếp WebSocket tới Worker chạy local bằng `wrangler dev` (npm run dev chạy cả hai)
    proxy: { '/ws': { target: 'http://localhost:8787', ws: true } },
  },
})
