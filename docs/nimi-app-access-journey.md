# Inscape App Access journey record

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
