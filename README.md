# Inscape (心相)

> A private, local-first space for Jungian personality exploration, daily reflection, and mindful relationships.

Inscape is designed for thoughtful adults (18+) who want to understand their inner patterns, navigate difficult choices, and improve their relationships through the lens of cognitive functions. It offers a space for personal reflection rather than clinical assessment. Your journals, relationship notes, and reflections live in a local SQLite database, and AI reflections run on your device.

---

## The Experience

Inscape is not an automated personality quiz that slaps a four-letter label on you. It is a quiet workbench for self-discovery where a personality type is an optional starting point, never a constraint.

- **Today's Field Notes & Inner Weather**: Log a real lived moment, an emotional shift, or a dilemma. Save it as a pure personal note, or invite local AI to explore the underlying cognitive dynamics.
- **The Inner Roundtable**: Bring a challenging decision before eight distinct cognitive-function perspectives. Hear different internal voices, explore alternative interpretations, and take one actionable experiment back into daily life.
- **Between Us**: Reflect on interactions with other adults (18+), compare tentative perspectives, unpack misunderstandings, and draft clearer, non-confrontational ways to express your needs.
- **About Me**: Visualize your dynamic cognitive function map with explicit confidence levels. Inspect field notes, review past experiments, and observe how your preferences evolve over time.

### How AI Works in Inscape

- **Local Inference Only**: AI requests use a configured Local text route through Nimi Runtime and never fall back to a cloud connector. If your local model is offline or busy, your notes remain safely saved on disk.
- **You Remain in Control**: AI reflections propose gentle profile calibrations only when you explicitly request them. You review every suggested adjustment before accepting it, and any accepted change can be revoked at any time.
- **Full Data Sovereignty**: Notes, relationship entries, and AI readings can be individually inspected, edited, or permanently deleted.

---

## Getting Started & Development

### Prerequisites
- [Nimi Desktop](https://nimi.ai/download) or local source dev environment.
- A ready local text model selected in Nimi Home.

### Running Locally
```bash
# Install dependencies
pnpm install

# Start in Desktop-supervised development mode
pnpm dev
```

To list existing local registrations or resume an existing workspace session:
```bash
# List registrations
pnpm dev -- --list-registrations

# Resume a specific registration
pnpm dev -- --resume <selector>
```

### Production Build & Packaging
```bash
# Synchronize and check project constraints
pnpm run sync
pnpm exec nimi-app check --production

# Run tests
pnpm exec nimi-app test

# Build and package for your target platform
# macOS
pnpm exec nimi-app build --target macos-aarch64 --production
pnpm exec nimi-app pack --target macos-aarch64 --production

# Windows
pnpm exec nimi-app build --target windows-x86_64 --production
pnpm exec nimi-app pack --target windows-x86_64 --production
```

---

## Data Privacy & Storage

- **Local Storage Path**:
  - macOS: `~/Library/Application Support/nimi.inscape/`
  - Windows: `%APPDATA%/nimi.inscape/`
  - *Note*: The paths above apply to the installed app; development registrations store data in separate subdirectories under `development/`.
- **Zero Cloud Sync**: Your field notes, reflections, relationship observations, and cognitive profiles are stored directly in SQLite on your disk and never uploaded to remote servers.
- **Clean Slate**: You can clear all local data at any time via Inscape's *Settings & Local Data* panel.

---

## Release & Verification Status

- **Verified Publisher Release**: [v0.1.8](https://github.com/nimiplatform/nimiapp-inscape/releases/tag/v0.1.8)
- **Registry Admission**: [#80](https://github.com/nimiplatform/nimi-app-registry/pull/80) (macOS arm64 and Windows x64)
- **Recorded Toolchain Combination**: SDK 0.21.0, Kit/native 0.19.3, App Tools 0.12.1, Nimi Coding 0.6.5
- **Previously Recorded Platform Checks**: macOS arm64 Catalog install, local reflection generation, local SQLite persistence, and cold start recovery verified against Nimi Home. (Windows GUI execution marked as `NOT-VERIFIED` in automated CI).
