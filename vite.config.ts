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
        // 개발 전용: 원본(3001)이 /api/* 를 자기 자신에게 부르면 vite가 라이트 로컬 api(3002)로
        // 대신 전달한다(= same-origin이라 브라우저 CORS 회피). 설치본에는 vite가 없으므로 이 프록시도
        // 없다 — 설치본의 서버 호출 통로는 별도(P1: Electron 메인 프로세스 경유)로 처리한다.
        proxy: {
          '/api': { target: 'http://localhost:3002', changeOrigin: true },
        },
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
        },
        // 중첩 서브앱(BTC_Admin_Server 등)이 자체 node_modules에 react를 또 갖고 있어,
        // dev에서 recharts가 그 두 번째 react에 묶여 "Invalid hook call"(React 두 벌)이 났다.
        // react/react-dom을 루트 한 벌로 강제 dedupe해 단일 인스턴스를 보장한다(배포 동작 불변).
        dedupe: ['react', 'react-dom'],
      }
    };
});
