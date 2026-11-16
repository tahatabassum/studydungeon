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
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/demo': 'http://127.0.0.1:8000',
      '/guests': 'http://127.0.0.1:8000',
      '/documents': 'http://127.0.0.1:8000',
      '/dungeons': 'http://127.0.0.1:8000',
      '/runs': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/leaderboard': 'http://127.0.0.1:8000',
      '/packs': 'http://127.0.0.1:8000',
      '/progress': 'http://127.0.0.1:8000',
      '/stats': 'http://127.0.0.1:8000',
      '/uploads': 'http://127.0.0.1:8000',
      '/reviews': 'http://127.0.0.1:8000',
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
