# Wiring the board to a Google Sheet

The board reads one Google Sheet through a small Apps Script web app. Family
members edit the Sheet; nobody touches code.

---

## 1. Build the Sheet

Create a new Google Sheet called **Mom's Board**, then:

**File → Settings → General → Time zone → `(GMT-08:00) Pacific Time`.**

Do this first. Date cells are stored at midnight in the *spreadsheet's* timezone,
so a Sheet left on the wrong zone shifts every date by a day.

Make four tabs, named exactly **Days**, **Events**, **Settings** and **Status**
(the last one stays empty — the board fills it in). Row 1 is headers in the
first three. Column order does not matter — the script matches on the
header text — but the spelling does.

### Tab: `Days` — one row per date

| Date | Today | Notes | Reassurance |
|------|-------|-------|-------------|
| 2026-08-08 | Researching care options⏎OnPoint Credit Union⏎Best Buy⏎Gratitude | Kat called this morning | |

- **Date** — `2026-08-08`, or a real date cell, or `8/8/2026`.
- **Today** — TODAY'S ROUTINE: the shape of her day, in order. **One item per
  line** (press **Alt+Enter** inside the cell), or separate with semicolons.
  Numbering is automatic.

  This is a *description*, not a task list. Nothing here is ever ticked off,
  by her or by the board — it exists so she can see what usually comes next,
  which is steadying when short-term memory is unreliable. Copy yesterday's
  cell and adjust it for anything unusual about the day.

  Past about six items the board switches to two columns automatically so the
  type stays large; the numbering keeps the order readable across the split.
- **Notes** — the NOTES AND MESSAGES box. One note per line (Alt+Enter), or
  separate with semicolons.

  A **pipe** `|` forces a line break *within* one note, for when you want to
  control where a sentence wraps without starting a separate note:
  `Kat called this morning.|She will ring again on Friday.`
- **Reassurance** — leave blank almost always. Only fill it in to override the
  bottom line for one particular day.

Fill in future days whenever you like. Days with nothing planned can be left
out entirely — the board shows "Nothing planned today." rather than guessing.

### Tab: `Events` — one row per event

| Date | Description |
|------|-------------|
| 2026-08-04 | Saw Dr. Amal |
| 2026-08-10 | 1:30 pm  Dentist – crown |
| 2026-08-10 | 2:30 pm  Realtor – Elaine Simms |
| 2026-08-19 | Kathy arrives |

This is the CALENDAR column. Put the time at the front of the description if
there is one.

**Never mark anything as done.** The board works out what is past from today's
date and adds the green check itself. Two entries on the same date print the
date once. Past entries stay visible for a few days so she can see that
something already happened — that is the whole point of the column.

The column holds 10 entries. Normally that is up to 4 past and 6 upcoming, but
once **8 or more things are coming up** the past is trimmed to 2 so the busy
stretch ahead gets the room. Nothing is deleted — trimmed entries are simply
off-screen, and past ones reappear whenever the horizon quietens down.

### Tab: `Status` — written BY the board, read by you

Add a tab named exactly **Status** and leave it empty. The script fills in the
header row and one row per display the first time each checks in:

| Device | Last seen | Ago | Status |
|--------|-----------|-----|--------|
| table | 2026-08-09 14:22 | 2 min ago | OK |
| living-room | 2026-08-09 14:21 | 3 min ago | OK |
| bedroom | 2026-08-09 09:04 | 5.3 hours ago | CHECK |

**Do not type in this tab.** Everything is overwritten. It answers one question
from anywhere in the world: is each screen actually running?

*Ago* and *Status* are live formulas, not text — they recompute whenever you
open the Sheet. That matters: a written-out "2 min ago" would freeze, so a
display that died last night would still read "2 min ago" this morning.

If the tab does not exist the board works exactly as before; the response
simply carries a warning and nothing is recorded.

### Tab: `Settings` — key/value

| Key | Value |
|-----|-------|
| standing | Feeling hungry? Eat some food. Feeling thirsty? Drink some water. Stay hydrated. |
| reassure | Everything is okay. You are safe and loved. |
| notes | Greg is here for {days:2026-08-20}. Then Kathy comes. Then Chris. |
| alertAfterMinutes | 15 |
| focus | *(usually blank — see §3)* |
| focusUntil | *(usually blank — see §3)* |
| night | It's the middle of the night.\|You're home and safe.\|It's not morning yet. |
| nightStart | 8:00 pm |
| nightEnd | 6:00 am |

