#!/usr/bin/env node
/* global console, process */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONFIG_PATH = join(ROOT, 'scripts', 'i18n.config.json');

const COPY_ATTRS = [
  'aria-label',
  'placeholder',
  'title',
  'alt',
  'label',
  'description',
];

const COPY_PROPS = [
  'ariaLabel',
  'emptyText',
  'helperText',
  'label',
  'placeholder',
  'subtitle',
  'text',
  'title',
];

function toPosixPath(pathLike) {
  return pathLike.replaceAll('\\', '/');
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
  const parsed = loadJson(CONFIG_PATH);
  const audit = parsed.audit ?? {};
  return {
    allowTextPatterns: Array.isArray(audit.allowTextPatterns) ? audit.allowTextPatterns : [],
    excludePathPatterns: Array.isArray(audit.excludePathPatterns) ? audit.excludePathPatterns : [],
    extensions: Array.isArray(audit.extensions) ? audit.extensions : ['.tsx', '.html'],
    scopeDirs: Array.isArray(audit.scopeDirs) ? audit.scopeDirs : [],
  };
}

function collectFiles(input) {
  if (!existsSync(input)) {
    return [];
  }
  const info = statSync(input);
  if (info.isFile()) {
    return [input];
  }

  const files = [];
  for (const entry of readdirSync(input, { withFileTypes: true })) {
    files.push(...collectFiles(join(input, entry.name)));
  }
  return files;
}

function shouldExcludeFile(filePath, excludePatterns) {
  const normalized = toPosixPath(filePath);
  return excludePatterns.some((pattern) => normalized.includes(String(pattern)));
}

function stripHtmlCommentsPreserveLines(source) {
  return source.replace(/<!--[\s\S]*?-->/g, (match) => match.replace(/[^\n]/g, ''));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeBasicEntities(value) {
  return value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function compactText(value) {
  return decodeBasicEntities(value).replace(/\s+/g, ' ').trim();
}

function lineNumberAt(source, index) {
  let line = 1;
  for (let offset = 0; offset < index; offset += 1) {
    if (source[offset] === '\n') {
      line += 1;
    }
  }
  return line;
}

function lineFromSourceFile(sourceFile, index) {
  return sourceFile.getLineAndCharacterOfPosition(index).line + 1;
}

function stringLiteralText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function propertyNameText(name, sourceFile) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return name.getText(sourceFile);
}

function extractTsxCandidates(source, filePath) {
  const candidates = [];
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function visit(node) {
    if (ts.isJsxText(node)) {
      candidates.push({
        kind: 'markup text',
        line: lineFromSourceFile(sourceFile, node.getStart(sourceFile)),
        text: node.getText(sourceFile),
      });
    }
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (COPY_ATTRS.includes(name) && node.initializer) {
        let text = null;
        if (ts.isStringLiteral(node.initializer)) {
          text = node.initializer.text;
        } else if (
          ts.isJsxExpression(node.initializer)
          && node.initializer.expression
        ) {
          text = stringLiteralText(node.initializer.expression);
        }
        if (text !== null) {
          candidates.push({
            kind: 'literal attribute',
            line: lineFromSourceFile(sourceFile, node.getStart(sourceFile)),
            text,
          });
        }
      }
    }
    if (ts.isPropertyAssignment(node)) {
      const name = propertyNameText(node.name, sourceFile);
      const text = COPY_PROPS.includes(name) ? stringLiteralText(node.initializer) : null;
      if (text !== null) {
        candidates.push({
          kind: 'copy property',
          line: lineFromSourceFile(sourceFile, node.getStart(sourceFile)),
          text,
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return candidates;
}

function extractHtmlCandidates(source) {
  const candidates = [];
  const normalizedSource = stripHtmlCommentsPreserveLines(source);
  const rawTextRegex = />\s*([^<>{]+?)\s*</g;
  let textMatch;
  while ((textMatch = rawTextRegex.exec(normalizedSource))) {
    const textIndex = textMatch.index + textMatch[0].indexOf(textMatch[1]);
    candidates.push({
      kind: 'markup text',
      line: lineNumberAt(normalizedSource, textIndex),
      text: textMatch[1],
    });
  }

  const attrNames = COPY_ATTRS.map(escapeRegExp).join('|');
  const attrRegex = new RegExp(`\\b(?:${attrNames})\\s*=\\s*["'\`]([^"'\`]+)["'\`]`, 'g');
  let attrMatch;
  while ((attrMatch = attrRegex.exec(normalizedSource))) {
    candidates.push({
      kind: 'literal attribute',
      line: lineNumberAt(normalizedSource, attrMatch.index),
      text: attrMatch[1],
    });
  }
  return candidates;
}

function extractCandidatesFromSource(source, filePath, extension) {
  if (extension === '.tsx') {
    return extractTsxCandidates(source, filePath);
  }
  if (extension === '.html') {
    return extractHtmlCandidates(source);
  }
  return [];
}

function isReasonCode(text) {
  return /^[A-Z0-9_+.-]+$/.test(text);
}

function isUserVisibleLiteral(text) {
  if (!text) {
    return false;
  }
  if (text.includes('${')) {
    return false;
  }
  if (!/[A-Za-z\u4E00-\u9FFF]/.test(text)) {
    return false;
  }
  if (isReasonCode(text)) {
    return false;
  }
  return true;
}

function runAudit() {
  const config = loadConfig();
  if (config.scopeDirs.length === 0) {
    throw new Error('audit.scopeDirs is empty');
  }

  const allowRegexes = config.allowTextPatterns.map((pattern) => new RegExp(pattern));
  const seenFiles = new Set();
  const violations = [];
  let scannedFiles = 0;

  for (const scopeDir of config.scopeDirs) {
    const absoluteScope = join(ROOT, scopeDir);
    for (const filePath of collectFiles(absoluteScope)) {
      const extension = extname(filePath);
      if (!config.extensions.includes(extension)) {
        continue;
      }

      const relativePath = toPosixPath(relative(ROOT, filePath));
      if (seenFiles.has(relativePath)) {
        continue;
      }
      seenFiles.add(relativePath);
      if (shouldExcludeFile(relativePath, config.excludePathPatterns)) {
        continue;
      }

      scannedFiles += 1;
      const source = readFileSync(filePath, 'utf8');
      for (const candidate of extractCandidatesFromSource(source, filePath, extension)) {
        const text = compactText(candidate.text);
        if (!isUserVisibleLiteral(text)) {
          continue;
        }
        if (allowRegexes.some((regex) => regex.test(text))) {
          continue;
        }
        violations.push({
          file: relativePath,
          kind: candidate.kind,
          line: candidate.line,
          text,
        });
      }
    }
  }

  if (violations.length > 0) {
    console.error(`i18n:audit found ${violations.length} hardcoded user-facing literal(s):`);
    for (const violation of violations.slice(0, 120)) {
      console.error(` - ${violation.file}:${violation.line} [${violation.kind}] ${violation.text}`);
    }
    if (violations.length > 120) {
      console.error(` ... ${violations.length - 120} more violation(s)`);
    }
    throw new Error('replace hardcoded UI copy with locale keys and t(...)');
  }

  console.log(`i18n:audit passed (${scannedFiles} file(s) scanned).`);
}

try {
  runAudit();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error || 'unknown error');
  console.error(`i18n:audit failed: ${message}`);
  process.exit(1);
}
