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
  **That bar is blue and always present**, which is a real limit on how dark a
  bedroom screen can get: the page can black out every pixel it owns and the
  bar still glows. The page cannot remove browser chrome. Two levers exist and
  only one is page-side: `<meta name="theme-color">`, which Chromium-based
  browsers use to tint their own chrome and which `applyMode()` keeps in step
  with the current palette (so it asks for `#000000` in the bedroom at night).
  **Unverified on Silk** — headless proves nothing here, exactly like the wake
  lock; if Silk ignores it the bar stays blue and nothing else changes. The
  durable fix is the WebView shell in `OPERATIONS.md`, which has no chrome.
- A living-room Fire TV Stick also runs the same page. **The bedroom stick is
  not installed yet**, so the bedroom's night behaviour is configured but has
  never run on hardware. All three screens dim at night; only the bedroom drops
  to the minimal layout (see *Display modes* below).

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

### URL flags

| Flag | Effect |
|---|---|
| `?screen=table` | names this display in the heartbeat; sanitised, defaults to `unnamed`. Also selects the per-screen night config |
| `?debug=1` | corner readout: wake-lock state, data age, heartbeat, current mode, viewport |
| `?demo=1` | sample content with no endpoint, for layout work |

All three survive the hourly reload — `reloadUrl()` rebuilds the query rather
than replacing it. Dropping `?screen=` would move a display's heartbeat to the
`unnamed` row, which looks exactly like the TV having died.

**Test hooks — all require `?demo=1`** and are inert without it, so a bookmarked
TV URL cannot trip one. Night and focus are driven by the clock and the Sheet,
so without these neither is reachable without waiting for 8pm or editing live
data a household depends on.

| Hook | Effect |
|---|---|
| `&night=1` / `&night=0` | force night mode on / off, ignoring screen and window |
| `&focus=TEXT` | force a takeover |
| `&focusuntil=4:00 pm` | …until this LA time (blank or unparseable = end of day) |
| `&nightmsg=TEXT` | override the night message |
| `&now=2026-08-15T22:30` | pretend it is this LA wall-clock time; the clock ticks on from there |

Set as a clock *skew*, not a frozen time, so a boundary crossing can be watched
happening. They are carried across the hourly reload too.

### The Sheet (four tabs)

| Tab | Shape | Feeds |
|-----|-------|-------|
| `Days` | one row per date: `Date, Today, Notes, Reassurance` | TODAY'S ROUTINE, NOTES |
| `Events` | one row per event: `Date, Description` | CALENDAR |
| `Settings` | key/value: `standing`, `reassure`, `notes`, `alertAfterMinutes`, `focus`, `focusUntil`, `night`, `nightStart`, `nightEnd` | constants shown every day, plus the two extra display modes |
| `Status` | written BY the board: `Device, Last seen, Ago, Status` | nothing — it is the heartbeat readout |

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

Left column ~56%, right ~44% — the calendar's entries are mostly short, so the
width went to the routine and notes. The standing prompt sits under the CALENDAR
and shares that card's height, so the two trade off against each other directly;
it is pinned to the card's bottom edge so leftover height falls above it rather
than pooling underneath.

The calendar is **height**-bound, not width-bound. Narrowing the date column
buys nothing — measured across four ratios, the resolved type size did not move.
If it needs to be larger, the lever is fewer entries, not more width.

## Display modes — two axes, chosen independently

The board has four display states. They are **not** four special cases; they
are two independent axes, and the states fall out of the combinations. Anything
added later should extend an axis rather than add a fifth branch.

| Axis | Values |
|---|---|
| **Palette** | `day` — the warm paper/ink board · `night` — near-black ground, warm low-luminance amber text |
| **Layout** | `full` — header + grid + reassurance · `single-message` — header + one dominant centred message + reassurance |

**The two axes are selected independently**, and that is the point of the
design rather than an implementation detail. Palette is decided first — is this
screen night-enabled, and are we inside night hours — and applies whatever
happens next. Layout is then decided on its own, per screen. Nothing derives
one from the other.

| State | Palette | Layout | Which screens | Middle is… |
|---|---|---|---|---|
| **Day board** | day | full | all, 6am–8pm | — (the original board, unchanged) |
| **Night, full board** | night | full | table, living room, unknown | — same board, dimmed |
| **Night, minimal** | night | single-message | bedroom | the night orientation text |
| **Focus** | day *or* night | single-message | all | an ad-hoc takeover message |

