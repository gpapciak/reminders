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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
