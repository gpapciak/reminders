# Operations — making the board a reliable household appliance

The web app is largely solved (see `HANDOFF.md`). The remaining problem is a
different layer: **keeping the displays showing it, unattended, from 5,000
miles away.**

Device-level reliability (Fire TV idle behaviour, ADB, Alexa, HDMI-CEC) is
being investigated separately. This file records the parts that constrain or
involve the web app, plus the decisions already made — so nobody re-derives
them or proposes a page-side fix for a problem the page cannot solve.

---

## Target behaviour

Not 24/7. That was the original instinct and it was dropped.

| | |
|---|---|
| **Morning** | displays turn on automatically |
| **Daytime** | board continuously available, no intervention, self-recovering |
| **Evening** | secondary displays off; table display maybe stays up longer |
| **Overnight** | displays off — no illuminated bedroom, no wasted power |
| **Next morning** | starts again reliably |

The governing constraint: **she cannot troubleshoot.** No opening Silk, no
bookmarks, no typing URLs, no switching HDMI inputs, no clearing a "No Signal"
screen. Display on → board appears. Anything else is a failure.

---

## Displays

| Device | Hardware | Notes |
|---|---|---|
| **Table (primary)** | Insignia 24" F20, **Fire TV built in**, 720p | Board already runs here. Screensaver can be set to Never; sleep timer maxes at 240 min. Behaves differently from the external Sticks. |
| **Living room** | LG TV + Fire TV Stick | Main test rig for external sticks. CEC = "SIMPLINK". |
| **Bedroom** | Hisense TV + Fire TV Stick | **Must not stay lit overnight.** |

### Two incompatible Stick architectures

This is the trap worth remembering: **the product name does not identify the
OS.** Newer "Fire TV Stick HD" hardware may ship with Vega.

- **Fire TV Stick 4K Select — Vega OS**, not Android. Silk works. But: idle
  after ~5–10 min → LG reports No Signal → pressing center wakes to **HOME, not
  back to the board**. Disabling Ambient Experience did not help. Android/ADB
  techniques should not be assumed to apply.
- **Fire TV Stick HD (2024) — Android-based Fire OS.** Also idles (~20–30 min),
  so its defaults don't solve it either, but it potentially offers ADB,
  developer options, sideloading, `FLAG_KEEP_SCREEN_ON`, and a WebView wrapper.
  **Preferred platform if buying more** — verify the OS, not the name.

---

## Diagnose five separate layers

A "blank TV" can be any of these, and they need different fixes. Always
establish which one before acting:

1. Television power state
2. Fire TV idle/power state
3. HDMI signal state
4. Browser (Silk) foreground state
5. Page state

---

## What the web app can and cannot do

**Confirmed: page activity does NOT keep Fire TV awake.** The board already
ticks a clock every second, fetches every 3 minutes, and reloads hourly — and
the 4K Select still idled. That is about as much activity as a page can
generate, so **no further page-side "keep busy" trick will work.** Stop looking
for one; the fix is at the device layer.

### Built

- **Heartbeat — remote observability, no camera required.** `doGet` now records
  which display asked and when into a `Status` tab:

  ```
  Device       Last seen          Ago             Status
  table        2026-08-09 14:22   2 min ago       OK
  bedroom      2026-08-09 09:04   5.3 hours ago   CHECK
  ```

  Openable from a phone anywhere. *Ago* and *Status* are live formulas, not
  text — written-out text would freeze and a display dead since last night
  would still read "2 min ago". `CHECK` appears after `alertAfterMinutes` in
  `Settings` (default 15), which is a judgement the family owns rather than a
  number buried in code.

  Guarded: `LockService` with a short **try**-lock that is skipped rather than
  queued, a 45-second per-device write throttle (the board also refetches on
  visibilitychange and on regaining network, which bunches requests), a 20-
  device cap folding overflow into one `other` row, and hard sanitising of
  `?screen=` — the endpoint is public, so anyone can invent values. Every
  failure degrades to a warning; the board always gets its data.

  **Needs a redeploy** (Deploy → Manage deployments → New version) and a
  `Status` tab before it records anything.

- **`?screen=table` / `?screen=living-room` / `?screen=bedroom`** — device
  identity, sanitised, defaulting to `unnamed` so an unlabelled display appears
  as a row rather than silently missing. Carried across the hourly reload.
  This is also the identity a bedroom night-variant will key off.

- **Screen Wake Lock — an experiment with a visible answer, NOT a fix.** Under
  `?debug=1` a corner readout reports `ACTIVE / RELEASED / UNSUPPORTED / DENIED`
  plus a release counter, legible through a Tapo camera. A lock released
  immediately by the system is the interesting result, so it is deliberately
  **not** re-requested on release — only on `visibilitychange` and a slow 60s
  retry, leaving the release count as the evidence.

  **Expect UNSUPPORTED or an immediate release on Vega.** A clean negative
  closes open question 2 below, which is a successful outcome. Headless Chrome
  reports ACTIVE and proves nothing.