**The dark full board is not a fourth mode somebody added.** It is what falls
out of asking the two questions separately instead of together, and it was
always a legal state — the palette is nothing but token overrides and every
layout rule is palette-agnostic. It simply was not *reachable*, because the
only route to the night palette ran through the single-message layout.

It exists because the living areas and the bedroom have different problems.
The bedroom's problem is **sleep**: dark while she is in bed, and minimal
because nobody reads a board at 3am. The living areas' problem is **evening
brightness**: those screens are still being *read* in the evening — she still
wants the calendar and the routine — they are just too bright. Dropping them to
one line would solve the wrong problem by removing the thing she is looking at.

**Selection order, re-evaluated on every paint** (`selectMode()`), never latched:

0. **Palette first, on its own.** `night = this screen is night-enabled AND
   deviceNow() is inside its night window`. That answer stands regardless of
   which layout is chosen below.
1. A focus message is active → single-message with the focus text, in that
   palette. So one takeover shows warm at 2pm and dark at 3am, on any screen.
2. Else if `night` → **this screen's configured night layout**: `single` (the
   bedroom) with the night text, or `full` (the living areas) with the ordinary
   board and no message at all.
3. Else → the full day board, day palette.

Both switches are clock-driven and nothing else, so `tick()` recomputes the
selection every second and repaints **only when the answer changes** — a
takeover has to disappear *at* its until-time, not up to a minute later, and
with no network. The current state is on `<html>` as `data-mode`,
`data-layout` and `data-palette`, which is what `?debug=1` and the headless
harness read. `data-layout` is styled by nothing today; it exists so the
expected palette split (below) costs one CSS block and no JS.

### Per-screen config

`SCREEN_MODES` in `index.html`, with a living-area-shaped default for anything
unlisted — including `unnamed`, so opening the bare URL from another country
shows what the table shows, since the palette keys off LA time.

| `?screen=` | `night` | `nightLayout` |
|---|---|---|
| `table`, `living-room` | true | `full` |
| `bedroom` | true | `single` |
| *anything else* | true | `full` |

### The single-message component

One component, used by both night and focus, so the fit/clip invariants are
solved once and a single centred block is the easiest possible case for the
existing auto-fit.

- **Header** — reused exactly as-is, same `fitHeader()`/`fitLine()` path.
  Orientation is the whole point of this layout: the date and the clock are the
  two questions the board exists to answer and they are true in every mode.
- **Middle** — one message, centred, wrapping (unlike the header, which is
  nowrap). `fitMessage()` shrinks it to fit; it never clips and never scrolls.
  `{days:}` works inside it.
- **Bottom** — focus keeps the normal reassurance line. **Night deliberately
  has none**: the night message *is* the reassurance, and a second glowing line
  in a dark bedroom is the opposite of minimal.

Two deliberate differences between the two callers of the same component:

- **Night has a lower type ceiling** (72px vs 160px). Both want opposite things
  from the auto-fit: a takeover should be as large as the screen allows,
  because being unmissable is its job, while the night message wants to be
  legible from the bed and no larger. At the full ceiling it filled the panel
  edge to edge and flooded a dark room with amber — exactly what the night
  palette exists to avoid.

  **72 is provisional and expected to come down.** The *direction* was settled
  by looking at the render; the *number* cannot be, because the real question
  is how much light a dark bedroom gets at 3am and no headless measurement
  answers that. It is a tuning target for the in-room night test below, on the
  same night as the glow-tolerance question — not a settled value, and not
  load-bearing for anything else.
- **`fitMessage()` measures differently from `fitBlock()`.** It compares the
  message's own `offsetHeight` against the box, not `scrollHeight`: the box
  centres its child, and a centred flex item that overflows spills equally
  above and below, so the half above the top edge is invisible to
  `scrollHeight` and an overflowing message would measure as fitting. It also
  steps coarse-then-fine (6px down, ≤5px back up) because this ceiling is ~6x a
  card's and a 1px walk would be ~130 reflows on a Fire TV per message change.

### Focus — the safety model

