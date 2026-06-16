#!/usr/bin/env node
/* global console, process */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONFIG_PATH = join(ROOT, 'scripts', 'i18n.config.json');

function flattenLeaves(value, prefix = '') {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      return flattenLeaves(child, nextPrefix);
    });
  }
  return [`${prefix}:${typeof value}`];
}

function loadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to read JSON ${filePath}: ${message}`);
  }
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`missing i18n config: ${CONFIG_PATH}`);
  }
  const config = loadJson(CONFIG_PATH);
  const supportedLocales = Array.isArray(config.supportedLocales)
    ? config.supportedLocales.filter((locale) => typeof locale === 'string' && locale.trim().length > 0)
    : [];
  const sourceLocale = typeof config.check?.sourceLocale === 'string' ? config.check.sourceLocale : 'en';
  const localesDir = typeof config.check?.localesDir === 'string' ? config.check.localesDir : 'src/shell/locales';

  if (!supportedLocales.includes('en') || !supportedLocales.includes('zh')) {
    throw new Error('supportedLocales must include both "en" and "zh"');
  }
  if (!supportedLocales.includes(sourceLocale)) {
    throw new Error(`sourceLocale "${sourceLocale}" is not listed in supportedLocales`);
  }

  return {
    localesDir: join(ROOT, localesDir),
    sourceLocale,
    supportedLocales,
  };
}

function localePath(localesDir, locale) {
  return join(localesDir, `${locale}.json`);
}

function runCheck() {
  const { localesDir, sourceLocale, supportedLocales } = loadConfig();
  const sourcePath = localePath(localesDir, sourceLocale);
  if (!existsSync(sourcePath)) {
    throw new Error(`source locale bundle not found: ${sourcePath}`);
  }

  const sourceLeaves = new Set(flattenLeaves(loadJson(sourcePath)));
  let totalMissing = 0;
  let totalExtra = 0;

  console.log(`i18n:check source=${sourceLocale} keys=${sourceLeaves.size}`);

  for (const locale of supportedLocales) {
    const currentPath = localePath(localesDir, locale);
    if (!existsSync(currentPath)) {
      totalMissing += sourceLeaves.size;
      console.error(` - ${locale}: missing bundle (${currentPath})`);
      continue;
    }

    const currentLeaves = new Set(flattenLeaves(loadJson(currentPath)));
    const missing = [...sourceLeaves].filter((key) => !currentLeaves.has(key));
    const extra = [...currentLeaves].filter((key) => !sourceLeaves.has(key));

    totalMissing += missing.length;
    totalExtra += extra.length;

    const status = missing.length === 0 && extra.length === 0 ? 'ok' : 'fail';
    console.log(` - ${locale}: ${status} keys=${currentLeaves.size} missing=${missing.length} extra=${extra.length}`);

    for (const key of missing.slice(0, 30)) {
      console.error(`   missing: ${key}`);
    }
    for (const key of extra.slice(0, 30)) {
      console.error(`   extra: ${key}`);
    }
    if (missing.length > 30) {
      console.error(`   ... ${missing.length - 30} more missing key(s)`);
    }
    if (extra.length > 30) {
      console.error(`   ... ${extra.length - 30} more extra key(s)`);
    }
  }

  if (totalMissing > 0 || totalExtra > 0) {
    throw new Error(`locale bundles diverged: missing=${totalMissing} extra=${totalExtra}`);
  }

  console.log('i18n:check passed.');
}

try {
  runCheck();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error || 'unknown error');
  console.error(`i18n:check failed: ${message}`);
  process.exit(1);
}
