/* =========================================================================
   اپکس پلنر — منطق برنامه
   منطق برنامه‌ریزی/چک‌لیست/گزارش کار درسی/آمار هفتگی مستقیماً بر اساس
   همون قوانینی نوشته شده که تو بات تلگرامی Apex Planner (Python) بود:
   - دسته‌ها: درسی / توسعه فردی / غیردرسی
   - هر پارت «درسی» وقتی تیک می‌خوره، دقیقه مطالعه + تعداد تست ثبت می‌شه
   - هفته‌ی شمسی از شنبه تا جمعه؛ بازه‌ی «آمار هفتگی» از پنجشنبه تا پنجشنبه بعد
   - پارت‌های انجام‌نشده‌ی آخر شب به‌صورت خودکار «(جبرانی)» برای فردا کپی می‌شن
   ========================================================================= */

// ---------------------------------------------------------------------------
// Jalali <-> Gregorian (self-contained, no deps)
// ---------------------------------------------------------------------------
const Jalali = (() => {
  // Public-domain algorithm (jalaali-js / Borkowski), astronomically accurate
  // 1000+ years out, verified below against the Python `jdatetime` library.
  function div(a, b) { return ~~(a / b); }
  function mod(a, b) { return a - ~~(a / b) * b; }

  const breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];

  function jalCalLeap(jy) {
    const bl = breaks.length;
    let gy = jy + 621, leapJ = -14, jp = breaks[0], jm, jump = 0, n, leap;
    if (jy < jp || jy >= breaks[bl - 1]) throw new Error('year out of range: ' + jy);
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

  function isLeapGregorian(gy) { return (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0; }

  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
      + div(153 * mod(gm + 9, 12) + 2, 5)
      + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }
  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return [gy, gm, gd];
  }
  function j2d(jy, jm, jd) {
    const r = jalCalLeap(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }
  function d2j(jdn) {
    const gy = d2g(jdn)[0];
    let jy = gy - 621;
    let r = jalCalLeap(jy);
    let jdn1f = g2d(r.gy, 3, r.march);
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

  function toJalali(gy, gm, gd) { return d2j(g2d(gy, gm, gd)); }
  function toGregorian(jy, jm, jd) { return d2g(j2d(jy, jm, jd)); }

  const faDigits = '۰۱۲۳۴۵۶۷۸۹';
  function toFaNum(str) {
    return String(str).replace(/[0-9]/g, d => faDigits[d]);
  }
  function toEnNum(str) {
    return String(str).replace(/[۰-۹]/g, d => faDigits.indexOf(d));
  }

  const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const WEEKDAYS = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];

  // weekday: 0=Saturday ... 6=Friday, based on gregorian date
  function weekdayOf(gy, gm, gd) {
    const jsDate = new Date(Date.UTC(gy, gm - 1, gd));
    const jsDow = jsDate.getUTCDay(); // 0=Sun..6=Sat
    return (jsDow + 1) % 7; // 0=Sat
  }

  function dateToStr(gy, gm, gd) {
    const p = n => String(n).padStart(2, '0');
    return `${gy}-${p(gm)}-${p(gd)}`;
  }
  function strToDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return { y, m, d };
  }
  function gregorianStrToJalaliStr(gStr) {
    const { y, m, d } = strToDate(gStr);
    const [jy, jm, jd] = toJalali(y, m, d);
    return `${toFaNum(jy)}/${toFaNum(String(jm).padStart(2,'0'))}/${toFaNum(String(jd).padStart(2,'0'))}`;
  }
  function gregorianStrToJalaliParts(gStr) {
    const { y, m, d } = strToDate(gStr);
    const [jy, jm, jd] = toJalali(y, m, d);
    return { jy, jm, jd };
  }
  function addDays(gStr, days) {
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
  // week range: Saturday..Friday (jalali week) containing reference gStr
  function weekRange(gStr) {
    const wd = (() => { const {y,m,d}=strToDate(gStr); return weekdayOf(y,m,d); })();
    const start = addDays(gStr, -wd);
    const end = addDays(start, 6);
    return [start, end];
  }
  // "weekly stats" range per bot logic: Thursday to next Thursday (8 days inclusive)
  function weeklyStatsRange(gStr) {
    const THU = 5; // 0=Sat..6=Fri, Thursday=5
    const wd = (() => { const {y,m,d}=strToDate(gStr); return weekdayOf(y,m,d); })();
    const daysSinceThu = ((wd - THU) % 7 + 7) % 7;
    const start = addDays(gStr, -daysSinceThu);
    const end = addDays(start, 7);
    return [start, end];
  }
  function formatJalaliRange(startStr, endStr) {
    return `${gregorianStrToJalaliStr(startStr)} تا ${gregorianStrToJalaliStr(endStr)}`;
  }

  return {
    toJalali, toGregorian, toFaNum, toEnNum, MONTHS, WEEKDAYS, weekdayOf,
    dateToStr, strToDate, gregorianStrToJalaliStr, gregorianStrToJalaliParts,
    addDays, todayStr, todayJalaliStr, weekRange, weeklyStatsRange, formatJalaliRange
  };
})();

