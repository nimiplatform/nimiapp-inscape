# nimiapp-inscape

## Published dependency and Catalog acceptance (2026-10-13)

Current public release: [0.1.8](https://github.com/nimiplatform/nimiapp-inscape/releases/tag/v0.1.8); [Registry admission #80](https://github.com/nimiplatform/nimi-app-registry/pull/80) is merged for macOS arm64 and Windows x64. Frozen locks use published SDK 0.21.0, Kit/native 0.19.3, App Tools 0.12.1 and nimi-coding 0.6.5; no local Nimi archive or source-link resolution is required.

Repository checks and managed production builds, package provenance and immutable Release checks passed for both declared targets. Actual Catalog download, installation and AI acceptance ran on macOS arm64 through source Nimi Home and its matching protected Runtime (Nimi main 35498102b). Runtime identity and App Access checks remain enforced.

Catalog update, adult test-space setup, real reflection generation, local save, and a full Home stop/launch preserving the complete reflection passed.

**NOT-VERIFIED:** Windows GUI installation and AI use. Other AI workflows and destructive data-management paths were not rerun.

Inscape helps adults explore Jungian personality patterns through daily observations and reflections, with data stored locally.

## The experience

Inscape is a private place to explore a lived moment, a difficult choice, or a relationship. A type code is an optional starting point; you can begin without one.

- **Today:** choose your inner weather, turn over an exploration card, or bring in a real moment. Save the note on its own or ask the local AI to explore it.
- **Inner roundtable:** hear eight cognitive-function perspectives on the same decision. Choose a voice to hear its perspective and question, consider another interpretation, and take one small experiment back into life.
- **Between us:** record your own observations of an adult relationship, compare tentative perspectives, revisit a misunderstanding, and explore clearer ways to express your needs.
- **About me:** explore a function map with explicit confidence, or search your field notes. Original words, structured AI readings, feedback, and experiments remain available after reopening.

AI readings retain their source context and can be reopened or individually deleted. Resonance feedback can be changed or withdrawn; type suggestions require their own explicit acceptance. Notes, shared moments, relationship details, and type references can be edited or removed. Failed saves retain the screen and offer retry without duplicating the operation. A reflection can propose a profile adjustment only when you request it, and the adjustment requires a separate acceptance. Each note contributes at most one reversible adjustment. Withdrawing its feedback or editing/deleting its source removes that contribution. Type and Beebe labels follow the current preference evidence and remain unset when it is uncertain. AI requests use the protected Nimi App Access client and a local text route. If the model is unavailable or returns an invalid exploration, the original note remains saved and the error is shown.

Start the desktop development app with `pnpm dev`. It requires Nimi Desktop and a local text model. To continue a specific existing local space, use `pnpm dev -- --list-registrations` and resume the corresponding selector with `pnpm dev -- --resume <selector>`.

The product uses a warm paper palette and a generated [inner landscape illustration](public/images/README.md). Layout previews under `.nimi/local/` are visual inspection artifacts, not the application or proof of working AI.

## Windows package and release

The production target is Windows x86_64 using Desktop-supervised Electron.
Build and inspect the package from this repository:

```bash
pnpm run sync
pnpm exec nimi-app check --production
pnpm exec nimi-app test
pnpm exec nimi-app build --target windows-x86_64 --production
pnpm exec nimi-app pack --target windows-x86_64 --production
```

Before tagging, follow the [GitHub release setup guide](https://github.com/nimiplatform/nimi/blob/main/app-tools/README.md#publishing-on-github), including the `NIMI_REPOSITORY_ADMIN_TOKEN` Actions secret.
A protected annotated version tag on the repository default branch runs the managed build, provenance and immutable Release workflow.
The publisher then submits the immutable Release to [Nimi App Registry](https://github.com/nimiplatform/nimi-app-registry). Registry admission is a separate human review; local builds and GitHub Releases do not create admission or installed state.

## Current repair and iteration scope

Canonical executable rules are in `.nimi/spec/**`; the original product targets
remain in the topic linked from `AGENTS.md`. Implementation status and journey
records are evidence, not product authority. Current data uses schema 3 with a
hard cut from earlier development files and no automatic migration.

Age text produces a review candidate, not actual knowledge. The user confirms
attribution/current age or corrects quoted, historical and hypothetical context.
Only confirmed under-18 subjects enter quarantine. Failed quarantine writes keep
analysis stopped and retain a private recovery-only intent until commit or an
explicit reset. Ordinary failed saves retain their existing retry/cancel behavior.

The 60-item assessment is a separate iteration. Independent observation records,
cumulative views and recurring friction analysis remain future product targets;
removing their empty storage scaffolding does not count as delivering them.

The frozen lock resolves published SDK 0.21.0, Kit/native 0.19.3, App Tools
0.12.1 and nimi-coding 0.6.5 from npm. Install with
`pnpm install --frozen-lockfile`; local Nimi archive overrides are removed.
Development still launches through the matching Nimi Home supervisor.
Electron's technical profile belongs to Desktop. App-owned SQLite is stored in
`<OS application-data>/nimi.inscape/`; development uses an isolated `development`
subdirectory keyed by the public Host profile. Resume a registration selected
from the current `pnpm exec nimi-app dev --list-registrations` result to reopen its
space. No old file is moved or converted.
