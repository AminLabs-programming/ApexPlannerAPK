/* =========================================================================
   بانک تحلیل (Analysis Bank)
   =========================================================================
   باگ‌های رفع‌شده:
   ۱. PDF همیشه نمایش داده می‌شه — حتی اگه mapping هنوز تنظیم نشده باشه،
      PDF viewer نشان داده می‌شه و فقط یه کارت هشدار برای تنظیم mapping بالاش میاد.
   ۲. کلیک روی شماره سوال دیگه PDF رو دانلود نمی‌کنه — فقط iframe رو
      آپدیت می‌کنه (src#page=N) یا اگه mapping نداره toast نشون می‌ده.
   ۳. OCR بهبود یافته — پشتیبانی از ارقام فارسی و الگوهای آزمون ماز
      مثل «-۱» یا «1-» با یا بدون فاصله.
   ========================================================================= */

// -----------------------------------------------------------------------
// تاکسونومی ثابتِ دسته‌ی اصلی/درس + پایه‌ی تحصیلی + وضعیت پاسخ.
// این یک نسخه‌ی هم‌گام با app/analysis_taxonomy.py در بک‌اند است — اگر
// درس یا کدی آنجا اضافه/تغییر کرد، باید همین‌جا هم به‌روزرسانی بشه.
// کدهای داخلی (کلیدهای دیکشنری) هرگز مستقیم به کاربر نشون داده نمی‌شن.
// -----------------------------------------------------------------------
const ANALYSIS_TAXONOMY = {
  math: {
    label: 'ریاضیات',
    subjects: {
      math1: 'ریاضی 1', geometry1: 'هندسه 1', geometry2: 'هندسه 2', stats_prob: 'آمار و احتمال',
      calculus1: 'حسابان 1', calculus2: 'حسابان 2', geometry3: 'هندسه 3', discrete_math: 'ریاضیات گسسته',
    },
  },
  physics: { label: 'فیزیک', subjects: { physics1: 'فیزیک 1', physics2: 'فیزیک 2', physics3: 'فیزیک 3' } },
  chemistry: { label: 'شیمی', subjects: { chemistry1: 'شیمی 1', chemistry2: 'شیمی 2', chemistry3: 'شیمی 3' } },
};
const ANALYSIS_GRADE_LABELS = { 10: 'دهم', 11: 'یازدهم', 12: 'دوازدهم' };
const ANALYSIS_STATUS_LABELS = { correct: 'درست زدم', incorrect: 'غلط زدم', unanswered: 'نزدم' };
const ANALYSIS_STATUS_SHORT = { correct: 'درست', incorrect: 'غلط', unanswered: 'نزده' };

function analysisSubjectLabel(code) {
  for (const cat of Object.values(ANALYSIS_TAXONOMY)) { if (cat.subjects[code]) return cat.subjects[code]; }
  return '';
}
function analysisCategoryOfSubject(code) {
  for (const [catCode, cat] of Object.entries(ANALYSIS_TAXONOMY)) { if (cat.subjects[code]) return catCode; }
  return '';
}

let analysisSelectedExamId = null;
let analysisDetailCache = {};
let analysisPdfPageGoto = 1;
let analysisPdfZoom = 1; // ضریب زوم دستی، اعمال‌شده روی مقیاس خودکار fit-to-width
// اگه از نتیجه‌ی یک فیلتر وارد جزئیات آزمون بشیم، همین سؤال رو خودکار باز می‌کنیم
let analysisPendingOpenQuestion = null;

// فیلتر «بانک تحلیل» (فقط در صفحه‌ی لیست استفاده می‌شه)
let analysisFilterPanelOpen = false;
let analysisFilterGrade = null;
let analysisFilterCategory = null;
let analysisFilterSubject = null;
let analysisFilterStatus = null;

function analysisFiltersActive() {
  return !!(analysisFilterGrade || analysisFilterCategory || analysisFilterStatus);
}
function analysisClearFilters() {
  analysisFilterGrade = null; analysisFilterCategory = null; analysisFilterSubject = null; analysisFilterStatus = null;
  rerender();
}

SCREENS.analysisBank = function (root) {
  if (analysisSelectedExamId) {
    renderAnalysisDetail(root, analysisSelectedExamId);
  } else {
    renderAnalysisList(root);
  }
};

