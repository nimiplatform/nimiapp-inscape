# Inscape App Access journey record

## Current follow-up — 2026-09-30

Source: v0.1.7 working tree based on `3b6f52c`; schema 3, confirmed age review,
shared calibration projection and renderer CSP. No publication is included.

The full Electron/real-SQLite suite passed with 112 tests. Relevant changed paths
were rerun after final fixes. Build, lint, bilingual resources (397 keys per
language), copy AST audit, redlines, App check and managed sync checks passed.
These command checks do not constitute current App acceptance.

The user approved adapting to `/Users/snwozy/nimi-realm/nimi` source development.
Selected combination: App Tools 0.11.4, SDK 0.19.0, Kit/native 0.16.0 via complete
npm tarballs. The App Tools archive was freshly packed from source commit
`3e10f7c83`; an older archive with the same version still had the old presence
parser. SDK/Kit are consumed only through built exports. Public registry release
reproducibility is not established by these local packages.

The same-package minimal reference passed init/sync/check/build, Desktop-supervised
launch, protected `auth.status` and a real local text call: `carrier reference ready`.
The official Inscape launcher then reached `running`, with its exact renderer at
1431 and an ephemeral CDP target. Protected session binding and real SQLite IPC
reads passed under the development CSP. A real protected text candidate also
returned `Inscape carrier ready` using the existing local Gemma selection. This
is a carrier probe, not acceptance of all structured product journeys. Default
window home rendering was inspected on the actual App target. No direct App
launch substituted for Desktop supervision.

The current Host follows the reference's mandatory profile-first setup and
renderer replacement on session invalidation. App-owned SQLite is separate from
the Electron technical profile, under the disclosed OS application-data root;
development spaces are isolated by registration. Old files are not moved or
converted. No shared Runtime or other App process was interrupted.

The undeclared `realm.worldCore.list` probe failed with `runtime-permission-denied`
and `local-app-operation-unavailable`. This proves no successful response; it does
not independently verify the exact domain-denial branch previously planned.

The post-audit repair below verifies the confirmed-source and failed-save retry
journeys on the exact App. Age-context correction, manual attribution changes,
restart recovery, reset confirmation, keyboard and narrow-window UI journeys
remain **NOT-VERIFIED**. Runtime loss/recovery, account-change invalidation and
installed Mac/Windows behavior are also **NOT-VERIFIED**.

### Post-audit quarantine repair — 2026-09-30

Confirmed age review now passes the source identity into quarantine. A self note
or a shared moment from another adult relationship moves with its dependent
readings; a removed reflection also withdraws its calibration contribution.
Requests from before the quarantine stay invalid after the write succeeds.
The product shell remains mounted and inert during the write, preserving
unrelated drafts until normal interaction resumes.

The full Electron/real-SQLite suite passed with **116 tests**, including four new
regressions for source removal, cross-relationship attribution, locked writes and
late responses. Build, lint, redlines, both locale checks and `git diff --check`
passed. The delayed model responses in these unit tests are synthetic contract
fixtures, not model-quality evidence.

Following the user's repair request, `pnpm exec nimi-app dev --shell electron`
reported the existing Desktop-supervised Inscape Host and its exact loopback CDP
target. Playwright attached there and exercised the real renderer and SQLite IPC:

- Created two synthetic people, kept an unsaved communication draft for person B,
  and submitted a self note stating that person A was 17.
- Confirmed A in the age-review dialog while holding an actual SQLite exclusive
  lock. The save-recovery dialog blocked interaction; B's original textarea value
  remained in the mounted, inert product shell.
- Released the lock and retried through the UI. A and the confirmed note left
  active data; B's relationship, selected tab and exact draft text remained.
- Read the actual database: the confirmed source had zero active reflection rows
  and one source-bound reflection in the quarantine payload.
- Inspected screenshots of the recovery dialog and retained draft, then removed
  only the synthetic records and draft through the product UI and detached.

Screenshots are under `.nimi/local/quarantine-fix-ui/`. The age-review path stopped
before model dispatch; this verifies quarantine and draft recovery, not a new
positive model-content journey.

The September acceptance evidence remains relevant historical evidence:
`.nimi/local/repair-dev-final.log` records a supervised Electron host;
`.nimi/local/remediation-plan.md` and its acceptance assets record real local-model
reflection, roundtable, calibration, relationship/rewrite and SQLite recovery.
It is incorrect to infer from the August record that no real positive journey
has ever run. It also does not verify the changed September 30 UI/carrier paths.

## Historical attempt — 2026-08-08

- Date: 2026-08-08
- App checkpoint: `d1969d1`
- Command: `pnpm exec nimi-app dev --shell electron --cdp-port 9337`
- Platform repository writes: none

## Preconditions observed

- `nimi-app doctor`: passed.
- Backend port `3002`: listening.
- Renderer port `1431`: free before launch.
- CDP port `9337`: free before launch.
- Nimi Desktop Electron development process: running.

## Launch result

The Desktop supervisor accepted the request and entered project validation,
then returned the typed prerequisite failure:

```text
[nimi-app dev] preparing: Validating project with Nimi Runtime
[nimi-app dev] runtime-unavailable: runtime-service-untrusted
```

No Inscape renderer or Electron target was created. The launched CLI process
was stopped after the typed failure was captured.

## Journey observations

| Observation | Result | Reason |
|---|---|---|
| Signed-in / action-required posture | `not_observed` | App target was not created. |
| `aiConfig.overwrite` local intent | `not_observed` | Protected session validation did not complete. |
| `runtime.consume` text candidate | `not_observed` | Protected session validation did not complete. |
| Undeclared `realm.worldCore.list` denial | `not_observed` | App target was not created. |
| Source Runtime loss → typed unavailable | `not_observed` | No trusted source Runtime session existed to interrupt. |
| Same-Host retry and recovery | `not_observed` | Initial trusted source Runtime prerequisite was absent. |
| Explicit exit cleanup | `not_observed` | No App host was launched. |

## Required rerun condition

Rerun the same command only after the Desktop development environment reports
a trusted source Runtime. Do not weaken App validation or substitute a direct
Electron launch; either would bypass the carrier being tested.

### Development environment diagnosis — 2026-09-30

The development Desktop itself is running at renderer 1420 / CDP 9333 with its
source Runtime. The earlier native `Nimi` binding selected the wrong environment.
The installed App Tools 0.7.5 presence parser rejects the development descriptor's
new `callerToken` field and maps that schema mismatch to “Nimi is not running”.
This was not evidence that the development Desktop or source Runtime was absent.

Current Host-profile carrier compatibility requires a deliberate SDK/Kit/tool
upgrade. The source package matrix supports SDK 0.19.0 / Kit/native 0.16.0 with
App Tools 0.11.4 through complete local archives. Registry queries currently return
404 for these versions. Old 0.11 / 0.7 packages must not be patched or linked to
source to bypass the carrier contract. The user explicitly superseded the earlier frozen pairing and authorized the
source development adaptation; the new combination is installed and checked.
