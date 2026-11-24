import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Same as production (vercel.json): only /api/* goes to the backend, without the /api prefix. Page routes
    // such as /leaderboard and /packs stay with the app. Use VITE_API_BASE=/api for same-origin cookies in dev.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_BACKEND ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    // Phaser is large; keep it in its own chunk.
    rollupOptions: { output: { manualChunks: (id: string) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
    chunkSizeWarningLimit: 1600,
  },
});
