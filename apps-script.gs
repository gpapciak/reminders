/**
 * Mom's Board — data endpoint.
 *
 * Paste this into the Sheet's own script project:
 *   Extensions -> Apps Script -> replace everything -> Save
 * Then: Deploy -> New deployment -> Web app
 *   Execute as:      Me
 *   Who has access:  Anyone
 * Copy the /exec URL into ENDPOINT at the top of index.html.
 *
 * Because it is bound to the Sheet there is no spreadsheet ID to paste.
 *
 * Everything is read defensively: a missing tab, a missing column or a
 * malformed row yields empty data and a warning, never an exception. The
 * board treats "no data" as "show the safe fallback", so failing quietly
 * here is the correct behaviour.
 */

var TZ = 'America/Los_Angeles';

/* Heartbeat. The endpoint is public, so the Status tab has to be bounded:
   anyone could invent ?screen= values. */
var MAX_DEVICES = 20;
var DEFAULT_ALERT_MIN = 15;     /* overridable via Settings/alertAfterMinutes */
/* Raised 45s -> 150s (2026-09-15) when the table display's poll went to 60s.
   This is a WRITE throttle, not a read one: at a 60s poll the old value let
   every single poll rewrite the Status row, tripling Sheet writes on the one
   screen whose reads we wanted to speed up. At 150s a 60s-polling screen
   writes about every 3 minutes — exactly what it did before — so the faster
   board costs no extra writes at all. Still far inside alertAfterMinutes (15),
   and a 3-minute poller is unaffected because its gaps (180s) already exceed
   this. */
var BEAT_MIN_GAP_MS = 150000;

/* ---------- check-ins ----------
   She taps a button on her phone; that tap appends one row here. The board
   reads them back and shows four chips. See the Log section further down. */
/* Eight kinds (2026-09-26, up from four). The SLUGS of the original four are
   deliberately unchanged even though two of them are now shown under different
   names — 'exercise' reads as "Biking/Walking" on the board. A slug is the
   stored identity: renaming it would orphan every row already in the Log tab
   and silently break the four Shortcuts already on her phone. Display names
   live in LOG_LABELS and in CHECKINS in index.html; those are free to change,
   slugs are not. */
var LOG_KINDS = ['medicine-am', 'medicine-pm', 'shower', 'exercise',
                 'drops-am', 'drops-pm', 'outside', 'memory'];
/* How each kind is SPOKEN, for the notification on her phone. Lives here and
   not in the Shortcut because a Shortcut cannot be redeployed remotely: if this
   wording ever needs to change, changing it here changes all four phones'
   notifications at once, with no phone in hand. See fmt=text below. */
var LOG_LABELS = {
  'medicine-am': 'Morning medicine',
  'medicine-pm': 'Evening medicine',
  'shower':      'Shower',
  'exercise':    'Biking or walking',
  'drops-am':    'Morning drops',
  'drops-pm':    'Evening drops',
  'outside':     'Outside time',
  'memory':      'Memory practice'
};
/* Read only the TAIL of the Log tab, never getDataRange(). doGet is polled by
   every display all day and this tab is the only one that grows without bound
   — ~4 rows/day forever. 80 rows is 20 days of normal use, so today's rows are
   always inside it with a wide margin, and the cost of this read stays flat in
   year three. If somebody hand-enters dozens of extra rows in a single day the
   oldest of today's could fall outside the window; the failure mode is a chip
   showing grey when it should be green, which is the safe direction. */
var LOG_TAIL_ROWS = 80;

