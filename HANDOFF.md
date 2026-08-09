# Handoff — state of the build

Context for anyone (or any model) picking this up cold. `BRIEF.md` is the
**original spec and is now partly out of date** — several deliberate departures
are listed below. Where the two disagree, this file is what was built.

---

## What it is

An always-on cognitive support display for an 86-year-old woman with
short-term memory impairment and possible delirium symptoms. It is not a
website she operates. She looks at it; it answers "what day is it, what is
happening, has that already happened, is everything okay."

**Live:** https://gpapciak.github.io/reminders/
**Repo:** https://github.com/gpapciak/reminders (public)

This file covers the **application** — what it shows and why. Keeping the
displays switched on, foregrounded and recoverable from abroad is a separate
layer: see `OPERATIONS.md`.

## Hardware

- Insignia 24" Fire TV, **720p**, viewed from ~32 inches at a table.
- Amazon Silk browser, which **keeps a top navigation bar** — the usable
  viewport is roughly 1280×650, not 1280×720. Confirmed on the device.
- Two more Fire TV Sticks exist (bedroom, living room). Same page eventually,
  simplified variants later. Not built.

## Architecture

```
Google Sheet  →  Apps Script web app (/exec, JSON)  →  index.html  →  Silk
```

- **`index.html`** — the entire board. One self-contained file, no build step,
  no dependencies, no framework. Deployed by `git push`; GitHub Pages serves it.
- **`apps-script.gs`** — bound to the Sheet (`Extensions → Apps Script`), so
  there is no spreadsheet ID anywhere. Deployed as a web app, *Execute as: Me*,
  *Who has access: Anyone*.
- **`appsscript.json`** — pins the OAuth scope to
  `spreadsheets.currentonly`. Without it Apps Script asks for "delete all your
  spreadsheets" plus a UI scope the code never uses. Confirmed working.
- **`SETUP.md`** — how to build the Sheet and deploy. Written for family.

### The Sheet (three tabs)

| Tab | Shape | Feeds |
|-----|-------|-------|
| `Days` | one row per date: `Date, Today, Notes, Reassurance` | TODAY'S ROUTINE, NOTES |
| `Events` | one row per event: `Date, Description` | CALENDAR |
| `Settings` | key/value: `standing`, `reassure`, `notes` | constants shown every day |

Headers are matched by name, so column order is free. Multi-line cells
(Alt+Enter) or semicolons both split into list items.

## Layout

```
Today is Sunday, August 9.                            1:49 PM
┌────────────────────────────┬─────────────────────────────┐
│ TODAY'S ROUTINE            │ CALENDAR                    │
│ 1. Breakfast   5. Lunch    │  ✓ Tue, Aug 4  Saw Dr. Amal │
│ 2. Medications 6. Rest     │  ✓ Thu, Aug 6  Had PT       │
│ 3. Reading     7. Biking   │  TODAY ──────────────────   │
│ 4. Rest        8. Dinner   │    Tomorrow    1:30 Dentist │
├────────────────────────────┤    Wed, Aug 19 Kathy arrives│
│ NOTES AND MESSAGES         │    Thu, Sep 17 Eyehealth NW │
│ Greg is here for 11 more   │  ─────────────────────────  │
│ days. Then Kathy comes.    │  Feeling hungry? Eat some…  │
└────────────────────────────┴─────────────────────────────┘
        Everything is okay. You are safe and loved.
```

Left column ~51%, right ~49%. The standing prompt sits under the CALENDAR and
shares that card's height, so the two trade off against each other directly.

## Deliberate departures from BRIEF.md

Each of these was a decision, not an oversight. Do not "restore" them without
asking.

1. **The medication card was removed.** The brief calls medication the
   safety-critical feature (risk of double-dosing). It was cut because she has
   in-person support who administers it. The CSS colour tokens (`--ok-*`,
   `--soon-*`) are still in the file so it can be restored cheaply if the care
   arrangement changes. **Revisit this if support ends.**
2. **No meals section, no IMPORTANT section.** Same reasoning: redundant with
   in-person support.
3. **TODAY is a routine, not a task list.** It describes the shape of her day
   so she can see what tends to come next — steadying under delirium symptoms.
   Nothing on it is her responsibility and nothing is ever ticked off. The
   caption says "TODAY'S ROUTINE" precisely so it doesn't read as assigned work.
   "Medications" appearing in that list is orientation, not an instruction.
4. **CALENDAR runs through today, not forward only.** Her most common question
   is *"have we contacted X yet?"* — a question about the **past**. Recent past
   entries carry a green check, then a TODAY divider, then upcoming. A
   forward-only list cannot answer the question that prompted the column.
