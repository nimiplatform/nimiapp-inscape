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

`@nimiplatform/{sdk,kit,app-tools}` are consumed via `link:` to the in-flight
`nimi-realm/nimi` packages and only through their built package exports. The
Desktop repository must provide fresh SDK/Kit dist before this app is built.

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

- Product authority lives under `.nimi/spec/**`.
- For canonical authority authoring, read only `.nimi/methodology/authority-authoring.yaml`, the affected authority files or bounded task context, and CLI diagnostics.
- Use `nimicoding authority context <path> <id> --max-units <n> --max-bytes <n> --json` only for the complete declared outgoing interpretation closure; it is not complete task context, and failure never permits guessed or partial context.
- Use `nimicoding authority diff` and `authority impact` with explicit `--max-bytes`; impact reports declared review obligations and does not prove implementation, consumers, or tests are synchronized.
- Under `.nimi/spec/**`, author only closed multi-unit `*.authority.yaml` containers or single-unit `*.authority.md`; historical document formats are unsupported and never inferred.
- Run `nimicoding authority fmt` on each changed file, then `nimicoding authority check` on the complete authority input set.
- Never bypass a failure with inferred or fallback semantics; choose repair values only from product/task authority.
- Keep derived and verification evidence under `.nimi/local/**`; it is never product authority.
<!-- nimicoding:managed:agents:end -->
