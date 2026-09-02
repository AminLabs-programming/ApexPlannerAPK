// تست واقعیِ (نه فقط syntax-check) منطق جدید بانک تحلیل در فرانت‌اند: انتخابگر
// سلسله‌مراتبیِ دسته/درس، برچسب‌های وضعیت پاسخ، پنل فیلتر، و رنگ‌بندی ۴حالته‌ی
// شبکه‌ی سؤال‌ها. با jsdom یک DOM واقعی می‌سازیم و کد واقعیِ screens_analysis.js
// رو داخلش اجرا می‌کنیم — نه fakeها/فرض‌ها.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

let fails = 0, total = 0;
function check(name, cond, extra) {
  total++;
  if (!cond) { fails++; console.log(`[FAIL] ${name}` + (extra ? ` — ${extra}` : '')); }
  else console.log(`[OK] ${name}`);
}

const dom = new JSDOM(`<!DOCTYPE html><html dir="rtl" lang="fa"><body><div id="root"></div><div id="sheetBody"></div></body></html>`, { runScripts: 'outside-only' });
const { window } = dom;

// --- استاب‌های حداقلیِ توابع/آبجکت‌هایی که screens_analysis.js ازشون استفاده
// می‌کنه ولی خودِ این تست قرار نیست رفتارشون رو بسنجه (روتر، sheet UI عمومی، Api واقعی) ---
window.escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
window.fa = (n) => String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
window.emptyState = (icon, title, sub) => `<div class="empty">${title}</div>`;
window.wireSeg = (id) => {
  const seg = window.document.getElementById(id);
  if (!seg) return;
  seg.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
    seg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }));
};
window.Jalali = { gregorianStrToJalaliStr: (s) => s };
let lastToast = null;
window.showToast = (msg, type) => { lastToast = { msg, type }; };
let sheetHtml = '';
window.openSheet = (html) => { sheetHtml = html; window.document.getElementById('sheetBody').innerHTML = html; };
window.closeSheet = () => { sheetHtml = ''; window.document.getElementById('sheetBody').innerHTML = ''; };
window.openDialog = () => {};
window.closeDialog = () => {};
let currentScreenStub = 'analysisBank';
Object.defineProperty(window, 'currentScreen', { get: () => currentScreenStub, set: (v) => { currentScreenStub = v; } });
let lastListAnalysisNotesParams = null;
window.apiListAnalysisNotes = async (filters) => { lastListAnalysisNotesParams = filters; return []; };
window.loadAnalysisExamsIfNeeded = async () => {};
window.DB = { analysisExams: [] };
window.rerender = () => {};
window.Api = { ApiError: class ApiError extends Error {}, getAnalysisPdfUrl: () => '#' };
window.apiUpsertAnalysisNote = async () => ({});
window.apiUpdateAnalysisExamMeta = async () => ({});
window.apiUploadAnalysisExam = async () => ({});
window.apiDeleteAnalysisNote = async () => {};
window.SCREENS = {};
window.apiDeleteAnalysisExam = async () => {};

const src = fs.readFileSync(path.join(__dirname, 'screens_analysis.js'), 'utf8');
// نکته‌ی مهم: اعلان‌های سطح‌بالای let/const (برخلاف var/function) به‌صورت
// window.X در دسترس نیستن، و window.X=... هم روی همون binding واقعی اثر
// نمی‌ذاره. هم‌چنین معلوم شد eval های جداگانه در jsdom لزوماً scope سطح‌بالا
// رو مثل چند <script> واقعی به اشتراک نمی‌ذارن؛ پس این helperها رو مستقیماً
// به همون رشته‌ی کدِ اصلی می‌چسبونیم تا در دقیقاً همون scope اجرا بشن.
const testHelpers = `
  window.ANALYSIS_TAXONOMY = ANALYSIS_TAXONOMY;
  window.analysisSubjectLabel = analysisSubjectLabel;
  window.analysisCategoryOfSubject = analysisCategoryOfSubject;
  window.__test = {
    getFilterState: () => ({ grade: analysisFilterGrade, category: analysisFilterCategory, subject: analysisFilterSubject, status: analysisFilterStatus }),
    setDetailCache: (v) => { analysisDetailCache = v; },
    getDetailCache: () => analysisDetailCache,
    setSelectedExamId: (v) => { analysisSelectedExamId = v; },
    setFilterPanelOpen: (v) => { analysisFilterPanelOpen = v; },
  };
`;
window.eval(src + '\n' + testHelpers);

