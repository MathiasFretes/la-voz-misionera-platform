# M7.9-0 — Suite Integration Baseline

## Canonical checkouts for this baseline

| Product       | Checkout / branch                                                               | Role                                                                |
| ------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| LVM Service   | `codex/m79-suite-baseline`, based on `origin/main` at `c7edfc3`                 | Owns the service and exports `WorshipContext 0.1` and `Service 0.1` |
| LVM Worship   | `claude/m77-worship-independence-audit` at `1edaf03e0`                          | Owns the musical setlist and exports `WorshipPlan 0.1`              |
| LVM Presenter | `codex/m79-suite-baseline`, descended from `codex/m78f-startup-qa` at `1b01485` | Converts `Service 0.1` into a project and presents it               |

Presenter `main` remains at `2de6ec1` and does not yet contain the M7.7/M7.8 work. M7.8F release packaging remains separate and paused. Neither contract 0.1 was changed here.

## Reproducible Windows run

Use Node 22.23.0 and install dependencies in all three checkouts. Build tools and Electron must be present; no Supabase account, API server, Internet, NDI runtime, or Studio Monitor is required. Set checkout paths explicitly and run from Service:

```powershell
$env:WORSHIP_REPO = 'C:\la-voz-misionera\LVM Worship'
$env:PRESENTER_REPO = 'C:\la-voz-misionera\.worktrees\M79 Presenter Baseline'
npm run test:suite
```

The runner builds Worship Web with inert loopback Supabase values, builds Service, compiles Presenter Electron, starts all three local web processes, and runs `e2e/platform-worship.spec.ts`. The test blocks non-loopback HTTP requests. The temporary browser and Presenter profiles are removed after the run. The V0 `dev:mock` path is not used.

For manual local use, configure `VITE_WORSHIP_URL` from `.env.example` when starting Service. The editor downloads WorshipContext 0.1, links to the local Worship workspace, previews an imported WorshipPlan 0.1 before applying it, and shows Service validation and the final order before downloading for Presenter. File selection remains explicit; the link does not transfer data between products or require an API.

## Verified path

1. Service creates an editable cult with welcome, announcement, Scripture, sermon, and a manual closing song.
2. It exports `WorshipContext 0.1` as a file.
3. Worship imports that context, adds three ChordPro songs, sets G/D/A keys and a repeated `1,2,1,2` arrangement, then survives a browser restart.
4. Worship exports a validated `WorshipPlan 0.1` file.
5. Service imports the plan, keeps the manual closing song, and survives a browser restart with eight ordered items.
6. Service exports valid `Service 0.1`; Presenter converts it to an eight-show `.project`.
7. Presenter imports the project through its UI, selects a slide containing `Señor 😀 estás aquí`, previews it, saves it, closes, reopens, and finds the imported project and song again.

The suite run passed on Windows on 2026-10-07. Service build, lint, and 17 unit tests passed. The repository-wide Prettier check already reports many unrelated existing files, so it is not claimed as a green gate for this slice.

The Presenter baseline also fixes two local Windows/UI regressions: conversion tests now resolve file URLs with `fileURLToPath` when a checkout path contains spaces, and the import alert no longer calls an undefined `click` handler. No NDI packaging work is included.
