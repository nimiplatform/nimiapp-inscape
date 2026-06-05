// Inscape redline lint — enforces the IS-* hard boundaries that are source-
// scannable. Hard-fails on: direct AI provider imports (T1-07 ai-boundary),
// telemetry/analytics sinks (IS-PROD-06), a cloud route literal (T1-08), and
// the MBTI(R) trademark in product copy (T1-09). The CSP (T1-06) is reported
// as a warning — its value needs one live `tauri dev` pass to verify it does
// not break IPC / the local runtime connection, so it is not silently claimed.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const SOURCE_EXTS = new Set(['.ts', '.tsx']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) out.push(...walk(full));
    else if (SOURCE_EXTS.has(extname(full))) out.push(full);
  }
  return out;
}

// Strip block + line comments so comments may reference a banned term while
// product code / strings cannot. Keeps `://` in URLs from being treated as a
// line comment.
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const RULES = [
  {
    id: 'T1-07 ai-boundary',
    re: /from\s+['"](openai|@anthropic-ai\/sdk|@google\/genai|@google\/generative-ai|cohere-ai|@nimiplatform\/sdk\/ai-provider)['"]/,
    hint: 'AI only via @nimiplatform/sdk + src/shell/ai; no direct provider SDK or ai-provider bypass',
  },
  {
    id: 'no-telemetry',
    re: /from\s+['"](@sentry\/\w+|posthog-js|posthog|mixpanel(-browser)?|@segment\/\w+|@amplitude\/\w+|amplitude-js)['"]/,
    hint: 'no telemetry / analytics sinks (IS-PROD-06)',
  },
  {
    id: 'T1-08 route-cloud',
    re: /route\s*:\s*['"]cloud['"]/,
    hint: 'local route only; no cloud rescue (IS-AI-02)',
  },
  {
    id: 'T1-09 mbti-trademark',
    re: /Myers-?Briggs|MBTI\s*(®|\(R\))/,
    hint: 'no MBTI(R) trademark in product copy; use Jungian / 16-type (allowlisted disclaimer only)',
  },
];

const violations = [];
const warnings = [];

const files = walk('src');
for (const file of files) {
  const code = stripComments(readFileSync(file, 'utf8'));
  for (const rule of RULES) {
    const match = code.match(rule.re);
    if (match) {
      violations.push(`${file}: [${rule.id}] matched "${match[0].trim()}" — ${rule.hint}`);
    }
  }
}

// T1-06 CSP — warning only (value requires live verification).
try {
  const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  const csp = conf?.app?.security?.csp;
  if (!csp || typeof csp !== 'string') {
    warnings.push(
      "T1-06 CSP: src-tauri/tauri.conf.json has no app.security.csp. Set connect-src to 'self' + the local runtime and verify on `tauri dev` (a wrong CSP breaks IPC).",
    );
  } else if (/connect-src[^;]*\*/.test(csp)) {
    violations.push(
      "src-tauri/tauri.conf.json: [T1-06 CSP] connect-src contains a wildcard — tighten to 'self' + the local runtime origin",
    );
  }
} catch (error) {
  warnings.push(`T1-06 CSP: could not read src-tauri/tauri.conf.json (${error.message})`);
}

for (const warning of warnings) {
  console.warn(`[redline:warn] ${warning}`);
}
if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`[redline:FAIL] ${violation}`);
  }
  console.error(`\n${violations.length} redline violation(s).`);
  process.exit(1);
}
console.log(
  `redline check passed (${files.length} source files scanned)${
    warnings.length ? `, ${warnings.length} warning(s)` : ''
  }.`,
);
