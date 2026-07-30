# Pre-authority specification archive manifest

Archived on 2026-07-23 during the hard cut to `nimicoding.authority/v1`.

## Archived files

1. `INDEX.md`
2. `project/index.md`
3. `project/kernel/index.md`
4. `project/kernel/core-rules.md`
5. `project/kernel/tables/rule-catalog.yaml`

## Legacy-to-authority traceability

The archived source contains 32 rule IDs: 7 product, 5 data-model, 3 typology, 3 inference, 3 runtime-AI, 3 information-architecture, 5 privacy, and 3 open-source rules. The table maps every archived rule ID; no thirty-third rule row or ID exists in the archived source.

| Legacy ID | Canonical authority unit |
|---|---|
| `IS-PROD-01` | `rule.inscape.product.r001` |
| `IS-PROD-02` | `rule.inscape.product.r002` |
| `IS-PROD-03` | `rule.inscape.product.r003` |
| `IS-PROD-04` | `rule.inscape.product.r004` |
| `IS-PROD-05` | `rule.inscape.product.r005` |
| `IS-PROD-06` | `rule.inscape.product.r006` |
| `IS-PROD-07` | `rule.inscape.product.r007` |
| `IS-DATA-01` | `rule.inscape.data-model.r001` |
| `IS-DATA-02` | `rule.inscape.data-model.r002` |
| `IS-DATA-03` | `rule.inscape.data-model.r003` |
| `IS-DATA-04` | `rule.inscape.data-model.r004` |
| `IS-DATA-05` | `rule.inscape.data-model.r005` |
| `IS-TYPO-01` | `rule.inscape.typology.r001` |
| `IS-TYPO-02` | `rule.inscape.typology.r002` |
| `IS-TYPO-03` | `rule.inscape.typology.r003` |
| `IS-INFER-01` | `rule.inscape.inference.r001` |
| `IS-INFER-02` | `rule.inscape.inference.r002` |
| `IS-INFER-03` | `rule.inscape.inference.r003` |
| `IS-AI-01` | `rule.inscape.runtime-ai.r001` |
| `IS-AI-02` | `rule.inscape.runtime-ai.r002` |
| `IS-AI-03` | `rule.inscape.runtime-ai.r003` |
| `IS-IA-01` | `rule.inscape.ia.r001` |
| `IS-IA-02` | `rule.inscape.ia.r002` |
| `IS-IA-03` | `rule.inscape.ia.r003` |
| `IS-PRIV-01` | `rule.inscape.privacy.r001` |
| `IS-PRIV-02` | `rule.inscape.privacy.r002` |
| `IS-PRIV-03` | `rule.inscape.privacy.r003` |
| `IS-PRIV-04` | `rule.inscape.privacy.r004` |
| `IS-PRIV-05` | `rule.inscape.privacy.r005` |
| `IS-OSS-01` | `rule.inscape.oss.r001` |
| `IS-OSS-02` | `rule.inscape.oss.r002` |
| `IS-OSS-03` | `rule.inscape.oss.r003` |

## Dispositions

- Normative statements in `project/kernel/core-rules.md` and their summaries in `project/kernel/tables/rule-catalog.yaml` are superseded by the canonical authority unit IDs in the traceability table.
- The `enforcement` and `status` columns from `project/kernel/tables/rule-catalog.yaml` are migrated to `docs/authority-implementation-status.yaml` as non-authority evidence.
- Guide portions of `INDEX.md`, `project/index.md`, and `project/kernel/index.md` are archived. The positioning paragraph from `project/index.md` is carried into `definition.inscape.product.inscape-app`.
- Work-item anchors `T1-05`, `T1-09`, `T1-10`, and `T1-11` are stripped from normative authority text and preserved in `docs/authority-implementation-status.yaml`; their source records remain in this archive.
