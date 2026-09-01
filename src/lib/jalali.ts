/* =========================================================================
   تقویم جلالی — پورت مستقیم از app.js اصلی (الگوریتم Borkowski/jalaali-js)
   دقیقاً همون منطقی که پروژه‌ی وانیلا-جی‌اس استفاده می‌کرد، بدون تغییر.
   ========================================================================= */

function div(a: number, b: number) {
  return ~~(a / b);
}
function mod(a: number, b: number) {
  return a - ~~(a / b) * b;
}

const breaks = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
  2192, 2262, 2324, 2394, 2456, 3178,
];

function jalCalLeap(jy: number) {
  const bl = breaks.length;
  let gy = jy + 621,
    leapJ = -14,
    jp = breaks[0],
    jm,
    jump = 0,
    n,
    leap;
  if (jy < jp || jy >= breaks[bl - 1]) throw new Error("year out of range: " + jy);
  for (let i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn: number): [number, number, number] {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return [gy, gm, gd];
}
function j2d(jy: number, jm: number, jd: number) {
  const r = jalCalLeap(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}
function d2j(jdn: number): [number, number, number] {
  const gy = d2g(jdn)[0];
  let jy = gy - 621;
  let r = jalCalLeap(jy);
  const jdn1f = g2d(r.gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      return [jy, 1 + div(k, 31), mod(k, 31) + 1];
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    r = jalCalLeap(jy);
    if (r.leap === 1) k += 1;
  }
  return [jy, 7 + div(k, 30), mod(k, 30) + 1];
}

function toJalali(gy: number, gm: number, gd: number) {
  return d2j(g2d(gy, gm, gd));
}
function toGregorian(jy: number, jm: number, jd: number) {
  return d2g(j2d(jy, jm, jd));
}

const faDigits = "۰۱۲۳۴۵۶۷۸۹";
function toFaNum(str: string | number) {
  return String(str).replace(/[0-9]/g, (d) => faDigits[+d]);
}
function toEnNum(str: string) {
  return String(str).replace(/[۰-۹]/g, (d) => String(faDigits.indexOf(d)));
}

const MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];
const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

// weekday: 0=Saturday ... 6=Friday, based on gregorian date
function weekdayOf(gy: number, gm: number, gd: number) {
  const jsDate = new Date(Date.UTC(gy, gm - 1, gd));
  const jsDow = jsDate.getUTCDay(); // 0=Sun..6=Sat
  return (jsDow + 1) % 7; // 0=Sat
}

function dateToStr(gy: number, gm: number, gd: number) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${gy}-${p(gm)}-${p(gd)}`;
}
function strToDate(str: string) {
  const [y, m, d] = str.split("-").map(Number);
  return { y, m, d };
}
function gregorianStrToJalaliStr(gStr: string) {
  const { y, m, d } = strToDate(gStr);
  const [jy, jm, jd] = toJalali(y, m, d);
  return `${toFaNum(jy)}/${toFaNum(String(jm).padStart(2, "0"))}/${toFaNum(String(jd).padStart(2, "0"))}`;
}
function gregorianStrToJalaliParts(gStr: string) {
  const { y, m, d } = strToDate(gStr);
  const [jy, jm, jd] = toJalali(y, m, d);
  return { jy, jm, jd };
}
function addDays(gStr: string, days: number) {
  const { y, m, d } = strToDate(gStr);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dateToStr(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
function todayStr() {
  const now = new Date();
  return dateToStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
function todayJalaliStr() {
  return gregorianStrToJalaliStr(todayStr());
}
function weekdayLabel(gStr: string) {
  const { y, m, d } = strToDate(gStr);
  return WEEKDAYS[weekdayOf(y, m, d)];
}
function monthLabel(gStr: string) {
  const { jy, jm } = gregorianStrToJalaliParts(gStr);
  return `${MONTHS[jm - 1]} ${toFaNum(jy)}`;
}
function dayNumLabel(gStr: string) {
  const { jd } = gregorianStrToJalaliParts(gStr);
  return toFaNum(jd);
}
function fullLabel(gStr: string) {
  const { jy, jm, jd } = gregorianStrToJalaliParts(gStr);
  return `${weekdayLabel(gStr)}، ${toFaNum(jd)} ${MONTHS[jm - 1]} ${toFaNum(jy)}`;
}
// week range: Saturday..Friday (jalali week) containing reference gStr
function weekRange(gStr: string): [string, string] {
  const { y, m, d } = strToDate(gStr);
  const wd = weekdayOf(y, m, d);
  const start = addDays(gStr, -wd);
  const end = addDays(start, 6);
  return [start, end];
}
// "weekly stats" range per bot logic: Thursday to next Thursday (8 days inclusive)
function weeklyStatsRange(gStr: string): [string, string] {
  const THU = 5; // 0=Sat..6=Fri, Thursday=5
  const { y, m, d } = strToDate(gStr);
  const wd = weekdayOf(y, m, d);
  const daysSinceThu = ((wd - THU) % 7 + 7) % 7;
  const start = addDays(gStr, -daysSinceThu);
  const end = addDays(start, 7);
  return [start, end];
}
function formatJalaliRange(startStr: string, endStr: string) {
  return `${gregorianStrToJalaliStr(startStr)} تا ${gregorianStrToJalaliStr(endStr)}`;
}

export const Jalali = {
  toJalali, toGregorian, toFaNum, toEnNum, MONTHS, WEEKDAYS, WEEKDAYS_SHORT, weekdayOf,
  dateToStr, strToDate, gregorianStrToJalaliStr, gregorianStrToJalaliParts,
  addDays, todayStr, todayJalaliStr, weekRange, weeklyStatsRange, formatJalaliRange,
  weekdayLabel, monthLabel, dayNumLabel, fullLabel,
};