function doGet(e) {
  /* THE WRITE BRANCH, taken before any read work at all.
     A bound web app has exactly one entry point, so a check-in arrives here
     too — but it must not pay for the whole board's read. On the other end of
     this request is a phone waiting on a notification, and the difference
     between "instant" and "a couple of seconds" is the difference between an
     interaction she trusts and one she taps twice. It returns its own small
     JSON and nothing below this line runs. */
  if (e && e.parameter && e.parameter.log) return handleLogWrite(e);

  var now = new Date();
  var out = {
    ok: true,
    serverEpochMs: now.getTime(),
    serverLaDate: Utilities.formatDate(now, TZ, 'yyyy-MM-dd'),
    days: {},
    events: [],
    media: [],
    settings: {},
    /* The two TIMED MESSAGES. Each is the raw text plus the ONE thing the
       client cannot safely work out for itself — when it stops being true,
       as an absolute instant. Identical shape, identical expiry, resolved by
       identical code; they differ only in what the board does with them.
       See resolveTimedMessages(). */
    focus: '',                   /* takes the board OVER while it is true   */
    focusUntilEpochMs: 0,
    focusForDate: '',
    gentle: '',                  /* takes a TURN in the rotation instead    */
    gentleUntilEpochMs: 0,
    gentleForDate: '',
    /* Today's check-ins, keyed by kind, as epoch ms so the board formats the
       time with its own fmtTime rather than parsing a string we chose here.
       logForDate is the guard: the board shows these ONLY if it is still that
       LA date, exactly like the day row. A check-in is day-scoped, undated
       information — it must expire at midnight with no network. */
    log: {},
    logForDate: '',
    screen: '',
    heartbeat: 'off',
    warnings: []
  };
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tz = ss.getSpreadsheetTimeZone();
    readDays(ss, tz, out);
    readEvents(ss, tz, out);
    readMedia(ss, out);
    readSettings(ss, tz, out);
    readLog(ss, out);              /* after nothing in particular; needs only serverLaDate */
    resolveTimedMessages(out);     /* after settings: it reads focus/gentle + their untils */
    recordHeartbeat(ss, e, out);   /* after settings: it reads alertAfterMinutes */
  } catch (err) {
    out.ok = false;
    out.error = String((err && err.message) || err);
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- helpers ---------- */

function norm(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Header row -> {normalisedName: columnIndex}, so columns can be reordered. */
function headerIndex(row) {
  var idx = {};
  for (var i = 0; i < row.length; i++) {
    var k = norm(row[i]);
    if (k && !(k in idx)) idx[k] = i;
  }
  return idx;
}

/** First matching header name wins, so a few spellings are accepted. */
function col(idx, names) {
  for (var i = 0; i < names.length; i++) {
    if (names[i] in idx) return idx[names[i]];
  }
  return -1;
}

function cell(row, i) {
  if (i < 0 || i >= row.length || row[i] == null) return '';
  return String(row[i]).trim();
}

/**
 * A date cell may be a real Date or text. Real Dates are stored at midnight
 * in the SPREADSHEET's timezone, so format with that — not with TZ — or a
 * sheet set to a different zone shifts every date by a day.
 */
function cellDate(row, i, tz) {
  if (i < 0 || i >= row.length) return '';
  var v = row[i];
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  var s = String(v == null ? '' : v).trim();
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return iso(m[1], m[2], m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);        // 8/10/2026
  if (m) return iso(m[3], m[1], m[2]);
  return '';
}
function iso(y, mo, d) {
  return y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2);
}

/** One cell -> several lines. Alt+Enter inside the cell, or semicolons. */
function lines(v) {
  return String(v == null ? '' : v)
    .split(/\r?\n|;/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}

function sheet(ss, name, out) {
  var sh = ss.getSheetByName(name);
  if (!sh) out.warnings.push('no tab named "' + name + '"');
  return sh;
}

/* ---------- tabs ---------- */

/**
 * "Days" — one row per date.
 *   Date | Today | Notes | Reassurance
 * Only a small window around today is returned; the board needs today's row,
 * and a day either side covers the midnight boundary.
 */
function readDays(ss, tz, out) {
  var sh = sheet(ss, 'Days', out);
  if (!sh) return;
  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) return;
  var idx = headerIndex(rows[0]);
  var cDate = col(idx, ['date']);
  var cToday = col(idx, ['today', 'todaysplans', 'plans']);
  var cNotes = col(idx, ['notes', 'note']);
  var cReass = col(idx, ['reassurance', 'reassure']);
  if (cDate < 0) { out.warnings.push('Days: no "Date" column'); return; }

  var todayISO = out.serverLaDate;
  var lo = shift(todayISO, -1), hi = shift(todayISO, 2);

  for (var r = 1; r < rows.length; r++) {
    var d = cellDate(rows[r], cDate, tz);
    if (!d || d < lo || d > hi) continue;
    out.days[d] = {
      date: d,
      today: lines(cToday < 0 ? '' : rows[r][cToday]),
      notes: lines(cNotes < 0 ? '' : rows[r][cNotes]),
      reassure: cell(rows[r], cReass)
    };
  }
}

/**
 * "Events" — one row per event.
 *   Date | Description
 * Past vs upcoming is decided by the board from today's date. Nothing here
 * is ever ticked off by hand.
 */
function readEvents(ss, tz, out) {
  var sh = sheet(ss, 'Events', out);
  if (!sh) return;
  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) return;
  var idx = headerIndex(rows[0]);
  var cDate = col(idx, ['date', 'when']);
  var cWhat = col(idx, ['description', 'what', 'event', 'details']);
  if (cDate < 0 || cWhat < 0) {
    out.warnings.push('Events: need "Date" and "Description" columns');
    return;
  }
  for (var r = 1; r < rows.length; r++) {
    var d = cellDate(rows[r], cDate, tz);
    var what = cell(rows[r], cWhat);
    if (d && what) out.events.push({ date: d, what: what });
  }
}

