import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3001,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      build: {
        sourcemap: false,
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          '@shared': path.resolve(__dirname, '../shared'),
        }
      }
    };
});
