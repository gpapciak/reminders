# Wiring the board to a Google Sheet

The board reads one Google Sheet through a small Apps Script web app. Family
members edit the Sheet; nobody touches code.

---

## 1. Build the Sheet

Create a new Google Sheet called **Mom's Board**, then:

**File → Settings → General → Time zone → `(GMT-08:00) Pacific Time`.**

Do this first. Date cells are stored at midnight in the *spreadsheet's* timezone,
so a Sheet left on the wrong zone shifts every date by a day.

Make three tabs, named exactly **Days**, **Events**, **Settings**. Row 1 is
headers in every tab. Column order does not matter — the script matches on the
header text — but the spelling does.

### Tab: `Days` — one row per date

| Date | Today | Notes | Reassurance |
|------|-------|-------|-------------|
| 2026-08-08 | Researching care options⏎OnPoint Credit Union⏎Best Buy⏎Gratitude | Kat called this morning | |

- **Date** — `2026-08-08`, or a real date cell, or `8/8/2026`.
- **Today** — the numbered TODAY list. **One item per line** (press
  **Alt+Enter** inside the cell), or separate with semicolons. Numbering is
  automatic.
- **Notes** — same rule, one per line.
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

### Tab: `Settings` — key/value

| Key | Value |
|-----|-------|
| standing | Feeling hungry? Eat some food. Feeling thirsty? Drink some water. Stay hydrated. |
| reassure | Everything is okay. You are safe and loved. |
| notes | Greg is here for {days:2026-08-20}. Then Kathy comes. Then Chris. |

- **standing** — the small grey line under NOTES. Constant, shown every day.
- **reassure** — the big line across the bottom.
- **notes** — a note shown *every* day, below whatever is in today's `Days` row.
  Use it for things that stay true for weeks, so you type them once instead of
  copying them into every row.

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

## 3. Publish the script

1. In the Sheet: **Extensions → Apps Script**.
2. Delete whatever is there, paste all of `apps-script.gs`, **Save**.
3. **Deploy → New deployment**, gear icon → **Web app**.
   - *Description*: anything
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
4. **Deploy**, authorise when asked (choose your account → Advanced → Go to
   project → Allow).
5. Copy the **Web app URL** — it ends in `/exec`.

> "Anyone" means anyone holding that URL can read the Sheet's contents. Keep it
> out of public places. The board itself is already on a public GitHub Pages URL.

Then in `index.html`, near the top of the `<script>`:

```js
const ENDPOINT = 'https://script.google.com/macros/s/AKfy.../exec';
```

Commit and push, and the TV picks it up within the hour — or immediately if you
reopen the page.

**After any later edit to the script you must Deploy → Manage deployments →
edit → Version: New version.** Saving alone does not change what the URL
serves. This catches everyone once.

---

## 4. What the board does when things go wrong

Designed to be wrong in the safe direction rather than confidently wrong.

| Situation | What she sees |
|-----------|---------------|
| Fetch fails (wifi, Google down) | The last good data stays up. After 25 minutes the bottom line quietly adds `· Updated 3:56 PM`. |
| Fetch keeps failing past midnight | TODAY and NOTES empty themselves, because they belonged to yesterday. **The calendar stays** — every entry carries its own date, so it is still correct. |
| No `Days` row for today | "Nothing planned today." The calendar still shows. |
| Sheet unreachable from a cold start | Date, time, the standing prompt and the reassurance line — all of which are true regardless. |
| A tab or column is missing | That section is empty; the rest works. The response includes a `warnings` list you can see by opening the `/exec` URL in a browser. |
| The Fire TV's clock is wrong | The board uses the server's clock for both the displayed time and which day to show. |

The rule behind all of it: **undated information expires, dated information does
not.** Yesterday's plans are never shown as today's. A dated appointment is
still a fact about that date no matter how old the fetch is.

---

## 5. Refresh behaviour

- Sheet is re-read every **3 minutes**, with a cache-busting parameter.
- The page fully reloads **hourly**, as protection against Silk misbehaving over
  days of uptime.
- At midnight Pacific the date line rolls over on its own and a fresh fetch
  fires immediately.
- Coming back online, or the tab becoming visible again, triggers a fetch.

## Testing without the TV

`https://gpapciak.github.io/reminders/?demo=1` renders sample content with no
Sheet at all — useful for checking layout. The bare URL never shows demo data.