/**
 * "Media" — one row per photo, for the occasional still-image "photo moment"
 * overlay (see index.html).
 *   File | Caption | Screens
 *
 * File is either a bare filename, resolved by the client against the repo's
 * /media/ folder, or a full https:// URL used as-is. Caption is optional
 * warmth/orientation text, never a status or instruction. Screens is an
 * optional comma/space-separated allow-list of ?screen= ids — blank means
 * eligible on every daytime screen EXCEPT the bedroom, which the client
 * excludes unconditionally regardless of what this column says.
 *
 * A row with no File is silently skipped, the same tolerant pattern
 * readEvents() uses for a row missing its date or description: never throws,
 * never warns per row, just left out. A missing or empty Media tab is a
 * valid, safe, opt-out state — out.media stays [] and no photo moment ever
 * fires, which is exactly what an as-yet-uncurated board should do.
 */
function readMedia(ss, out) {
  var sh = sheet(ss, 'Media', out);
  if (!sh) return;
  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) return;
  var idx = headerIndex(rows[0]);
  var cFile = col(idx, ['file', 'filename', 'image', 'photo']);
  var cCaption = col(idx, ['caption', 'captions']);
  var cScreens = col(idx, ['screens', 'screen']);
  if (cFile < 0) { out.warnings.push('Media: no "File" column'); return; }
  for (var r = 1; r < rows.length; r++) {
    var file = cell(rows[r], cFile);
    if (!file) continue;
    var caption = cCaption < 0 ? '' : cell(rows[r], cCaption);
    var rawScreens = cScreens < 0 ? '' : cell(rows[r], cScreens);
    var screens = rawScreens.split(/[,\s]+/)
      .map(normScreenToken)
      .filter(function (s) { return s.length > 0; });
    out.media.push({ file: file, caption: caption, screens: screens });
  }
}

/**
 * "Settings" — key/value.
 *   Key      | Value
 *   standing | Feeling hungry? Eat some food. ...
 *   reassure | Everything is okay. You are safe and loved.
 *   notes    | Greg is here for {days:2026-08-20}. Then Kathy comes.
 *
 * "notes" shows every day, under any note on today's row, so a fact that
 * holds for weeks is typed once rather than copied into every row.
 *
 * Also: focus / focusUntil / gentle / gentleUntil / gentleEveryMin /
 * gentleHoldSec / night / nightStart / nightEnd — see resolveTimedMessages()
 * and the mode selection in index.html.
 */
function readSettings(ss, tz, out) {
  var sh = sheet(ss, 'Settings', out);
  if (!sh) return;
  var rows = sh.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    var k = norm(rows[r][0]);
    if (k) out.settings[k] = settingValue(rows[r].length > 1 ? rows[r][1] : '', tz);
  }
}

/**
 * Type "4:00 pm" into a Sheets cell and Sheets does not store that string — it
 * stores a Date, and String() on it yields "Sat Dec 30 1899 16:00:00 GMT-0752",
 * which no clock parser will ever accept. Time-typed cells are the NORMAL way a
 * family member will fill in focusUntil, gentleUntil or nightStart, so normalise
 * here, once,
 * for every setting:
 *   a time-only cell  -> "16:00"
 *   a date-time cell  -> "2026-08-15 16:00"
 * The 1899-12-30 epoch date is Sheets' sentinel for "no date part".
 */
function settingValue(v, tz) {
  /* Duck-typed, not `instanceof Date`, for the reason spelled out in
     writeHeartbeat(): that check is realm-sensitive and fails silently on a
     value produced elsewhere. Failing silently here would mean a family
     member's perfectly good "4:00 pm" quietly becoming an unparseable
     "Sat Dec 30 1899 ...". */
  if (v && typeof v.getTime === 'function' && !isNaN(v.getTime())) {
    var ymd = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    var hm = Utilities.formatDate(v, tz, 'HH:mm');
    return (ymd < '1900-01-01') ? hm : (ymd + ' ' + hm);
  }
  return String(v == null ? '' : v).trim();
}


/* ---------- the Log tab: self-reported check-ins ----------
 *
 * | Timestamp        | Kind        | Date       |
 * | 2026-09-15 08:20 | medicine-am | 2026-09-15 |
 *
 * She taps one of four buttons on her phone. That tap is a plain HTTPS GET to
 * this same /exec URL with ?log=KIND&k=TOKEN, and it appends one row.
 *
 * WHY THIS IS NOT A VIOLATION OF "nothing is inferred from time passing".
 * Everything else on the board refuses to turn elapsed time into a claim that
 * something happened. This does the opposite of inferring: it is an EXPLICIT
 * confirmation, made by her, at the moment she made it, recorded with the
 * server's clock. The board reports what she said. It never computes what she
 * probably did, and it must never start to.
 *
 * `Date` is stored redundantly alongside the timestamp so the tab is readable
 * and filterable by hand, and so reading it back never has to re-derive a
 * timezone from a Date cell. Both are written in one append.
 */

