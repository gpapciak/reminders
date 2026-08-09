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

function doGet(e) {
  var now = new Date();
  var out = {
    ok: true,
    serverEpochMs: now.getTime(),
    serverLaDate: Utilities.formatDate(now, TZ, 'yyyy-MM-dd'),
    days: {},
    events: [],
    settings: {},
    warnings: []
  };
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tz = ss.getSpreadsheetTimeZone();
    readDays(ss, tz, out);
    readEvents(ss, tz, out);
    readSettings(ss, out);
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
 * "Settings" — key/value.
 *   Key      | Value
 *   standing | Feeling hungry? Eat some food. ...
 *   reassure | Everything is okay. You are safe and loved.
 *   notes    | Greg is here for {days:2026-08-20}. Then Kathy comes.
 *
 * "notes" shows every day, under any note on today's row, so a fact that
 * holds for weeks is typed once rather than copied into every row.
 */
function readSettings(ss, out) {
  var sh = sheet(ss, 'Settings', out);
  if (!sh) return;
  var rows = sh.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    var k = norm(rows[r][0]);
    if (k) out.settings[k] = cell(rows[r], 1);
  }
}

function shift(isoDate, days) {
  var p = isoDate.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