- **standing** — the small grey line under the CALENDAR. Constant, shown every
  day. Break it across lines with a pipe **or** Alt+Enter inside the cell:

  `Feeling hungry? Eat some food.|Feeling thirsty? Drink some water. Stay hydrated.`

  A semicolon does **not** work here. `Settings` values are read whole, unlike
  the `Days` columns where a semicolon starts a new item.
- **reassure** — the big line across the bottom.
- **notes** — a note shown *every* day, below whatever is in today's `Days` row.
  Use it for things that stay true for weeks, so you type them once instead of
  copying them into every row.
- **alertAfterMinutes** — how quiet a display must go before the `Status` tab
  calls it `CHECK` instead of `OK`. Default 15. This is a judgement call and it
  is yours: too low and a slow morning start looks like a fault, too high and a
  dead screen goes unnoticed for hours. The board checks in every 3 minutes, so
  anything above ~10 is safe from false alarms.
- **focus** and **focusUntil** — a message that takes over the whole screen.
  Normally both blank. **See §3, "Putting one big message on the screen".**
- **nightStart** and **nightEnd** — when every screen dims, and when it stops.
  **Two separate rows** — one row saying `nightStart / nightEnd` does not work;
  the board would ignore it and quietly keep 8:00 pm.
- **night** — the message the *bedroom* shows once dimmed. The other screens
  keep their usual board, so this does not affect them.
- All three are optional; leaving them out gives the defaults above.
  **See §4, "The evening and the bedroom at night".**

---

## 2. Countdowns: `{days:YYYY-MM-DD}`

Anywhere in a Today item or a Note, `{days:2026-08-20}` becomes:

| Days away | Shows |
|-----------|-------|
| 12 | `12 more days` |
| 1 | `1 more day` |
| 0 | `today` |
| past | **the whole line disappears** |

So `Greg is here for {days:2026-08-20}.` reads "Greg is here for 12 more days."
today and "for 1 more day." on the 19th, with nobody editing anything.

Write the **date**, never the number. A hand-typed "13 more days" is wrong
tomorrow and nobody notices — which is exactly the kind of quietly-wrong
information this board exists to prevent.

---

## 3. Putting one big message on the screen

Sometimes the ordinary board is the *least* helpful thing to be showing. She has
noticed you are not in the house and wants to know where you are; the day's
routine and the dentist in three weeks are not the answer. For that, put one
sentence on the screen and nothing else.

Two cells in `Settings`, editable from your phone:

| Key | Value |
|-----|-------|
| focus | Greg stepped out, back around 4:00 |
| focusUntil | 4:00 pm |

Within about three minutes every display drops everything and shows that
sentence, as large as it will fit, with the date and time still at the top and
the usual reassurance line at the bottom.

**It takes itself down.** At 4:00 pm the takeover disappears and the normal
board comes back — you do not have to remember to clear it, and it clears
itself even if the wifi has been dead all afternoon. That is the whole design:
a message like this is *worse* than nothing once it has stopped being true.

- **`focusUntil` blank** → it runs until the end of the day. Use this when you
  don't know how long you'll be.
- **`focusUntil` is today only.** Type `4:00 pm`, or `16:00`, or use a time cell.
  Anything later than tonight is pulled back to the end of today.
- **To take it down early**, clear the `focus` cell — or set `focusUntil` to a
  time that has already passed.
- **Anything that stays true for days does not belong here.** "Kathy arrives
  Wednesday" is a NOTES line or a calendar entry, where it sits *alongside*
  everything else instead of hiding the calendar for a week. If you find
  yourself wanting a takeover for tomorrow as well, that is the sign.
- `{days:2026-08-20}` works inside the message, same as everywhere else.

If nothing appears, open the `/exec` URL in a browser and read the `warnings`
list — an unrecognised `focusUntil`, or one already in the past, says so there.

---

## 4. The evening, and the bedroom at night

**Every screen dims between 8pm and 6am** — near-black background, dim amber
text, no white or blue. What differs is what each one shows once dimmed:

- **Table and living room — the whole board, just darker.** Same routine, same
  calendar, same notes, same reassurance line, nothing removed. These screens
  are still being read in the evening; they were only ever too *bright*.
- **The bedroom — the date, the time and one short message.** Nothing else,
  because nobody reads a board at 3am.

> The bedroom TV stick is not installed yet, so for now this only affects the
> table and living room. The `night` message below is what the bedroom will show
> when it goes in; you can write it whenever you like.

| Key | Value |
|-----|-------|
| night | It's the middle of the night.\|You're home and safe.\|It's not morning yet. |
| nightStart | 8:00 pm |
| nightEnd | 6:00 am |