A focus takeover is live, acute and **time-bounded**. It always carries an
until-instant and retires itself. The failure this is built to prevent is the
board sitting there at 9pm still insisting *"Greg is gone until 4:00"* —
stale, wrong, and distressing to someone who cannot check.

This is the project's existing rule applied to a message: **a focus message
with an until-instant is dated information**, so it is safe to cache and it
expires by pure comparison, exactly like a calendar entry sliding into the past.

- **Resolved server-side.** `doGet` turns `focusUntil` into an absolute
  `focusUntilEpochMs`, in `America/Los_Angeles`, DST included, and caps it at LA
  end-of-day. The client does one absolute comparison against `deviceNow()` and
  stays dumb.
- **Why the server.** The LA date is already known and already authoritative
  there, consistent with "the server's clock wins" — and an absolute instant
  cannot be re-interpreted against a later day. A cached bare `"4:00 pm"` could
  be, and that is precisely how yesterday's takeover would resurrect itself on
  a display that lost its network.
- **Same-day cap, always.** Anything that needs to outlive today is not a
  takeover, it is a NOTES line, where it coexists with the calendar instead of
  suppressing it for days. An until past end-of-day is capped and pushes a line
  into `warnings`, visible by opening `/exec`.
- **Blank until + a message present** → end of LA day. That is the "I have just
  stepped out and I don't know how long" case, and it is bounded and
  self-clearing, so it never needs a second edit to take the message down.
- **Missing or blank message** → no takeover, ever. Message and instant are set
  together or not at all (`setFocus()`), so "a message with no deadline" is not
  a representable state.
- **An unparseable `focusUntil`** falls back to end of day *with a warning*,
  rather than dropping the takeover. Judgement call, and it goes the other way
  from the malformed-message case on purpose: the message itself is well-formed
  and acute, and suppressing something urgent because a time was typed oddly is
  the worse failure. It is still bounded, so it can never become stuck.
- **Client-side belt and braces.** `activeFocus()` also refuses any focus whose
  `focusForDate` is not today, so a takeover cannot outlive its day even if a
  nonsense instant somehow got through.

In v1 focus is **global** — one message on every screen, rendered in whatever
palette each screen currently warrants. Per-screen targeting is a documented
future option (it would want its own tab), not now.

### Night

**All three screens now dim at night.** The living areas keep the whole board;
the bedroom drops to one line. Note the bedroom is enabled in config but **no
bedroom display exists yet — the stick is not installed**, so that branch is
untested on hardware and its first real night is still a supervised event.

- **⚠ THE NIGHT WINDOW IS PROVISIONAL AND EXPECTED TO SPLIT.** 8:00 pm – 6:00 am
  LA, overridable via the **two separate** `nightStart` and `nightEnd` keys in
  `Settings`, and every screen shares the one window.

  It was 9pm, chosen for **sleep** — dark while she is in bed — which is the
  bedroom's problem. The living areas have a different one, *evening
  brightness*, which starts nearer dusk, so **8pm** is Greg's judgement of the
  better general rule. A judgement, not a measured result, and not yet looked
  at in the room.

  One window still serves both purposes and they will eventually want different
  answers — the living areas possibly earlier still, the bedroom possibly later.
  The lookup goes through `nightWindowFor(cfg)` purely so a second window is a
  config change rather than a rewrite. Do not hardcode `NIGHT_START_MIN`
  anywhere new.
- Compared against `deviceNow()`, so a drifting Fire TV clock cannot flip a
  screen an hour early. Identical start and end reads as an *empty* window, not
  a 24-hour one — a typo must not be able to hold a display dark all day when
  nobody in the house can see the URL that would explain why.

