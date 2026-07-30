# Inscape kernel — authority map

## Contracts

| Contract | Rule families | Governs |
|---|---|---|
| `core-rules.md` | IS-PROD · IS-DATA · IS-TYPO · IS-INFER · IS-AI · IS-IA · IS-PRIV · IS-OSS | Inscape product + implementation invariants |

## Tables

| Table | Governs |
|---|---|
| `tables/rule-catalog.yaml` | Enumerated rule catalog: `rule_id → family → summary → enforcement → status` |

## Implementation surfaces

| Family | Source |
|---|---|
| IS-DATA | `src/domain/**`, `src/contracts/inscape-space-validator.ts`, `src-tauri/src/persistence.rs` |
| IS-TYPO | `src/domain/typology.ts`, `src/domain/type-profile.ts` |
| IS-INFER | `src/product/inference/**` |
| IS-AI | `src/shell/ai/**` |
| IS-PRIV | persistence CHECK gates (`persistence.rs`), runtime token custody (`src/shell/features/auth/**`), under-18 quarantine |
| IS-IA | `src/shell/routes/**` + the three faces (wave-3) |

`status` in the rule catalog distinguishes implemented invariants from
planned ones (wave-3/wave-4); a planned rule is authority for the eventual
implementation, not a claim that it already holds.
