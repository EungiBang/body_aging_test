import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3001,
        host: '0.0.0.0',
      },
      plugins: [
        react(), 
        tailwindcss(),
        viteStaticCopy({
          targets: [
            {
              src: 'node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm',
              dest: 'wasm'
            }
          ]
        })
      ],
      build: {
        sourcemap: false,
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