- All three are optional. Leave them out and you get exactly what is shown above.
- **`nightStart` and `nightEnd` apply to every screen**, not just the bedroom —
  they are when the whole house dims. If the table still feels too bright in the
  evening, make `nightStart` earlier; that is a Sheet edit, no code involved.
- `night` is the bedroom's message only. The other screens show their usual
  board when they dim, so there is nothing extra to write for them.
- A **pipe** `|` (or Alt+Enter) forces a line break, same as the standing prompt.
- Keep it true at *any* hour of the night, and keep it kind. It has to work at
  2am and at 5am with nobody there to explain it, so it should never say morning
  is close.
- The times accept `8:00 pm`, `20:00`, or a time-formatted cell.
- A **focus message overrides night**: if you raise one at 2am, the bedroom shows
  it in the dark palette rather than the night message. That is intentional —
  the acute thing wins, it just doesn't shout.

*Which* screen shows which of the two is set in the code, not the Sheet
(`SCREEN_MODES` in `index.html`) — bedroom minimal, everything else the full
board. The *timing* is yours in the Sheet, above. If a screen ever wants the
other treatment, that is a one-line change.

---

## 5. Publish the script

1. In the Sheet: **Extensions → Apps Script**.
2. Delete whatever is there, paste all of `apps-script.gs`, **Save**.
3. Rename the project from "Untitled project" to **Mom's Board**, or you will
   never find it again in your Google account permissions.
4. **Pin the permissions** (see *Scopes* below): gear → Project Settings → tick
   *Show "appsscript.json" manifest file in editor*, then open `appsscript.json`
   and replace it with the copy of that file in this repo. **Save.**
5. **Deploy → New deployment**, gear icon → **Web app**.
   - *Description*: anything
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
6. **Deploy**, authorise when asked. Google shows *"Google hasn't verified this
   app"* — expected: verification is for apps distributed to strangers, and the
   developer here is you. **Advanced → Go to Mom's Board (unsafe) → Allow.**
7. Copy the **Web app URL** — it ends in `/exec`.

> "Anyone" means anyone holding that URL can read the Sheet's contents. Keep it
> out of public places. The board itself is already on a public GitHub Pages URL.

### Scopes

Left to itself, Apps Script asks for **"See, edit, create, and delete all your
Google Sheets spreadsheets"** plus **"Display and run third-party web content in
prompts and sidebars"**. This script uses neither: it reads one Sheet and has no
UI whatsoever. Automatic scope inference on container-bound projects over-asks.

That matters more than usual here, because the web app is reachable by **anyone**
with the URL and runs **as you** — so whatever you grant is what a stray request
could reach. `appsscript.json` in this repo pins it to a single scope:

```
https://www.googleapis.com/auth/spreadsheets.currentonly
```

which covers the Sheet the script is attached to and nothing else in your Drive.
The consent screen should then ask only for *"View and manage the spreadsheet
that this application is installed in."*

If a deployment with this scope fails to read the Sheet, drop the `oauthScopes`
block, redeploy, and accept the broad grant — but try the narrow one first.

Then in `index.html`, near the top of the `<script>`:

```js
const ENDPOINT = 'https://script.google.com/macros/s/AKfy.../exec';
```

Commit and push, and the TV picks it up within the hour — or immediately if you
reopen the page.

**After any later edit to the script you must Deploy → Manage deployments →
edit (pencil) → Version: New version → Deploy.** Saving alone does not change
what the URL serves. This catches everyone once.

> **The heartbeat needs this.** The `Status` tab stays empty until you redeploy
> a new version — the URL keeps serving the older script until you do. Open the
> `/exec` URL in a browser afterwards: `"heartbeat":"ok"` means it is recording.

> **So do `focus` and `focusUntil` (§3).** Until the redeploy the old script
> keeps serving, the takeover simply never appears, and the board carries on
> exactly as before — no error, nothing broken, nothing on screen. Open `/exec`
> and look for `"focusUntilEpochMs"`: if that word is not in the response, the
> deployment is still the old version.

**And then be patient.** After a redeploy, a change can take up to ~10 minutes
to reach a TV — GitHub Pages caches the page for 10 minutes — plus up to an hour
for that display's hourly reload. Nothing has failed; it just has not arrived
yet. (A `focus` message is different: it is *data*, not code, so it appears
within about three minutes with no redeploy at all.)

---

## 6. One URL per display

Bookmark a different URL on each TV so each one identifies itself:

| Display | URL |
|---|---|
| Table | `https://gpapciak.github.io/reminders/?screen=table` |
| Living room | `https://gpapciak.github.io/reminders/?screen=living-room` |
| Bedroom | `https://gpapciak.github.io/reminders/?screen=bedroom` |

