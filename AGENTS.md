# Inscape (心相) AGENTS.md

> Authoritative module-level instructions for AI agents working on Inscape.

## Identity

- **App name (Chinese)**: 心相
- **App name (English)**: Inscape
- **Canonical Nimi app_id**: `nimi.inscape`
- **Product slug**: `inscape`
- **Electron App Access id**: `nimi.inscape`
- **Submitted manifest app_id**: `nimi.inscape`
- **One-line**: A fully local, open-source, 18+ desktop app that turns Jungian
  typology (cognitive-function stack + Beebe archetypes) into daily-life
  application — type as a moving probability distribution, refined only by
  user-driven signals.
- **Status**: Pre-Alpha. wave-1 build baseline; not yet launched.

## Provenance

Forked 2026-06-05 from `nimiapp-shijing`'s **non-product** consumption layer
(`src/shell/**`, the former Tauri shell wiring, the persistence
interface, the test/build/governance scaffold). ShiJing's product layer
(astrology pipeline, ShiJingSpace domain, product tabs) was **not** carried
over. There must be **no** shijing / astrology / `SJG-*` remnants in this repo.

Product authority lives in the nimi-realm topic
`.nimi/topics/ongoing/2026-05-27-inscape-app-design-and-audit-closure`
(`product-manual.md`, `user-storyboard.md`, `implementation-approach.md`).

## Architecture

| Layer | Technology | Location |
|-------|-----------|----------|
| Desktop shell | Electron 42 + Desktop-supervised App Access carrier | `src-electron/` |
| Frontend | React 19 + Vite 7 | `src/shell/renderer` (`src/main.tsx`) |
| Consumption layer | protected local App Access bootstrap | `src/shell/{app-shell,infra,persistence}` |
| Persistence | **Custom SQLite** (G1, `better-sqlite3`) | `src-electron/persistence.ts` + `src/shell/persistence/runtime-app-storage-adapter.ts` |
| AI wording | `runtime.consume` via `ai.text.generateCandidate` | `src/shell/ai/**` |
| UI components | `@nimiplatform/kit` | npm link |
| Domain (product) | InscapeSpace + IS-* contracts | `src/domain`, `src/contracts` (wave-2) |

`@nimiplatform/{sdk,kit,app-tools}` consume the public package versions selected
by the published app-tools `sync` command, only through their built exports.

## Hard boundaries

- **18+ fail-close (G1 / T1-04 / T1-05)**: the SQLite layer opens
  `<electron-user-data>/inscape.db` with `0o600` and
  `CHECK (attested_adult = 1)`; the space is never persisted without an adult
  attestation. Keep this gate at the DB level.
- **Runtime owns identity**: the app never custodies access/refresh tokens
  (protected local App Access `auth.status` + `currentUser.get`). No app-owned
  token surface.
- **Local only**: no cloud, no telemetry, no cross-app data hub.
- **No astrology**: this is typology, not bazi/ganzhi. No ShiJing vocabulary.
- **No legacy/compat shims, no fallback that hides a contract violation.**

## Verification

```bash
pnpm build     # typecheck + Electron host/preload + Vite renderer
pnpm test      # node --test test/*.test.mjs
pnpm lint
```

## Conventions

- ULID for new IDs. ISO 8601 (UTC, explicit `Z`) for persisted timestamps.
- ESM imports use the `.ts` extension for in-repo TypeScript (Node 24 native
  type-strip; `tsconfig` `allowImportingTsExtensions`).
- `Logger`/structured logging via `src/shell/infra/renderer-log.ts`; never bare
  `console.*` in product source.
- `.nimi/methodology/authority-authoring.yaml` is managed by
  `@nimiplatform/nimi-coding`; app-specific configuration remains host owned.

<!-- nimicoding:managed:agents:start -->
# Nimi Coding Managed Block

- From the repository root, invoke the pinned project-local CLI as `pnpm exec nimicoding`; do not probe or rely on a global `nimicoding` binary in `PATH`.
- Product authority lives under `.nimi/spec/**`.
- Choose authority and code queries when their declared scope can resolve an uncertainty that affects the current task; reuse sufficient current evidence. Query scope is not the limit of host reasoning or authorized work, and hypotheses are not product authority.
- For canonical authority authoring, read only `.nimi/methodology/authority-authoring.yaml`, the affected authority files or bounded task context, and CLI diagnostics.
- Use `pnpm exec nimicoding authority context <path> <id> --max-units <n> --max-bytes <n> --json` only for the complete declared outgoing interpretation closure; it is not complete task context, and failure never permits guessed or partial context.
- Use `pnpm exec nimicoding authority diff` and `pnpm exec nimicoding authority impact` with explicit `--max-bytes`; impact reports declared review obligations and does not prove implementation, consumers, or tests are synchronized.
- Use `pnpm exec nimicoding authority change-candidates` only with explicit channels and budgets; its complete union is recall input, never conflict, retirement, absence, authority, or conformance judgment.
- When explicit authority links are needed, use `pnpm exec nimicoding code authority --repo <root> --authority <id> --max-files <n> --max-bytes <n>` to locate annotated code, and use `--source <path>` for code-to-authority lookup. Results cover only explicit markers and authority lifecycle; they do not prove implementation conformance or evaluate unannotated code.
- For a new or changed authority-governed feature, add the reserved standalone physical line `// @nimi-authority: <exact-id>` in TypeScript/TSX, Go, or Rust, and `# @nimi-authority: <exact-id>` in Python. The scanner does not prove language comment context, so use this reserved form only for intentional links at a few key semantic owners.
- Use `// @nimi-deprecated: <exact-id>`, or `# @nimi-deprecated: <exact-id>` in Python, only after direct authority evidence or a real product failure confirms obsolete semantics; find it with `pnpm exec nimicoding code authority --repo <root> --audit --max-files <n> --max-bytes <n>` and remove it with the hard cut.
- When a selected TypeScript or TSX consumer still has a static-dependency question, use `pnpm exec nimicoding code context <path> --repo <root> --symbol <identifier> --tsconfig <path> --max-bytes <n>` for bounded root-direct static dependencies; it is not inbound impact, runtime dispatch, or complete task context.
- Use `pnpm exec nimicoding sync --check` to diagnose drift in package-owned managed projections, `pnpm exec nimicoding sync --apply` to restore them, and `pnpm exec nimicoding doctor` to diagnose package/managed compatibility. These commands do not validate product authority, implementation conformance, or task readiness.
- Under `.nimi/spec/**`, author only closed multi-unit `*.authority.yaml` containers or single-unit `*.authority.md`; historical document formats are unsupported and never inferred.
- Run `pnpm exec nimicoding authority fmt` on each changed file, then `pnpm exec nimicoding authority check` on the complete authority input set.
- A failed project-local `pnpm exec nimicoding ...` invocation supplies no usable result. Pause decisions that require refused, missing, or incomplete results; continue independent authorized work. Never substitute guessed, corpus-wide, or fallback context, or treat diagnostics or partial output as complete context; choose repair values only from product/task authority.
- Keep derived and local verification output under `.nimi/local/**`; it is never product authority.
<!-- nimicoding:managed:agents:end -->