// ---------------------------------------------------------------------------
// لیست آزمون‌های بانک تحلیل + فیلتر (پایه/دسته/درس/وضعیت)
// ---------------------------------------------------------------------------
function renderAnalysisList(root) {
  const hasFilters = analysisFiltersActive();
  root.innerHTML = `
    <h1 class="page-title">بانک تحلیل</h1>
    <p class="page-sub">دفترچه‌ی PDF آزمون‌هات رو آپلود کن و تحلیل هر سوال رو اینجا نگه دار</p>

    <button class="btn-sm btn-ghost" style="margin-bottom:10px; display:flex; align-items:center; gap:6px; width:fit-content;" onclick="toggleAnalysisFilterPanel()">
      <span class="material-symbols-rounded" style="font-size:16px;">filter_list</span>
      فیلتر${hasFilters ? ' (فعال)' : ''}
      <span class="material-symbols-rounded" style="font-size:16px;">${analysisFilterPanelOpen ? 'expand_less' : 'expand_more'}</span>
    </button>
    <div id="analysisFilterPanel">${analysisFilterPanelOpen ? renderAnalysisFilterPanelHtml() : ''}</div>

    <div id="analysisListBody"></div>
    <button class="btn btn-primary" style="margin-top:16px;" onclick="openUploadAnalysisSheet()">
      <span class="material-symbols-rounded" style="font-size:19px;">upload_file</span> آپلود آزمون جدید
    </button>
  `;
  const body = root.querySelector('#analysisListBody');
  body.innerHTML = `<div class="empty"><span class="material-symbols-rounded">hourglass_top</span><p>در حال بارگذاری…</p></div>`;

  if (analysisFilterCategory || analysisFilterStatus) {
    // دسته/درس یا وضعیت هم فیلتر شده → این یعنی کاربر دنبال سؤال‌های مشخصیه،
    // نه فقط مرور آزمون‌ها؛ پس جست‌وجوی ترکیبی بین همه‌ی آزمون‌ها (سطح سؤال).
    apiListAnalysisNotes({
      grade: analysisFilterGrade, category: analysisFilterCategory,
      subject: analysisFilterSubject, status: analysisFilterStatus,
    }).then(rows => {
      if (currentScreen !== 'analysisBank' || analysisSelectedExamId) return;
      if (!rows.length) {
        body.innerHTML = emptyState('search_off', 'چیزی با این فیلتر پیدا نشد', 'یه ترکیب دیگه رو امتحان کن یا فیلترها رو پاک کن');
      } else {
        body.innerHTML = `<div style="font-size:12px; color:var(--text-3); margin-bottom:10px;">${fa(rows.length)} نتیجه</div>` + rows.map(renderAnalysisFilterResultRow).join('');
      }
    }).catch(e => {
      body.innerHTML = `<div class="empty"><span class="material-symbols-rounded">error</span><p>${escapeHtml(e.message)}</p></div>`;
    });
  } else {
    // بدون فیلتر یا فقط فیلترِ پایه → فهرست آزمون‌ها، از کش محلی (سریع، آفلاین-دوست)
    loadAnalysisExamsIfNeeded().then(() => {
      if (currentScreen !== 'analysisBank' || analysisSelectedExamId) return;
      let list = [...DB.analysisExams];
      if (analysisFilterGrade) list = list.filter(e => e.grade === analysisFilterGrade);
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      if (!list.length) {
        body.innerHTML = analysisFilterGrade
          ? emptyState('folder_open', 'آزمونی با این پایه پیدا نشد', 'فیلتر پایه رو پاک کن یا یه آزمون جدید با این پایه آپلود کن')
          : emptyState('folder_open', 'هنوز آزمونی آپلود نشده', 'دفترچه‌ی PDF یک آزمون رو آپلود کن تا تحلیلش رو اینجا بنویسی');
      } else {
        body.innerHTML = list.map(renderAnalysisExamCard).join('');
      }
    });
  }
}

function toggleAnalysisFilterPanel() {
  analysisFilterPanelOpen = !analysisFilterPanelOpen;
  rerender();
}

function renderAnalysisFilterPanelHtml() {
  const gradeChips = [10, 11, 12].map(g => `
    <button class="chip ${analysisFilterGrade === g ? 'on' : ''}" onclick="setAnalysisFilterGrade(${g})">${ANALYSIS_GRADE_LABELS[g]}</button>
  `).join('');
  const categoryChips = Object.entries(ANALYSIS_TAXONOMY).map(([code, cat]) => `
    <button class="chip ${analysisFilterCategory === code ? 'on' : ''}" onclick="setAnalysisFilterCategory('${code}')">${cat.label}</button>
  `).join('');
  const statusChips = Object.entries(ANALYSIS_STATUS_SHORT).map(([code, label]) => `
    <button class="chip ${analysisFilterStatus === code ? 'on' : ''}" onclick="setAnalysisFilterStatus('${code}')">${label}</button>
  `).join('');
  const subjectChips = analysisFilterCategory ? Object.entries(ANALYSIS_TAXONOMY[analysisFilterCategory].subjects).map(([code, label]) => `
    <button class="chip ${analysisFilterSubject === code ? 'on' : ''}" onclick="setAnalysisFilterSubject('${code}')">${label}</button>
  `).join('') : '';

  return `
    <div class="qcard" style="margin-bottom:14px;">
      <div style="font-size:12px; font-weight:700; color:var(--text-3); margin-bottom:6px;">پایه</div>
      <div class="chip-row filter-scroll" style="margin-bottom:12px;">
        <button class="chip ${!analysisFilterGrade ? 'on' : ''}" onclick="setAnalysisFilterGrade(null)">همه‌ی پایه‌ها</button>
        ${gradeChips}
      </div>
      <div style="font-size:12px; font-weight:700; color:var(--text-3); margin-bottom:6px;">دسته</div>
      <div class="chip-row filter-scroll" style="margin-bottom:${analysisFilterCategory ? '8px' : '12px'};">
        <button class="chip ${!analysisFilterCategory ? 'on' : ''}" onclick="setAnalysisFilterCategory(null)">همه‌ی دروس</button>
        ${categoryChips}
      </div>
      ${analysisFilterCategory ? `<div class="chip-row filter-scroll" style="margin-bottom:12px;">
        <button class="chip ${!analysisFilterSubject ? 'on' : ''}" onclick="setAnalysisFilterSubject(null)">همه‌ی ${ANALYSIS_TAXONOMY[analysisFilterCategory].label}</button>
        ${subjectChips}
      </div>` : ''}
      <div style="font-size:12px; font-weight:700; color:var(--text-3); margin-bottom:6px;">وضعیت پاسخ</div>
      <div class="chip-row filter-scroll">
        <button class="chip ${!analysisFilterStatus ? 'on' : ''}" onclick="setAnalysisFilterStatus(null)">همه‌ی وضعیت‌ها</button>
        ${statusChips}
      </div>
      ${hasFiltersForClearButton() ? `<button class="btn-sm btn-ghost" style="width:100%; margin-top:12px;" onclick="analysisClearFilters()">پاک‌کردن فیلترها</button>` : ''}
    </div>
  `;
}
function hasFiltersForClearButton() { return analysisFiltersActive(); }

function setAnalysisFilterGrade(g) { analysisFilterGrade = g; rerender(); }
function setAnalysisFilterCategory(c) {
  analysisFilterCategory = c;
  analysisFilterSubject = null; // با عوض‌شدن دسته، انتخاب درسِ قبلی دیگه معتبر نیست
  rerender();
}
function setAnalysisFilterSubject(s) { analysisFilterSubject = s; rerender(); }
function setAnalysisFilterStatus(s) { analysisFilterStatus = s; rerender(); }