/** The JSON a caller gets back. Small and STABLE — anything parsing it cannot
 *  be redeployed remotely the way this script can. */
function logJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ?fmt=text — the same answer as one finished English sentence, ready to be
 * shown verbatim.
 *
 * WHY THIS EXISTS. The JSON above is the honest machine answer, but the only
 * thing consuming it is an iOS Shortcut, and assembling a sentence there costs
 * five actions: read a dictionary key, branch on it, and paste a variable into
 * two notification strings — built four times, by hand, on a phone keyboard,
 * by someone who does not write software. Every one of those steps is a place
 * to mistype a key name and get a notification that silently says nothing.
 *
 * The server already knows the kind, the time, and whether it was a repeat. So
 * it says the sentence, and the Shortcut becomes: fetch this, show that. Two
 * actions, nothing to get wrong, and the wording stays changeable from here
 * rather than needing four phones back.
 *
 * The error text is deliberately HER error text, not the technical one — she
 * is the one who reads it. Drop &fmt=text from the URL to see the real reason
 * ("unauthorized", "no log tab") when something needs diagnosing.
 */
function logText(obj) {
  var msg;
  if (obj && obj.ok) {
    var label = LOG_LABELS[obj.kind] || obj.kind;
    msg = obj.already
        ? label + ' — already recorded at ' + obj.at
        : label + ' — recorded at ' + obj.at;
  } else {
    msg = "Couldn't record — try again in a minute";
  }
  return ContentService
    .createTextOutput(msg)
    .setMimeType(ContentService.MimeType.TEXT);
}

/** One place decides which of the two shapes goes back, so every return path
 *  in handleLogWrite() gets it without having to remember. */
function logReply(e, obj) {
  var fmt = String((e && e.parameter && e.parameter.fmt) || '').toLowerCase();
  return (fmt === 'text') ? logText(obj) : logJson(obj);
}

function handleLogWrite(e) {
  try {
    /* The token lives in Script Properties, NEVER in this file — the repo is
       public. A MISSING property rejects every write rather than defaulting to
       open: an unconfigured deployment must be closed, not wide open, because
       "I forgot to set it" and "anyone can write to her medical log" would
       otherwise be the same state. */
    var token = PropertiesService.getScriptProperties().getProperty('LOG_TOKEN');
    var given = String((e.parameter && e.parameter.k) || '');
    /* A plain comparison. Not constant-time, and deliberately not pretending to
       be: this runs behind Google's front end over HTTPS with per-request
       latency in the hundreds of milliseconds and heavy rate limiting, which
       makes a timing oracle here a fiction. The honest threat model is written
       down in SETUP.md — this stops accidents and casual pokes, not somebody
       who has the URL and the token. */
    if (!token || given !== token) return logReply(e, { ok: false, error: 'unauthorized' });

    var kind = String(e.parameter.log || '').trim().toLowerCase();
    /* A fixed allowlist, never a dynamic kind. The board renders four chips
       from its own matching list; a fifth kind here would write rows nothing
       ever displays, which is worse than refusing. */
    if (LOG_KINDS.indexOf(kind) < 0) return logReply(e, { ok: false, error: 'unknown kind' });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Log');
    if (!sh) return logReply(e, { ok: false, error: 'no log tab' });

    var lock = LockService.getScriptLock();
    /* Waited on, not skipped — the opposite of the heartbeat's policy, and for
       the opposite reason. A dropped heartbeat costs nothing because another
       one is three minutes away; a dropped check-in is the entire interaction
       failing in her hand. 10s is longer than any append can take and still
       short enough to return an honest "try again" rather than hanging. */
    if (!lock.tryLock(10000)) return logReply(e, { ok: false, error: 'busy' });
    try {
      return logReply(e, appendCheckIn(sh, kind));
    } finally {
      lock.releaseLock();
    }

  } catch (err) {
    /* Never an exception out of this branch: the phone shows a notification
       built from this reply, and a 500 would give her a blank one. */
    return logReply(e, { ok: false, error: String((err && err.message) || err) });
  }
}

/**
 * FIRST PRESS OF THE DAY WINS, and later presses are idempotent by design.
 *
 * This is the load-bearing decision in the whole feature. She may well tap a
 * second time *to check* — that is exactly what someone with a short memory
 * window does, and it is the behaviour the board exists to support. So a
 * second tap must answer "yes, 8:20 AM", never quietly record a second event
 * and never move the recorded time later. The row that survives is the one
 * closest to when it actually happened.
 *
 * Called with the script lock already held, so the read-then-append below
 * cannot interleave with another tap.
 */
