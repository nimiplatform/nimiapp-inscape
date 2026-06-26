import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const runtimeAiClient = readFileSync(new URL('../src/shell/ai/inscape-runtime-ai-client.ts', import.meta.url), 'utf8');

function blockAfter(label) {
  return viteConfig.match(new RegExp(`${label}:\\s*\\[([\\s\\S]*?)\\]`))?.[1] ?? '';
}

test('dev resolver treats local Nimi SDK and Kit source as the only platform contract surface', () => {
  assert.match(viteConfig, /const nimiSdkSourceRoot = path\.resolve\(nimiRepoRoot, 'sdks\/typescript'\);/);
  assert.match(viteConfig, /const nimiKitSourceRoot = path\.resolve\(nimiRepoRoot, 'kit'\);/);
  assert.ok(viteConfig.includes('find: /^@nimiplatform\\/sdk\\/runtime$/'));
  assert.ok(viteConfig.includes("replacement: path.resolve(nimiSdkSourceRoot, 'runtime/index.ts')"));
  assert.ok(viteConfig.includes('find: /^@nimiplatform\\/kit\\/shell\\/renderer\\/bridge$/'));
  assert.ok(viteConfig.includes("replacement: path.resolve(nimiKitSourceRoot, 'shell/renderer/src/bridge/index.ts')"));
  assert.match(blockAfter('exclude'), /'@nimiplatform\/sdk\/runtime'/);
  assert.match(blockAfter('exclude'), /'@nimiplatform\/kit\/shell\/renderer\/bridge'/);
  assert.doesNotMatch(blockAfter('include'), /@nimiplatform\/(?:sdk|kit)/);
  assert.match(styles, /@source "\.\.\/\.\.\/\.\.\/nimi\/kit\/\*\*\/\*\.\{ts,tsx\}";/);
  assert.doesNotMatch(styles, /@nimiplatform\/kit\/dist/);
});

test('runtime AI client consumes v2 targetRef without retired local ids', () => {
  const targetRefModelBody = runtimeAiClient.slice(
    runtimeAiClient.indexOf('function targetRefModel'),
    runtimeAiClient.indexOf('function schedulingTargetFor'),
  );
  assert.match(targetRefModelBody, /profileBindingId/);
  assert.match(targetRefModelBody, /readinessRef/);
  assert.doesNotMatch(targetRefModelBody, /profileId/);
  assert.doesNotMatch(targetRefModelBody, /targetId/);
  assert.match(runtimeAiClient, /readonly targetRef: NimiAIConfigTargetRef/);
  assert.match(runtimeAiClient, /targetRef: resolved\.targetRef/);
});