function renderAnalysisFilterResultRow(row) {
  const statusCls = row.answerStatus === 'correct' ? 'tag-diff-easy' : (row.answerStatus === 'incorrect' ? 'tag-diff-hard' : 'tag-diff-mid');
  return `
    <div class="qcard" style="cursor:pointer;" onclick="openAnalysisFilterResult('${row.examId}', ${row.questionNumber})">
      <div class="chip-row" style="margin-bottom:8px;">
        ${row.examGradeLabel ? `<span class="chip tag-subject">${row.examGradeLabel}</span>` : ''}
        ${row.subjectLabel ? `<span class="chip">${escapeHtml(row.subjectLabel)}</span>` : ''}
        <span class="chip ${statusCls}">${ANALYSIS_STATUS_SHORT[row.answerStatus] || ''}</span>
      </div>
      <div class="qtext">سوال ${fa(row.questionNumber)} — ${escapeHtml(row.examTitle)}</div>
      ${row.note ? `<div class="li-sub" style="margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(row.note)}</div>` : ''}
    </div>
  `;
}

function openAnalysisFilterResult(examId, qNum) {
  analysisPendingOpenQuestion = qNum;
  openAnalysisExam(examId);
}

function renderAnalysisExamCard(e) {
  const methodLabel = e.mappingMethod === 'auto' ? 'تشخیص خودکار صفحات' : 'نگاشت دستی صفحات';
  const methodIcon = e.mappingMethod === 'auto' ? 'auto_awesome' : 'tune';
  return `
    <div class="qcard" style="cursor:pointer;" onclick="openAnalysisExam('${e.id}')">
      <div class="chip-row" style="margin-bottom:9px;">
        ${e.gradeLabel ? `<span class="chip tag-subject">${e.gradeLabel}</span>` : ''}
        ${e.date ? `<span class="chip">${escapeHtml(Jalali.gregorianStrToJalaliStr(e.date))}</span>` : ''}
        <span class="chip"><span class="material-symbols-rounded" style="font-size:13px; vertical-align:-2px;">${methodIcon}</span> ${methodLabel}</span>
      </div>
      <div class="qtext">${escapeHtml(e.title)}</div>
      <div class="li-sub" style="margin-top:4px;">${fa(e.questionCount)} سوال · ${fa(e.pageCount)} صفحه · ${fa(e.notesCount)} تحلیل ثبت‌شده</div>
    </div>`;
}

function openAnalysisExam(id) {
  analysisSelectedExamId = id;
  analysisPdfPageGoto = 1;
  analysisPdfZoom = 1;
  rerender();
}

function closeAnalysisExam() {
  analysisSelectedExamId = null;
  rerender();
}

// ---------------------------------------------------------------------------
// آپلود آزمون جدید
// ---------------------------------------------------------------------------
function openUploadAnalysisSheet() {
  openSheet(`
    <h2>آپلود آزمون جدید</h2>
    <div class="field"><label>عنوان آزمون</label><input id="anTitle" type="text" placeholder="مثلاً آزمون جامع شماره ۳ — کانون" /></div>
    <div class="field">
      <label>پایه‌ی تحصیلی</label>
      <div class="seg" id="anGradeSeg">
        <button type="button" data-val="10">دهم</button>
        <button type="button" data-val="11">یازدهم</button>
        <button type="button" data-val="12">دوازدهم</button>
      </div>
    </div>
    <div class="field"><label>تاریخ آزمون (اختیاری)</label><input id="anDate" type="date" /></div>
    <div class="field"><label>تعداد کل سوالات</label><input id="anQCount" type="number" min="1" max="200" placeholder="مثلاً 75" /></div>

    <div class="field">
      <label>فایل PDF دفترچه‌ی آزمون</label>
      <input id="anPdfFile" type="file" accept="application/pdf" style="padding:10px 12px; border-radius:8px; background:var(--surface-2); border:1px solid var(--border); color:var(--text-1); width:100%;" />
    </div>

    <div style="background:var(--surface-2); border:1px solid var(--border-soft); border-radius:10px; padding:12px; margin-bottom:14px;">
      <div style="font-size:12.5px; font-weight:700; color:var(--text-2); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
        <span class="material-symbols-rounded" style="font-size:16px;">auto_awesome</span>
        تشخیص خودکار شماره‌ی صفحه‌ی هر سوال
      </div>
      <p style="font-size:12.5px; color:var(--text-3); line-height:1.8; margin:0 0 10px;">
        اول خودکار روی متن PDF امتحان می‌کنیم. اگه جواب نداد، فقط کافیه بگی سوال ۱ از کدوم صفحه شروع می‌شه
        و سوال آخر توی کدوم صفحه‌ست؛ بقیه‌ی سوالات به‌نسبت بین این دو صفحه تخمین زده می‌شن.
      </p>
      <div style="display:flex; gap:10px;">
        <div class="field" style="flex:1; margin-bottom:0;"><label>صفحه‌ی شروع سوال ۱</label><input id="anStartPage" type="number" min="1" placeholder="مثلاً 3" /></div>
        <div class="field" style="flex:1; margin-bottom:0;"><label>صفحه‌ی سوال آخر</label><input id="anEndPage" type="number" min="1" placeholder="مثلاً 18" /></div>
      </div>
    </div>

    <div class="field"><label>تحلیل کلی آزمون (اختیاری)</label><textarea id="anOverallNote" placeholder="جمع‌بندی کلی از عملکردت توی این آزمون…"></textarea></div>

    <button class="btn btn-primary" id="anSubmitBtn" onclick="submitUploadAnalysisExam()">آپلود و ذخیره</button>
  `);
  wireSeg('anGradeSeg');
}

async function submitUploadAnalysisExam() {
  const title = document.getElementById('anTitle').value.trim();
  const gradeVal = document.querySelector('#anGradeSeg button.active')?.dataset.val;
  const date = document.getElementById('anDate').value || '';
  const qCountRaw = document.getElementById('anQCount').value;
  const qCount = parseInt(qCountRaw, 10);
  const fileInput = document.getElementById('anPdfFile');
  const file = fileInput.files && fileInput.files[0];
  const startPageRaw = document.getElementById('anStartPage').value;
  const endPageRaw = document.getElementById('anEndPage').value;
  const overallNote = document.getElementById('anOverallNote').value.trim();

  if (!title) { showToast('عنوان آزمون رو وارد کن', 'error'); return; }
  if (!gradeVal) { showToast('پایه‌ی تحصیلی آزمون رو مشخص کن', 'error'); return; }
  if (!qCount || qCount < 1 || qCount > 200) { showToast('تعداد سوالات باید بین ۱ تا ۲۰۰ باشه', 'error'); return; }
  if (!file) { showToast('فایل PDF رو انتخاب کن', 'error'); return; }
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('فقط فایل PDF قابل قبوله', 'error'); return;
  }

  const btn = document.getElementById('anSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'در حال آپلود…';

  try {
    const meta = {
      title, date, grade: parseInt(gradeVal, 10), question_count: qCount,
      manual_start_page: startPageRaw ? parseInt(startPageRaw, 10) : null,
      manual_end_page: endPageRaw ? parseInt(endPageRaw, 10) : null,
      overall_note: overallNote,
    };
    const full = await apiUploadAnalysisExam(meta, file);
    closeSheet();
    if (full.mappingMethod === 'auto') {
      showToast('آپلود شد — شماره‌ی صفحه‌ی سوالات به‌صورت خودکار تشخیص داده شد');
    } else if (Object.keys(full.questionPageMap || {}).length) {
      showToast('آپلود شد — نگاشت صفحات از روی مقادیر دستی ساخته شد');
    } else {
      showToast('آپلود شد — نگاشت صفحات رو از داخل آزمون تنظیم کن', 'info');
    }
    analysisDetailCache[full.id] = full;
    openAnalysisExam(full.id);
  } catch (e) {
    if (e instanceof Api.ApiError && e.isNetworkError) {
      showToast('برای آپلود آزمون به اینترنت نیاز داری', 'error');
    } else {
      showToast('خطا در آپلود: ' + e.message, 'error');
    }
    btn.disabled = false;
    btn.textContent = 'آپلود و ذخیره';
  }
}

// ---------------------------------------------------------------------------
// جزئیات یک آزمون
// ---------------------------------------------------------------------------
function renderAnalysisDetail(root, examId) {
  root.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
      <button class="icon-btn" onclick="closeAnalysisExam()"><span class="material-symbols-rounded" style="font-size:19px;">arrow_forward</span></button>
      <h1 class="page-title" style="margin:0;">جزئیات آزمون</h1>
    </div>
    <div id="analysisDetailBody" style="margin-top:14px;">
      <div class="empty"><span class="material-symbols-rounded">hourglass_top</span><p>در حال بارگذاری…</p></div>
    </div>
  `;

  const body = root.querySelector('#analysisDetailBody');
  const cached = analysisDetailCache[examId];
  if (cached) renderAnalysisDetailBody(body, cached);

  apiGetAnalysisExamFull(examId).then(full => {
    analysisDetailCache[examId] = full;
    if (analysisSelectedExamId === examId) {
      const el = document.getElementById('analysisDetailBody') || body;
      renderAnalysisDetailBody(el, full);
      if (analysisPendingOpenQuestion != null) {
        const qNum = analysisPendingOpenQuestion;
        analysisPendingOpenQuestion = null;
        openAnalysisQuestionSheet(examId, qNum);
      }
    }
  }).catch(e => {
    if (!cached) {
      body.innerHTML = `<div class="empty"><span class="material-symbols-rounded">error</span><p>بارگذاری این آزمون ممکن نشد: ${escapeHtml(e.message)}</p></div>`;
    } else if (!(e instanceof Api.ApiError && e.isNetworkError)) {
      showToast('خطا در به‌روزرسانی: ' + e.message, 'error');
    }
  });
}

