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
  bar still glows. The page cannot remove browser chrome outright, but two
  page-side requests exist:

  - **`<meta name="theme-color">`** — asks Silk to *tint* its chrome to match
    the current palette (`applyMode()` keeps it in step; `#000000` in the
    bedroom at night). **Confirmed on hardware: Silk ignores it.** The bar
    stayed blue. Left in the page — it costs nothing, and it may matter on a
    future browser or device — but it is not the answer.
  - **Fullscreen API** — asks Silk to *remove* its chrome, not recolour it.
    A different and more drastic request; some mobile/TV browsers collapse
    their whole UI in fullscreen. **Built as a second experiment**, same
    posture as the wake lock: labelled, safe to fail, visible under
    `?debug=1` (`FULL ACTIVE` / `DENIED` / `UNSUPPORTED`, plus a drop count).
    **Scoped to `?screen=bedroom` only** — the one screen this matters for
    and, not incidentally, the one screen with no hardware yet, so an
    unproven experiment risks nothing on a display already working
    unattended. Requested on boot (expected to be refused — no user gesture
    exists to grant it) and retried from inside any `keydown` /
    `pointerdown` / `click` the page ever receives, on the chance a Fire TV
    remote press ever reaches it as a real gesture. **Not yet tried on the
    device** — the bedroom stick isn't installed. If it also fails, the
    durable fix is the WebView shell in `OPERATIONS.md`, which has no chrome
    to ask permission from.
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
| `&media=on` / `&media=off` | force the photo-moments master switch |
| `&mediaeverymin=N` / `&mediaholdsec=N` | override the cadence / hold, still passing through the same clamps |
| `&photonow=1` | fire one attempt ~50ms after boot, bypassing the WAIT only — every safety check still applies |
| `&gentle=TEXT` | force a rotating message |
| `&gentleuntil=4:00 pm` | …until this LA time (blank or unparseable = end of day) |
| `&gentleeverymin=N` / `&gentleholdsec=N` | override its cadence / hold, still through the same clamps |
| `&gentlenow=1` | show it ~50ms after boot. Cannot just call `attemptMoment()` — that hands a tie to the photo — so it skips the slot allocation only; the gate and the expiry check both still run |

Set as a clock *skew*, not a frozen time, so a boundary crossing can be watched
happening. They are carried across the hourly reload too (`photonow` is not —
it is a one-shot preview action, not persistent state, so it does not refire
on the next hourly reload).

### The Sheet (five tabs)

| Tab | Shape | Feeds |
|-----|-------|-------|
| `Days` | one row per date: `Date, Today, Notes, Reassurance` | TODAY'S ROUTINE, NOTES |
| `Events` | one row per event: `Date, Description` | CALENDAR |
| `Media` | one row per photo: `File, Caption, Screens` | occasional photo-moment overlays |
| `Settings` | key/value: `standing`, `reassure`, `notes`, `alertAfterMinutes`, `focus`, `focusUntil`, `night`, `nightStart`, `nightEnd`, `media`, `mediaEveryMin`, `mediaHoldSec` | constants shown every day, plus the extra display modes |
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
│ Greg is here for 11 more   │    Thu, Sep 17 Eyehealth NW │
│ days. Then Kathy comes.    │    Fri, Sep 25 Haircut      │
│ KEEP YOUR PHONE WITH YOU.  │    Mon, Sep 28 Retina NW    │
└────────────────────────────┴─────────────────────────────┘
        Everything is okay. You are safe and loved.
