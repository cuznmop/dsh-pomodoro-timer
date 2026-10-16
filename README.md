# dsh-pomodoro-timer

A Pomodoro timer for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI: a **sidebar page** with focus / short-break / long-break cycles, plus a **countdown pill** beside the composer.

English | [简体中文](README.zh.md)

Repository: <https://github.com/cuznmop/dsh-pomodoro-timer> · Issues: <https://github.com/cuznmop/dsh-pomodoro-timer/issues> · Package: <https://www.npmjs.com/package/dsh-pomodoro-timer>

## Features

- **Sidebar page** — clock icon in the left panel list opens a full page with a progress ring, controls, and statistics.
- **Composer pill** — a compact countdown next to the message box; click it to jump to the page. It keeps running while you work in chat.
- **Cycle control** — focus 25 / short break 5 / long break 15 minutes by default, a long break every 4 pomodoros, and an optional auto-start for the next phase.
- **Controls** — start, pause, resume, reset the current phase, skip to the next phase.
- **Statistics** — the pomodoro number in the current round and how many you finished today; the counter rolls over at midnight.
- **Chime** — three short tones when a phase ends naturally (can be turned off; the page needs one interaction before the browser allows audio).
- **Survives a reload** — the running deadline is stored in `localStorage`, so refreshing the page resumes the same countdown.
- **Light and dark themes** — every colour is a `--dsw-alias-*` theme token; the plugin imports no Harness client package, so it does not break when those internals change.
- **Bilingual** — Simplified Chinese and English, following the GUI language.

## Requirements

| Component | Requirement |
| --- | --- |
| DeepSeek Harness | verified on `0.2.0-rc.2` (Web/Desktop profiles); the plugin uses only the public client `slots` and `locale` services, and declares no DSH peer dependency |
| DSH profile | a Web surface (`web`, or the Desktop app); headless profiles have no UI |
| Node.js | `^22.19.0` or `>=24.0.0` (only for the optional local check) |

## Install

```powershell
# plain dsh web profile
dsh plugin --profile web add dsh-pomodoro-timer
```

In the Desktop app, install `dsh-pomodoro-timer` from the plugin market page, or from **Settings → Plugins**. Restart Harness (or reload the page) afterwards, then look for the clock icon in the sidebar panel list.

## Usage

| Control | Behaviour |
| --- | --- |
| Start / Pause | Start or pause the current phase |
| Reset | Restore the current phase to its full length and pause |
| Skip | Move to the next phase without crediting a pomodoro |
| Settings | Focus length, short break, long break, pomodoros per long break, auto-start, chime |

Changing a duration while a phase is paused resizes it immediately; while it is running, the change applies from the next phase.

State lives under the `dsh.plugin.pomodoro-timer.v1` key in `localStorage`.

## Uninstall

```powershell
dsh plugin --profile web remove dsh-pomodoro-timer
```

## Development

No build step: `client.js` is the published browser bundle. The package ships a self-contained offline check.

```powershell
npm run check     # node --check on both halves + the offline bundle test
# pnpm run check works too. On a machine that only has DSH's bundled runtime, put
# the workspace shims on PATH first:  $env:PATH = "<workspace>\bin;$env:PATH"
```

`test/client.test.mjs` loads the browser bundle with a module-loader stub and a fake client context and exercises registration ids, the phase machine, persistence, and component rendering. It proves logic, not looks — visual verification needs the running GUI.

### Layout

| Path | Responsibility |
| --- | --- |
| `package.json` | manifest: bundle patch, client declaration, export map, icon, file allowlist |
| `cordis.patch.yml` | inserts the Host row that puts the browser bundle in the module graph |
| `index.js` | Host half — intentionally a no-op |
| `client.js` | the timer store, the sidebar page, the composer pill, and both dictionaries |
| `locale/*.json` | plugin-card title and description |
| `icon.svg` | plugin-card artwork |
| `test/client.test.mjs` | offline check |

## Notes

- The plugin reads and writes nothing but its own `localStorage` key. It has no host-side service, no tool, and no network access.
- It registers into `sidebar.panellist`, `main`, and `conversation.composer.dock`; it never replaces the app root and never appends to `document.body`.

## License

[MIT](LICENSE)