function appendCheckIn(sh, kind) {
  var now = new Date();
  var today = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  var HEAD = ['Timestamp', 'Kind', 'Date'];

  var last = sh.getLastRow();
  if (last < 1) {
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]);
    sh.setFrozenRows(1);
    last = 1;
  }

  var found = findCheckIn(sh, kind, today);
  if (found) {
    return { ok: true, kind: kind, already: true,
             at: Utilities.formatDate(found, TZ, 'h:mm a') };
  }

  sh.appendRow([now, kind, today]);
  return { ok: true, kind: kind, already: false,
           at: Utilities.formatDate(now, TZ, 'h:mm a') };
}

/** Today's row for this kind, as a Date, or null. Tail-scanned — see
 *  LOG_TAIL_ROWS for why this never reads the whole tab. */
function findCheckIn(sh, kind, today) {
  var rows = logTail(sh);
  if (!rows) return null;
  for (var r = rows.values.length - 1; r >= 0; r--) {   /* newest first */
    var row = rows.values[r];
    if (norm(cell(row, rows.cKind)) !== norm(kind)) continue;
    if (logRowDate(row, rows) !== today) continue;
    var ts = row[rows.cTime];
    /* Duck-typed, not instanceof — same realm-sensitivity reason as
       writeHeartbeat(). A hand-typed timestamp has no getTime and is treated
       as "present but unreadable": the row still counts as today's check-in
       (so no duplicate is appended) and the caller gets now() for display. */
    return (ts && typeof ts.getTime === 'function' && !isNaN(ts.getTime())) ? ts : new Date();
  }
  return null;
}

/** Header lookup + the tail rows, or null if the tab is unusable. One place,
 *  because the write path and the read path must agree about what a row is. */
function logTail(sh) {
  var last = sh.getLastRow();
  if (last < 2) return null;                       /* headers only, or empty */
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var idx = headerIndex(head);
  var cTime = col(idx, ['timestamp', 'time', 'when']);
  var cKind = col(idx, ['kind', 'what', 'type']);
  var cDate = col(idx, ['date', 'day']);
  if (cTime < 0 || cKind < 0) return null;         /* caller warns */
  var first = Math.max(2, last - LOG_TAIL_ROWS + 1);
  var values = sh.getRange(first, 1, last - first + 1, head.length).getValues();
  return { values: values, cTime: cTime, cKind: cKind, cDate: cDate };
}

/** The row's LA date. Prefers the redundant Date column; falls back to
 *  deriving it from the timestamp if that column is missing or was cleared,
 *  so a half-filled tab still reads correctly rather than showing nothing. */
