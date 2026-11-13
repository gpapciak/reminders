/*
 * test-log-kinds.js — run with:  node test-log-kinds.js
 *
 * Round-trips EVERY kind in LOG_KINDS through the endpoint: write it, read it
 * back, assert the board would light the chip. No Apps Script needed — the
 * globals it uses are stubbed below.
 *
 * WHY THIS FILE IS IN THE REPO rather than somewhere temporary.
 * drops-am and drops-pm were written to the Log tab correctly and then
 * silently skipped on the way back: norm() strips punctuation, so the slug
 * came back as "dropsam", and the code that un-mangled it had been written
 * when medicine-am and medicine-pm were the only hyphenated kinds. Nothing
 * errored, nothing warned. The rows were there; the chips just never went
 * green.
 *
 * The checks that should have caught it covered three of the eight kinds, and
 * they lived in a temp directory that was later cleaned. Hence: all of them,
 * every time, checked in.
 *
 * The loop reads LOG_KINDS itself, so a new kind is covered the moment it is
 * added to apps-script.gs. Nothing here needs editing for that — which is the
 * whole point, since editing it is exactly what did not happen last time.
 */
const fs = require('fs');
const vm = require('vm');
const SRC = fs.readFileSync(require('path').join(__dirname, 'apps-script.gs'), 'utf8');