function renderAnalysisDetailBody(body, exam) {
  const hasMap = Object.keys(exam.questionPageMap || {}).length > 0;
  const noteByQ = {};
  (exam.notes || []).forEach(n => { noteByQ[n.questionNumber] = n; });

  const questionChips = [];
  for (let q = 1; q <= exam.questionCount; q++) {
    const n = noteByQ[q];
    let cls = '';
    if (n) {
      if (n.answerStatus === 'correct') cls = 'on tag-diff-easy';
      else if (n.answerStatus === 'incorrect') cls = 'on tag-diff-hard';
      else cls = 'on tag-diff-mid'; // تحلیل ثبت شده ولی وضعیت «نزدم»
    }
    questionChips.push(`
      <button class="chip ${cls}" onclick="openAnalysisQuestionSheet('${exam.id}', ${q})">${fa(q)}</button>
    `);
  }

  // pdfDownloadUrl (با download=1) → attachment، فقط برای دکمه‌ی دانلود.
  // خود PDF viewer دیگه از این URL مستقیم استفاده نمی‌کنه — با fetch
  // گرفته می‌شه و روی canvas رندر می‌شه (نگاه کن به initAnalysisPdfViewer).
  const pdfDownloadUrl = Api.getAnalysisPdfUrl(exam.id, true);

  body.innerHTML = `
    <div class="qcard" style="margin-bottom:14px;">
      <div class="chip-row" style="margin-bottom:8px;">
        ${exam.gradeLabel ? `<span class="chip tag-subject">${exam.gradeLabel}</span>` : `<span class="chip" style="opacity:.65;">پایه نامشخص</span>`}
      </div>
      <div class="qtext" style="margin-bottom:6px;">${escapeHtml(exam.title)}</div>
      <div class="li-sub">
        ${exam.date ? escapeHtml(Jalali.gregorianStrToJalaliStr(exam.date)) + ' · ' : ''}
        ${fa(exam.questionCount)} سوال · ${fa(exam.pageCount)} صفحه
      </div>
      ${exam.overallNote ? `<div style="margin-top:10px; font-size:13.5px; line-height:1.9; color:var(--text-2); background:var(--surface-3); border-radius:8px; padding:10px;">${escapeHtml(exam.overallNote)}</div>` : ''}
      <div class="btn-row" style="margin-top:12px;">
        <button class="btn-sm btn-ghost" style="flex:1;" onclick="openEditAnalysisMetaSheet('${exam.id}')">ویرایش اطلاعات</button>
        <a class="btn-sm btn-ghost" style="flex:1; text-align:center; text-decoration:none; display:flex; align-items:center; justify-content:center;" href="${pdfDownloadUrl}" download="${escapeHtml(exam.originalFilename || exam.title + '.pdf')}">
          <span class="material-symbols-rounded" style="font-size:17px;">download</span> دانلود PDF
        </a>
        <button class="btn-sm btn-danger-ghost" style="flex:1;" onclick="confirmDeleteAnalysisExam('${exam.id}')">حذف آزمون</button>
      </div>
    </div>

    ${!hasMap ? `
    <div class="qcard" style="margin-bottom:14px; border-color:rgba(239,68,68,.35);">
      <div style="font-size:13px; color:var(--danger); font-weight:700; margin-bottom:8px;">نگاشت شماره‌سوال به صفحه هنوز مشخص نیست</div>
      <p style="font-size:12.5px; color:var(--text-3); line-height:1.8; margin-bottom:10px;">
        تشخیص خودکار برای این فایل جواب نداد. صفحه‌ی شروع سوال ۱ و صفحه‌ی سوال آخر رو وارد کن تا نگاشت ساخته بشه.
        <br/>PDF آزمونت رو پایین می‌تونی ببینی تا شماره صفحه‌ها رو چک کنی.
      </p>
      <div style="display:flex; gap:10px;">
        <div class="field" style="flex:1; margin-bottom:0;"><label>صفحه‌ی شروع سوال ۱</label><input id="remapStart" type="number" min="1" max="${exam.pageCount}" /></div>
        <div class="field" style="flex:1; margin-bottom:0;"><label>صفحه‌ی سوال آخر</label><input id="remapEnd" type="number" min="1" max="${exam.pageCount}" /></div>
      </div>
      <button class="btn btn-primary" style="margin-top:10px;" onclick="submitRemapAnalysisExam('${exam.id}')">محاسبه‌ی نگاشت صفحات</button>
    </div>` : `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
      <span style="font-size:13px; font-weight:700; color:var(--text-2);">مشاهده‌ی دفترچه‌ی آزمون</span>
      <button class="btn-sm btn-ghost" onclick="openAnalysisRemapSheet('${exam.id}')"><span class="material-symbols-rounded" style="font-size:15px;">tune</span> اصلاح نگاشت صفحات</button>
    </div>
    `}

    <!-- =====================================================
         PDF.js viewer — رندر روی canvas، مستقل از مرورگر/WebView
         ===================================================== -->
    <div class="pdfjs-wrap" style="margin-bottom:18px;">
      <div class="pdfjs-toolbar">
        <div class="pdfjs-nav">
          <button id="pdfjsPrevBtn" onclick="analysisPdfGoRelative(-1)" title="صفحه‌ی قبل">
            <span class="material-symbols-rounded" style="font-size:18px;">chevron_right</span>
          </button>
          <span class="pdfjs-page-label" id="pdfjsPageLabel">…</span>
          <button id="pdfjsNextBtn" onclick="analysisPdfGoRelative(1)" title="صفحه‌ی بعد">
            <span class="material-symbols-rounded" style="font-size:18px;">chevron_left</span>
          </button>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button onclick="analysisPdfZoomBy(-0.2)" title="کوچک‌نمایی">
            <span class="material-symbols-rounded" style="font-size:18px;">remove</span>
          </button>
          <button onclick="analysisPdfZoomBy(0.2)" title="بزرگ‌نمایی">
            <span class="material-symbols-rounded" style="font-size:18px;">add</span>
          </button>
        </div>
      </div>
      <div class="pdfjs-canvas-scroll" id="pdfjsCanvasScroll">
        <div class="pdfjs-status"><span class="material-symbols-rounded" style="font-size:22px;">hourglass_top</span>در حال بارگذاری PDF…</div>
      </div>
    </div>

    ${hasMap ? `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
      <span style="font-size:13px; font-weight:700; color:var(--text-2);">سوال‌ها — بزن تا تحلیل بنویسی و به صفحه‌ش بپری</span>
      <span style="font-size:11px; color:var(--text-3);">🟢 درست · 🔴 غلط · 🟡 نزده · خاکستری = بدون تحلیل</span>
    </div>` : `
    <div style="font-size:13px; font-weight:700; color:var(--text-2); margin-bottom:8px;">
      سوال‌ها — بزن تا تحلیل بنویسی (بعد از تنظیم نگاشت صفحات، به صفحه‌ی سوال هم می‌پری)
    </div>`}
    <div class="chip-row" style="flex-wrap:wrap;">${questionChips.join('')}</div>
  `;

  initAnalysisPdfViewer(exam.id);
}

