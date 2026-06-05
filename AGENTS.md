# Inscape (心相) AGENTS.md

> Authoritative module-level instructions for AI agents working on Inscape.

## Identity

- **App name (Chinese)**: 心相
- **App name (English)**: Inscape
- **App ID (SDK / runtime / Tauri identifier)**: `ai.nimi.apps.inscape`
  (manifest `app_id: inscape`)
- **One-line**: A fully local, open-source, 18+ desktop app that turns Jungian
  typology (cognitive-function stack + Beebe archetypes) into daily-life
  application — type as a moving probability distribution, refined only by
  user-driven signals.
- **Status**: Pre-Alpha. wave-1 build baseline; not yet launched.

## Provenance

Forked 2026-06-05 from `nimiapp-shijing`'s **non-product** consumption layer
(`src/shell/**`, the `src-tauri` + `nimi-shell-tauri` wiring, the persistence
interface, the test/build/governance scaffold). ShiJing's product layer
(astrology pipeline, ShiJingSpace domain, product tabs) was **not** carried
over. There must be **no** shijing / astrology / `SJG-*` remnants in this repo.

Product authority lives in the nimi-realm topic
`.nimi/topics/ongoing/2026-05-27-inscape-app-design-and-audit-closure`
(`product-manual.md`, `user-storyboard.md`, `implementation-approach.md`).

## Architecture

| Layer | Technology | Location |
|-------|-----------|----------|
| Desktop shell | Tauri 2 + `nimi-shell-tauri` crate | `src-tauri/` |
| Frontend | React 19 + Vite 7 | `src/shell/renderer` (`src/main.tsx`) |
| Consumption layer (reuse) | auth / bootstrap / runtime bridge | `src/shell/{app-shell,infra,bridge,features/auth,persistence}` |
| Persistence | **Custom SQLite** (G1) | `src-tauri/src/main.rs` + `src/shell/persistence/runtime-app-storage-adapter.ts` |
| AI wording | nimi runtime (`runtime.ai.text.*`) via `@nimiplatform/sdk` | `src/shell/ai/**` (wave-1 Increment 3) |
| UI components | `@nimiplatform/kit` | npm link |
| Domain (product) | InscapeSpace + IS-* contracts | `src/domain`, `src/contracts` (wave-2) |

`@nimiplatform/{sdk,kit}` are consumed via `link:` to the in-flight
`nimi-realm/nimi/{sdk,kit}`. Re-adapt the thin `src/shell/ai` + `bridge` seam
when the platform sdk/kit refactor lands (topic wave-5) — do not let the
refactor block product work.

## Hard boundaries

- **18+ fail-close (G1 / T1-04 / T1-05)**: the SQLite layer opens
  `<runtime-data-root>/inscape.db` with `0o600` and
  `CHECK (attested_adult = 1)`; the space is never persisted without an adult
  attestation. Keep this gate at the DB level.
- **Runtime owns identity**: the app never custodies access/refresh tokens
  (`createNimiAppRuntimePlatformClient` + `runtime.account.*`). No app-owned
  token surface.
- **Local only**: no cloud, no telemetry, no cross-app data hub.
- **No astrology**: this is typology, not bazi/ganzhi. No ShiJing vocabulary.
- **No legacy/compat shims, no fallback that hides a contract violation.**

## Verification

```bash
pnpm build     # tsc --noEmit + vite build + (cd src-tauri && cargo check)
pnpm test      # node --test test/*.test.mjs
pnpm lint
```

## Conventions

- ULID for new IDs. ISO 8601 (UTC, explicit `Z`) for persisted timestamps.
- ESM imports use the `.ts` extension for in-repo TypeScript (Node 24 native
  type-strip; `tsconfig` `allowImportingTsExtensions`).
- `Logger`/structured logging via `src/shell/infra/renderer-log.ts`; never bare
  `console.*` in product source.
- `.nimi/{config,contracts,methodology}/**` are `@nimiplatform/nimi-coding`
  projections — managed by `pnpm exec nimicoding sync`, never hand-edited.

<!-- nimicoding:managed:agents:start -->
# Nimi Coding Managed Block

- Read .nimi/methodology, .nimi/spec, and .nimi/contracts before high-risk changes.
- Treat .nimi as the primary AI truth surface for this project.
- Treat `/.nimi/spec/**` as the current repo-wide product authority for this project, and use Git history for retired pre-cutover authority evidence.
- If .nimi/spec remains bootstrap-only, use .nimi/methodology/spec-reconstruction.yaml and .nimi/config/skills.yaml to drive AI-side truth reconstruction.
- Treat .nimi/methodology/spec-target-truth-profile.yaml as repo-local support guidance for future governance slices, not as the canonical reconstruction completion target or a guaranteed fresh-bootstrap seed.
- Treat .nimi/contracts/spec-reconstruction-result.yaml, .nimi/contracts/doc-spec-audit-result.yaml, .nimi/contracts/high-risk-execution-result.yaml, and .nimi/contracts/high-risk-admission.schema.yaml as machine contracts for reconstruction, audit, local-only high-risk closeout summaries, and local-only high-risk admission evidence.
- Treat .nimi/config/skill-manifest.yaml, .nimi/config/host-profile.yaml, .nimi/config/host-adapter.yaml, .nimi/config/external-execution-artifacts.yaml, .nimi/config/skill-installer.yaml, .nimi/methodology/skill-runtime.yaml, .nimi/methodology/skill-installer-result.yaml, .nimi/methodology/skill-handoff.yaml, and admitted package-owned adapter profiles under adapters/**/profile.yaml as the canonical bridge to any external AI/skill execution.
- Treat standalone nimicoding as boundary-complete for bootstrap, handoff, validation, projection, and explicit admission only; do not assume packaged run-kernel, provider, scheduler, notification, or automation ownership.
- Treat .nimi/config/installer-evidence.yaml and .nimi/methodology/skill-installer-summary-projection.yaml as the operational-to-semantic installer projection boundary; do not promote concrete evidence artifacts into semantic truth.
- Treat high-risk external execution closeout, decision, ingest, and review payloads under .nimi/local/** as local-only operational projections; they do not promote semantic truth automatically, even when manager-owned.
- Use high-risk packetized execution only when authority, ownership, or cross-layer risk justifies it.
- Keep inline manager-worker as the default methodology posture; do not assume a separate worker runtime is mandatory.
- Keep code changes AI-context-efficient: favor bounded, cohesive files and split by responsibility during implementation instead of first concentrating unrelated logic into one file.
- Keep the methodology continuity-agnostic; do not assume daemon, heartbeat, or persistent manager ownership.
- Treat cutover readiness as preflight evidence only; the authority flip must come from an admitted cutover batch, not from readiness green by itself.
- Do not treat this managed block as a replacement for project-specific rules outside .nimi.
<!-- nimicoding:managed:agents:end -->