- **⚠ THE PALETTE VALUES ARE PROVISIONAL, AND THIS IS THE RISKIEST OF THE THREE.**
  Ten tokens in one CSS block; nothing else hardcodes a night colour. They were
  chosen against a monitor, which is not the test.

  The tension to weigh in the room: this palette was designed for the
  **bedroom**, a glance-if-you-look screen where legibility is traded away for
  darkness on purpose. **The table is the opposite** — she *actively reads* it at
  ~32 inches with aging eyes and it is her primary anchor. "Less off-putting in
  the evening" must not quietly cost her readability on the screen that matters
  most.

  Measured computed contrast, day vs night, same roles (headless, so this part
  *is* objective even though the perceptual question is not):

  | Text role | Day | Night |
  |---|---|---|
  | header date · routine items | 15–16:1 | ~6.1–6.3:1 |
  | calendar entry · past entry | 6.05:1 | 3.91:1 |
  | clock · reassurance line | 6.29:1 | 4.30:1 |
  | **captions · calendar DATE column · standing prompt** | **4.68:1** | **2.85:1** |

  That last row is the one to look at first. `--muted` carries the calendar's
  date column — "Wed, Aug 19", precisely what the calendar exists to say — and
  it lands **below 3:1**, where its day-palette counterpart sits at 4.68:1. That
  gap is an artifact of picking amber values for a screen where `--muted` is
  barely used, not a decision anybody made about the full board.

- **The split is now half-built: the bedroom has its own deeper block.**
  Requested because the bedroom needs to be darker than the living areas can
  afford to be. Ground goes to true black and the amber drops about a stop:

  | | Living areas | Bedroom |
  |---|---|---|
  | ground | `#080603` | `#000000` |
  | message / header | 6.1–6.3:1 | **3.74:1** |
  | clock | 4.30:1 | 2.51:1 |

  **Keyed on the SCREEN, not the layout** — `[data-screen="bedroom"]
  [data-palette="night"]` — and that distinction is load-bearing. The earlier
  note here guessed the split would key on `data-layout`, which would have been
  wrong: a focus takeover uses the single-message layout on *every* screen, so
  a layout-keyed rule would also have dimmed a 2pm takeover in the living room,
  where she is awake and reading it. The thing being targeted is the room, so
  the selector names the room. Verified: a living-room takeover at night keeps
  the readable night palette, and the deeper block does not leak.

  What is still **not** built is the other half — a *gentler* dim for the
  living-area full board, if the shared night palette turns out to be too dark
  for reading the calendar there. Same mechanism, one more block.
- **Message** from the `night` Settings key, with a safe default that is true at
  any hour of any night with no data behind it at all, and never says morning is
  close. `{days:}` works in it.

### Carve-out: this is not "inferring from time passing"

Written as a comment in the code as well, because it looks like a violation and
is not. The invariant forbids turning elapsed time into a **claim that something
happened** — meds taken, a meal eaten, a routine item done. That is why routine
items are never auto-greyed.

Neither switch does that. Changing palette at 8pm is presentation. Retiring a
focus message at its until-time **removes** an explicitly-authored statement and
returns the board to its safe baseline. Time passing here only ever removes or
restyles information; it never asserts an occurrence. This is an application of
*"undated information expires"* — the same rule that empties the day row at
midnight and drops an expired `{days:}` line — not an exception to *"nothing is
inferred from time."*

**Now that the palette applies to the full board on every screen, this is the
case where it looks most like a violation** — at 8pm the whole board changes
colour, every card at once — so be exact about why it is fine. Restyling is not
asserting. The routine says the same things in the same order, the calendar's
checkmarks still come from comparing dates, and not one line means something
different at 20:01 than it did at 19:59. The only thing the clock changed is
how much light the panel emits, and that is measured: the dark full board
resolves to *byte-identical* type sizes and row counts as the day board — only
the colours differ.

The test for any future clock-driven behaviour is unchanged: **does it change
what the board claims, or only how that claim looks?**

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
6. **Night and focus are modes of one board, not separate pages.** Two axes,
   one shared single-message component, one selection function — see above.
   Resist adding a fourth branch; extend an axis instead.
7. **A focus takeover is always time-bounded and always same-day.** There is no
   "until I take it down" option and that is the point. See the safety model
   above; anything longer-lived belongs in a NOTES line.
8. **Night omits the reassurance line and uses a lower type ceiling.** Both are
   deliberate, both are explained above. Do not "fix" either for consistency
   with focus — the two modes want opposite things from the same component.

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
  for the displayed time, which day's row to show, night-window switching **and**
  focus expiry, so a drifting Fire TV clock cannot display the wrong day or go
  dark at the wrong hour.
- **Nothing is ever inferred from time passing.** A passed time is not evidence
  something happened. This is why routine items are never auto-greyed, and why
  the `Status` tab's "Ago" is a live formula rather than text written once.
  Night switching and focus expiry are **not** exceptions — see the carve-out
  above before touching either.