function logRowDate(row, rows) {
  if (rows.cDate >= 0) {
    var d = row[rows.cDate];
    if (d && typeof d.getTime === 'function' && !isNaN(d.getTime())) {
      return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
    }
    var txt = cell(row, rows.cDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;
  }
  var ts = row[rows.cTime];
  if (ts && typeof ts.getTime === 'function' && !isNaN(ts.getTime())) {
    return Utilities.formatDate(ts, TZ, 'yyyy-MM-dd');
  }
  return '';
}

/**
 * A cell from the Kind column -> the canonical slug, or '' if it is not one.
 *
 * Compares NORMALISED forms on both sides, and that symmetry is the whole
 * point. norm() strips punctuation, so 'drops-am' in the sheet comes back as
 * 'dropsam' and no longer matches the slug it was written from. The previous
 * version tried to un-mangle the one side with a regex that restored exactly
 * 'medicine-am' and 'medicine-pm' — correct when those were the only hyphenated
 * kinds, and silently wrong the moment 'drops-am' and 'drops-pm' were added:
 * their rows were written correctly and then skipped on the way back, so the
 * chips never went green and nothing anywhere reported a problem.
 *
 * Normalising both sides instead means any future slug is safe whatever
 * punctuation it carries, and a hand-typed "Drops AM" or "drops am" in the
 * cell still resolves to the right kind.
 */
function logKindOf(raw) {
  var n = norm(raw);
  if (!n) return '';
  for (var i = 0; i < LOG_KINDS.length; i++) {
    if (norm(LOG_KINDS[i]) === n) return LOG_KINDS[i];
  }
  return '';
}

/**
 * TODAY ONLY, keyed by kind, as epoch ms.
 *
 * Yesterday's rows are simply never returned, so a board that somehow ignored
 * logForDate still could not show a stale green chip. Two independent guards
 * for the same failure, because that failure — "you already took it" when she
 * has not — is the one this feature could actually hurt someone with.
 */
function readLog(ss, out) {
  try {
    out.logForDate = out.serverLaDate;
    var sh = ss.getSheetByName('Log');
    if (!sh) {
      /* Not an error and not a reason to show nothing else: the board draws
         four grey chips, which is the honest state. */
      out.warnings.push('no tab named "Log" - no check-ins recorded or shown');
      return;
    }
    var rows = logTail(sh);
    if (!rows) {
      if (sh.getLastRow() >= 2) out.warnings.push('Log: no "Timestamp"/"Kind" columns');
      return;
    }
    for (var r = 0; r < rows.values.length; r++) {
      var row = rows.values[r];
      var kind = logKindOf(cell(row, rows.cKind));
      if (!kind) continue;
      if (logRowDate(row, rows) !== out.serverLaDate) continue;
      var ts = row[rows.cTime];
      if (!ts || typeof ts.getTime !== 'function' || isNaN(ts.getTime())) continue;
      /* FIRST press of the day wins here too, matching the write path: keep
         the earliest if duplicates ever exist (a hand-added row, a row that
         predates the lock). Never silently show the later one. */
      var t = ts.getTime();
      if (!out.log[kind] || t < out.log[kind]) out.log[kind] = t;
    }
  } catch (err) {
    /* Same posture as the heartbeat: one bad tab never takes the board down. */
    out.log = {};
    out.warnings.push('log: ' + String((err && err.message) || err));
  }
}

/* ---------- timed messages: focus and gentle ----------
 *
 * Two intensities of the same thing — a temporary message from whoever is
 * looking after her — and ONE resolver, because the part that has to be
 * right is identical for both.
 *
 *   focus   drops the whole board for one big sentence: "Greg stepped out,
 *           back around 4:00". It is the moment the dense day board helps
 *           least, so it is worth suppressing — but ONLY while it is true.
 *
 *   gentle  says the same kind of thing when suppressing the board would be
 *           too much. It never takes the board over; the display fades it in
 *           over the board for a few seconds every few minutes, exactly the
 *           way a photo moment works, and gives the board straight back.
 *           See the GENTLE MESSAGES block in index.html.
 *
 * Which one to reach for is an authoring decision, made in the Sheet. This
 * code does not infer it and must not start to.
 *
 * The failure we are structurally preventing is the board still insisting at
 * 9pm that Greg is back at 4:00. Stale, wrong, and distressing to someone who
 * cannot check. So neither message is ever undated: each always carries an
 * until-INSTANT, and retires itself by comparison, exactly like a calendar
 * entry moving into the past. This is the project's "undated information
 * expires, dated information does not" rule applied to a message.
 *
 * It matters MORE for gentle, not less, which is why there is no lighter
 * version of any guard below. A wrong takeover is at least sitting there in
 * front of whoever next walks into the room; a wrong gentle message fades
 * itself in again every few minutes, mostly when nobody is watching.
 *
 * Resolved HERE rather than on the client for two reasons:
 *   - the LA date is already known and already authoritative here, and the
 *     server's clock is what the board trusts for everything else;
 *   - an absolute instant cannot be re-interpreted against a later day. A
 *     cached "4:00 pm" could be; that is precisely how a message from
 *     yesterday would resurrect itself on a display that lost its network.
 *
 * Capped at LA end-of-day, always. Anything that needs to outlive today is
 * neither of these — it is a NOTES line, where it sits alongside the calendar
 * instead of interrupting for days.
 */
function resolveTimedMessages(out) {
  resolveTimedMsg(out, 'focus',  'focusUntilEpochMs',  'focusForDate');
  resolveTimedMsg(out, 'gentle', 'gentleUntilEpochMs', 'gentleForDate');
  /* Both authored at once is not something the client needs protecting from
     — it already prefers the takeover and suppresses every moment underneath
     it — but from the Sheet a gentle message that never appears looks exactly
     like a broken one, so say which is which. */
  if (out.focus && out.gentle) {
    out.warnings.push('focus and gentle are both set - focus takes the board ' +
                      'over, so the gentle message will not rotate in until ' +
                      'focus clears. Use one or the other.');
  }
}

/**
 * One message, resolved. `key` is BOTH the Settings key and the output field
 * ("focus" -> settings.focus + settings.focusuntil -> out.focus), which is what
 * keeps the two messages from drifting apart as anything is added here.
 */
function resolveTimedMsg(out, key, untilField, dateField) {
  /* Belt and braces around each one SEPARATELY. Everything below is defensive
     already, but this is the only part of doGet that parses free text a family
     member typed, and an exception here would fail the WHOLE response — the
     board would fall back to cached data over a typo in one cell. Per-message
     rather than around both, so a bad gentleUntil cannot also take down a
     perfectly good focus message. Same rule as the heartbeat: degrade to a
     warning, never take the board down. */
  try { resolveTimedMsgInner(out, key, untilField, dateField); }
  catch (err) {
    out[key] = ''; out[untilField] = 0; out[dateField] = '';
    out.warnings.push(key + ': ' + String((err && err.message) || err) + ' - not shown');
  }
}

function resolveTimedMsgInner(out, key, untilField, dateField) {
  var msg = String(out.settings[key] || '').trim();
  if (!msg) return;                      /* no key, blank cell -> nothing */

  var today = out.serverLaDate;
  var endOfDay = laInstantMs(today, 23, 59) + 59999;
  var label = key + 'Until';
  var raw = String(out.settings[key + 'until'] || '').trim();
  var until;

  if (!raw) {
    /* "I've just stepped out and I don't know how long" is the common case.
       End of day is the safe answer: bounded, self-clearing, and it never
       needs a second edit to take the message down. */
    until = endOfDay;
  } else {
    until = parseUntilTime(raw, today);
    if (until === null) {
      /* Deliberately NOT "show nothing". The message itself is well-formed and
         somebody typed it for a reason; refusing to show it because the time
         was typed oddly would suppress something that matters. End of day is
         bounded and self-clearing, so this can never become a stuck message
         either way. */
      out.warnings.push(label + ' "' + raw + '" not understood - using end of day');
      until = endOfDay;
    }
  }

  if (until > endOfDay) {
    out.warnings.push(label + ' "' + raw + '" is past end of day - capped. ' +
                      'Anything longer than today belongs in notes, not ' + key + '.');
    until = endOfDay;
  }
  if (until <= out.serverEpochMs) {
    /* Not an error: an until-time earlier today is how a message is taken down
       without deleting the text. Say so, because from the Sheet it looks
       identical to a message that is simply not appearing. */
    out.warnings.push(label + ' "' + raw + '" has already passed - not shown');
  }

  out[key] = msg;
  out[untilField] = until;
  out[dateField] = today;
}

/** "4:00 pm" | "16:00" | "2026-08-15 4:00 pm" -> epoch ms, or null if it is
 *  not a time. Null always means "not understood", never a time. */
function parseUntilTime(s, todayISO) {
  var ymd = todayISO, timePart = String(s || '').trim();
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]+(.*))?$/.exec(timePart);
  if (m) {
    ymd = iso(m[1], m[2], m[3]);
    timePart = String(m[4] || '').trim();
    if (!timePart) return null;          /* a bare date names no instant */
  }
  var hm = parseClock(timePart);
  if (!hm) return null;
  return laInstantMs(ymd, hm.h, hm.m);
}