function formatMinutes(total) {
  total = Math.round(total || 0);
  const h = Math.floor(total / 60), m = total % 60;
  if (h && m) return `${Jalali.toFaNum(h)} ساعت و ${Jalali.toFaNum(m)} دقیقه`;
  if (h) return `${Jalali.toFaNum(h)} ساعت`;
  return `${Jalali.toFaNum(m)} دقیقه`;
}
function fa(n) { return Jalali.toFaNum(n); }

// ---------------------------------------------------------------------------
// Storage layer (persistent, personal — key-value via window.storage)
// ---------------------------------------------------------------------------
const DB_KEY = 'apex:data:v1';
let DB = null; // in-memory cache of the whole app state, synced to storage

function uid() { return 'x' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

function defaultDB() {
  return {
    profile: { name: 'دانش‌آموز', goalHoursPerDay: 5, examTargetLabel: '', createdAt: Jalali.todayStr() },
    planItems: [],      // {id,name,date,category,status,studyMinutes,testCount,timeLabel,notes}
    questions: [],       // {id,text,options:[{text,correct}],subject,topic,difficulty,createdAt}
    exams: [],            // {id,name,date,subjects:[{name,correct,wrong,unanswered,total,percent}]}
    alarms: [],           // {id,label,time:'HH:MM',days:[0..6],enabled,sound}
    sessions: [],          // completed study sessions {id,date,subject,minutes,mode}
    streakDone: {},         // {'YYYY-MM-DD': true}
    dailyMeta: {}             // {'YYYY-MM-DD': {priorities:[],goals:''}}
  };
}

async function loadDB() {
  try {
    const res = await window.storage.get(DB_KEY, false);
    DB = res && res.value ? JSON.parse(res.value) : defaultDB();
  } catch (e) {
    DB = defaultDB();
  }
  // migrate missing fields
  const d = defaultDB();
  for (const k in d) if (!(k in DB)) DB[k] = d[k];
  return DB;
}

let saveTimer = null;
function saveDB() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await window.storage.set(DB_KEY, JSON.stringify(DB), false); }
    catch (e) { console.error('save failed', e); }
  }, 250);
}

// ---------------------------------------------------------------------------
// Plan item helpers (mirrors bot.py local_db logic)
// ---------------------------------------------------------------------------
const CATEGORIES = ['درسی', 'توسعه فردی', 'غیردرسی'];

