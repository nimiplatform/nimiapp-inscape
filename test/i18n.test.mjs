import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSCAPE_LOCALES } from '../src/domain/locale.ts';
import { FACES } from '../src/product/navigation/tab-descriptor.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RELATIONSHIP_NATURES = [
  'partner',
  'parent',
  'child',
  'sibling',
  'friend',
  'coworker',
  'mentor',
  'other',
];

const REFUSAL_CATEGORIES = [
  'money',
  'employment',
  'sexual_consent',
  'decision_pressure',
];

function loadLocale(locale) {
  return JSON.parse(readFileSync(path.join(ROOT, `src/shell/locales/${locale}.json`), 'utf8'));
}

function leafShape(value, prefix = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => leafShape(child, prefix ? `${prefix}.${key}` : key));
  }
  return [`${prefix}:${typeof value}`];
}

function getPath(value, dottedPath) {
  return dottedPath.split('.').reduce((current, segment) => current?.[segment], value);
}

test('locale resources have the same leaf-key shape', () => {
  const en = loadLocale('en');
  const zh = loadLocale('zh');
  assert.deepEqual(leafShape(en).sort(), leafShape(zh).sort());
});

test('locale resources cover all dynamic product keys', () => {
  for (const locale of INSCAPE_LOCALES) {
    const copy = loadLocale(locale);
    for (const supportedLocale of INSCAPE_LOCALES) {
      assert.equal(typeof getPath(copy, `Language.short.${supportedLocale}`), 'string');
    }
    for (const face of FACES) {
      assert.equal(typeof getPath(copy, `Navigation.faces.${face.id}`), 'string');
    }
    for (const nature of RELATIONSHIP_NATURES) {
      assert.equal(typeof getPath(copy, `RelationshipNature.${nature}`), 'string');
    }
    for (const category of REFUSAL_CATEGORIES) {
      assert.equal(typeof getPath(copy, `CommunicationRewrite.refusal.${category}`), 'string');
    }
  }
});