function parseClock(s) {
  var m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*$/i.exec(String(s || ''));
  if (!m) return null;
  var h = +m[1], mi = m[2] ? +m[2] : 0;
  var ap = (m[3] || '').toLowerCase().charAt(0);
  if (mi > 59) return null;
  if (ap) { if (h < 1 || h > 12) return null; h = h % 12; if (ap === 'p') h += 12; }
  else if (h > 23) return null;
  return { h: h, m: mi };
}

/**
 * An LA wall-clock time -> an absolute instant, DST included.
 *
 * Two passes, because the offset is itself a function of the instant: the
 * first guess picks an offset, the second confirms it. Without the second
 * pass a time on a DST-change morning lands an hour out. Written this way
 * rather than with new Date(string) because Apps Script's parser does not
 * accept a named timezone.
 */
function laInstantMs(ymd, h, m) {
  var guess = Date.parse(ymd + 'T' + pad2(h) + ':' + pad2(m) + ':00Z');
  /* "2026-99-99" matches the date shape and parses to NaN. Caught here rather
     than downstream, where an invalid Date would make Utilities.formatDate
     throw and take the whole response with it. Null reads as "not understood",
     which the caller already handles. */
  if (!isFinite(guess)) return null;
  var t = guess - laOffsetMs(new Date(guess));
  var off2 = laOffsetMs(new Date(t));
  if (guess - off2 !== t) t = guess - off2;
  return t;
}
function laOffsetMs(d) {
  var z = Utilities.formatDate(d, TZ, 'Z');          /* e.g. "-0700" */
  var sign = z.charAt(0) === '-' ? -1 : 1;
  return sign * ((+z.substr(1, 2)) * 3600000 + (+z.substr(3, 2)) * 60000);
}
function pad2(n) { return ('0' + n).slice(-2); }


/* ---------- heartbeat ----------
 *
 * Remote observability, and the cheapest available: every display already
 * calls this endpoint every ~3 minutes, so recording WHO asked and WHEN turns
 * an existing request into "is each screen actually running?" — answerable
 * from a phone in another country, as data rather than a camera image someone
 * has to interpret.
 *
 * Non-negotiable: this must never break the board. Every failure path here
 * degrades to a warning and the caller still gets its data.
 */

/** The same "?screen=" -> identifier shape used in three places: the
 *  heartbeat's device id, index.html's own SCREEN constant, and a Media row's
 *  Screens allow-list. Kept in one function so all three can never drift out
 *  of sync with each other — a mismatch here would mean a Screens entry that
 *  looks right in the Sheet silently never matches any real screen.
 *  Returns '' on blank input; callers decide what blank means for them. */