### Worth doing, not built

- **Silk's homepage should be the dashboard URL** — each device pointed at its
  own `?screen=` URL. After an idle wake the 4K Select returns to HOME, so any
  recovery path ends in "launch Silk". If Silk's homepage is the board,
  launching Silk *is* recovering the board — no bookmark navigation, nothing
  for her to select. Cheap, do it on every device.

### Already in place

- Hourly `location.replace('?v=…')` reload — watchdog against a browser wedged
  after days of uptime. Cache-busted deliberately: GitHub Pages serves HTML
  with `Cache-Control: max-age=600`, so a plain reload could serve stale HTML.
- Fetch retries every 3 min; recovers on `online` and on `visibilitychange`
  without a reload.
- Survives network loss without blanking (see the safety model in `HANDOFF.md`).

**Note for deploys:** a code change can take up to ~10 minutes to reach a TV
because of that Pages cache, plus up to an hour for the reload to fire. Not a
bug — just don't expect a push to appear instantly on the screen.

---

## Recovery hierarchy

Each step is only reached when the one above it fails:

1. Board keeps running.
2. Page recovers from a transient failure itself.
3. Browser/app stays foregrounded.
4. Device wakes and returns to the board.
5. Alexa routine relaunches it.
6. Remote Alexa command recovers it.
7. Tapo camera gives visual confirmation of state.
8. Tapo speaker → Echo Dot voice command as last-resort recovery.
9. Only then does someone physically touch the TV.

Steps 1–3 are the web app's responsibility and are built. **4 onward are the
open work.**

---

## Alexa / Echo

All Fire TV devices registered under one Amazon account. One centrally located
Echo Dot is planned as **control infrastructure, not something she operates.**

Intended uses: scheduled morning power-on, scheduled night power-off, waking a
Fire TV, HDMI-CEC to the television, launching apps, remote recovery.

Open: whether Oregon devices can be driven from the Alexa app and Echo devices
**in France** on the same account. Keep these mechanisms distinct when testing —
they fail differently: cloud device control · local Echo↔Fire TV pairing ·
Alexa groups · HDMI-CEC · plain remote functionality.

## Tapo cameras

Already in the house. Give remote *observation*: is the TV on, is the board
showing, is Fire TV Home showing, does it say No Signal, did a recovery command
work. Two-way audio enables a last-resort path — speak through the camera, Echo
hears "Alexa…", Echo controls the Fire TV, verify visually.

**Backup mechanism, not normal operation.** Whether Alexa reliably understands
speech played through a camera speaker is untested. The heartbeat above is a
better primary answer to "is it working?" — it is data, not a picture someone
has to look at.

## HDMI-CEC

Enable on LG (SIMPLINK) and Hisense. Goal: Alexa → Fire TV → CEC → TV power and
correct input. Reliability of that chain is unverified.

---

## A dedicated app, if Silk stays unreliable

For Fire OS hardware: a minimal WebView shell — full screen,
`FLAG_KEEP_SCREEN_ON`, auto-retry/reload on network failure, no browser chrome,
no bookmarks, launchable by name ("Mom Display") and therefore by Alexa.

**The existing web app stays the source of the UI.** The wrapper is a kiosk
shell around this URL — do not rebuild the board natively. Everything in
`HANDOFF.md` continues to apply unchanged inside a WebView.

Whether an equivalent is feasible on Vega is open; prioritise Fire OS if it is
materially simpler.

---

## Open questions

Device-layer, being investigated separately. Approach empirically — do not
assume forum answers apply to these OS versions.

1. What exactly triggers idle on each platform?
2. Does Wake Lock prevent it in Silk? **Instrumented — open any display with
   `?debug=1` and read the corner. `UNSUPPORTED`, or `RELEASED` with a climbing
   counter, answers this.**
3. Can the sleep timeout be changed (and via what, per OS)?
4. Can Alexa wake the device? Does CEC reliably wake the TV and pick the input?
5. After waking, what is on screen — and can Alexa launch Silk, or a named app?
6. Can scheduled routines do morning-on / night-off?
7. Can the Oregon devices be controlled from France on the same account?
8. What does ADB add on the 2024 Fire OS Stick?
9. Would a WebView wrapper materially improve reliability?

**Not the goal:** "never sleep." The goal is awake 12–16 hours, deliberately off
overnight, reliably back in the morning, recoverable remotely, verifiable
remotely. Prefer the simplest thing that achieves that.
