# Inscape core rules (IS-*)

Normative invariants. Each rule has an ID; `tables/rule-catalog.yaml` is the
typed mirror with enforcement + implementation status. "Planned" rules are
authority for the eventual implementation (wave-3/wave-4), not a claim that the
behavior already ships.

## IS-PROD — product definition & anti-targets

- **IS-PROD-01** Inscape is 18+ adults-only. No minor experience tier, no
  14–17 carve-out.
- **IS-PROD-02** Not a dating / matching app. No `compatibility_score` (or any
  other-person matching score) field anywhere in the schema.
- **IS-PROD-03** Not an HR / hiring / performance tool. The relationship graph
  records the user's own observations, not a personnel file.
- **IS-PROD-04** Not a clinical / diagnostic tool. A permanent non-diagnostic
  disclaimer is present; AI output never pathologizes.
- **IS-PROD-05** Not a chat companion. All AI output is structured-purpose;
  there is no open-ended chat mode.
- **IS-PROD-06** Fully local. No cloud component, no realm sync, no telemetry.
- **IS-PROD-07** Exactly three faces: Today / Relationship / Self. No agent
  capsule, no notification bell, no background AI behavior.

## IS-DATA — data model

- **IS-DATA-01** `InscapeSpace` is the single local data root.
- **IS-DATA-02** A `Subject` is `self` or `other_person`. Under-18 subjects are
  never stored as subjects; they go to the quarantine region (see IS-PRIV-03).
- **IS-DATA-03** Every signal is user-driven (test answers, reflection text,
  accept/reject on AI reads, pasted snippets). No passive or cross-app capture.
- **IS-DATA-04** Every persistence read and write runs `validateInscapeSpace`;
  failure is a typed error, never a silent pass.
- **IS-DATA-05** Persistence is relational SQLite with per-row CHECK constraints
  and a dedicated `quarantine` table.

## IS-TYPO — typology

- **IS-TYPO-01** The cognitive-function stack is the authority. 4-letter codes
  are a parenthetical legibility aid only.
- **IS-TYPO-02** The Beebe 8-position archetype model (hero → demon) is canonical.
- **IS-TYPO-03** No claim of MBTI® authorization. Trademark hard-string ban in
  product UI + marketing copy, with a single allowlisted disclaimer template
  (T1-09).

## IS-INFER — inference

- **IS-INFER-01** Type is a posterior distribution updated only by user-driven
  signals; the long-term view is explicitly anti-fixation.
- **IS-INFER-02** T1-11 fail-close parser: an AI posterior-update proposal that
  fails JSON or schema validation is dropped whole — no partial merge, no
  fabricated value, no retry-into-success.
- **IS-INFER-03** A posterior update requires explicit user accept; the default
  state is no-update.

## IS-AI — AI consumption

- **IS-AI-01** AI access is exclusively via `@nimiplatform/sdk`. No direct
  provider SDKs, no own HTTP clients, no Tauri-side model binaries.
- **IS-AI-02** `route: 'local'` only; no cloud fallback rescue. Missing/invalid
  binding fails closed before dispatch.
- **IS-AI-03** AI surfaces are structured-purpose modes (today read, decision
  aid, communication rewrite, friction analysis, reflection resonance).

## IS-IA — information architecture

- **IS-IA-01** Three primary faces: Today / Relationship / Self.
- **IS-IA-02** Distribution-first display. Never render "your type is INTJ" hero
  text; show distributions with confidence bands.
- **IS-IA-03** Every AI read carries accept / reject / see-evidence controls.

## IS-PRIV — privacy & 18+

- **IS-PRIV-01** 18+ attestation is gated at the DB level
  (`CHECK (attested_adult = 1)`); a non-adult subject row cannot exist.
- **IS-PRIV-02** The runtime owns access/refresh token custody; the app holds
  no token surface.
- **IS-PRIV-03** Under-18 actual knowledge → fail-close quarantine of the
  affected subject. No guardian-facing UI, no minor-mode surface.
- **IS-PRIV-04** CommunicationRewrite carries a 4-layer anti-manipulation
  defence (prompt injection + keyword classifier + mandatory disclaimer +
  history audit) and refuses money / employment / sexual-consent /
  decision-pressure contexts (T1-10).
- **IS-PRIV-05** SQLite file permissions are `0o600` (T1-05); no telemetry sink.

## IS-OSS — open source & data posture

- **IS-OSS-01** MIT license uniformly across code, spec, and content assets.
- **IS-OSS-02** Question bank is IPIP-derived public-domain + Inscape-original
  items released into the same public domain.
- **IS-OSS-03** Standalone `nimiapp-inscape` repository.
