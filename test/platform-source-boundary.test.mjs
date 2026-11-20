import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const manifest = readFileSync(new URL('../nimi.app.yaml', import.meta.url), 'utf8');
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const viteWeb = readFileSync(new URL('../vite.web.config.ts', import.meta.url), 'utf8');
const electronMain = readFileSync(new URL('../src-electron/main.ts', import.meta.url), 'utf8');
const desktopEntry = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const webEntry = readFileSync(new URL('../src/main.web.tsx', import.meta.url), 'utf8');
const appShell = readFileSync(new URL('../src/shell/App.tsx', import.meta.url), 'utf8');
const aiConfig = readFileSync(new URL('../src/shell/ai/inscape-ai-config.tsx', import.meta.url), 'utf8');
const aiClient = readFileSync(new URL('../src/shell/ai/inscape-runtime-ai-client.ts', import.meta.url), 'utf8');

const SEMVER_SPEC = /^\^?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

test('toolchain consumes public packages through dist exports for Desktop and Web', () => {
  assert.equal(packageJson.scripts.dev, 'nimi-app dev --shell electron');
  assert.equal(packageJson.scripts['dev:web'], 'nimi-app dev --platform web');
  assert.match(packageJson.scripts['build:web:release'], /vite build --config vite\.web\.config\.ts --mode web-release/);
  assert.match(packageJson.dependencies['@nimiplatform/sdk'], SEMVER_SPEC);
  assert.match(packageJson.dependencies['@nimiplatform/kit'], SEMVER_SPEC);
  assert.match(packageJson.devDependencies['@nimiplatform/app-tools'], SEMVER_SPEC);
  assert.doesNotMatch(vite, /nimiSdkSourceRoot|nimiKitSourceRoot|alias:/);
  assert.match(viteWeb, /nimiWebViteConfig/);
  assert.match(electronMain, /registerNimiElectronAppBridge/);
  assert.match(electronMain, /appCommandHandlers/);
});

test('manifest declares only the required App Access domain and public slug', () => {
  assert.match(manifest, /^profile: standalone$/mu);
  assert.match(manifest, /^public_slug: inscape$/mu);
  assert.match(manifest, /^app_access:\n  - runtime\.consume$/mu);
  assert.match(manifest, /renderer_origin: http:\/\/127\.0\.0\.1:1431/);
  assert.match(manifest, /command: pnpm run dev:web-renderer/);
  assert.doesNotMatch(manifest, /^permissions:/mu);
});

test('renderer uses protected App Session and local-only AI surfaces', () => {
  assert.match(desktopEntry, /createDesktopNimiAppSession/);
  assert.match(webEntry, /createWebNimiAppSession/);
  assert.match(appShell, /NimiAppAccessGate/);
  assert.match(aiConfig, /aiConfig\.(get|overwrite)/);
  assert.match(aiConfig, /allowedRoutes=\{\['local'\]\}/);
  assert.match(aiClient, /ai\.text\.generateCandidate/);
  assert.doesNotMatch(
    `${desktopEntry}\n${webEntry}\n${appShell}\n${aiConfig}\n${aiClient}`,
    /runtime\.account|first-party|permissions/,
  );
});