function normScreenToken(v) {
  return String(v == null ? '' : v).toLowerCase().trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

/** Untrusted input from a public URL. Sanitised client-side too; done again
 *  here because the client is not the only thing that can call this. Note a
 *  leading "=" cannot survive, so nothing typed into ?screen= can land in the
 *  Sheet as a formula. Blank normalises to "unnamed" — a device identity, so
 *  unlike normScreenToken() it must never come back empty. */
function cleanScreenId(v) {
  return normScreenToken(v) || 'unnamed';
}

function recordHeartbeat(ss, e, out) {
  try {
    var id = cleanScreenId(e && e.parameter ? e.parameter.screen : '');
    out.screen = id;

    var sh = ss.getSheetByName('Status');
    if (!sh) {
      out.warnings.push('no tab named "Status" - heartbeat not recorded');
      out.heartbeat = 'no-tab';
      return;
    }

    var lock = LockService.getScriptLock();
    /* Short, and SKIPPED rather than queued. The board's data is the critical
       path and the next beat is only three minutes away — never make one
       display wait on another display's write. */
    if (!lock.tryLock(1500)) { out.heartbeat = 'busy'; return; }
    try { writeHeartbeat(sh, id, out); }
    finally { lock.releaseLock(); }

  } catch (err) {
    /* Observability must never take the board down. */
    out.heartbeat = 'error';
    out.warnings.push('heartbeat: ' + String((err && err.message) || err));
  }
}

function writeHeartbeat(sh, id, out) {
  var HEAD = ['Device', 'Last seen', 'Ago', 'Status'];
  var now = new Date();

  var last = sh.getLastRow();
  if (last < 1) {
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]);
    sh.setFrozenRows(1);
    last = 1;
  }

  var rows = last > 1 ? sh.getRange(2, 1, last - 1, 2).getValues() : [];
  var row = -1, i;
  for (i = 0; i < rows.length; i++) {
    if (norm(rows[i][0]) === norm(id)) { row = i + 2; break; }
  }

  if (row > 0) {
    /* The board also refetches on visibilitychange and on regaining network,
       which can bunch requests together. One write per device per minute is
       ample for a 3-minute beat and keeps doGet cheap. */
    var seen = rows[row - 2][1];
    /* Duck-typed rather than `instanceof Date`: that check is realm-sensitive
       and quietly fails on a value produced elsewhere, which would silently
       disable this throttle. A non-date (someone typed in the cell) has no
       getTime, falls through, and we simply rewrite the row. */
    if (seen && typeof seen.getTime === 'function' &&
        (now.getTime() - seen.getTime()) < BEAT_MIN_GAP_MS) {
      out.heartbeat = 'fresh';
      return;
    }
  } else {
    if (rows.length >= MAX_DEVICES) {
      /* Fold the overflow into a single row rather than letting a public URL
         grow the tab without end. */
      for (i = 0; i < rows.length; i++) {
        if (norm(rows[i][0]) === 'other') { row = i + 2; break; }
      }
      if (row < 0) row = rows.length + 2;
      id = 'other';
      out.warnings.push('Status: device cap (' + MAX_DEVICES + ') reached - recorded as "other"');
    } else {
      row = rows.length + 2;
    }
    sh.getRange(row, 2).setNumberFormat('yyyy-mm-dd hh:mm');
  }

  /* "Ago" and "Status" are FORMULAS, not text. A written-out "2 min ago" would
     freeze at the moment of writing, so a display that died an hour ago would
     still read "2 min ago" forever — precisely the confidently-wrong stale
     information this project exists to avoid. NOW() recalculates when the
     Sheet is opened, so these are true whenever anybody actually looks. */
  var alertMin = Number(out.settings.alertafterminutes);
  if (!isFinite(alertMin) || alertMin <= 0) alertMin = DEFAULT_ALERT_MIN;

  var b = '$B' + row;
  var ago =
    '=IF(' + b + '="","",' +
    'IF((NOW()-' + b + ')*1440<90,ROUND((NOW()-' + b + ')*1440)&" min ago",' +
    'IF((NOW()-' + b + ')*24<48,ROUND((NOW()-' + b + ')*24,1)&" hours ago",' +
    'ROUND(NOW()-' + b + ',1)&" days ago")))';
  var stat =
    '=IF(' + b + '="","",IF((NOW()-' + b + ')*1440>' + alertMin + ',"CHECK","OK"))';

  sh.getRange(row, 1, 1, 4).setValues([[id, now, ago, stat]]);
  out.heartbeat = 'ok';
}

function shift(isoDate, days) {
  var p = isoDate.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