function fmt(date, tz, pattern) {
  const p = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(date).forEach(x => p[x.type] = x.value);
  if (pattern === 'yyyy-MM-dd') return `${p.year}-${p.month}-${p.day}`;
  if (pattern === 'HH:mm') return `${p.hour}:${p.minute}`;
  if (pattern === 'h:mm a') {
    let h = +p.hour, ap = h < 12 ? 'AM' : 'PM';
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${p.minute} ${ap}`;
  }
  throw new Error('unstubbed ' + pattern);
}
function FakeSheet(v) { this.v = v; }
FakeSheet.prototype.getLastRow = function () { return this.v.length; };
FakeSheet.prototype.getLastColumn = function () { return this.v.reduce((m, r) => Math.max(m, r.length), 0); };
FakeSheet.prototype.getRange = function (r, c, nr, nc) {
  const self = this;
  return {
    getValues: () => { const o = []; for (let i = 0; i < nr; i++) o.push((self.v[r - 1 + i] || []).slice(c - 1, c - 1 + nc)); return o; },
    setValues: v => { for (let i = 0; i < v.length; i++) self.v[r - 1 + i] = v[i].slice(); }
  };
};
FakeSheet.prototype.setFrozenRows = function () {};
FakeSheet.prototype.appendRow = function (r) { this.v.push(r.slice()); };

let SHEETS = {};
const ctx = {
  console,
  Utilities: { formatDate: fmt },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'tok' }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  ContentService: {
    MimeType: { JSON: 'json', TEXT: 'text' },
    createTextOutput: t => ({ _t: t, setMimeType: function () { return this; } })
  },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => SHEETS[n] || null }) }
};
vm.createContext(ctx); vm.runInContext(SRC, ctx);

let pass = 0, fail = 0;
function check(n, c, d) {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (d ? '  -> ' + d : '')); }
}
const TODAY = fmt(new Date(), 'America/Los_Angeles', 'yyyy-MM-dd');
const KINDS = ctx.LOG_KINDS;

console.log('--- every kind must survive write -> read ---');
KINDS.forEach(k => {
  SHEETS = { Log: new FakeSheet([['Timestamp', 'Kind', 'Date']]) };
  const w = JSON.parse(ctx.handleLogWrite({ parameter: { log: k, k: 'tok' } })._t);
  const out = { log: {}, logForDate: '', serverLaDate: TODAY, warnings: [] };
  ctx.readLog(ctx.SpreadsheetApp.getActiveSpreadsheet(), out);
  check(k.padEnd(13) + ' written and read back',
        w.ok === true && typeof out.log[k] === 'number',
        'wrote ' + JSON.stringify(w) + ' read ' + JSON.stringify(out.log));
});

console.log('\n--- all eight at once ---');
SHEETS = { Log: new FakeSheet([['Timestamp', 'Kind', 'Date']]) };
KINDS.forEach(k => ctx.handleLogWrite({ parameter: { log: k, k: 'tok' } }));
let out = { log: {}, logForDate: '', serverLaDate: TODAY, warnings: [] };
ctx.readLog(ctx.SpreadsheetApp.getActiveSpreadsheet(), out);
check('all ' + KINDS.length + ' come back together',
      Object.keys(out.log).length === KINDS.length,
      Object.keys(out.log).sort().join(','));

console.log('\n--- hand-typed variations in the Kind cell still resolve ---');
[['Drops-AM', 'drops-am'], ['drops am', 'drops-am'], ['  DROPS-PM  ', 'drops-pm'],
 ['Medicine-AM', 'medicine-am'], ['Outside', 'outside']].forEach(([typed, want]) => {
  SHEETS = { Log: new FakeSheet([['Timestamp', 'Kind', 'Date'],
    [new Date(), typed, TODAY]]) };
  const o = { log: {}, logForDate: '', serverLaDate: TODAY, warnings: [] };
  ctx.readLog(ctx.SpreadsheetApp.getActiveSpreadsheet(), o);
  check('"' + typed + '" -> ' + want, typeof o.log[want] === 'number', JSON.stringify(o.log));
});

console.log('\n--- and junk still does not ---');
SHEETS = { Log: new FakeSheet([['Timestamp', 'Kind', 'Date'],
  [new Date(), 'coffee', TODAY], [new Date(), '', TODAY]]) };
out = { log: {}, logForDate: '', serverLaDate: TODAY, warnings: [] };
ctx.readLog(ctx.SpreadsheetApp.getActiveSpreadsheet(), out);
check('unknown and blank kinds ignored', Object.keys(out.log).length === 0, JSON.stringify(out.log));

/* ------------------------------------------------------------------------
 * MEDICATION MODE — the session-complete check, end to end.
 *
 * A session takes the board over until BOTH of its kinds are logged. If the
 * endpoint wrote a kind and the board then failed to read it back (the
 * drops-am / norm() bug above), the screen would not merely show a grey chip:
 * it would sit there telling her to take pills she had taken, all morning.
 * So this runs the board's OWN session-complete code — the block between the
 * MEDS-PURE markers in index.html, evaluated as-is — against the endpoint's
 * real readLog() output, for the full read and for the ?lite=1 read.
 * ------------------------------------------------------------------------ */
console.log('\n--- medication sessions clear on the logs the endpoint returns ---');
const HTML = fs.readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
const mb = HTML.indexOf('/* MEDS-PURE-BEGIN'), me = HTML.indexOf('/* MEDS-PURE-END */');
check('index.html has the MEDS-PURE block', mb > 0 && me > mb);
const MEDS = vm.runInNewContext(HTML.slice(mb, me) +
  '\n;({ MEDS_SESSIONS: MEDS_SESSIONS, medsSessionDone: medsSessionDone });', {});

Object.keys(MEDS.MEDS_SESSIONS).forEach(name => {
  const s = MEDS.MEDS_SESSIONS[name];
  check(name + ': both kinds are real LOG_KINDS (else it could never clear)',
        KINDS.indexOf(s.pills) >= 0 && KINDS.indexOf(s.drops) >= 0, s.pills + ', ' + s.drops);

  function readBack(kinds, lite) {
    SHEETS = { Log: new FakeSheet([['Timestamp', 'Kind', 'Date']]) };
    kinds.forEach(k => ctx.handleLogWrite({ parameter: { log: k, k: 'tok' } }));
    if (lite) return JSON.parse(ctx.handleLiteRead({ parameter: { lite: '1' } })._t);
    const o = { log: {}, logForDate: '', logOk: false, serverLaDate: TODAY, warnings: [] };
    ctx.readLogChecked(ctx.SpreadsheetApp.getActiveSpreadsheet(), o);
    return o;
  }
  [false, true].forEach(lite => {
    const via = lite ? ' (lite read)' : ' (full read)';
    let o = readBack([s.pills, s.drops], lite);
    check(name + ': both pressed -> session complete' + via,
          MEDS.medsSessionDone(o.log, s) === true && o.logOk === true, JSON.stringify(o));
    o = readBack([s.pills], lite);
    check(name + ': pills only -> still showing' + via, MEDS.medsSessionDone(o.log, s) === false);
    o = readBack([s.drops], lite);
    check(name + ': drops only -> still showing' + via, MEDS.medsSessionDone(o.log, s) === false);
  });
  /* The other session's presses must never clear this one. */
  const other = MEDS.MEDS_SESSIONS[name === 'am' ? 'pm' : 'am'];
  const o = readBack([other.pills, other.drops], false);
  check(name + ': the other session\'s presses do not clear it', MEDS.medsSessionDone(o.log, s) === false);
});

console.log('\n--- logOk: "nothing pressed" is never confused with "could not read" ---');
SHEETS = {};
out = { log: {}, logForDate: '', logOk: false, serverLaDate: TODAY, warnings: [] };
ctx.readLogChecked(ctx.SpreadsheetApp.getActiveSpreadsheet(), out);
check('no Log tab -> logOk false', out.logOk === false);
SHEETS = { Log: new FakeSheet([['Timestamp', 'Kind', 'Date']]) };
out = { log: {}, logForDate: '', logOk: false, serverLaDate: TODAY, warnings: [] };
ctx.readLogChecked(ctx.SpreadsheetApp.getActiveSpreadsheet(), out);
check('headers only (nothing pressed yet) -> logOk true', out.logOk === true);
SHEETS = { Log: new FakeSheet([['Foo', 'Bar'], ['x', 'y']]) };
out = { log: {}, logForDate: '', logOk: false, serverLaDate: TODAY, warnings: [] };
ctx.readLogChecked(ctx.SpreadsheetApp.getActiveSpreadsheet(), out);
check('unreadable headers -> logOk false', out.logOk === false);
SHEETS = { Log: { getLastRow: () => { throw new Error('boom'); } } };
const lr = JSON.parse(ctx.handleLiteRead({ parameter: { lite: '1' } })._t);
check('a throwing Log tab -> lite read still answers, logOk false',
      lr.ok === true && lr.logOk === false && lr.lite === true, JSON.stringify(lr));

/* ------------------------------------------------------------------------
 * MEDICATION MODE — session times from Settings.
 * The board decides with its copy of medsResolveTimes(); /exec reports the
 * same notes from the script's copy. Two copies of a rule drift unless
 * something stops them, so: byte-identical source, the same clock parser
 * behaviour on both sides, and every rule exercised.
 * ------------------------------------------------------------------------ */
console.log('\n--- session times: one rule, two copies ---');
function block(src) {
  const a = src.indexOf('/* MEDS-TIMES-BEGIN'), b = src.indexOf('/* MEDS-TIMES-END */');
  return a >= 0 && b > a ? src.slice(a, b) : null;
}
const clientTimes = block(HTML), serverTimes = block(SRC);
check('both files carry the MEDS-TIMES block', !!clientTimes && !!serverTimes);
check('the two copies are byte-identical', clientTimes === serverTimes);

const clientParse = vm.runInNewContext(
  /function parseClockMin\(v\)\{[\s\S]*?\n\}/.exec(HTML)[0] + ';parseClockMin', {});
['9:30 am', '9:30 AM', '21:15', '10:15', '12:00 am', '12 pm', '7pm', ' 8:05 p.m. ', 'noon', '25:00',
 '9:61', '', 'soon', '13:00 pm', '0:00'].forEach(v => {
  check('clock parser agrees on "' + v + '"', clientParse(v) === ctx.parseClockMin(v),
        'board ' + clientParse(v) + ' vs script ' + ctx.parseClockMin(v));
});

const R = (s) => ctx.medsResolveTimes(s, ctx.parseClockMin);
let r = R({});
check('defaults: 9:30-2:00 / 8:30-11:59 PM, step 10, both on, no warnings',
      r.am.start === 570 && r.am.end === 840 && r.pm.start === 1230 && r.pm.end === 1439 &&
      r.step === 10 && r.am.on && r.pm.on && r.warnings.length === 0, JSON.stringify(r));
r = R({ medsamstart: '10:15 am', medsstepmin: '5' });
check('overrides: morning 10:15, 5-minute steps', r.am.start === 615 && r.step === 5 && !r.warnings.length, JSON.stringify(r));
r = R({ medsamstart: '10:15' });
check('a Sheets time cell ("10:15") works', r.am.start === 615);
r = R({ medsamstart: 'soonish' });
check('unreadable start -> default + warning', r.am.start === 570 && r.am.on && r.warnings.length === 1, JSON.stringify(r.warnings));
r = R({ medsamend: '10:00 am' });
check('end before the last stage -> clamped to last stage + one step, warned',
      r.am.end === 570 + 40 && r.am.on && r.warnings.length === 1, JSON.stringify(r));
r = R({ medspmend: 'midnight' });
check('"midnight" end -> 11:59 PM + warning', r.pm.end === 1439 && r.warnings.length === 1);
r = R({ medspmend: '12:00 am' });
check('"12:00 am" end -> 11:59 PM + warning', r.pm.end === 1439 && r.warnings.length === 1);
r = R({ medspmstart: '11:45 pm' });
check('start too late for four stages -> pulled earlier, still on, never past 11:59',
      r.pm.on && r.pm.start === 1439 - 40 && r.pm.end <= 1439 && r.warnings.length >= 1, JSON.stringify(r));
r = R({ medsstepmin: 'ten' });
check('unreadable step -> 10 + warning', r.step === 10 && r.warnings.length === 1);
r = R({ medsstepmin: '0' });
check('zero step -> 10 + warning', r.step === 10 && r.warnings.length === 1);
r = R({ medsstepmin: '500' });
check('huge step -> 60 + warning, sessions still fit', r.step === 60 && r.pm.start + 240 <= 1439 && r.warnings.length >= 1, JSON.stringify(r));
r = R({ medsmorning: 'off' });
check('medsMorning off -> morning off, evening on, no warning', !r.am.on && r.pm.on && !r.warnings.length);
r = R({ medsevening: 'OFF ' });
check('medsEvening " OFF " -> evening off', r.am.on && !r.pm.on);
r = R({ medsmorning: 'nope' });
check('unreadable on/off -> on + warning (never skipped)', r.am.on && r.warnings.length === 1);
r = R({ medsamend: '9:00 pm' });
check('morning running into evening -> ends where evening starts',
      r.am.end === 1230 && r.pm.start === 1230 && r.warnings.length === 1, JSON.stringify(r));
r = R({ medsamstart: '9:00 pm', medspmstart: '8:00 pm' });
check('sessions that cannot both fit -> default times for both, both still on',
      r.am.on && r.pm.on && r.am.start === 570 && r.pm.start === 1230 && r.warnings.length >= 1, JSON.stringify(r));
SHEETS = { Settings: new FakeSheet([['Key', 'Value'], ['meds', 'on'], ['medsAmStart', 'whenever'], ['medsStepMin', '5']]),
           Log: new FakeSheet([['Timestamp', 'Kind', 'Date']]) };
FakeSheet.prototype.getDataRange = function () { const v = this.v; return { getValues: () => v.map(row => row.slice()) }; };
ctx.SpreadsheetApp.getActiveSpreadsheet = () => ({ getSheetByName: n => SHEETS[n] || null,
                                                   getSpreadsheetTimeZone: () => 'America/Los_Angeles' });
const ex = JSON.parse(ctx.doGet({ parameter: {} })._t);
check('/exec still answers ok with a bad value', ex.ok === true, JSON.stringify(ex.error));
check('/exec carries the note for a bad value', ex.warnings.some(w => /meds: medsAmStart "whenever"/.test(w)),
      JSON.stringify(ex.warnings));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