// ---------------------------------------------------------------------------
// PDF.js viewer — بارگذاری یک‌بار PDF در حافظه (به‌صورت ArrayBuffer) و
// رندر صفحه‌ی دلخواه روی canvas. مستقل از iframe/پلاگین PDF مرورگره،
// پس روی موبایل، دسکتاپ، Chrome، Edge، WebView داخل اپ یکسان کار می‌کنه.
// ---------------------------------------------------------------------------
let analysisPdfDocCache = {}; // examId -> pdfjsLib PDFDocumentProxy
let analysisPdfRenderToken = 0; // برای لغو رندرهای قدیمی/همپوشان

async function initAnalysisPdfViewer(examId) {
  const scrollEl = document.getElementById('pdfjsCanvasScroll');
  if (!scrollEl) return;

  // اگه pdf.js هنوز از CDN لود نشده (شبکه کند/کاربر آفلاینه)، صبر می‌کنیم
  if (!window.pdfjsLib) {
    scrollEl.innerHTML = `<div class="pdfjs-status"><span class="material-symbols-rounded" style="font-size:22px;">hourglass_top</span>در حال آماده‌سازی نمایشگر PDF…</div>`;
    await new Promise(resolve => {
      const onReady = () => { window.removeEventListener('pdfjs-ready', onReady); resolve(); };
      window.addEventListener('pdfjs-ready', onReady);
      setTimeout(resolve, 6000); // حداکثر ۶ ثانیه صبر، بعد تلاش می‌کنیم (شاید تا الان لود شده)
    });
  }
  if (!window.pdfjsLib) {
    scrollEl.innerHTML = `<div class="pdfjs-status"><span class="material-symbols-rounded" style="font-size:22px;">wifi_off</span>نمایشگر PDF بارگذاری نشد. اتصال اینترنتت رو چک کن و دوباره امتحان کن.</div>`;
    return;
  }

  try {
    let pdfDoc = analysisPdfDocCache[examId];
    if (!pdfDoc) {
      scrollEl.innerHTML = `<div class="pdfjs-status"><span class="material-symbols-rounded" style="font-size:22px;">hourglass_top</span>در حال بارگذاری PDF…</div>`;
      // با fetch می‌گیریم (نه iframe) تا روی همه‌ی پلتفرم‌ها یکسان کار کنه
      const res = await fetch(Api.getAnalysisPdfUrl(examId), { credentials: 'omit' });
      if (!res.ok) throw new Error('دریافت فایل PDF ناموفق بود (کد ' + res.status + ')');
      const arrayBuffer = await res.arrayBuffer();
      pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      analysisPdfDocCache[examId] = pdfDoc;
    }
    await renderAnalysisPdfPage(examId, analysisPdfPageGoto || 1);
  } catch (e) {
    scrollEl.innerHTML = `<div class="pdfjs-status"><span class="material-symbols-rounded" style="font-size:22px;">error</span>نمایش PDF ممکن نشد: ${escapeHtml(e.message)}</div>`;
  }
}

