import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';

const externals = [ 'electron', 'better-sqlite3', 'path', 'fs', 'util', 'stream', 'http', 'https', 'url', 'zlib' ];

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.cjs',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: externals,
            },
          },
        },
      },
      {
        entry: 'electron/preload.cjs',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: externals,
            },
          },
        },
      },
    ]),
  ],
  base: './',
  build: {
    outDir: 'dist'
  }
});