```

Left column ~56%, right ~44% — the calendar's entries are mostly short, so the
width went to the routine and notes.

**Rebalanced 2026-09-14, on Greg's read of how the board is used: the notes get
read, the routine mostly doesn't.** The standing prompt under the CALENDAR was
removed and its height turned into rows (`TOTAL_MAX` 10 → 13, the most that
costs no type size at 1280×650). NOTES lost its title. The routine gave up 10%
of its height (`ROUTINE_SPLIT`, 6/4 → 54/46 for a long list) and 10% of its
type (`ROUTINE_MAX.many` 28, from the 31px the real 8-item list resolved to),
and NOTES' ceiling rose to 40 so its extra height becomes bigger type. Measured
with the live Sheet at 1280×650: routine 31→28px, notes 22→31px, calendar
unchanged at 17px with 11 upcoming rows instead of 8.

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

### Gentle — the same news, without the takeover

Added 2026-09-15. `Settings.gentle` / `gentleUntil` is the **counterpart** to a
focus takeover, not a variant of it:

| | `focus` | `gentle` |
|---|---|---|
| What it is | a display **mode** (`selectMode`) | a **moment** (the overlay) |
| The board | suppressed while it runs | untouched between turns |
| On screen | continuously | ~`gentleHoldSec` every `gentleEveryMin` |
| Type ceiling | `MSG_MAX` (160) | `GENTLE_MSG_MAX` (96, provisional) |
| Use it when | the board is in the way | the board is still useful |

The motivating case: a carer is out for the afternoon and wants her reassured
about it *periodically*, without losing the calendar and the routine for four
hours to say so.

- **The expiry model is shared, not merely similar.** Both messages resolve
  through the same server function (`resolveTimedMessages` → `resolveTimedMsg`,
  keyed on the Settings key name) and expire through the same client function
  (`activeTimedMsg`). Every bullet in "Focus — the safety model" above is true
  of `gentle` word for word: server-resolved absolute instant, LA end-of-day
  cap, blank-until → end of day, unparseable-until → end of day with a warning,
  all-three-or-none (`timedMsg()`), and the client-side `forDate` belt-and-braces.
- **It needs that model more than focus does, not less.** A wrong takeover is at
  least sitting in front of whoever next walks into the room. A wrong gentle
  message fades itself back in every few minutes, mostly when nobody is
  watching. There is deliberately no lighter version of any guard.
- **`focus` wins.** `momentBlockedBy()` returns `'focus'`, which suppresses every
  moment including this one. Both cells filled in also pushes a `warnings` line,
  because from the Sheet "suppressed" and "broken" look identical.
- **No master switch.** Unlike `media`, the presence of the text *is* the switch.
  A separate on/off cell would be one more thing to leave in the wrong position,
  and the direction it would fail in is "still showing". It is also deliberately
  **not** gated by `media` — that switch is about photographs, and a bad day for
  images is not a reason to stop telling her where somebody is.
- **Not in the photo caption.** The caption's whole contract is that it asserts
  nothing (warmth/orientation only). A status message there would break it, so a
  gentle message is its own kind of moment instead.
- **Cadence floor 2 minutes** (`GENTLE_EVERY_MIN_FLOOR`, matching media's on
  purpose — one overlay, one hard cap, no reason for one kind to be allowed
  closer together than the other). Lowered to 2 on request: some circumstances
  want a much steadier pulse than the 15-minute default. What bounds the feature
  is `gentleUntil`, not the floor.

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

- **The split is now half-built: the bedroom has its own deeper block, pushed
  in two passes.** Requested because the bedroom needs to be darker than the
  living areas can afford to be. Pass 1 held every value at or above the WCAG
  large-text floor (3:1). Pass 2, on request, dropped it below that floor on
  purpose — `--ink`/`--soft` are the only two tokens the bedroom's
  single-message layout ever renders (no card, no calendar, so `--card` /
  `--muted` / `--line` / `--done*` / `--note-ink` are set but inert there),
  and both were pushed down, deliberately unevenly — `--ink` (the message)
  stays the more legible of the two, `--soft` (the clock, secondary) goes
  further, so the one thing worth reading if she looks stays the readable one.
  The single-message type ceiling (`MSG_MAX_NIGHT`) came down alongside it, for
  less lit area on top of dimmer pixels:

  | | Living areas | Bedroom |
  |---|---|---|
  | ground | `#080603` | `#000000` |
  | message / header | 6.1–6.3:1 | **2.17:1** (was 6.27, then 3.74) |
  | clock | 4.30:1 | **1.47:1** (was 2.51) |
  | message ceiling | — | **56px** (was 72) |

  **Keyed on the SCREEN, not the layout** — `[data-screen="bedroom"]
  [data-palette="night"]` — and that distinction is load-bearing. The earlier
  note here guessed the split would key on `data-layout`, which would have been
  wrong: a focus takeover uses the single-message layout on *every* screen, so
  a layout-keyed rule would also have dimmed a 2pm takeover in the living room,
  where she is awake and reading it. The thing being targeted is the room, so
  the selector names the room. Verified: a living-room takeover at night keeps
  the readable night palette, and the deeper block does not leak.

  **A real bug on the way to pass 2, worth flagging so it isn't repeated:** a
  comment describing the inert tokens wrote their names with `--` and `/`
  between them and happened to type `--done*/--note-ink` — the literal
  characters `*` `/` back to back, which is a CSS block-comment terminator.
  The comment closed early; every remaining line of that comment, plus the
  rest of the intended comment text, was then parsed as raw (invalid) CSS —
  and the whole `:root[data-screen="bedroom"]...` rule after it vanished
  silently, dropped by the parser. Headless testing did not catch it either,
  because nothing asserted the bedroom's colours were *different* from the
  shared night palette's, only that they were present. Caught by hand-checking
  `document.styleSheets[0].cssRules` after the values didn't move. **Never
  write a literal `*/` inside a CSS comment, including inside prose describing
  custom-property names — say them as plain words, not with a stray `*` next
  to a `/`.**

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

## Photo moments

A curated family photo fades in **over** the board, holds for a while, fades
back — an occasional overlay, not a fifth display mode. Deliberately kept
outside `selectMode()`/`paint()`: everything in that system answers "what
does the board currently CLAIM", recomputed on every paint because that
answer must always be current. A photo claims nothing, so it runs on its own
timers instead, in `index.html`'s "PHOTO MOMENTS" section.

**Since 2026-09-15 that machinery is shared.** A *moment* is now either a photo
or a gentle message, and the two ride one scheduler, one overlay (`#moment`),
one `momentState`, one hard cap and one interrupt check. Names follow: anything
common to both is `moment*` (`momentBlockedBy`, `attemptMoment`, `endMoment`,
`MOMENT_HARD_CAP_MS`), anything genuinely about photographs keeps `photo*`
(`photoBlockedBy`, `pickNextPhoto`, `beginPhotoMoment`, `revealPhoto`).
**Sharing the overlay is the collision model**: "two things rotating at once"
is not a state that can be represented, so nothing arbitrates between them at
paint time and nothing needs to.

