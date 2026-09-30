import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// @nimi-authority: rule.inscape.privacy.r006
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), {
    name: 'inscape-development-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      // Vite's refresh preamble and exact loopback HMR are development-only.
      return html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
        .replace("connect-src 'none'", "connect-src 'self' ws://127.0.0.1:1431 ws://localhost:1431 ws://[::1]:1431");
    },
  }],
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
});