- **Observability never blocks the thing observed.** The heartbeat write is
  skipped — never queued — if another display holds the lock, and every failure
  path in it degrades to a warning. The board gets its data regardless.

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
- A **focus message with an until-instant is dated information** and expires by
  absolute comparison, with no network and without a fetch. One exception to the
  `{days:}` rule inside it: an expired token does *not* drop the whole message,
  because the message is already dated by its until-instant and suppressing an
  acute statement over one stale token would be the wrong failure. Only an
  expansion to nothing means there is nothing to say — and then there is no
  takeover at all.

## Verified vs. not

**Verified** (headless Chrome against the live endpoint):
- No clipping in any box from 1280×720 down to 1280×510; fills exactly, no
  letterboxing.
- Six safety scenarios in-browser: cold boot, good row, *yesterday's* row, no
  row for today, 40-minute-stale data, countdown expiry.
- Live cross-origin fetch, `currentonly` scope, `{days:}` arithmetic.

**Verified for the display modes** (104 measured checks in headless Chrome over
CDP, plus 56 for the endpoint's focus resolution run under Node with stubbed
Apps Script globals):
- **The day board is unchanged.** Resolved `--fs` for every box, the header, the
  standing prompt and the reassurance line are *identical* before and after this
  change at 1280×720 / 650 / 510 / 800×600 / 1920×1080.
- No clip, no scroll, no letterbox at all three viewports for: day board, night,
  focus in the day palette, focus in the night palette, a one-line message, a
  two-sentence message, and a deliberately abusive ~950-character message
  (which lands at 27–32px rather than clipping).
- **The palette axis**, on all four screen names (`table`, `living-room`,
  `bedroom`, `unnamed`): night at 21:00 / 23:30 / 03:00 / 05:59, day at
  20:59 / 06:00 / 14:00.
- **The layout axis, chosen independently**: at the *same instant* the table,
  living room and unknown screens are night + **full**, with all four boxes and
  the reassurance line still present, while the bedroom is night + **single**.
  Same palette, same background colour, different layouts — which is the
  independence, demonstrated rather than asserted.
- **The dark full board is presentation only**: at 1280×650 it resolves to
  identical `--fs` for every box and identical row counts to the day board;
  only the background and ink colours differ.
- Focus at 3am is single-message in the **night** palette while focus at 2pm is
  single-message in the **day** palette.
- Focus expiry crossing its until-time on the ticking clock alone, with no
  reload and no fetch.
- **The night boundary crossed in both directions on the ticking clock, for
  both layouts.** The table goes day-full → night-full at 21:00 and back at
  06:00; the bedroom goes day-full → night-single and back. On the table
  crossing, the resolved type sizes, row counts, captions and reassurance line
  are all unchanged across the boundary and only the background moves — the
  living-area promise, checked rather than assumed.
- **Offline self-clear from cache**, with the endpoint blocked at the network
  layer: a cached takeover shows, then retires itself at its until-time and the
  day board returns.
- A focus resolved for *yesterday* never appears today even with a live
  until-instant; an already-passed instant never appears; five shapes of
  corrupt cached focus (`{}`, no instant, a string instant, a null instant, an
  empty message) all yield no takeover.
- `{days:}` expands inside both a focus and a night message; an all-expired
  `{days:}` focus produces no takeover, and an all-expired night message falls
  back to the safe default.
- Server side: DST-correct instant resolution (including 01:30 and 03:30 on the
  spring-forward morning), the clock-time parser's accepts and rejects, blank →
  end of day, malformed → end of day + warning, a future date capped + warning,
  a past until warned about, and a Sheets *time-typed* cell surviving the whole
  path (Sheets stores "4:00 pm" as a Date, whose `String()` is
  `"Sat Dec 30 1899 16:00:00 GMT-0752"` — normalised in `settingValue()`).
- `resolveFocus()` **never throws**, for impossible dates (`2026-99-99`), dates
  that roll over (`2026-02-30`), the year 9999, all-zeros, and a `{days:}`
  token typed into the wrong cell. It is the only part of `doGet` that parses
  free text somebody typed, and an exception there would fail the *whole*
  response — the board would fall back to cached data over a typo in one cell.
  It degrades to a warning and no takeover, like the heartbeat.

