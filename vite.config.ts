import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const appReact = fileURLToPath(new URL('./node_modules/react/index.js', import.meta.url));
const appReactDom = fileURLToPath(new URL('./node_modules/react-dom/index.js', import.meta.url));
const appReactJsxRuntime = fileURLToPath(
  new URL('./node_modules/react/jsx-runtime.js', import.meta.url),
);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^react$/, replacement: appReact },
      { find: /^react-dom$/, replacement: appReactDom },
      { find: /^react\/jsx-runtime$/, replacement: appReactJsxRuntime },
    ],
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
});