**Why it exists, and why every default leans conservative.** Added for
warmth and connection, explicitly *not* to compete with the property doing
most of the therapeutic work — the board's **constancy**. The person it
serves recently had a minor ischemic stroke on top of an unassessed cognitive
condition, which pushes two things toward the conservative end on purpose:

- **Emotional lability** — an evocative image can land harder and faster
  than expected. Hence: opt-in (off unless `Settings.media` is exactly
  `"on"`), one cell to kill it instantly with no redeploy, and a caption
  convention (warmth/orientation only, never a status or instruction) that
  the code cannot enforce but is written here for whoever edits `Media`.
- **Fatigue / overstimulation** — hence: still images only, one at a time,
  muted, a couple of times an afternoon at most, daytime only, and every
  cadence/hold number clamped so a typo cannot turn "occasional" into
  "constant".

### The safety model

Four invariants, each with a specific failure it structurally prevents:

1. **A moment always returns to the board.** `PHOTO_HARD_CAP_MS` (90s, fixed
   — not derived from the current hold setting) is armed the instant
   anything becomes visible, independent of the normal hold-then-fade path.
   If that path is ever wrong for any reason, the hard cap tears the overlay
   down anyway. Verified by *sabotaging* the normal path (clearing the hold
   timer mid-moment, as if that code had a bug) and confirming the hard cap
   still recovers the board — the same "prove the backstop works when the
   primary path doesn't" posture as a focus takeover's until-instant, applied
   to a timer instead of a clock comparison, because there is no wall-clock
   deadline to compare against here.