**Verified on the actual Fire TV:**
- The board renders correctly in Silk and fills the screen.
- **Midnight rollover against the live Sheet** — the date line advanced, the
  routine swapped to the new day's row, and calendar entries moved past the
  divider and gained their checkmarks. This is the path that runs unattended
  every night.

**Built but NOT yet confirmed against the live system:**
- **Night and focus end-to-end through the Sheet.** Everything above was
  measured against the two new code paths directly. The `focus`, `focusUntil`,
  `night`, `nightStart` and `nightEnd` keys cannot do anything until
  `apps-script.gs` is **redeployed as a new version** — saving the script
  changes nothing at the `/exec` URL. Until then the endpoint keeps serving the
  older script, `focusUntilEpochMs` is absent, `setFocus()` sees no instant and
  there is simply no takeover: the board runs exactly as it does today. Open
  `/exec` in a browser afterwards and look for `"focusUntilEpochMs"`.
- **The heartbeat.** Logic is unit-tested against a stubbed Sheet across every
  failure path (missing tab, lock contention, freshness throttle, device cap,
  hostile `?screen=`). It cannot record anything until the Apps Script is
  redeployed as a new version AND a `Status` tab exists — until then the board
  runs exactly as before and the response reports `heartbeat: no-tab`.
- **Wake Lock on Silk.** Headless Chrome reports `ACTIVE`, which proves nothing
  about Vega or Fire OS. This ships as an experiment with a visible answer, not
  as a working feature.

**Not verified on hardware:**
- Silk's exact viewport dimensions — inferred from the letterboxing symptom,
  never measured on the device.
- **Whether the night palette is READABLE on the full board.** The one that
  matters most, because it lands on the table — the screen she actively reads.
  Headless can prove it does not clip and can measure contrast ratios (see
  *Night* above, and the `--muted` row in particular); it cannot tell you
  whether an 86-year-old can read amber-on-near-black across a room. Look at the
  table after 8pm before anything else. Dials, in order: the **ten night tokens**
  (contrast/darkness — `--muted` first), then the `[data-layout="full"]` split
  if one palette will not serve both screens.
- **Whether the living areas want an earlier window still.** 8pm is already an
  evening-shaped correction to a sleep-shaped
  answer to an evening-brightness problem. If the table is still glaring at
  8pm, that is `nightStart`, and it is a Sheet edit, not a code change — until
  the bedroom needs a different one from the living areas, which is the split
  flagged above.
- **Whether she tolerates a dim amber glow in the bedroom overnight.** Untested
  and untestable for now — the stick is not installed. When it is, the first
  night is a supervised event. If she cannot sleep with it, the answer is to
  switch that display off overnight at the device layer rather than to soften
  the palette further — see `OPERATIONS.md`. If it is merely too bright, dial
  **`MSG_MAX_NIGHT`** (currently 72, provisional — less lit area) before
  touching colour.
- Whether 25px routine type is readable from her chair.
- Whether Silk survives days of uptime. There is an hourly `location.replace()`
  reload as a watchdog, untested over a long run.

## Open questions

- **Times in the routine.** It currently shows order but not position in the
  day. Typing `8:00 am Breakfast` and styling the time would let her answer
  "what's next" against the clock, without the board claiming anything is done.
- **Medication**, if the support arrangement changes.
- **Per-screen focus.** v1 is global: one takeover on every display. A second
  tab (`Focus`, one row per screen) would make it targetable — "Greg stepped
  out" is more useful in the living room than in an empty bedroom. Not built,
  and not worth building until the global one has been used a few times.
- **Whether the night message should ever change through the night.** It is one
  constant string now, which is the safe version. "It's very early, go back to
  sleep" at 2am versus "it's nearly morning" at 5:30 would be more useful and
  is *not* a violation of the time invariant (it asserts nothing about her) —
  but it is more moving parts for a screen nobody can debug at 3am.
- **Screen Wake Lock is a live experiment, not a result.** Built and reporting
  under `?debug=1`; whether Silk honours it is still unanswered. See below.
- The calendar shows at most 10 entries. Normally up to 4 past + 6 upcoming,
  with either side spilling into the other's spare rows. **Once 8 or more
  things are upcoming the past is capped at 2** and the freed rows go to the
  future — a crowded horizon matters more than a long tail of confirmations.
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
