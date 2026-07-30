# Inscape Spec Index

Inscape product authority is organized by active domain. Kernel markdown files
and typed tables under each domain carry product semantics; top-level domain
files are reading guides.

## Active Product Domains

- `project`

## Reading Order

1. Open `project/index.md` for the domain reading guide.
2. Open `project/kernel/index.md` for the authority map.
3. Open `project/kernel/core-rules.md` for the normative IS-* rules, then the
   matching `project/kernel/tables/*.yaml` if your change is table-shaped.
4. For implementation-bearing waves, update `/src/{domain,contracts,product}/**`,
   `/src-tauri/src/**`, and `/test/**` in the same change.

## Authority Rules

- `.nimi/spec/**` is the only normative source of Inscape product authority.
- `.nimi/{methodology,contracts,config}/**` is the `@nimiplatform/nimi-coding`
  governance projection — managed via `pnpm exec nimicoding sync`, never
  hand-edited.
- `.nimi/local/**` and `.nimi/cache/**` are local-only operational artifacts;
  they do not promote to product truth.
- `.nimi/topics/**`, when present, holds human-authored topic lifecycle reports;
  the canonical authority for any admitted contract lives here under
  `.nimi/spec/project/kernel/**`.
