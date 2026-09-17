# Wiring the board to a Google Sheet

The board reads one Google Sheet through a small Apps Script web app. Family
members edit the Sheet; nobody touches code.

---

## 1. Build the Sheet

Create a new Google Sheet called **Mom's Board**, then:

**File → Settings → General → Time zone → `(GMT-08:00) Pacific Time`.**

Do this first. Date cells are stored at midnight in the *spreadsheet's* timezone,
so a Sheet left on the wrong zone shifts every date by a day.

Make five tabs, named exactly **Days**, **Events**, **Settings**, **Status**
and **Media** (Status stays empty always — the board fills it in; Media can
stay empty until you want photo moments — see §5 below). Row 1 is headers in
the rest. Column order does not matter — the script matches on the header
text — but the spelling does.

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

### Tab: `Media` — one row per photo, for occasional "photo moments"

| File | Caption | Screens |
|------|---------|---------|
| kathy-summer-2024.jpg | Kathy, your daughter — summer 2024 | |
| garden-2023.jpg | Your garden last spring | table |

Optional in every sense — see **§5, "Photo moments"** below for what this
does, how to add a photo, and the safety model behind it. Leave the tab empty
(or don't make it at all) and nothing changes: no photo ever appears, which is
the deliberate default.

### Tab: `Settings` — key/value

| Key | Value |
|-----|-------|
| reassure | Everything is okay. You are safe and loved. |
| notes | Greg is here for {days:2026-08-20}. Then Kathy comes. Then Chris. |
| alertAfterMinutes | 15 |
| focus | *(usually blank — see §3)* |
| focusUntil | *(usually blank — see §3)* |
| gentle | *(usually blank — see §3a)* |
| gentleUntil | *(usually blank — see §3a)* |
| gentleEveryMin | *(blank — see §3a)* |
| gentleHoldSec | *(blank — see §3a)* |
| night | It's the middle of the night.\|You're home and safe.\|It's not morning yet. |
| nightStart | 8:00 pm |
| nightEnd | 6:00 am |
| checkins | *(blank — see §5a)* |
| media | *(blank — see §5)* |
| mediaEveryMin | *(blank — see §5)* |
| mediaHoldSec | *(blank — see §5)* |

- **standing** — no longer shown (removed 2026-09-14 so the calendar could
  show more upcoming events). A leftover row does nothing and can be deleted.
- **reassure** — the big line across the bottom. Break it across lines with a
  pipe **or** Alt+Enter inside the cell; a semicolon does **not** work here.
  `Settings` values are read whole, unlike the `Days` columns where a
  semicolon starts a new item.
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
- **gentle**, **gentleUntil**, **gentleEveryMin**, **gentleHoldSec** — the
  quieter version of the same thing: a message that comes round every few
  minutes for a few seconds instead of taking the board over. Normally all
  blank. **See §3a, "The quieter version".**
- **nightStart** and **nightEnd** — when every screen dims, and when it stops.
  **Two separate rows** — one row saying `nightStart / nightEnd` does not work;
  the board would ignore it and quietly keep 8:00 pm.
- **night** — the message the *bedroom* shows once dimmed. The other screens
  keep their usual board, so this does not affect them.
- All three are optional; leaving them out gives the defaults above.
  **See §4, "The evening and the bedroom at night".**
- **checkins** — `on` shows the row of four check-in chips. Anything else, or
  blank, hides it completely. **See §5a, "Check-ins".**
- **media**, **mediaEveryMin**, **mediaHoldSec** — the photo moments master
  switch and its timing. All optional; leaving them out means no photo moments
  at all, which is the default. **See §5, "Photo moments".**

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

## 3a. The quieter version — a message that comes round

A takeover is the right tool when the board is genuinely in the way. Often it
isn't. You are out for a couple of hours, you would like her to be reminded of
that now and then, and you do not want the calendar and the routine gone all
afternoon to say it.

`gentle` is that. **Same message, same deadline, but it does not take the
board over.** It fades in over the board for about twenty seconds every
fifteen minutes, then fades out and the board is back exactly as it was — the
same way the photo moments work.

| Key | Value |
|-----|-------|
| gentle | Greg is at the store. He'll be back around 4:00. |
| gentleUntil | 4:00 pm |

**Everything §3 says about `focusUntil` is true of `gentleUntil`**, in exactly
the same words and for exactly the same reason: blank means end of day, it is
today only, anything later than tonight is pulled back, and it takes itself
down with no network. If anything the deadline matters *more* here — a wrong
takeover is at least sitting in front of whoever next walks in, while a wrong
gentle message keeps coming back when nobody is watching.

**Two optional dials**, both safe to leave blank:

| Key | Default | What it does |
|-----|---------|--------------|
| gentleEveryMin | 15 | How often it comes round. Minimum 2. |
| gentleHoldSec | 20 | How long it stays up each time. 5–60. |

- **`gentleEveryMin` goes down to 2 minutes** when a day needs a much steadier
  pulse than the default. That is a real setting, not a safety valve — but at
  2 minutes with the default hold the message is on screen roughly a sixth of
  the time, so reach for it deliberately and put a `gentleUntil` on it.
- **Photos keep their own pace.** If `media` is on, photo moments still appear
  as often as `mediaEveryMin` says; they simply take their turn in the same
  rotation. Only one thing is ever on screen at a time — a photo and a gentle
  message can never overlap or fight.
- **`media` off does not silence it.** That switch is about photographs. A
  gentle message runs whether or not photos are on.
- **The bedroom at night does not show it**, the same as photos — the dark
  screen stays dark. The living areas do.
- **`focus` wins.** If both cells are filled in, the takeover shows and the
  gentle message waits until the takeover clears. The `warnings` list says so.
- `{days:2026-08-20}` works inside the message, same as everywhere else.

**Which one do I want?**

| | `focus` | `gentle` |
|---|---|---|
| The board | gone while it runs | still there between turns |
| On screen | continuously | ~20s every ~15 min |
| Use it when | the board is in the way | the board is still useful |
| Example | "Stay inside. Greg is on his way." | "Greg is at the store, back around 4:00." |

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
- A **pipe** `|` (or Alt+Enter) forces a line break, same as in `Settings` values.
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

## 5. Photo moments

Off by default. Turn it on and, every hour or so, a curated family photo
fades in over the whole board, holds for about half a minute, and fades back
— a moment of warmth without giving up the board's *constancy*, which is
what actually does the reassuring day to day. It never appears at night, on
the bedroom, or while a takeover message is up, and it only ever shows a
photo you added yourself: nothing is ever pulled in from anywhere else.

**Why it is off by default, and why it stays gentle even switched on.** She
recently had a minor stroke, and a photo can land harder and faster than
expected — so the whole feature leans calm on purpose: still images only, one
at a time, a couple of times an afternoon at most, and instantly reversible
from one cell in the Sheet if a day isn't going well.

### Adding a photo

1. Get the image file into the `media/` folder in the GitHub repo (ask
   whoever set up the board if you need a hand with this part — it's a file
   upload, not a Sheet edit) and note the filename, e.g. `kathy-2024.jpg`.
2. Add one row to the `Media` tab:

   | File | Caption | Screens |
   |------|---------|---------|
   | kathy-2024.jpg | Kathy, your daughter — 2024 | |

   - **File** — just the filename from step 1. (A full `https://` link also
     works, but see the warning below before using one.)
   - **Caption** — optional. Keep it warm and orienting — who, and roughly
     when — never a status or a task. "Kathy, your daughter — 2024" is right;
     "Call Kathy back" is not; that belongs in NOTES.
   - **Screens** — leave blank for every screen (the bedroom is *always*
     excluded regardless, no matter what you type here). To restrict a photo
     to one display, type its id exactly as it appears in that display's URL
     — `table` or `living-room` — not the everyday name ("Living Room" with a
     space will not match anything).
3. That's it — no redeploy needed for a new photo, just the two steps above.
   It becomes eligible within about three minutes.

> **A same-origin file in `media/` is strongly preferred over a hosted
> link.** A Google Drive "share" link can stop working for hotlinking without
> warning, and this board runs unattended for months — a broken link there
> just means that one photo quietly never shows again, but it is one more
> thing that can go wrong for no reason. Keep photos in the repo unless there
> is a real reason not to.

### Turning it on, and the settings that shape it

| Key | Value |
|-----|-------|
| media | on |
| mediaEveryMin | *(optional — default ~80)* |
| mediaHoldSec | *(optional — default ~25)* |

- **media** — the master switch. Must be exactly `on`; anything else,
  including blank, is off. **This is the one-cell "not today" switch** — set
  it back to blank or anything but `on` and every display stops showing
  photos within about three minutes, no code, no redeploy.
- **mediaEveryMin** — roughly how many minutes between moments (a little
  randomised each time so it doesn't feel mechanical). Never allowed to go
  below 2 minutes no matter what is typed here, so a typo can't make the
  board flicker through photos.
- **mediaHoldSec** — how long a photo stays up before fading back, capped at
  60 seconds — past that it stops being a "moment" and starts being a
  takeover, which is what `focus` is for.

### What she never sees

If a photo fails to load — a typo in the filename, a broken link, no
internet for a moment — the board simply does not show it and quietly tries
something else next time. Never a broken-image icon, never a blank screen.
And a moment can never get stuck: it always has an upper bound on how long it
can possibly stay up, independent of everything else, so even if something
went wrong the ordinary board is always what comes back.

---

## 5a. Check-ins — four buttons on her phone

She taps a button on her phone when she takes her morning medicine, her evening
medicine, showers, or exercises. The board shows four chips: grey with no time,
or green with a checkmark and the time it was recorded. They clear at midnight.

**She never touches the television.** The board stays read-only; the buttons
are on the phone.

This needs four things set up, in this order.

### 1. A new tab called `Log`

Three columns, headers in row 1, spelled like this:

| Timestamp | Kind | Date |
|---|---|---|
| *(the script fills these in)* | | |

Leave it empty. The script writes the header row itself the first time a button
is pressed, so if you get the spelling slightly wrong the simplest fix is to
delete the tab's contents and let it rebuild.

Rows arrive looking like `2026-09-15 08:20 | medicine-am | 2026-09-15`. The date
is stored twice on purpose, so the tab is readable and sortable by hand.

**To undo a mistaken tap, delete that row.** There is no undo on her end — see
the limitations at the end of this section.

### 2. A secret, set once

The `/exec` URL is public, so the buttons need a password of sorts. It is
**not** stored in the code, because the code is in a public repository.

**Pick a token first.** 20+ characters of letters and numbers, no spaces and no
punctuation — it travels in a URL. Write it down somewhere you will still have
it in a year; you need it once here and once per Shortcut, and there is no way
to read it back out of Apps Script afterwards.

1. Open the Sheet → **Extensions → Apps Script**
2. In the **left sidebar**, click the **gear icon** (⚙️ *Project Settings*) — it
   is below the `< >` editor icon, not inside the code editor
3. Scroll to the bottom, to **Script Properties**
4. Click **Add script property** (if you have set properties before, the button
   says **Edit script properties** first)
5. **Property:** `LOG_TOKEN` — exactly that, capitals and underscore
6. **Value:** your token
7. Click **Save script properties**

**This takes effect immediately.** Script properties are read when the script
runs, so unlike a code change this needs no redeploy — you can set it before or
after publishing and it works either way.

**To check it took**, once the script has been redeployed (§6), paste this into
a browser with a *deliberately wrong* token:

```
https://script.google.com/macros/s/AKfycbxWpXuqZTXYxlk1gP8JtvML1tDoajdAK5nckcoO_uLMZlwZr6e8yt7SAt0CzWFEQE2A/exec?log=shower&k=definitely-wrong
```

You should get back exactly:

```json
{"ok":false,"error":"unauthorized"}
```

That one line proves three things at once: the redeploy landed, the endpoint is
reading the property, and the lock is shut. Then try it again with the **real**
token — you should get `{"ok":true,...}` — and **delete that test row from the
`Log` tab afterwards**, or the board will show a green Shower chip all day.

> If this property is missing, **every** button press is rejected. That is
> deliberate: an unconfigured board must be closed, not open. The symptom is
> that every Shortcut shows the failure notification.

### 3. Turn the chips on

In `Settings`, add a row: key `checkins`, value `on`.

Leave it off until you have seen the strip on the table display. You can preview
it on one screen without touching the Sheet by opening that display's URL with
`&checkins=1` on the end.

### 4. Four Shortcuts on her phone

**There is no Google account on her phone, and there does not need to be.**
Nothing Google-branded is installed or signed in — no Sheets app, no Drive, no
account, no login. The Shortcut makes a plain web request, and the script runs
as *you*, the owner. Her phone is just an anonymous visitor to a web address.
Shortcuts is already on every iPhone.

That is worth knowing because of what it removes: no session that can expire, no
app update that changes a login screen, no permission dialog she has to
interpret months from now.

**Build ONE of them completely, test it, then duplicate it three times.** Only
the URL and one word of the notification change between them, and duplicating
is far less error-prone than building the same six actions four times on a
phone keyboard.

#### Building the first one

**Shortcuts is an iPhone app** — grey icon, four coloured shapes. It is already
installed. It is not a website, and there is no Windows version, so this part
cannot be done on the laptop.

Open **Shortcuts** → tap **+** (top right). You are now in the editor: a blank
shortcut with a search box at the bottom.

**Name it.** Tap the name at the very top (it says *New Shortcut*) → **Rename**
→ type `Morning Medicine` → **Done**.

---

**Action 1 — fetch the URL.**

In the search box at the bottom, type `contents`. Tap **Get Contents of URL**.

A card appears reading **Get Contents of** ***URL***, where *URL* is blue.

Tap that blue **URL** word. The keyboard opens. Paste:

```
https://script.google.com/macros/s/AKfycbxWpXuqZTXYxlk1gP8JtvML1tDoajdAK5nckcoO_uLMZlwZr6e8yt7SAt0CzWFEQE2A/exec?log=medicine-am&k=YOUR_TOKEN&fmt=text
```

**Do not go looking for the Method setting.** It is hidden behind a small grey
**Show More** at the bottom of that card, and it is already **GET**, which is
what we want. Leave the card alone. (Open *Show More* only if you want to see
it; then tap **Show Less** and change nothing.)

---

**Action 2 — show what came back.**

Search `notification`. Tap **Show Notification**.

The card reads **Show Notification** with a text box containing *Hello World*.

1. Tap the words **Hello World** and delete them.
2. Just above the keyboard is a bar of blue variable chips. Tap the one that
   says **Contents of URL**.

The card should now read **Show Notification** *Contents of URL*. That is the
whole shortcut:

```
Get Contents of URL      .../exec?log=medicine-am&k=TOKEN&fmt=text
Show Notification        [Contents of URL]
```

Tap **Done**.

**That is it — two actions.** No dictionary, no If, nothing to branch on. The
`&fmt=text` on the end is what makes this possible: the server sends back a
finished sentence rather than data to assemble, so the phone's only job is to
show it. What she sees is one of:

> Morning medicine — recorded at 8:20 AM
> Morning medicine — already recorded at 8:20 AM
> Couldn't record — try again in a minute

including the wording for a failure, which is the case a hand-built shortcut is
most likely to get wrong.

**Test it now** — tap the ▷ play button at the bottom of the editor. You should
get a notification with a real time in it. Then **delete that row from the
`Log` tab.**

---

#### Then duplicate it three times

From the Shortcuts list, long-press **Morning Medicine** → **Duplicate** →
long-press the copy → **Rename**. Open it and change **one thing**: the word
after `log=` in the URL.

| Shortcut name | change `log=` to |
|---|---|
| Morning Medicine | `medicine-am` |
| Evening Medicine | `medicine-pm` |
| Shower | `shower` |
| Exercise | `exercise` |

Nothing else changes — not even the notification, because the server names the
activity itself. That also means the wording can be reworded later from the
script, without collecting four phones.

**Tapping twice is safe and always has been.** The second tap does not record a
second event; it answers with the *first* time, and says "already". That is on
purpose: pressing the button again to check "did I already do that?" is exactly
what she will do, and it has to give the right answer.

---

#### If you would rather parse the JSON

Dropping `&fmt=text` makes the same URL return
`{"ok":true,"kind":"medicine-am","already":false,"at":"8:20 AM"}` instead, which
is the machine-readable shape and is what to use when diagnosing — it carries
the real error (`unauthorized`, `no log tab`) where the text version shows her
wording. Building the notification from it on the phone takes five actions
(**Get Dictionary Value** for key `at`, an **If** on *has any value*, and a
**Show Notification** in each branch) and is not recommended: it is four times
the work, on a phone keyboard, for the same result.

#### Putting them on her phone

**A widget is worth trying first** — it puts all four on the home screen with no
folder to open. Put the four shortcuts in a folder first (Shortcuts → the
sidebar → **New Folder** → `Check-ins`), then long-press the home screen → **+**
→ **Shortcuts** → the **medium** (4-slot) widget → **Add Widget**, then tap the
widget and point it at the `Check-ins` folder.

**Or as four icons:** open a shortcut → **⌄** → **Add to Home Screen**.

**Sound.** Each **Show Notification** action has a **Play Sound** toggle. The
board is deliberately silent, but the phone is not the board — a sound here is
useful confirmation. Your call.

> **One thing to verify on the real phone:** `/exec` bounces the request to a
> second address (`googleusercontent.com`) before answering. Shortcuts normally
> follows that automatically, but it has not been tested on her handset. If the
> notification never shows a time, that redirect is the first thing to suspect.

> **If the network is down**, *Get Contents of URL* fails outright and iOS shows
> its own error banner instead of the "Couldn't record" message. Not silent, but
> not our wording either — worth knowing so it is not mistaken for a bug.

### Run each Shortcut once, during setup

The **first** time each Shortcut runs, iOS asks whether to allow it to send data
to `script.google.com`. That prompt is exactly what she should never have to
answer — and it appears **once per Shortcut**.

**So run all four yourself during setup and approve the prompt then.** Four taps
buys a permanently clean interaction afterwards. The prompt reads *"Allow
&lt;shortcut&gt; to send data to script.google.com?"* — choose **Allow Always** if it
is offered, **Allow** otherwise.

While you are there, this is also the test: each of the four should show a
notification with a real time in it. Then **delete those four test rows from the
`Log` tab**, or her board will start the day with four green chips she did not
earn.

**Where you BUILD them does not matter; where you RUN them does.** An earlier
version of this page said to build them on her phone, which is more painful than
it needs to be and was not quite right: the grant is per-shortcut *and*
per-device, and sharing a shortcut does not carry it across. So the prompt has to
be answered on her handset either way, and nothing is gained by typing a
150-character URL four times on someone else's phone.

Build all four wherever there is a real keyboard — your own iPhone, or a Mac —
then share them over (shortcut → **⌄** → **Share** → AirDrop or iCloud link) and
run each one once on her phone. Per the established two-person pattern: Greg
building and sharing, whoever is with her tapping each one once and answering
the prompt.

### Two honest limitations

- **The token stops accidents, not people.** Anyone who has both the `/exec`
  URL and the token can write rows. It is a lock on a garden gate, not a safe.
- **A mistaken tap has no undo on her end.** Correcting one means deleting that
  row in the `Log` tab.

---

## 6. Publish the script

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

> **So does `gentle` (§3a).** Same failure, same shape: until the redeploy the
> rotating message simply never appears and the board carries on exactly as
> before. Open `/exec` and look for `"gentleUntilEpochMs"` — if that word is
> not in the response, the deployment is still the old version. Note `focus`
> can be working fine while `gentle` is not: `"focusUntilEpochMs"` came in an
> earlier version, so its presence does **not** tell you this one landed.

> **So does the `Log` tab (§5a)** — and here the redeploy comes FIRST, before
> anything else in that section works: until it lands, a button press returns
> the old script's ordinary board JSON instead of an acknowledgement, and the
> Shortcut shows the failure notification. Open `/exec` and look for
> `"logForDate"`.

> **And the `Media` tab (§5) needs one, once — the first time this board is
> set up with photo moments in mind.** Until that redeploy `/exec` never
> mentions `"media"` at all and every row in `Media` is invisible to the
> board, same safe-and-quiet failure as above. After that one redeploy, a new
> photo row is a plain Sheet edit — no further redeploys, ever, just for
> adding photos.

**And then be patient.** After a redeploy, a change can take up to ~10 minutes
to reach a TV — GitHub Pages caches the page for 10 minutes — plus up to an hour
for that display's hourly reload. Nothing has failed; it just has not arrived
yet. (A `focus` message is different: it is *data*, not code, so it appears
within about three minutes with no redeploy at all.)

---

## 7. One URL per display

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
table   data 2m   beat ok   mode day full   photo idle   1280x650
PHOTO idle   next in 7m   every 10m   pool 10/10   last shown fire1.jpg 3m ago
```

`WAKE` is the Screen Wake Lock experiment, `data` is how long since the Sheet
was last read, `beat` is whether the heartbeat recorded. Legible through a Tapo
camera, which is the point.

The `PHOTO` line is for "why isn't this screen showing photos?": a bracketed
reason if something is blocking them right now (`[night]`, `[media off]`,
`[focus]`), when the next try is, how many photos this screen is
allowed out of how many the Sheet lists, and what the last try did — including
`FAILED to load <file>` if a photo couldn't be downloaded. The table and
living room show photos day and night; the bedroom only in day mode, so from
8pm to 6am it reads `[night]`.

It draws over the reassurance line, so prefer running it on the living-room or
bedroom TV rather than her table display. Without the flag nothing is added to
the page at all.

---

## 8. What the board does when things go wrong

Designed to be wrong in the safe direction rather than confidently wrong.

| Situation | What she sees |
|-----------|---------------|
| Fetch fails (wifi, Google down) | The last good data stays up. After 25 minutes the bottom line quietly adds `· Updated 3:56 PM`. |
| Fetch keeps failing past midnight | TODAY and NOTES empty themselves, because they belonged to yesterday. **The calendar stays** — every entry carries its own date, so it is still correct. |
| No `Days` row for today | "Nothing planned today." The calendar still shows. |
| Sheet unreachable from a cold start | Date, time and the reassurance line — all of which are true regardless. |
| A tab or column is missing | That section is empty; the rest works. The response includes a `warnings` list you can see by opening the `/exec` URL in a browser. |
| No `Status` tab, or two displays writing at once | The heartbeat is skipped for that request and noted in the response. The board still gets its data — observability never blocks the thing being observed. |
| The Fire TV's clock is wrong | The board uses the server's clock for the displayed time, which day to show, when night starts, and when a takeover ends. |
| A takeover is up and the wifi dies | It still disappears at its own `focusUntil` — the deadline travels with the message, so no network is needed to take it down. |
| A takeover is still cached the next day | It never reappears. The deadline is an exact moment, not a clock time, so "4:00 pm" cannot be re-read against a new day. |
| `focusUntil` is set past tonight | Pulled back to the end of today, with a note in `warnings`. Anything longer belongs in a NOTES line. |
| `focusUntil` is unreadable ("soonish") | The message still shows, until the end of today, and `warnings` says so. Better than silently swallowing something urgent. |
| `focus` is blank or missing | No takeover. The ordinary board, exactly as before. |
| `gentle` is up and the wifi dies | Same as a takeover: it still stops at its own `gentleUntil`. The deadline travels with the message. |
| `gentle` and `focus` are both set | The takeover shows; the gentle message waits for it to clear. `warnings` says so. |
| `gentleEveryMin` is 0 or nonsense | Pulled up to the 2-minute minimum. A typo cannot turn it into a strobe. |
| `night` is blank or missing | The bedroom still goes dark at night and shows the built-in message. |

The rule behind all of it: **undated information expires, dated information does
not.** Yesterday's plans are never shown as today's. A dated appointment is
still a fact about that date no matter how old the fetch is.

---

## 9. Refresh behaviour

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
| `&gentle=Greg is at the store, back around 4:00` | a rotating message instead |
| `&gentleuntil=4:00 pm` | …with that deadline |
| `&gentleeverymin=3` `&gentleholdsec=8` | …at that pace |
| `&gentlenow=1` | show it now instead of waiting |
| `&nightmsg=…` | try a different night message |
| `&now=2026-08-15T22:30` | pretend it is this time; the clock runs on from there |
| `&screen=bedroom` | the display that has a night mode |
| `&media=on` | turn photo moments on for this preview only |
| `&photonow=1` | show one right now, instead of waiting out the cadence |
| `&mediaholdsec=8` | …and hold it for this many seconds instead of the default |

Two examples — the same moment, half past eleven, on the two kinds of screen:

```
the table, dimmed but complete:
https://gpapciak.github.io/reminders/?demo=1&screen=table&now=2026-08-15T23:30

the bedroom, dimmed and minimal:
https://gpapciak.github.io/reminders/?demo=1&screen=bedroom&now=2026-08-15T23:30
```

`&night=1` forces the dim regardless of the hour, if you would rather not pick
a time. A third example — a photo moment, right now, without waiting an hour
or touching the Sheet:

```
https://gpapciak.github.io/reminders/?demo=1&screen=table&media=on&photonow=1
```

That preview uses a small placeholder graphic (not a real photo) so it works
with no `Media` tab at all — it exists purely to show the fade and layout.

These only work alongside `demo=1`, so the three bookmarked TV URLs can never
trip one by accident.
