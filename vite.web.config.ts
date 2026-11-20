import { defineConfig, loadEnv, mergeConfig } from 'vite';
import { nimiWebViteConfig } from '@nimiplatform/app-tools/web';
import base from './vite.config.js';

export default defineConfig(({ command, mode }) =>
  mergeConfig(
    mergeConfig(base, {
      plugins: [
        {
          name: 'inscape-web-entry',
          transformIndexHtml: {
            order: 'pre',
            handler(html: string) {
              // Electron's index.html enforces connect-src 'none' for desktop offline isolation.
              // Hosted/dev Web uses browser coordination and WebRTC to reach the user's primary PC Runtime.
              return html
                .replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>\s*/u, '')
                .replace('/src/main.tsx', '/src/main.web.tsx');
            },
          },
        },
      ],
      build: { outDir: 'dist-web' },
    }),
    nimiWebViteConfig({
      root: import.meta.dirname,
      env: { ...loadEnv(mode, import.meta.dirname, ''), ...process.env },
      serve: command === 'serve',
      release: mode === 'web-release',
    }),
  ),
);