2. **Never over a focus message; at night only where the screen allows it.**
   `contextAllowsPhoto()` is the single gate: checked before starting,
   checked *again* at the moment of reveal (a preload can take a few
   seconds — long enough for a focus message to land while waiting), and
   checked every second via `checkPhotoInterrupt()` (hooked into the same
   `tick()` that already drives the palette/focus clock checks) while one is
   showing, so a transition into any of those states mid-moment fades it out
   immediately. **Since 2026-09-14, at Greg's request, the table and living
   room show photos at night too** (`nightPhotos:true` in `SCREEN_MODES`;
   the overlay then paints on the night palette's dark ground). **The bedroom
   has `nightPhotos:false`**: it was once excluded outright, now gets photos
   in day mode only — from `nightStart` to `nightEnd` a photo is refused, and
   one already up at the boundary fades within a second. A blank `Screens` cell includes the
   bedroom; list screens explicitly to keep a photo out of it.
3. **A photo that fails to decode is skipped silently.** Nothing is ever
   assigned to the real, on-screen `<img>`'s `src` until a hidden `new
   Image()` preload has already fully decoded (`decode()`, not just
   `onload` — the difference between "the bytes arrived" and "the browser
   has actually finished painting it", which matters on a slow connection).
   A failure records a cooldown timestamp so one dead file stops stealing
   turns for `MEDIA_FAIL_COOLDOWN_MS` (30 min) without being permanently
   excluded — a transient network blip should not blacklist a real photo
   forever.
4. **Nothing is claimed.** The caption is warmth/orientation text, never a
   status or instruction — a Sheet-authoring convention, not something the
   code enforces, documented in `SETUP.md` for whoever edits `Media`. The
   scheduling itself needs no carve-out the way night/focus did: a photo
   moment does not assert that anything happened, so there is nothing here
   for the "nothing is ever inferred from time passing" invariant to
   conflict with in the first place.

### Scheduling and selection

**Two due-clocks, one timer.** The scheduler wakes at `momentEveryMin()` — the
faster of the two cadences while a gentle message is live, the photo cadence
otherwise — so a live message *tightens the whole rotation* rather than adding
a second timer beside it. Each kind carries its own `*DueAt` stamp; a slot goes
to whatever is due, and **a photo wins a tie** (it is the rarer event and there
are only a handful of them; the message comes back round within minutes by
construction, and its own due-time stays passed so it takes the very next slot).
With no gentle message the whole thing degenerates exactly to the previous
photo-only behaviour — that is what `MOMENT_DUE_SLACK` (0.8) is for: a due-time
is set slightly short of the full cadence so a tick that jitters up to 15% early
still counts as due, instead of silently costing that kind a whole cycle.

A slot is allocated on "could this actually run", not merely "is it due" —
otherwise a permanently-due-but-impossible photo (media off, empty pool, no
eligible rows for this screen) would quietly eat every slot the message should
have had.

> **Due-times live on `Date.now()`, never `deviceNow()`.** A due-time is a
> stopwatch — how long since the last one of these — so it belongs on the same
> unskewed clock the scheduler itself runs on (`momentNextAt`, `momentLastAt`,
> `shortIn`). The skewed clock is for deciding what is **true** (dates,
> until-instants); the raw clock is for deciding what is **next**. Mixing them
> is not a rounding error: `clockSkewMs` on a drifting Fire TV, or under a
> `?now=` test hook, can be hours, which makes every due-time permanently past
> and hands every slot to whichever kind is checked first. This was a real bug,
> caught in the headless trace before it shipped.

- Fires roughly every `mediaEveryMin` (default ~80, floor **2** — lowered
  20 → 10 → 2 on request; provisional the same way the night numbers
  are, a judgement call rather than a measured one — re-applied *after*
  jitter so an unlucky low draw can never undercut the safety rail), with
  ±15% jitter so it doesn't feel mechanical. **The timer is armed at boot
  from cached settings, then re-armed when a fetch brings a different
  cadence.** Before that re-arm existed, a display with no localStorage cache
  armed the 80-minute default, the hourly reload always won the race, and
  that screen never showed a photo. The same race still applies to any
  *configured* cadence above ~52 min (60 / 1.15): the reload lands first on
  every cycle, so such a value means "never" in practice. `mediaHoldSec` (default ~25,
  floor 5, ceiling 60 — past 60s it stops being a "moment" and starts being
  a takeover, which is what `focus` is for) is likewise clamped regardless
  of what is typed.
- **Shuffle-without-immediate-repeat**, compared by *file*, not object
  identity — `mediaList` is replaced wholesale by every ~3-minute fetch, so
  two "the same photo" entries a few minutes apart are different object
  instances, and an identity check would silently stop noticing repeats.
  `mediaLastShownFile` is set only by the real reveal path, which is why a
  test exercising `pickNextPhoto()` in isolation has to mirror that one
  assignment itself to test the real guarantee (see verification, below) —
  an easy mistake to make once and worth flagging so it isn't repeated.
- Eligibility is a single filter: has a `File`, allowed on this screen (blank
  `Screens` = every non-bedroom screen; a name restricts further; bedroom is
  excluded regardless), not in cooldown. Empty eligible set → no moment,
  silently — a valid, common, safe state (no `Media` tab, everything
  excluded for this screen, everything briefly cooling down).

### Render

`.moment` sits as the last child of `.stage`, `position:absolute;inset:0`,
opacity-transitioned rather than `[hidden]`-toggled (display cannot
transition, and a smooth ~1s cross-fade needs the element present at
opacity:0 throughout). Being out of the flex flow means showing or hiding it
can never perturb `.grid`'s or `.single`'s own layout — the board keeps
rendering underneath exactly as it would with the overlay absent, which is
what lets it fade back to something always *current* rather than something
frozen at the moment the photo started.

Image: `object-fit:contain` inside a flexible wrapper, centred, never cropped
— a face must never be cut off by the frame. The letterbox strips
`contain` leaves are filled by `.photo`'s own `--paper` background, so they
read as a deliberately framed photo rather than a rendering glitch. Caption:
a **fixed height budget** (`.photo-cap-box`, mirroring `.single`'s own fixed
`flex:1 1 auto` sizing), auto-fit via a **generalised `fitMessage()`** —
the function that already drives the single-message component was
parameterised to take element ids instead of hardcoded ones, so the caption
reuses the exact same measured shrink-until-fits algorithm rather than a
second hand-rolled copy of it, per the spec's own instruction to reuse the
existing fit machinery.

Palette: day only, by construction rather than by a CSS rule — a photo
moment is refused entirely while the board is in its night state (invariant
2 above), so `--paper` always resolves to the warm palette at the moment
this becomes visible. No night-specific override exists or is needed.

### apps-script.gs

`readMedia(ss, out)` follows the exact tolerant pattern `readEvents()` uses:
missing tab → one warning, `out.media` stays `[]`, never throws; a row with
no `File` is silently skipped, same as a malformed `Events` row. **A missing
or empty `Media` tab is a valid, safe, opt-out state** — no photo moment ever
fires, which is exactly what an as-yet-uncurated board should do.

`Screens` is split and normalised through a new shared helper,
`normScreenToken()` — the same character-stripping rule `cleanScreenId()`
already used for the heartbeat's device id and `index.html`'s own `SCREEN`
constant, factored out so all three can never drift apart. (`cleanScreenId()`
now just wraps it with `|| 'unnamed'`, since a device identity must never
come back blank while a list membership token safely can.) This is why
`Media`'s `Screens` column expects the canonical id form (`living-room`),
not the human display name — "Living Room" with a plain space would split
into two separate, wrong tokens, since a bare space is *also* a valid
separator between entries.

**Needs one redeploy, once** (Deploy → Manage deployments → edit → New
version), the same as `focus`/`focusUntil` did. Until then `/exec` never
mentions `"media"` and every `Media` row is invisible to the board — safe
and quiet, not broken. After that one redeploy, adding a photo is a plain
Sheet edit with no further redeploys.

### Demo / test hooks

All under `?demo=1` (see the URL-flags table above): `&media=on`/`off`,
`&mediaeverymin=`/`&mediaholdsec=` (still clamped — these override the
*input*, not the safety rail), and `&photonow=1` to fire one attempt
~50ms after boot rather than waiting out the cadence. `photonow` bypasses
the **wait**, never the safety checks — exactly like `&focus=` bypasses the
Sheet edit but not the safety model around it. `DEMO_DATA.media` seeds two
entries for `?demo=1`: a small placeholder SVG (`media/demo-placeholder.svg`
— not a photo, exists purely so the demo path exercises the real
same-origin fetch rather than a mock) and a filename that genuinely does not
exist, so the failure/skip path is exercised for real too, not simulated.

## Check-ins

Added 2026-09-15. Four buttons on her iPhone — morning medicine, evening
medicine, shower, exercise. Each tap is a plain HTTPS GET to the same `/exec`
endpoint, which appends one row to a new `Log` tab. The board reads them back
as a row of four chips: grey with no time, green with a checkmark and the
recorded time. They clear at midnight. The board stays read-only — she never
touches the television.

**Why this does not break "nothing is ever inferred from time passing."** That
invariant forbids turning elapsed time into a claim that something happened,
which is why routine items are never auto-greyed. This is the opposite of
inferring: it is her own explicit confirmation, stamped by the server at the
moment she made it. The board reports what she said. It must never start
computing what she probably did.

### The two guards that matter

Everything else here is ordinary. These two are the feature.

1. **Day-scoped, twice.** The block is shaped exactly like `dayRow` and carries
   its own `forDate`; `todaysCheckIns()` returns `{}` unless that equals today,
   so midnight empties the strip with no fetch and no network. Independently,
   the server never sends anything but today's rows. It takes two separate
   failures, not one, to show a stale green chip — and a stale green chip on
   "Morning medicine" tells her she has taken a pill she has not taken.
2. **First press of the day wins, and later presses are idempotent.** A second
   tap returns the *first* timestamp and appends nothing. This is not an
   optimisation; it is the interaction. Someone with a ten-to-fifteen-minute
   memory window will press the button again *to check*, and the honest answer
   is "yes, 8:20 AM", not a new row. Enforced under `LockService` so two
   near-simultaneous taps cannot both append, and again on the read side, where
   duplicate rows resolve to the earliest.

### Copy — read this before editing a chip

The strip carries a caption, **TODAY'S CHECK-INS**, and that caption is doing
safety work rather than decoration. It scopes every chip under it to the
*record* instead of the act: a grey "Morning medicine" means "no check-in
recorded", not "you have not taken your medicine."

No chip may ever contain:

- **A negative statement** ("not taken", "missed", "due"). If she took the pill
  and forgot to press, that is the double-dose risk from `BRIEF.md` running in
  reverse, with the board causing it.
- **An instruction** ("tap your phone"). An earlier draft had exactly that, and
  it is wrong for the same reason: *"Evening medicine — tap your phone"* sitting
  grey at 9am reads as a prompt to take the evening dose in the morning.
  **Evening medicine grey all morning is normal and must not look like a
  problem.**

So the unpressed state is the name alone, in the board's ordinary muted ink,
asserting nothing.

### Where the strip lives, and what it costs — MEASURED

It sits **inside the left column, between the routine and the notes** (Greg,
2026-09-15). It began full width between `.grid` and the reassurance line, and
that did not survive measurement: at 108px it drove TODAY'S ROUTINE to its 15px
floor **and clipped it**, which is invariant 1. The measured cliff at full width
was between 100px and 110px.

Moving it into the left column changes the economics completely:

- **The calendar is no longer charged anything.** The right column never sees
  this element. Measured across every viewport and every routine length below,
  `card-cal` resolves to *exactly* the same `--fs` with check-ins on and off.
- The whole cost lands on the left column, paid for by two changes made in the
  same pass: the routine's ceiling came down 10% (`ROUTINE_MAX` 28 → 25,
  40 → 36), and the two-column threshold moved 6 → 4 (below).
- The chips are ~160px wide instead of ~240px, so the caption went back *above*
  the row rather than inline beside it. Inline it ate 95px of a 673px column,
  14% of the width straight out of four already-narrow chips. A line of its own
  costs ~23px of height and is the cheaper trade here — the opposite of the
  answer when the strip was full width.

Resolved `--fs`, ten-item routine (`notes` stayed at its 40px ceiling):

| viewport | card | strip off | strip on |
|---|---|---|---|
| 1280×720 | today | 25px | 19px |
| | cal | 24px | **24px** |
| **1280×650** (real Silk) | today | 23px | 17px |
| | cal | 22px | **22px** |
| 1280×510 | today | 18px | *dropped* |
| | cal | 18px | **18px** |

**The two-column threshold moved 6 → 4, and it is not a concession.** Found while
fitting the strip: at five and six items the left column was so saturated that
the strip could not fit at *any* height, not even 30px. The cause was that the
single-column path was rendering a five-item routine at 22px and a six-item one
at 18px — both *below* the 25px ceiling two columns can hold, because one tall
column must shrink to fit the card while two short ones need not. "Stays one
column and stays large" had quietly stopped being true somewhere around five
items, and nobody had re-measured it since the card's height last changed.

Splitting earlier fixes three things at once, at 1280×650:

| | before | after |
|---|---|---|
| 6-item routine, check-ins **off** | 18px | **25px** |
| 6-item routine, check-ins **on** | strip could not fit at any height | strip fits, routine **still 25px** |
| 6-item routine at 1280×510 | **clipped** (pre-existing) | no clip |

That last row is a bug fix that predates this feature.

**The strip still yields when there is no room.** `renderFull()` fits the cards,
and if any of them still clips it hides the strip and re-fits. Deliberately a
measurement, not a viewport threshold or an item-count rule — both would be
guesses about content nobody has typed. `?debug=1` prints `DROPPED(no room)` so
this is never silent to whoever is watching through the camera.

Swept against routine length at 1280×650 (today's `--fs`, off → on):

| items | 6 | 8 | 10 | 12 | 15 |
|---|---|---|---|---|---|
| strip | 73px | 73px | 73px | **dropped** | **dropped** |
| today | 25 → 25 | 25 → 21 | 23 → 17 | 19 → 19 | 15 → 15 |

So: **no cost at all up to six items**, a few px from seven to ten, and on a
twelve-or-more-item day the strip stands down rather than squeezing the routine.
Her routine is normally well inside that range. The remaining honest cost is
that on a long-routine day the strip is absent — which is why placement is still
listed under Open questions rather than closed.

### Night palette — a latent hazard, now fixed

`--ok-bg` / `--ok-ink` / `--ok-edge` had **no night values**. They had been
dormant since the medication card was removed, so nothing rendered them. The
first green chip after 8pm would have put `#e3f1e4` — a near-white panel — on
the living room's dark board, appearing for the first time on an evening nobody
was testing. Night values are now defined alongside the rest of the palette.
Green is kept rather than folded into the amber: the hue is the meaning, and
the palette's stated rule bans white and blue, not colour. Luminance is matched
to `--soft`. Provisional like every other number in that block.

### Refresh rate — what the measurement actually said

The instinct was to poll the table display every 60s so a press shows up
quickly. Measured first, as instructed: `/exec` takes **4.0–8.5s per call**, of
which ~0.08s is network. Essentially all of it is Google-side time, against a
consumer account's 90-minutes-a-day script runtime cap.

| | calls/day | vs today |
|---|---|---|
| today — 3 screens @ 180s | 1,440 | — |
| table @ 60s + 2 @ 180s | 2,400 | 1.67× |
| **table @ 120s + 2 @ 180s** | **1,680** | **1.17×** |

At anything like the measured per-call cost, 1,440 calls/day is already the
same order as the cap; the likely reason it has never bitten is that the Fire
TVs sleep, not that there is headroom. **The billed number is not visible from
outside** — it is in Apps Script's own Executions view.

So the table ships at **120s, not 60s**: most of the benefit (worst-case
staleness 180s → 120s) for a 17% load increase instead of 67%. Going to 60s
later is editing one constant, once that dashboard has been read. The real fix
is cheaper reads — `doGet` currently `getDataRange()`s every tab on every call,
including `Days` and `Events`, which change a few times a week.

`BEAT_MIN_GAP_MS` went 45s → 150s in the same change, so the faster-polling
screen writes its heartbeat about as often as it did before. The faster board
costs no extra Sheet *writes* at all.

### Shape of the endpoint

Write branch, taken before any read work — a bound web app has one entry point,
and a check-in must not pay for the whole board's read when a phone is waiting
on a notification:

```
GET /exec?log=medicine-am&k=TOKEN
{ "ok": true,  "kind": "medicine-am", "already": false, "at": "8:20 AM" }
{ "ok": true,  "kind": "medicine-am", "already": true,  "at": "8:20 AM" }
{ "ok": false, "error": "unauthorized" | "unknown kind" | "no log tab" | "busy" }
```

- **Token** from `PropertiesService` script properties, never from the file —
  the repo is public. A *missing* property rejects every write rather than
  defaulting to open.
- **Fixed kind allowlist.** No dynamic kinds; a fifth kind would write rows the
  board never renders.
- **Tail read, never `getDataRange()`.** `Log` is the only tab that grows
  without bound (~4 rows/day forever). 80 rows is 20 days of normal use, and
  the cost of the read stays flat in year three.

Read path adds `log` (keyed by kind, epoch ms, today only) and `logForDate`.

## Deliberate departures from BRIEF.md

Each of these was a decision, not an oversight. Do not "restore" them without
asking.

1. **The medication *card* was removed — but medication is back, as a
   self-confirmed check-in.** The brief calls medication the safety-critical
   feature (risk of double-dosing). The card was cut because she has in-person
   support who administers it, and it stays cut: there is no medication
   *status*, nothing computes whether a dose is due, and nothing turns the
   clock into a claim.
   What exists instead (2026-09-15) is two of the four check-in chips — she
   presses a button on her phone and the board reports the time she pressed it.
   That is a record of something she said, not a judgement about something she
   should do. See "Check-ins" below, and read the copy rules there before
   changing a single word on those two chips.
   `--ok-*` is now live as the pressed state. `--soon-*` is still dormant.
   **Revisit the full card only if in-person support ends.**
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
5. **Photos, weather, greeting line — not built.** Deliberately out of scope
   at the time. **Photos are now built**, as the occasional overlay in *Photo
   moments* above, not as a permanent part of the layout — that distinction
   was deliberate too: the board's constancy is what does most of the
   reassuring, and a photo is a rare guest on top of it, never a fixture.
   Weather and a greeting line remain out of scope.
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
  dark at the wrong hour. The converse also holds and is just as load-bearing:
  **scheduling intervals use the raw `Date.now()`**, never the skewed clock —
  see the due-clock note under "Scheduling and selection".
- **Nothing is ever inferred from time passing.** A passed time is not evidence
  something happened. This is why routine items are never auto-greyed, and why
  the `Status` tab's "Ago" is a live formula rather than text written once.
  Night switching and focus expiry are **not** exceptions — see the carve-out
  above before touching either.
- **Observability never blocks the thing observed.** The heartbeat write is
  skipped — never queued — if another display holds the lock, and every failure
  path in it degrades to a warning. The board gets its data regardless.
- **A check-in block is only ever shown for its own date.** `todaysCheckIns()`
  is the single reader and it compares `forDate` to today on every call. Do not
  add a second path that reads `logRow.kinds` directly — the guard is the
  feature, and a stale green medication chip is the one thing on this board
  that could actually hurt someone.
- **One moment at a time, structurally.** One scheduler, one overlay, one
  `momentState`, and `attemptMoment()` returns immediately unless that state is
  `idle`. This is what makes "a photo and a gentle message could collide"
  unrepresentable rather than merely unlikely. If a third kind of moment is ever
  added, add it to the same scheduler — never give it its own timer.
- **A wrong-in-the-safe-direction overlay always has an independent hard
  backstop.** A focus takeover's until-instant, a moment's
  `MOMENT_HARD_CAP_MS` — both guarantee the board returns to its baseline by a
  mechanism that does not depend on the "normal" path working correctly. When
  adding anything else that temporarily covers the board, give it the same
  property and prove it the same way: deliberately break the normal teardown
  and confirm the backstop still recovers on its own.

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
- A **focus *or gentle* message with an until-instant is dated information**
  (they share `activeTimedMsg()`) and expires by absolute comparison, with no network and without a fetch. One exception to the
  `{days:}` rule inside it: an expired token does *not* drop the whole message,
  because the message is already dated by its until-instant and suppressing an
  acute statement over one stale token would be the wrong failure. Only an
  expansion to nothing means there is nothing to say — and then there is no
  takeover at all. A gentle message additionally expires **mid-hold**: the
  once-a-second interrupt re-checks its until-instant, so it is pulled off the
  screen at its deadline rather than being allowed to finish a hold it has
  stopped being true for.

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

**Verified for photo moments** (54 measured checks in headless Chrome over
CDP, plus 12 for the endpoint's `readMedia`/`normScreenToken` run under Node
with stubbed Apps Script globals):
- A full cycle — fade in, hold, fade out — with the board confirmed intact
  after: no residual overlay, no lingering `<img src>`, caption box collapsed,
  every existing card's resolved `--fs` and overflow unchanged.
- **The hard cap fires even with the normal teardown deliberately sabotaged**
  mid-moment (its hold timer cleared, simulating a bug in that path) — still
  showing well past where an unsabotaged cycle is already idle, then torn
  down anyway once the backstop fires.
- Suppressed correctly in every documented case: the night window, an
  active focus message, `media` off, `media` absent (opt-in
  default), and an eligible set that is empty for the current screen.
- **Interrupted immediately mid-moment** by a transition into night or by a
  focus message becoming active — fading within the same second, fully torn
  down shortly after, in both cases.
- A failing image (a real same-origin 404, not a mock) is skipped silently:
  never reaches `showing`, no exception thrown, the board measured intact
  afterward, and the failure recorded for cooldown de-prioritisation.
- A deliberately long caption does not clip.
- `clampMediaEveryMin`/`clampMediaHoldSec` hold their documented floors and
  ceilings against huge, zero, negative, non-numeric and `undefined` input.
- Shuffle-without-immediate-repeat verified across 20 consecutive picks from
  a 2-photo pool; the `Screens` allow-list verified to include/exclude
  exactly the rows it should for a given screen.
**Verified for gentle messages** (headless Chrome, single-load traces over
compressed virtual time, plus four rendered states):
- **Interleaving with photos**, traced slot by slot over ~50 virtual minutes at
  `gentleEveryMin=5` / `mediaEveryMin=20`: the message took ~4.5-minute turns
  and photos landed at ~4.5 / 21.9 / 41.8 min, i.e. each kind held its own
  cadence and neither starved the other.
- **No regression to the photo-only path**: with no gentle message, photos still
  fire at the plain `mediaEveryMin` cadence and the first one still lands one
  cadence after boot, as before.
- **Suppressed correctly**: bedroom in night mode reports `skipped: night` and
  shows nothing; an active `focus` suppresses it and `?debug=1` reads
  `GENTLE live [focus]`, distinguishing "suppressed" from "broken".
- **Not suppressed by `media=off`**, by design — the message still rotates.
- **Mid-hold expiry**: shown at 1:04 PM with a 60s hold and `gentleUntil=1:05
  PM`, it was faded at 1:05 (`gentle live=NO`) rather than finishing the hold,
  and the overlay tore down clean (`moment-msg` emptied).
- Rendered and read at 1280×650: a long message wraps to three lines at the 96px
  ceiling without clipping; a short one sits with air around it, visibly smaller
  than the same text as a takeover.
- **Not verified**: whether 15 min / 20 s / 96px are the right *numbers*. Those
  are judgement calls about a real room and a real person, exactly like the night
  ceiling — see Open questions.

- (Superseded 2026-09-14: the bedroom now arms the timer like every other
  screen and is gated by night mode only — verified day shows, night refuses,
  and a photo up at the night boundary fades.)
- Server side: a missing `Media` tab warns once and never throws; a row
  missing `File` is silently skipped; `Screens` values are split and
  normalised (`Table, living-room` → `["table","living-room"]`) through the
  same token rule the heartbeat's device id uses; a bare `https://` URL in
  `File` passes through verbatim.

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
- **Photo moments through the live Sheet.** Same story as focus: `readMedia()`
  is verified directly against a stubbed Sheet, but `/exec` never mentions
  `"media"` and every `Media` row is invisible to the board until
  `apps-script.gs` is redeployed as a new version. Until then `mediaList`
  stays `[]` from a real fetch and the feature is reachable only via
  `?demo=1`'s hooks — safe and quiet, not broken.
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
  evening-shaped correction to what was a sleep-shaped default. If the table is
  still glaring at 8pm, that is `nightStart`, a Sheet edit, not a code change —
  until the bedroom needs a different one from the living areas, which is the
  split flagged above.
- **Whether she tolerates a dim amber glow in the bedroom overnight.** Untested
  and untestable for now — the stick is not installed. When it is, the first
  night is a supervised event. If she cannot sleep with it, the answer is to
  switch that display off overnight at the device layer rather than to soften
  the palette further — see `OPERATIONS.md`. It has already been pushed twice
  on request (darker `--ink`/`--soft`, lower `MSG_MAX_NIGHT`, now 56); both
  remain provisional and there is more room to go dimmer in either dial if the
  room says so, but there is also a floor below which "darker" becomes
  "unreadable if she does look", and only the room can say where that is.
- Whether 25px routine type is readable from her chair.
- Whether Silk survives days of uptime. There is an hourly `location.replace()`
  reload as a watchdog, untested over a long run.
- **Whether an actual photo — a real family JPEG, not the placeholder SVG —
  decodes and fades cleanly in Silk, and whether repeated decode/discard
  cycles over days of uptime destabilise it at all.** This is the specific
  reason v1 is stills only, never video: this is exactly the kind of thing
  the hourly reload watchdog exists to survive, and a still image is the
  cheapest possible version of that risk. Nothing about it can be answered
  headless. Turn it on, add one real photo, and watch the first afternoon.
- **How a photo actually reads on the table at ~32 inches, and whether the
  cadence/hold defaults feel right.** Headless proves the mechanics (fades,
  timing, no clipping); it says nothing about whether ~80 minutes feels rare
  enough or a photo lands the way it is meant to. Tune `mediaEveryMin` /
  `mediaHoldSec` in the room, the same way the night palette is being tuned.

## Open questions

- **Times in the routine.** It currently shows order but not position in the
  day. Typing `8:00 am Breakfast` and styling the time would let her answer
  "what's next" against the clock, without the board claiming anything is done.
- **Medication**, if the support arrangement changes.
- **Where the check-in strip goes.** Now in the left column between the routine
  and the notes, which costs the calendar nothing and costs the routine nothing
  up to six items. It still stands down on a twelve-or-more-item routine. The
  remaining untried placement is the RIGHT column under the calendar, which
  would spend the calendar's slack instead — worth trying only if long-routine
  days turn out to be common enough that the strip disappearing is a nuisance.
  See "Where the strip lives".
- **Whether the check-in chips earn their height at all.** The phone already
  shows a notification with the recorded time; the board is a second, slower
  confirmation. If the strip keeps costing the routine 5px of type, the honest
  question is whether it is worth it — which is a question about her, in the
  room, not one headless can answer.
- **Per-screen focus.** v1 is global: one takeover on every display. A second
  tab (`Focus`, one row per screen) would make it targetable — "Greg stepped
  out" is more useful in the living room than in an empty bedroom. Not built,
  and not worth building until the global one has been used a few times. The
  same applies to `gentle`, and more so: a message coming round every fifteen
  minutes in a room nobody is in is pure wear on the board's constancy.
- **Whether a gentle message should keep the header.** It currently covers the
  whole stage like a photo does, so the date and clock go with it for ~20s.
  Leaving the header visible would put "back around 4:00" next to the actual
  time, which is exactly the comparison she cannot make from memory. It needs
  the overlay to start below the header rather than at `inset:0`, so it is a
  real change, not a tweak — worth doing only if the full-bleed version reads
  as too much of an interruption in the room.
- **The three gentle numbers** — 15 min, 20 s, 96px — are starting points
  chosen the same way `MSG_MAX_NIGHT` was, and want the same treatment: look at
  them in the room, on the panel, with a real message. Headless proved the
  mechanics, not the judgement.
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