5. **Photos, weather, greeting line — not built.** Deliberately out of scope.

## Invariants — things that will break if changed casually

- **Nothing ever scrolls and nothing is ever clipped.** Type sizes in the CSS
  are *ceilings*; `fitBlock()` steps each box down until its content fits. This
  is what makes arbitrary Sheet text safe.
- **`.stage { flex: 0 0 auto }` is load-bearing.** It is a fixed-size flex item;
  without this it gets *squashed* instead of scaled on any viewport under
  1280px, which silently collapses every box to its minimum type size.
- **`fit()` scales to full width** and gives the stage whatever height the
  viewport actually offers, then `--vs` scales the header, footer, captions and
  padding to match. Scaling by `min(w/1280, h/720)` letterboxed the TV, because
  Silk's nav bar makes height the binding constraint.
- **The server's clock wins.** `clockSkewMs` is taken from the endpoint and used
  for both the displayed time and which day's row to show, so a drifting Fire TV
  clock cannot display the wrong day.
- **Nothing is ever inferred from time passing.** A passed time is not evidence
  something happened. This is why routine items are never auto-greyed.

## The safety model

**Undated information expires. Dated information does not.**

- The day row (routine, notes) is used *only* if its date is today. At midnight
  it stops matching and those boxes empty themselves.
- Events survive regardless — each carries its own date, so it stays true no
  matter how stale the fetch. A dead network past midnight therefore loses
  today's routine but keeps the calendar.
- A successful fetch that finds no row for today is treated as good news
  ("nothing planned"), not as a failure.
- After 25 minutes without a successful fetch the bottom line quietly gains
  `· Updated 3:56 PM`. No alarm.
- `{days:YYYY-MM-DD}` in any item renders "12 more days" / "1 more day" /
  "today", and the line is **dropped** once the date passes. This replaced a
  hand-typed "Greg here for 13 more days", which is wrong the next day and
  nobody notices. Countdowns are always stored as dates.

## Verified vs. not

**Verified** (headless Chrome against the live endpoint):
- No clipping in any box from 1280×720 down to 1280×510; fills exactly, no
  letterboxing.
- Six safety scenarios in-browser: cold boot, good row, *yesterday's* row, no
  row for today, 40-minute-stale data, countdown expiry.
- Live cross-origin fetch, `currentonly` scope, `{days:}` arithmetic.

**Verified on the actual Fire TV:**
- The board renders correctly in Silk and fills the screen.
- **Midnight rollover against the live Sheet** — the date line advanced, the
  routine swapped to the new day's row, and calendar entries moved past the
  divider and gained their checkmarks. This is the path that runs unattended
  every night.

**Not verified on hardware:**
- Silk's exact viewport dimensions — inferred from the letterboxing symptom,
  never measured on the device.
- Whether 25px routine type is readable from her chair.
- Whether Silk survives days of uptime. There is an hourly `location.replace()`
  reload as a watchdog, untested over a long run.

## Open questions

- **Times in the routine.** It currently shows order but not position in the
  day. Typing `8:00 am Breakfast` and styling the time would let her answer
  "what's next" against the clock, without the board claiming anything is done.
- **Medication**, if the support arrangement changes.
- **Bedroom / living-room variants** — `?screen=bedroom` etc. Nothing built.
  Now also wanted as a device identity for the heartbeat below, and because the
  bedroom display must not stay lit overnight.
- **Heartbeat / remote observability.** The board already calls an endpoint we
  control every 3 minutes; having `doGet` record which device asked and when
  would answer "is it actually running?" from a phone anywhere. Cheapest
  operational win available. See `OPERATIONS.md`.
- **Screen Wake Lock** — worth testing in Silk with a visible debug readout,
  with low expectations. Page activity provably does not keep Fire TV awake.
- The calendar shows at most 10 entries (4 past + 6 upcoming, backfilled).
  Ten is a deliberate floor to hold: the calendar gives up type size to keep
  them, and anything trimmed is logged to the console rather than dropped
  silently.

## Conventions

- Plain ES5-ish JavaScript, no build, no dependencies. Keep it that way — it
  has to run in Silk and be debuggable years from now.
- Comments explain *why*, especially where something looks odd (`flex:0 0 auto`,
  the line-height on the header, the two-column threshold).
- Layout claims are **measured**, not estimated — render it headless and read
  the resolved `--fs` values off the cards rather than reasoning about whether
  text fits. Estimating produced two wrong answers early on.
