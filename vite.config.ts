import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appReact = fileURLToPath(new URL('./node_modules/react/index.js', import.meta.url));
const appReactDom = fileURLToPath(new URL('./node_modules/react-dom/index.js', import.meta.url));
const appReactJsxRuntime = fileURLToPath(
  new URL('./node_modules/react/jsx-runtime.js', import.meta.url),
);
const appRoot = fileURLToPath(new URL('.', import.meta.url));
const nimiRepoRoot = path.resolve(appRoot, '../../nimi');
const nimiSdkSourceRoot = path.resolve(nimiRepoRoot, 'sdks/typescript');
const nimiKitSourceRoot = path.resolve(nimiRepoRoot, 'kit');

function normalizeId(id: string): string {
  return id.split(path.sep).join('/');
}

function isNimiSdkModule(normalizedId: string): boolean {
  return (
    normalizedId.includes('/node_modules/@nimiplatform/sdk/')
    || normalizedId.includes('/node_modules/.pnpm/@nimiplatform+sdk@')
    || normalizedId.includes('/nimi-realm/nimi/sdks/typescript/')
  );
}

function isNimiKitModule(normalizedId: string): boolean {
  return (
    normalizedId.includes('/node_modules/@nimiplatform/kit/')
    || normalizedId.includes('/node_modules/.pnpm/@nimiplatform+kit@')
    || normalizedId.includes('/nimi-realm/nimi/kit/')
  );
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^react$/, replacement: appReact },
      { find: /^react-dom$/, replacement: appReactDom },
      { find: /^react\/jsx-runtime$/, replacement: appReactJsxRuntime },
      { find: /^@nimiplatform\/sdk$/, replacement: path.resolve(nimiSdkSourceRoot, 'index.ts') },
      { find: /^@nimiplatform\/sdk\/ai$/, replacement: path.resolve(nimiSdkSourceRoot, 'core/ai/index.ts') },
      { find: /^@nimiplatform\/sdk\/runtime$/, replacement: path.resolve(nimiSdkSourceRoot, 'runtime/index.ts') },
      { find: /^@nimiplatform\/sdk\/runtime\/generated$/, replacement: path.resolve(nimiSdkSourceRoot, 'runtime/generated.ts') },
      { find: /^@nimiplatform\/sdk\/types$/, replacement: path.resolve(nimiSdkSourceRoot, 'types/index.ts') },
      { find: /^@nimiplatform\/kit\/auth$/, replacement: path.resolve(nimiKitSourceRoot, 'auth/src/index.ts') },
      { find: /^@nimiplatform\/kit\/auth\/styles\.css$/, replacement: path.resolve(nimiKitSourceRoot, 'auth/src/styles.css') },
      { find: /^@nimiplatform\/kit\/core\/oauth$/, replacement: path.resolve(nimiKitSourceRoot, 'core/src/oauth/index.ts') },
      { find: /^@nimiplatform\/kit\/core\/storage-json$/, replacement: path.resolve(nimiKitSourceRoot, 'core/src/storage-json.ts') },
      { find: /^@nimiplatform\/kit\/shell\/renderer\/bridge$/, replacement: path.resolve(nimiKitSourceRoot, 'shell/renderer/src/bridge/index.ts') },
      { find: /^@nimiplatform\/kit\/ui$/, replacement: path.resolve(nimiKitSourceRoot, 'ui/src/index.ts') },
      { find: /^@nimiplatform\/kit\/ui\/styles\.css$/, replacement: path.resolve(nimiKitSourceRoot, 'ui/src/styles.css') },
      { find: /^@nimiplatform\/kit\/ui\/themes\/(.+\.css)$/, replacement: path.resolve(nimiKitSourceRoot, 'ui/src/themes/$1') },
      { find: /^@nimiplatform\/kit\/ui\/(.+)$/, replacement: path.resolve(nimiKitSourceRoot, 'ui/src/$1') },
    ],
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  optimizeDeps: {
    exclude: [
      '@nimiplatform/kit',
      '@nimiplatform/kit/ui',
      '@nimiplatform/kit/auth',
      '@nimiplatform/kit/shell/renderer/bridge',
      '@nimiplatform/sdk',
      '@nimiplatform/sdk/ai',
      '@nimiplatform/sdk/runtime',
      '@nimiplatform/sdk/runtime/generated',
      '@nimiplatform/sdk/types',
    ],
  },
  server: {
    fs: {
      allow: [
        appRoot,
        nimiRepoRoot,
      ],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = normalizeId(id);
          if (isNimiSdkModule(normalizedId)) {
            if (normalizedId.includes('/core-generated/')) return 'nimi-sdk-generated';
            return 'nimi-sdk';
          }
          if (isNimiKitModule(normalizedId)) return 'nimi-kit';
          return undefined;
        },
      },
    },
  },
});
