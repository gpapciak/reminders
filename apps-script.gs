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
var BEAT_MIN_GAP_MS = 45000;

function doGet(e) {
  var now = new Date();
  var out = {
    ok: true,
    serverEpochMs: now.getTime(),
    serverLaDate: Utilities.formatDate(now, TZ, 'yyyy-MM-dd'),
    days: {},
    events: [],
    settings: {},
    /* Focus takeover: the raw message plus the ONE thing the client cannot
       safely work out for itself — when it stops being true, as an absolute
       instant. See resolveFocus(). */
    focus: '',
    focusUntilEpochMs: 0,
    focusForDate: '',
    screen: '',
    heartbeat: 'off',
    warnings: []
  };
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tz = ss.getSpreadsheetTimeZone();
    readDays(ss, tz, out);
    readEvents(ss, tz, out);
    readSettings(ss, tz, out);
    resolveFocus(out);             /* after settings: it reads focus/focusUntil */
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
 * "Settings" — key/value.
 *   Key      | Value
 *   standing | Feeling hungry? Eat some food. ...
 *   reassure | Everything is okay. You are safe and loved.
 *   notes    | Greg is here for {days:2026-08-20}. Then Kathy comes.
 *
 * "notes" shows every day, under any note on today's row, so a fact that
 * holds for weeks is typed once rather than copied into every row.
 *
 * Also: focus / focusUntil / night / nightStart / nightEnd — see resolveFocus()
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
 * family member will fill in focusUntil or nightStart, so normalise here, once,
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


/* ---------- focus takeover ----------
 *
 * A focus message drops the whole board for one big sentence: "Greg stepped
 * out, back around 4:00". It is the moment the dense day board helps least,
 * so it is worth suppressing — but ONLY while it is true.
 *
 * The failure we are structurally preventing is the board still insisting at
 * 9pm that Greg is back at 4:00. Stale, wrong, and distressing to someone who
 * cannot check. So a focus message is never undated: it always carries an
 * until-INSTANT, and it retires itself by comparison, exactly like a calendar
 * entry moving into the past. This is the project's "undated information
 * expires, dated information does not" rule applied to a message.
 *
 * Resolved HERE rather than on the client for two reasons:
 *   - the LA date is already known and already authoritative here, and the
 *     server's clock is what the board trusts for everything else;
 *   - an absolute instant cannot be re-interpreted against a later day. A
 *     cached "4:00 pm" could be; that is precisely how a takeover from
 *     yesterday would resurrect itself on a display that lost its network.
 *
 * Capped at LA end-of-day, always. Anything that needs to outlive today is
 * not a takeover — it is a NOTES line, where it sits alongside the calendar
 * instead of suppressing it for days.
 */
function resolveFocus(out) {
  /* Belt and braces around the whole thing. Everything below is defensive
     already, but this function is the only part of doGet that parses free text
     a family member typed, and an exception here would fail the WHOLE response
     — the board would fall back to cached data over a typo in one cell. Same
     rule as the heartbeat: degrade to a warning, never take the board down. */
  try { resolveFocusInner(out); }
  catch (err) {
    out.focus = ''; out.focusUntilEpochMs = 0; out.focusForDate = '';
    out.warnings.push('focus: ' + String((err && err.message) || err) + ' - no takeover');
  }
}

function resolveFocusInner(out) {
  var msg = String(out.settings.focus || '').trim();
  if (!msg) return;                      /* no key, blank cell -> no takeover */

  var today = out.serverLaDate;
  var endOfDay = laInstantMs(today, 23, 59) + 59999;
  var raw = String(out.settings.focusuntil || '').trim();
  var until;

  if (!raw) {
    /* "I've just stepped out and I don't know how long" is the common case.
       End of day is the safe answer: bounded, self-clearing, and it never
       needs a second edit to take the message down. */
    until = endOfDay;
  } else {
    until = parseFocusUntil(raw, today);
    if (until === null) {
      /* Deliberately NOT "no takeover". The message itself is well-formed and
         acute; refusing to show it because the time was typed oddly would
         suppress something urgent. End of day is bounded and self-clearing, so
         this can never become a stuck takeover either way. */
      out.warnings.push('focusUntil "' + raw + '" not understood - using end of day');
      until = endOfDay;
    }
  }

  if (until > endOfDay) {
    out.warnings.push('focusUntil "' + raw + '" is past end of day - capped. ' +
                      'Anything longer than today belongs in notes, not focus.');
    until = endOfDay;
  }
  if (until <= out.serverEpochMs) {
    /* Not an error: an until-time earlier today is how a takeover is taken
       down without deleting the text. Say so, because from the Sheet it looks
       identical to a message that is simply not appearing. */
    out.warnings.push('focusUntil "' + raw + '" has already passed - no takeover');
  }

  out.focus = msg;
  out.focusUntilEpochMs = until;
  out.focusForDate = today;
}

/** "4:00 pm" | "16:00" | "2026-08-15 4:00 pm" -> epoch ms, or null if it is
 *  not a time. Null always means "not understood", never a time. */
function parseFocusUntil(s, todayISO) {
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

/** Untrusted input from a public URL. Sanitised client-side too; done again
 *  here because the client is not the only thing that can call this. Note a
 *  leading "=" cannot survive, so nothing typed into ?screen= can land in the
 *  Sheet as a formula. */
function cleanScreenId(v) {
  var s = String(v == null ? '' : v).toLowerCase().trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return s ? s.slice(0, 24) : 'unnamed';
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