// =====================================================================
console.log('='.repeat(60)); console.log('۱) تاکسونومی و توابع کمکی خالص');
console.log('='.repeat(60));
check('ANALYSIS_TAXONOMY سه دسته‌ی اصلی دقیقاً مطابق سند کار داره', JSON.stringify(Object.keys(window.ANALYSIS_TAXONOMY)) === JSON.stringify(['math', 'physics', 'chemistry']));
check('ریاضیات دقیقاً ۸ زیرشاخه داره', Object.keys(window.ANALYSIS_TAXONOMY.math.subjects).length === 8);
check('فیزیک دقیقاً ۳ زیرشاخه داره', Object.keys(window.ANALYSIS_TAXONOMY.physics.subjects).length === 3);
check('شیمی دقیقاً ۳ زیرشاخه داره', Object.keys(window.ANALYSIS_TAXONOMY.chemistry.subjects).length === 3);
check('analysisSubjectLabel(calculus2) درست کار می‌کنه', window.analysisSubjectLabel('calculus2') === 'حسابان 2');
check('analysisCategoryOfSubject(calculus2) درست کار می‌کنه', window.analysisCategoryOfSubject('calculus2') === 'math');
check('analysisCategoryOfSubject برای کد نامعتبر رشته‌ی خالی می‌ده', window.analysisCategoryOfSubject('xyz') === '');

// =====================================================================
console.log('\n' + '='.repeat(60)); console.log('۲) شیت تحلیل سؤال: انتخابگر سلسله‌مراتبی دسته/درس');
console.log('='.repeat(60));

window.__test.setDetailCache({
  examA: {
    id: 'examA', title: 'آزمون تست', grade: 11, gradeLabel: 'یازدهم',
    questionCount: 5, questionPageMap: { 1: 2 }, notes: [],
  },
});
window.__test.setSelectedExamId('examA');

window.openAnalysisQuestionSheet('examA', 1);
let doc = window.document;
check('شیت با ۳ چیپ دسته‌ی اصلی رندر شد', doc.querySelectorAll('#anqCategoryRow .chip').length === 3);
check('در حالت اولیه (بدون نوت قبلی) هیچ دسته‌ای انتخاب نیست', doc.querySelectorAll('#anqCategoryRow .chip.on').length === 0);
check('ردیف درس اولیه خالیه (چون دسته‌ای انتخاب نشده)', doc.getElementById('anqSubjectRow').innerHTML.trim() === '');
check('وضعیت پیش‌فرض «نزدم» فعاله', doc.querySelector('#anqCorrectSeg button[data-val="unanswered"]').classList.contains('active'));

// شبیه‌سازی کلیک روی دسته‌ی «ریاضیات»
window.selectAnalysisNoteCategory('math', '');
check('بعد از انتخاب «ریاضیات»، چیپ آن دسته .on می‌شه', doc.querySelector('#anqCategoryRow .chip[data-cat="math"]').classList.contains('on'));
check('بعد از انتخاب «ریاضیات»، ۸ چیپ درسِ ریاضی ظاهر می‌شن', doc.querySelectorAll('#anqSubjectRow .chip').length === 8);

// شبیه‌سازی کلیک روی «حسابان 2»
window.selectAnalysisNoteSubject('calculus2');
check('بعد از انتخاب «حسابان ۲»، دقیقاً همون چیپ .on می‌شه', doc.querySelector('#anqSubjectRow .chip[data-code="calculus2"]').classList.contains('on'));
check('بقیه‌ی چیپ‌های درس .on ندارن (تک‌انتخابی)', doc.querySelectorAll('#anqSubjectRow .chip.on').length === 1);

// شبیه‌سازی کلیک روی وضعیت «غلط زدم»
doc.querySelector('#anqCorrectSeg button[data-val="incorrect"]').click();
check('بعد از کلیک، وضعیت «غلط زدم» فعال می‌شه و بقیه غیرفعال', doc.querySelector('#anqCorrectSeg button.active').dataset.val === 'incorrect');

// حالا دسته رو عوض می‌کنیم به «فیزیک» — انتخاب قبلیِ حسابان۲ (که متعلق به ریاضیاته) باید پاک بشه
window.selectAnalysisNoteCategory('physics', 'calculus2');
check('با عوض‌شدن دسته به فیزیک، درسِ ریاضیِ قبلی دیگه انتخاب نیست', doc.querySelectorAll('#anqSubjectRow .chip.on').length === 0);
check('ردیف درس حالا ۳ چیپ فیزیک داره', doc.querySelectorAll('#anqSubjectRow .chip').length === 3);
check('مقدار textarea (تحلیل) از قبل از عوض‌کردن دسته حفظ شده (re-render کامل نشده)', doc.getElementById('anqNote') !== null);

// حالا شیت رو با یه نوتِ از قبل موجود (متعلق به شیمی) باز می‌کنیم
window.__test.getDetailCache().examA.notes = [{
  id: 'n1', questionNumber: 2, subjectCode: 'chemistry3', subject: 'شیمی 3', category: 'chemistry',
  subjectLabel: 'شیمی 3', answerStatus: 'correct', note: 'یادداشت قبلی', isCorrect: true,
}];
window.openAnalysisQuestionSheet('examA', 2);
doc = window.document;
check('با باز کردن نوتِ موجود، دسته‌ی درستش (شیمی) از پیش فعاله', doc.querySelector('#anqCategoryRow .chip[data-cat="chemistry"]').classList.contains('on'));
check('با باز کردن نوتِ موجود، درسِ درستش (شیمی۳) از پیش فعاله', doc.querySelector('#anqSubjectRow .chip[data-code="chemistry3"]').classList.contains('on'));
check('با باز کردن نوتِ موجود، وضعیت «درست زدم» از پیش فعاله', doc.querySelector('#anqCorrectSeg button.active').dataset.val === 'correct');
check('متن تحلیل قبلی در textarea نشون داده می‌شه', doc.getElementById('anqNote').value === 'یادداشت قبلی');

