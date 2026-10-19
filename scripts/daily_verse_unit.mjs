/* Regression: featured reading must advance at local midnight, not weekly or UTC midnight. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

process.env.TZ="America/Chicago";
const source=readFileSync(new URL("../oustory-features.js",import.meta.url),"utf8");
const marker="  const byId=id=>";
assert.ok(source.includes(marker),"Daily reading helpers must remain testable");
const instrumented=source.replace(marker,
  "  window.__dailyTest={localDayIndex,selectDailyTheme};\n"+marker);
const context={
  window:{},
  localStorage:{getItem(){return null;}}
};
vm.runInNewContext(instrumented,context,{filename:"oustory-features.js"});
const {localDayIndex,selectDailyTheme}=context.window.__dailyTest;
const verse=date=>selectDailyTheme(new Date(date))[1]+":"+
  selectDailyTheme(new Date(date))[2]+":"+selectDailyTheme(new Date(date))[3];

const sameDayBeforeUtcMidnight="2026-10-19T23:59:59Z";
const sameDayAfterUtcMidnight="2026-10-20T00:00:01Z";
assert.equal(localDayIndex(new Date(sameDayBeforeUtcMidnight)),
  localDayIndex(new Date(sameDayAfterUtcMidnight)),"UTC midnight must not change the local day");
assert.equal(verse(sameDayBeforeUtcMidnight),verse(sameDayAfterUtcMidnight),
  "UTC midnight must not change today's reading in Texas");

const beforeLocalMidnight="2026-10-20T04:59:59Z"; // Oct 19, 11:59:59 PM CDT
const afterLocalMidnight="2026-10-20T05:00:01Z";  // Oct 20, 12:00:01 AM CDT
assert.equal(localDayIndex(new Date(afterLocalMidnight))-
  localDayIndex(new Date(beforeLocalMidnight)),1,"Local midnight must increment the day");
assert.notEqual(verse(beforeLocalMidnight),verse(afterLocalMidnight),
  "A new local day must select a different verse");

const beforeDstMidnight="2026-11-02T05:59:59Z"; // Nov 1, 11:59:59 PM CST
const afterDstMidnight="2026-11-02T06:00:01Z";  // Nov 2, 12:00:01 AM CST
assert.equal(localDayIndex(new Date(afterDstMidnight))-
  localDayIndex(new Date(beforeDstMidnight)),1,
  "The local day must still roll over correctly after daylight saving time ends");
assert.notEqual(verse(beforeDstMidnight),verse(afterDstMidnight));

assert.match(source,/document\.addEventListener\("visibilitychange"/);
assert.match(source,/window\.addEventListener\("pageshow",checkDailyOnReturn\)/);
assert.match(source,/window\.addEventListener\("focus",checkDailyOnReturn\)/);
assert.match(source,/scheduleDailyRefresh\(\);/);
assert.match(source,/renderId!==homeRenderId/);
console.log("Daily verse date rotation, Texas midnight, DST, and resume hooks: passed.");