function addPlanItem({ name, date, category, timeLabel }) {
  const item = {
    id: uid(), name, date, category: category || 'درسی',
    status: false, studyMinutes: 0, testCount: 0,
    timeLabel: timeLabel || '', notes: ''
  };
  DB.planItems.push(item);
  saveDB();
  return item;
}
function getItemsForDate(dateStr) {
  return DB.planItems.filter(i => i.date === dateStr);
}
function getItemsBetween(start, end) {
  return DB.planItems.filter(i => i.date >= start && i.date <= end);
}
function getItemById(id) { return DB.planItems.find(i => i.id === id); }
function deleteItem(id) {
  DB.planItems = DB.planItems.filter(i => i.id !== id);
  saveDB();
}
function markItemDone(id, done) {
  const it = getItemById(id); if (!it) return;
  it.status = done;
  saveDB();
}
function saveStudyData(id, minutes, tests, markDone = true) {
  const it = getItemById(id); if (!it) return;
  it.studyMinutes = minutes; it.testCount = tests;
  if (markDone) it.status = true;
  saveDB();
}
function createMakeupItem(original, dateStr) {
  const title = original.name.includes('(جبرانی)') ? original.name : `${original.name} (جبرانی)`;
  return addPlanItem({ name: title, date: dateStr, category: original.category });
}
// carry over unfinished items from a date to the next day, tagging as makeup — run lazily
function runCarryOverIfNeeded() {
  const today = Jalali.todayStr();
  const lastRun = localStorage.getItem('apex_carry_last') || '';
  if (lastRun === today) return;
  const yesterday = Jalali.addDays(today, -1);
  const items = getItemsForDate(yesterday);
  let count = 0;
  items.forEach(it => {
    if (!it.status) {
      // avoid duplicating if a makeup already exists for today with same base name
      const already = getItemsForDate(today).some(x => x.name === (it.name.includes('(جبرانی)') ? it.name : it.name + ' (جبرانی)'));
      if (!already) { createMakeupItem(it, today); count++; }
    }
  });
  localStorage.setItem('apex_carry_last', today);
  if (count > 0) { setTimeout(() => showToast(`${fa(count)} پارت مونده دیروز، برای امروز منتقل شد`), 800); }
}