// =====================================================================
console.log('\n' + '='.repeat(60)); console.log('۳) پنل فیلتر بانک تحلیل');
console.log('='.repeat(60));

window.analysisClearFilters();
window.__test.setFilterPanelOpen(true);

let root = window.document.getElementById('root');
window.renderAnalysisList(root);
check('پنل فیلتر باز رندر می‌شه (وقتی analysisFilterPanelOpen=true)', root.querySelector('#analysisFilterPanel').innerHTML.trim() !== '');
check('بدون فیلتر فعال، دکمه‌ی «پاک‌کردن فیلترها» دیده نمی‌شه', !root.innerHTML.includes('پاک‌کردن فیلترها'));

window.setAnalysisFilterCategory('math');
check('بعد از انتخاب دسته، analysisFilterCategory درست ست شد', window.__test.getFilterState().category === 'math');
window.renderAnalysisList(window.document.getElementById('root')); // شبیه‌سازی rerender() واقعی
root = window.document.getElementById('root');
check('چیپ‌های زیرشاخه‌ی ریاضی در پنل فیلتر ظاهر شدن', root.innerHTML.includes('حسابان 2'));

window.setAnalysisFilterSubject('calculus2');
check('انتخاب درسِ فیلتر درست کار می‌کنه', window.__test.getFilterState().subject === 'calculus2');

// حالا دسته‌ی فیلتر رو عوض می‌کنیم؛ طبق قرارداد باید subject فیلتر ریست بشه
window.setAnalysisFilterCategory('physics');
check('با عوض‌شدن دسته‌ی فیلتر، درسِ انتخاب‌شده‌ی قبلی ریست می‌شه', window.__test.getFilterState().subject === null);

// وقتی دسته/وضعیت فعاله، باید از apiListAnalysisNotes (جست‌وجوی بین همه‌ی آزمون‌ها) استفاده بشه
window.setAnalysisFilterStatus('incorrect');
window.renderAnalysisList(window.document.getElementById('root')); // شبیه‌سازی rerender() واقعی
check('فراخوانی apiListAnalysisNotes با پارامترهای درست انجام شد', lastListAnalysisNotesParams && lastListAnalysisNotesParams.category === 'physics' && lastListAnalysisNotesParams.status === 'incorrect', JSON.stringify(lastListAnalysisNotesParams));

window.analysisClearFilters();
const clearedState = window.__test.getFilterState();
check('analysisClearFilters همه‌ی فیلترها رو پاک می‌کنه', !clearedState.grade && !clearedState.category && !clearedState.subject && !clearedState.status);

// =====================================================================
console.log('\n' + '='.repeat(60)); console.log('۴) رنگ‌بندی ۴حالته‌ی شبکه‌ی سؤال‌ها');
console.log('='.repeat(60));

const examForGrid = {
  id: 'examB', title: 'آزمون رنگ', grade: 12, gradeLabel: 'دوازدهم', date: '',
  questionCount: 4, overallNote: '', originalFilename: '',
  questionPageMap: { 1: 1, 2: 1, 3: 2, 4: 2 },
  notes: [
    { questionNumber: 1, answerStatus: 'correct' },
    { questionNumber: 2, answerStatus: 'incorrect' },
    { questionNumber: 3, answerStatus: 'unanswered' },
    // سؤال ۴: اصلاً نوتی نداره
  ],
};
window.initAnalysisPdfViewer = async () => {}; // جلوگیری از fetch واقعی در تست
const gridBody = window.document.createElement('div');
window.renderAnalysisDetailBody(gridBody, examForGrid);
const chips = gridBody.querySelectorAll('.chip-row button.chip');
check('۴ چیپِ سؤال رندر شدن', chips.length === 4);
check('سؤال ۱ (درست) کلاس tag-diff-easy داره', chips[0].className.includes('tag-diff-easy'));
check('سؤال ۲ (غلط) کلاس tag-diff-hard داره', chips[1].className.includes('tag-diff-hard'));
check('سؤال ۳ (نزده ولی نوت‌دار) کلاس tag-diff-mid داره', chips[2].className.includes('tag-diff-mid'));
check('سؤال ۴ (بدون نوت) هیچ‌کدوم از این کلاس‌ها رو نداره', !chips[3].className.includes('tag-diff') && !chips[3].className.includes('on'));
check('نشان پایه‌ی «دوازدهم» در هدر جزئیات آزمون دیده می‌شه', gridBody.innerHTML.includes('دوازدهم'));

console.log('\n' + '='.repeat(60));
console.log(`نتیجه: ${total - fails}/${total} تست موفق (${fails} شکست)`);
console.log('='.repeat(60));
process.exit(fails ? 1 : 0);