The name is tidied automatically — `Living Room`, `living_room` and
`living-room` all become `living-room`. A display opened with no `?screen=`
still checks in, under `unnamed`, so an unlabelled TV shows up as a row rather
than silently going missing.

Set each device's Silk homepage to its own URL. Then "launch Silk" *is* the
recovery step after an idle wake, with no bookmark to select.

### `?debug=1` — diagnostics

Adding `&debug=1` draws a small readout in the bottom-left corner:

```
WAKE ACTIVE 6s   releases 0
table   data 2m   beat ok   1280x650
```

`WAKE` is the Screen Wake Lock experiment, `data` is how long since the Sheet
was last read, `beat` is whether the heartbeat recorded. Legible through a Tapo
camera, which is the point.

It draws over the reassurance line, so prefer running it on the living-room or
bedroom TV rather than her table display. Without the flag nothing is added to
the page at all.

---

## 7. What the board does when things go wrong

Designed to be wrong in the safe direction rather than confidently wrong.

| Situation | What she sees |
|-----------|---------------|
| Fetch fails (wifi, Google down) | The last good data stays up. After 25 minutes the bottom line quietly adds `· Updated 3:56 PM`. |
| Fetch keeps failing past midnight | TODAY and NOTES empty themselves, because they belonged to yesterday. **The calendar stays** — every entry carries its own date, so it is still correct. |
| No `Days` row for today | "Nothing planned today." The calendar still shows. |
| Sheet unreachable from a cold start | Date, time, the standing prompt and the reassurance line — all of which are true regardless. |
| A tab or column is missing | That section is empty; the rest works. The response includes a `warnings` list you can see by opening the `/exec` URL in a browser. |
| No `Status` tab, or two displays writing at once | The heartbeat is skipped for that request and noted in the response. The board still gets its data — observability never blocks the thing being observed. |
| The Fire TV's clock is wrong | The board uses the server's clock for the displayed time, which day to show, when night starts, and when a takeover ends. |
| A takeover is up and the wifi dies | It still disappears at its own `focusUntil` — the deadline travels with the message, so no network is needed to take it down. |
| A takeover is still cached the next day | It never reappears. The deadline is an exact moment, not a clock time, so "4:00 pm" cannot be re-read against a new day. |
| `focusUntil` is set past tonight | Pulled back to the end of today, with a note in `warnings`. Anything longer belongs in a NOTES line. |
| `focusUntil` is unreadable ("soonish") | The message still shows, until the end of today, and `warnings` says so. Better than silently swallowing something urgent. |
| `focus` is blank or missing | No takeover. The ordinary board, exactly as before. |
| `night` is blank or missing | The bedroom still goes dark at night and shows the built-in message. |

The rule behind all of it: **undated information expires, dated information does
not.** Yesterday's plans are never shown as today's. A dated appointment is
still a fact about that date no matter how old the fetch is.

---

## 8. Refresh behaviour

- Sheet is re-read every **3 minutes**, with a cache-busting parameter.
- The page fully reloads **hourly**, as protection against Silk misbehaving over
  days of uptime.
- At midnight Pacific the date line rolls over on its own and a fresh fetch
  fires immediately.
- Coming back online, or the tab becoming visible again, triggers a fetch.

## Testing without the TV

`https://gpapciak.github.io/reminders/?demo=1` renders sample content with no
Sheet at all — useful for checking layout. The bare URL never shows demo data.

With `?demo=1` you can also see the other two modes without touching the Sheet
and without waiting for 8pm. Add any of these to that URL:

| Add | Shows |
|---|---|
| `&night=1` | the night screen |
| `&focus=Greg stepped out, back around 4:00` | a takeover |
| `&focusuntil=4:00 pm` | …with that deadline |
| `&nightmsg=…` | try a different night message |
| `&now=2026-08-15T22:30` | pretend it is this time; the clock runs on from there |
| `&screen=bedroom` | the display that has a night mode |

Two examples — the same moment, half past eleven, on the two kinds of screen:

```
the table, dimmed but complete:
https://gpapciak.github.io/reminders/?demo=1&screen=table&now=2026-08-15T23:30

the bedroom, dimmed and minimal:
https://gpapciak.github.io/reminders/?demo=1&screen=bedroom&now=2026-08-15T23:30
```

`&night=1` forces the dim regardless of the hour, if you would rather not pick
a time.

These only work alongside `demo=1`, so the three bookmarked TV URLs can never
trip one by accident.
