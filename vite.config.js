// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Fichier d'entrée pour le processus principal
        entry: 'electron/main.cjs', 
        // Configuration pour la sortie (optionnel, le plugin déduit souvent)
        vite: {
          build: {
            outDir: 'dist-electron/main', // Ou juste 'dist-electron' si le plugin gère le nom
          },
        },
      },
      {
        // Fichier d'entrée pour le script de préchargement
        entry: 'electron/preload.cjs',
        onstart(options) {
          // Permet au script de préchargement de se recharger lorsque vous le modifiez
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload', // Ou juste 'dist-electron'
          },
        },
      },
    ]),
  ],
  base: './',
  build: {
    outDir: 'dist' // Pour la partie renderer (React)
  }
});