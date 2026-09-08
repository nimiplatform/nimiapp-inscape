import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const manifest = readFileSync(new URL('../nimi.app.yaml', import.meta.url), 'utf8');
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const electronMain = readFileSync(new URL('../src-electron/main.ts', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../src/shell/infra/inscape-bootstrap.ts', import.meta.url), 'utf8');
const aiClient = readFileSync(new URL('../src/shell/ai/inscape-runtime-ai-client.ts', import.meta.url), 'utf8');

test('toolchain consumes public packages through dist exports and Electron', () => {
  assert.equal(packageJson.scripts.dev, 'nimi-app dev --shell electron');
  assert.match(packageJson.dependencies['@nimiplatform/sdk'], /^\^?\d+\.\d+\.\d+$/);
  assert.match(packageJson.dependencies['@nimiplatform/kit'], /^\^?\d+\.\d+\.\d+$/);
  assert.match(packageJson.devDependencies['@nimiplatform/app-tools'], /^\^?\d+\.\d+\.\d+$/);
  assert.doesNotMatch(vite, /nimiSdkSourceRoot|nimiKitSourceRoot|alias:/);
  assert.match(electronMain, /registerNimiElectronAppBridge/);
  assert.match(electronMain, /appCommandHandlers/);
});

test('manifest declares only the required App Access domain', () => {
  assert.match(manifest, /^profile: standalone$/mu);
  assert.match(manifest, /^app_access:\n  - runtime\.consume$/mu);
  assert.match(manifest, /renderer_origin: http:\/\/127\.0\.0\.1:1431/);
  assert.doesNotMatch(manifest, /^permissions:/mu);
});

test('renderer uses protected local App Access surfaces only', () => {
  assert.match(bootstrap, /createNimiLocalAppStandardShellSurface/);
  assert.match(bootstrap, /createNimiClient\(\{\s*localApp:/su);
  assert.match(bootstrap, /client\.auth\.status\(\)/);
  assert.match(bootstrap, /client\.currentUser\.get\(\)/);
  assert.match(bootstrap, /client\.aiConfig\.(get|overwrite)/);
  assert.match(aiClient, /ai\.text\.generateCandidate/);
  assert.doesNotMatch(`${bootstrap}\n${aiClient}`, /runtime\.account|first-party|permissions/);
});