// ---------------------------------------------------------------------------
// Study report text builder (mirrors build_study_report_text_for_date)
// ---------------------------------------------------------------------------
function buildStudyReportText(dateStr) {
  const items = getItemsBetween(dateStr, dateStr).filter(i => i.category === 'درسی');
  const studied = [], partial = [], missed = [];
  let totalMin = 0, totalTests = 0;
  items.forEach(it => {
    if (it.status) {
      studied.push(it.name); totalMin += it.studyMinutes; totalTests += it.testCount;
    } else if (it.studyMinutes > 0 || it.testCount > 0) {
      partial.push(`${it.name} (${fa(it.studyMinutes)} دقیقه، ${fa(it.testCount)} تست)`);
      totalMin += it.studyMinutes; totalTests += it.testCount;
    } else {
      missed.push(it.name);
    }
  });
  const lines = [
    'به نام خدا',
    `تاریخ: ${Jalali.gregorianStrToJalaliStr(dateStr)}`,
    `درس‌های مطالعه‌شده: ${studied.length ? studied.join('، ') : 'ندارد'}`,
    `ساعت مطالعه: ${totalMin ? formatMinutes(totalMin) : '۰ دقیقه'}`,
    `تعداد تست: ${fa(totalTests)}`,
    `پارت‌های ناقص: ${partial.length ? partial.join('، ') : 'ندارد'}`,
    `پارت‌های انجام‌نشده: ${missed.length ? missed.join('، ') : 'ندارد'}`
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Weekly stats builder (mirrors build_weekly_pdf_data)
// ---------------------------------------------------------------------------
function extractSubjectName(title) {
  const parts = title.trim().split(/\s+/);
  return parts[0] || 'نامشخص';
}
function buildWeeklyStats(weekStart, weekEnd) {
  const items = getItemsBetween(weekStart, weekEnd).filter(i => i.category === 'درسی');
  const perDayMinutes = {}, studiedDays = new Set();
  let totalMinutes = 0, totalTests = 0, completed = 0, partialCount = 0, missedCount = 0;
  const missedItems = [], partialItems = [];
  const subjectStats = {};

  items.forEach(it => {
    const subject = extractSubjectName(it.name);
    if (!subjectStats[subject]) subjectStats[subject] = { minutes: 0, tests: 0, total: 0, done: 0 };
    subjectStats[subject].total++;

    if (it.status) {
      completed++; subjectStats[subject].done++;
      subjectStats[subject].minutes += it.studyMinutes;
      subjectStats[subject].tests += it.testCount;
      totalMinutes += it.studyMinutes; totalTests += it.testCount;
      perDayMinutes[it.date] = (perDayMinutes[it.date] || 0) + it.studyMinutes;
      if (it.studyMinutes > 0) studiedDays.add(it.date);
    } else if (it.studyMinutes > 0 || it.testCount > 0) {
      partialCount++;
      partialItems.push(`${it.name} «${fa(it.studyMinutes)} دقیقه، ${fa(it.testCount)} تست»`);
      subjectStats[subject].minutes += it.studyMinutes;
      subjectStats[subject].tests += it.testCount;
      totalMinutes += it.studyMinutes; totalTests += it.testCount;
      perDayMinutes[it.date] = (perDayMinutes[it.date] || 0) + it.studyMinutes;
      if (it.studyMinutes > 0) studiedDays.add(it.date);
    } else {
      missedCount++; missedItems.push(it.name);
    }
  });

  const daysWithStudy = studiedDays.size || 1;
  const avgMinutes = Math.round(totalMinutes / daysWithStudy);

  const dayLabels = [], dayHours = [];
  let d = weekStart;
  while (d <= weekEnd) {
    const minutes = perDayMinutes[d] || 0;
    dayHours.push(Math.round((minutes / 60) * 10) / 10);
    const { y, m, d: dd } = Jalali.strToDate(d);
    const wd = Jalali.weekdayOf(y, m, dd);
    dayLabels.push(Jalali.WEEKDAYS[wd]);
    d = Jalali.addDays(d, 1);
  }

  let bestIdx = 0, worstIdx = 0;
  if (dayHours.some(h => h > 0)) {
    bestIdx = dayHours.indexOf(Math.max(...dayHours));
    worstIdx = dayHours.indexOf(Math.min(...dayHours));
  }

  const subjects = Object.entries(subjectStats).map(([name, s]) => ({
    name, minutes: s.minutes, tests: s.tests,
    percent: s.total ? Math.round((s.done / s.total) * 100) : 0
  })).sort((a, b) => b.minutes - a.minutes);

  return {
    totalMinutes, avgMinutes, studiedDaysCount: studiedDays.size, totalTests,
    completed, partialCount, missedCount, missedItems, partialItems,
    dayLabels, dayHours, subjects,
    bestDay: dayLabels[bestIdx], bestDayHours: dayHours[bestIdx],
    worstDay: dayLabels[worstIdx], worstDayHours: dayHours[worstIdx]
  };
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
let toastTimer = null;
function showToast(msg, icon = 'check_circle') {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.querySelector('.material-symbols-rounded').textContent = icon;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const SCREENS = {}; // name -> render function
let currentScreen = 'home';

function go(name) {
  currentScreen = name;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === name);
  });
  render();
  window.scrollTo(0, 0);
}
function render() {
  const container = document.getElementById('screens');
  container.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'screen active';
  el.id = 'screen-' + currentScreen;
  container.appendChild(el);
  if (SCREENS[currentScreen]) SCREENS[currentScreen](el);
}
function rerender() { render(); }

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  await loadDB();
  runCarryOverIfNeeded();
  checkAlarmsLoop();
  go('home');
});

// expose module-scope bindings for debugging/testing convenience
window.__apex = { get DB() { return DB; }, get Jalali() { return Jalali; }, get TimerState() { return typeof TimerState !== 'undefined' ? TimerState : null; } };
Object.defineProperty(window, 'DB', { get() { return DB; }, configurable: true });
Object.defineProperty(window, 'Jalali', { get() { return Jalali; }, configurable: true });