async function renderAnalysisPdfPage(examId, pageNum) {
  const pdfDoc = analysisPdfDocCache[examId];
  const scrollEl = document.getElementById('pdfjsCanvasScroll');
  const label = document.getElementById('pdfjsPageLabel');
  const prevBtn = document.getElementById('pdfjsPrevBtn');
  const nextBtn = document.getElementById('pdfjsNextBtn');
  if (!pdfDoc || !scrollEl) return;

  const clamped = Math.min(Math.max(1, pageNum), pdfDoc.numPages);
  analysisPdfPageGoto = clamped;
  const myToken = ++analysisPdfRenderToken;

  if (label) label.textContent = `صفحه ${fa(clamped)} از ${fa(pdfDoc.numPages)}`;
  if (prevBtn) prevBtn.disabled = clamped <= 1;
  if (nextBtn) nextBtn.disabled = clamped >= pdfDoc.numPages;

  const page = await pdfDoc.getPage(clamped);
  if (myToken !== analysisPdfRenderToken) return; // یه رندر جدیدتر درخواست شده، این یکی رو ول کن

  const containerWidth = Math.min(scrollEl.clientWidth - 20, 900);
  const baseViewport = page.getViewport({ scale: 1 });
  const fitScale = (containerWidth > 0 ? containerWidth : 320) / baseViewport.width;
  const scale = fitScale * analysisPdfZoom;
  const viewport = page.getViewport({ scale: Math.max(scale, 0.3) });

  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = Math.floor(viewport.width) + 'px';
  canvas.style.height = Math.floor(viewport.height) + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  scrollEl.innerHTML = '';
  scrollEl.appendChild(canvas);

  await page.render({ canvasContext: ctx, viewport }).promise;
  if (myToken !== analysisPdfRenderToken) return;
  scrollEl.scrollTop = 0;
}

function analysisPdfGoRelative(delta) {
  if (!analysisSelectedExamId) return;
  renderAnalysisPdfPage(analysisSelectedExamId, (analysisPdfPageGoto || 1) + delta);
}

function analysisPdfZoomBy(delta) {
  if (!analysisSelectedExamId) return;
  analysisPdfZoom = Math.min(3, Math.max(0.5, +(analysisPdfZoom + delta).toFixed(2)));
  renderAnalysisPdfPage(analysisSelectedExamId, analysisPdfPageGoto || 1);
}

// ---------------------------------------------------------------------------
// پرش به صفحه‌ی سوال — با pdf.js دیگه نیازی به ری‌لود/iframe نیست،
// فقط صفحه‌ی موردنظر رو روی همون canvas از سند PDF (که در حافظه کش
// شده) دوباره رندر می‌کنیم. سریع، بدون دانلود مجدد، روی همه‌ی مرورگرها.
// ---------------------------------------------------------------------------
function jumpToAnalysisQuestionPage(examId, qNum) {
  const exam = analysisDetailCache[examId];
  if (!exam) return;
  const page = (exam.questionPageMap || {})[qNum] || (exam.questionPageMap || {})[String(qNum)];
  if (!page) { showToast('صفحه‌ی این سوال هنوز از نگاشت مشخص نیست', 'error'); return; }
  renderAnalysisPdfPage(examId, page).then(() => {
    const wrap = document.querySelector('.pdfjs-wrap');
    if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ---------------------------------------------------------------------------
// تحلیل یک سوال مشخص (باز شدن در بات‌شیت)
// ---------------------------------------------------------------------------
function openAnalysisQuestionSheet(examId, qNum) {
  const exam = analysisDetailCache[examId];
  if (!exam) return;
  const existing = (exam.notes || []).find(n => n.questionNumber === qNum);
  const hasMap = Object.keys(exam.questionPageMap || {}).length > 0;
  const page = hasMap ? ((exam.questionPageMap || {})[qNum] || (exam.questionPageMap || {})[String(qNum)]) : null;
  const initialCategory = existing?.subjectCode ? analysisCategoryOfSubject(existing.subjectCode) : '';
  const initialSubject = existing?.subjectCode || '';
  const status = existing?.answerStatus || 'unanswered';

  openSheet(`
    <h2>سوال ${fa(qNum)}</h2>
    ${page ? `
    <button class="btn-sm btn-ghost" style="width:100%; margin-bottom:14px;" onclick="closeSheet(); jumpToAnalysisQuestionPage('${examId}', ${qNum});">
      <span class="material-symbols-rounded" style="font-size:16px;">visibility</span> پرش به این سوال در PDF (صفحه‌ی ${fa(page)})
    </button>` : (hasMap ? `<p style="font-size:12.5px; color:var(--text-3); margin-bottom:14px;">صفحه‌ی این سوال از نگاشت مشخص نیست.</p>` :
    `<p style="font-size:12.5px; color:var(--text-3); margin-bottom:14px;">برای پریدن به صفحه، ابتدا نگاشت صفحات آزمون رو تنظیم کن.</p>`)}

    <div class="field">
      <label>دسته و درس (اختیاری)</label>
      <div class="chip-row" id="anqCategoryRow">
        ${Object.entries(ANALYSIS_TAXONOMY).map(([code, cat]) => `
          <button type="button" class="chip ${initialCategory === code ? 'on' : ''}" data-cat="${code}" onclick="selectAnalysisNoteCategory('${code}', '${initialSubject}')">${cat.label}</button>
        `).join('')}
      </div>
      <div class="chip-row" id="anqSubjectRow" style="margin-top:8px;">${renderAnalysisSubjectChipsHtml(initialCategory, initialSubject)}</div>
      ${existing?.subjectCode === '' && existing?.subject ? `<p style="font-size:11.5px; color:var(--text-3); margin-top:6px;">درسِ قدیمیِ ثبت‌شده (متن آزاد): «${escapeHtml(existing.subject)}» — اگه از لیست بالا انتخاب کنی جایگزینش می‌شه.</p>` : ''}
    </div>

    <div class="field">
      <label>وضعیت من توی این سوال</label>
      <div class="seg" id="anqCorrectSeg">
        <button type="button" data-val="unanswered" class="${status === 'unanswered' ? 'active' : ''}">نزدم</button>
        <button type="button" data-val="correct" class="${status === 'correct' ? 'active' : ''}">درست زدم</button>
        <button type="button" data-val="incorrect" class="${status === 'incorrect' ? 'active' : ''}">غلط زدم</button>
      </div>
    </div>
    <div class="field"><label>تحلیل</label><textarea id="anqNote" placeholder="چرا غلط زدم، چه نکته‌ای رو باید مرور کنم…">${escapeHtml(existing?.note || '')}</textarea></div>

    <div class="btn-row">
      <button class="btn btn-primary" style="flex:1;" onclick="submitAnalysisQuestionNote('${examId}', ${qNum})">ذخیره تحلیل</button>
      ${existing ? `<button class="btn-sm btn-danger-ghost" onclick="confirmDeleteAnalysisNote('${examId}', '${existing.id}')">حذف</button>` : ''}
    </div>
  `);
  wireSeg('anqCorrectSeg');
}

// چیپ‌های درسِ یک دسته‌ی مشخص؛ به‌شکل رشته‌ی HTML برمی‌گرده تا هم موقع باز شدنِ
// شیت، هم موقع عوض‌شدنِ دسته (بدون rerender کل شیت، تا مقدار textarea/وضعیت از
// دست نره) قابل استفاده باشه.
function renderAnalysisSubjectChipsHtml(categoryCode, selectedSubjectCode) {
  if (!categoryCode || !ANALYSIS_TAXONOMY[categoryCode]) return '';
  return Object.entries(ANALYSIS_TAXONOMY[categoryCode].subjects).map(([code, label]) => `
    <button type="button" class="chip ${selectedSubjectCode === code ? 'on' : ''}" data-code="${code}" onclick="selectAnalysisNoteSubject('${code}')">${label}</button>
  `).join('');
}

function selectAnalysisNoteCategory(categoryCode, initialSubjectCode) {
  const catRow = document.getElementById('anqCategoryRow');
  const subjRow = document.getElementById('anqSubjectRow');
  if (!catRow || !subjRow) return;
  catRow.querySelectorAll('.chip').forEach(el => el.classList.toggle('on', el.dataset.cat === categoryCode));
  // اگه درسِ از قبل انتخاب‌شده هنوز به همین دسته تعلق داره نگهش می‌داریم، وگرنه پاکش می‌کنیم
  const keepSubject = initialSubjectCode && analysisCategoryOfSubject(initialSubjectCode) === categoryCode ? initialSubjectCode : '';
  subjRow.innerHTML = renderAnalysisSubjectChipsHtml(categoryCode, keepSubject);
}

function selectAnalysisNoteSubject(subjectCode) {
  const subjRow = document.getElementById('anqSubjectRow');
  if (!subjRow) return;
  subjRow.querySelectorAll('.chip').forEach(el => el.classList.toggle('on', el.dataset.code === subjectCode));
}

async function submitAnalysisQuestionNote(examId, qNum) {
  const subjectCode = document.querySelector('#anqSubjectRow .chip.on')?.dataset.code || '';
  const note = document.getElementById('anqNote').value.trim();
  const answerStatus = document.querySelector('#anqCorrectSeg button.active')?.dataset.val || 'unanswered';

  try {
    const saved = await apiUpsertAnalysisNote(examId, { question_number: qNum, subject_code: subjectCode, note, answer_status: answerStatus });
    const exam = analysisDetailCache[examId];
    if (exam) {
      const idx = exam.notes.findIndex(n => n.questionNumber === qNum);
      if (idx >= 0) exam.notes[idx] = saved; else exam.notes.push(saved);
    }
    closeSheet();
    showToast('تحلیل ذخیره شد');
    if (analysisSelectedExamId === examId) rerender();
  } catch (e) {
    showToast('خطا در ذخیره: ' + e.message, 'error');
  }
}

function confirmDeleteAnalysisNote(examId, noteId) {
  openDialog({
    icon: 'delete', title: 'حذف تحلیل', text: 'تحلیل این سوال پاک می‌شه.',
    confirmText: 'حذف کن', confirmClass: 'btn-danger-ghost',
    onConfirm: async () => {
      try {
        await apiDeleteAnalysisNote(examId, noteId);
        const exam = analysisDetailCache[examId];
        if (exam) exam.notes = exam.notes.filter(n => n.id !== noteId);
        closeDialog(); closeSheet();
        showToast('حذف شد');
        if (analysisSelectedExamId === examId) rerender();
      } catch (e) {
        showToast('خطا: ' + e.message, 'error');
        closeDialog();
      }
    }
  });
}

// ---------------------------------------------------------------------------
// ویرایش اطلاعات آزمون
// ---------------------------------------------------------------------------
function openEditAnalysisMetaSheet(examId) {
  const exam = analysisDetailCache[examId];
  if (!exam) return;
  openSheet(`
    <h2>ویرایش اطلاعات آزمون</h2>
    <div class="field"><label>عنوان</label><input id="anEditTitle" type="text" value="${escapeHtml(exam.title)}" /></div>
    <div class="field">
      <label>پایه‌ی تحصیلی</label>
      <div class="seg" id="anEditGradeSeg">
        <button type="button" data-val="10" class="${exam.grade === 10 ? 'active' : ''}">دهم</button>
        <button type="button" data-val="11" class="${exam.grade === 11 ? 'active' : ''}">یازدهم</button>
        <button type="button" data-val="12" class="${exam.grade === 12 ? 'active' : ''}">دوازدهم</button>
      </div>
    </div>
    <div class="field"><label>تاریخ</label><input id="anEditDate" type="date" value="${escapeHtml(exam.date || '')}" /></div>
    <div class="field"><label>تحلیل کلی</label><textarea id="anEditOverall" placeholder="جمع‌بندی کلی…">${escapeHtml(exam.overallNote || '')}</textarea></div>
    <button class="btn btn-primary" onclick="submitEditAnalysisMeta('${examId}')">ذخیره تغییرات</button>
  `);
  wireSeg('anEditGradeSeg');
}

async function submitEditAnalysisMeta(examId) {
  const title = document.getElementById('anEditTitle').value.trim();
  const gradeVal = document.querySelector('#anEditGradeSeg button.active')?.dataset.val;
  const date = document.getElementById('anEditDate').value || '';
  const overall_note = document.getElementById('anEditOverall').value.trim();
  if (!title) { showToast('عنوان نمی‌تونه خالی باشه', 'error'); return; }
  if (!gradeVal) { showToast('پایه‌ی تحصیلی رو مشخص کن', 'error'); return; }
  try {
    const updated = await apiUpdateAnalysisExamMeta(examId, { title, date, grade: parseInt(gradeVal, 10), overall_note });
    analysisDetailCache[examId] = { ...analysisDetailCache[examId], ...updated, notes: analysisDetailCache[examId].notes };
    closeSheet();
    showToast('ذخیره شد');
    rerender();
  } catch (e) {
    showToast('خطا: ' + e.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// اصلاح دستی نگاشت صفحات
// ---------------------------------------------------------------------------
function openAnalysisRemapSheet(examId) {
  const exam = analysisDetailCache[examId];
  if (!exam) return;
  openSheet(`
    <h2>اصلاح نگاشت صفحات</h2>
    <p style="font-size:12.5px; color:var(--text-3); line-height:1.8; margin-bottom:14px;">
      اگه شماره‌ی صفحه‌ی بعضی سوالات درست نیست، صفحه‌ی شروع سوال ۱ و صفحه‌ی سوال آخر رو دوباره وارد کن.
    </p>
    <div style="display:flex; gap:10px;">
      <div class="field" style="flex:1;"><label>صفحه‌ی شروع سوال ۱</label><input id="remapStart2" type="number" min="1" max="${exam.pageCount}" value="${exam.manualStartPage || ''}" /></div>
      <div class="field" style="flex:1;"><label>صفحه‌ی سوال آخر</label><input id="remapEnd2" type="number" min="1" max="${exam.pageCount}" value="${exam.manualEndPage || ''}" /></div>
    </div>
    <button class="btn btn-primary" onclick="submitRemapAnalysisExam('${examId}', true)">محاسبه‌ی دوباره</button>
  `);
}

async function submitRemapAnalysisExam(examId, fromSheet) {
  const startEl = document.getElementById(fromSheet ? 'remapStart2' : 'remapStart');
  const endEl = document.getElementById(fromSheet ? 'remapEnd2' : 'remapEnd');
  const start = parseInt(startEl.value, 10);
  const end = parseInt(endEl.value, 10);
  if (!start || !end) { showToast('هر دو صفحه رو وارد کن', 'error'); return; }
  if (end < start) { showToast('صفحه‌ی سوال آخر نمی‌تونه قبل از صفحه‌ی شروع باشه', 'error'); return; }
  try {
    const updated = await apiRemapAnalysisExam(examId, start, end);
    analysisDetailCache[examId] = { ...analysisDetailCache[examId], ...updated, notes: analysisDetailCache[examId].notes };
    if (fromSheet) closeSheet();
    showToast('نگاشت صفحات به‌روز شد');
    rerender();
  } catch (e) {
    showToast('خطا: ' + e.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// حذف کل آزمون
// ---------------------------------------------------------------------------
function confirmDeleteAnalysisExam(examId) {
  openDialog({
    icon: 'delete', title: 'حذف آزمون', text: 'این آزمون، فایل PDF و همه‌ی تحلیل‌های ثبت‌شده‌ش برای همیشه حذف می‌شن.',
    confirmText: 'حذف کن', confirmClass: 'btn-danger-ghost',
    onConfirm: async () => {
      try {
        await apiDeleteAnalysisExam(examId);
        delete analysisDetailCache[examId];
        delete analysisPdfDocCache[examId];
        closeDialog();
        showToast('حذف شد');
        closeAnalysisExam();
      } catch (e) {
        showToast('خطا در حذف: ' + e.message, 'error');
        closeDialog();
      }
    }
  });
}
