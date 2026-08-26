/* =========================================================================
   صفحه‌ی پنل ادمین - شامل مدیریت اعضا، ناتیون و ریستور پوینت‌ها
   ========================================================================= */

// فرض بر اینه که توکن و چک کردن ادمین قبل از رندر این کامپوننت انجام شده
// اگر نه، همون چک اولیه‌ای که داشتی رو نگه دار.

export function renderAdminScreen(root, currentUser) {
  // چک کردن دسترسی ادمین (اگر از بیرون چک نکردی)
  if (!currentUser || currentUser.role !== 'admin') {
    root.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-rounded" style="font-size:48px; color:var(--danger);">lock</span>
        <h3>دسترسی نداری</h3>
        <p>این بخش فقط مخصوص ادمین‌های سیستمه.</p>
      </div>`;
    return;
  }

  root.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
      <button class="icon-btn" onclick="app.navigate('profile')" aria-label="بازگشت">
        <span class="material-symbols-rounded">arrow_back</span>
      </button>
      <h1 class="page-title" style="margin:0;">پنل مدیریت کلان</h1>
    </div>

    <!-- بخش عملیات سریع (ناتیون و ریستور) -->
    <div class="card" style="background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1)); border: 1px solid rgba(99,102,241,0.2); margin-bottom: 20px;">
      <h3 style="margin:0 0 12px 0; font-size:16px; display:flex; align-items:center; gap:8px;">
        <span class="material-symbols-rounded" style="color:var(--primary);">settings_suggest</span>
        ابزارهای سیستمی
      </h3>
      
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        <button id="btnSyncNotion" class="btn-sm" style="background:var(--primary); color:white;" onclick="handleSyncNotion()">
          <span class="material-symbols-rounded" style="vertical-align:middle; margin-left:4px;">sync</span>
          همگام‌سازی ناتیون
        </button>
        <button id="btnRestorePoints" class="btn-sm" style="background:var(--surface-2); color:var(--text);" onclick="showRestorePointsModal()">
          <span class="material-symbols-rounded" style="vertical-align:middle; margin-left:4px;">history</span>
          نقاط بازیابی
        </button>
      </div>
      <p style="font-size:11px; color:var(--text-3); margin-top:8px; line-height:1.4;">
        ⚠️ همگام‌سازی ناتیون داده‌های جدید را از تلگرام می‌خواند.<br>
        نقاط بازیابی برای برگرداندن اپ در صورت خرابی استفاده می‌شوند.
      </p>
    </div>

    <!-- بخش مدیریت اعضا -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <h2 style="margin:0; font-size:16px;">اعضای گروه</h2>
      <button class="btn-sm btn-ghost" onclick="loadAdminMembers()">
        <span class="material-symbols-rounded">refresh</span>
      </button>
    </div>
    
    <div id="adminMembersList">
      <div class="empty">
        <span class="material-symbols-rounded">hourglass_top</span>
        <p>در حال بارگذاری...</p>
      </div>
    </div>

    <!-- مودال نقاط بازیابی (Hidden by default) -->
    <div id="restoreModal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:9999; align-items:center; justify-content:center;">
      <div class="card" style="width:90%; max-width:400px; max-height:80vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
          <h3 style="margin:0;">نقاط بازیابی</h3>
          <button class="icon-btn" onclick="document.getElementById('restoreModal').style.display='none'">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
        <button class="btn-sm btn-primary" style="width:100%; margin-bottom:15px;" onclick="createNewRestorePoint()">
          <span class="material-symbols-rounded">add</span>
          ساخت نقطه بازیابی جدید
        </button>
        <div id="restorePointsList"></div>
      </div>
    </div>
  `;

  // لود کردن اولیه اعضا
  loadAdminMembers();
}

// --- توابع مربوط به ناتیون ---
async function handleSyncNotion() {
  const btn = document.getElementById('btnSyncNotion');
  const originalText = btn.innerHTML;
  
  try {
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-rounded">sync</span> در حال همگام‌سازی...`;
    
    await Api.syncNotion();
    
    showToast('همگام‌سازی با ناتیون با موفقیت انجام شد!', 'success');
  } catch (e) {
    showToast('خطا در همگام‌سازی: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// --- توابع مربوط به Restore Points ---
async function showRestorePointsModal() {
  const modal = document.getElementById('restoreModal');
  const listEl = document.getElementById('restorePointsList');
  
  modal.style.display = 'flex';
  listEl.innerHTML = `<div class="empty"><span class="material-symbols-rounded">hourglass_top</span><p>در حال دریافت...</p></div>`;

  try {
    const points = await Api.listRestorePoints();
    
    if (!points || points.length === 0) {
      listEl.innerHTML = `<p style="text-align:center; color:var(--text-3); padding:20px;">هیچ نقطه بازیابی وجود ندارد.</p>`;
      return;
    }

    listEl.innerHTML = points.map(p => `
      <div style="background:var(--surface-2); padding:12px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:bold; font-size:14px;">${escapeHtml(p.name || 'بدون نام')}</div>
          <div style="font-size:11px; color:var(--text-3);">${new Date(p.created_at).toLocaleString('fa-IR')}</div>
        </div>
        <button class="btn-sm btn-danger-ghost" onclick="applyRestorePoint(${p.id}, '${escapeHtml(p.name)}')">
          بازگردانی
        </button>
      </div>
    `).join('');
  } catch (e) {
    listEl.innerHTML = `<p style="color:var(--danger); text-align:center;">خطا: ${e.message}</p>`;
  }
}

async function createNewRestorePoint() {
  const name = prompt('نام این نقطه بازیابی را وارد کنید (مثلا: قبل از آپدیت ناتیون):', 'Manual Backup');
  if (!name) return;

  try {
    showToast('در حال ساخت...', 'info');
    await Api.createRestorePoint(name);
    showToast('نقطه بازیابی ساخته شد', 'success');
    showRestorePointsModal(); // رفرش لیست
  } catch (e) {
    showToast('خطا: ' + e.message, 'error');
  }
}

window.applyRestorePoint = async function(id, name) {
  if (!confirm(`آیا مطمئن هستید که می‌خواهید داده‌ها را به حالت "${name}" بازگردانی کنید؟\nاین عملیات غیرقابل بازگشت است.`)) return;

  try {
    showToast('در حال بازگردانی...', 'info');
    await Api.applyRestorePoint(id);
    document.getElementById('restoreModal').style.display = 'none';
    showToast('سیستم با موفقیت بازگردانی شد', 'success');
    // رفرش کردن صفحه یا داده‌ها در صورت نیاز
    setTimeout(() => location.reload(), 1500);
  } catch (e) {
    showToast('خطا در بازگردانی: ' + e.message, 'error');
  }
};

// --- توابع مدیریت اعضا (کد قبلی شما با کمی تمیزکاری) ---
let adminMembers = null;
let adminLoading = false;

async function loadAdminMembers() {
  adminLoading = true;
  const listEl = document.getElementById('adminMembersList');
  if(listEl) listEl.innerHTML = `<div class="empty"><span class="material-symbols-rounded">hourglass_top</span><p>در حال بارگذاری...</p></div>`;
  
  try {
    adminMembers = await Api.adminListMembers();
  } catch (e) {
    showToast('خطا در بارگذاری اعضا: ' + e.message, 'error');
    adminMembers = [];
  }
  adminLoading = false;
  renderAdminMembersList();
}

function renderAdminMembersList() {
  const listEl = document.getElementById('adminMembersList');
  if (!listEl) return;

  if (!adminMembers || !adminMembers.length) {
    listEl.innerHTML = `<div class="empty"><span class="material-symbols-rounded">group_off</span><p>عضوی پیدا نشد</p></div>`;
    return;
  }

  listEl.innerHTML = adminMembers.map(m => `
    <div class="card" style="margin-top:12px; ${m.is_banned ? 'opacity:.6; border-color:var(--danger);' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-weight:800; font-size:14.5px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            ${escapeHtml(m.display_name)}
            ${m.role === 'admin' ? '<span class="chip" style="background:rgba(251,191,36,.15); color:var(--gold); font-size:10px;">ادمین</span>' : ''}
            ${m.is_banned ? '<span class="chip" style="background:rgba(239,68,68,.15); color:var(--danger); font-size:10px;">مسدود</span>' : ''}
          </div>
          <div style="font-size:11.5px; color:var(--text-3); margin-top:2px;">
            @${escapeHtml(m.username || '-')} 
            ${m.telegram_chat_id ? '· <span style="color:var(--success);">وصل به تلگرام ✓</span>' : '· <span style="color:var(--text-3);">عدم اتصال</span>'}
          </div>
        </div>
      </div>
      
      <div class="grid-2" style="margin-top:12px; background:var(--surface-2); padding:8px; border-radius:8px;">
        <div style="text-align:center;">
          <div style="font-weight:800; font-size:15px; color:var(--primary);">${formatMinutes(m.total_minutes_last_7d)}</div>
          <div style="font-size:10px; color:var(--text-3);">مطالعه (۷ روز)</div>
        </div>
        <div style="text-align:center;">
          <div style="font-weight:800; font-size:15px; color:var(--accent);">${fa(m.total_tests_last_7d || 0)}</div>
          <div style="font-size:10px; color:var(--text-3);">تست (۷ روز)</div>
        </div>
      </div>

      ${m.role !== 'admin' ? `
      <div class="btn-row" style="margin-top:12px;">
        <button class="btn-sm ${m.is_banned ? 'btn-primary' : 'btn-danger-ghost'}" style="flex:1;" onclick="toggleMemberBan(${m.id}, ${!m.is_banned})">
          ${m.is_banned ? 'رفع مسدودیت' : 'مسدود کردن'}
        </button>
        <button class="btn-sm btn-ghost" style="flex:1; color:var(--danger);" onclick="confirmDeleteMember(${m.id}, '${escapeHtml(m.display_name)}')">حذف کامل</button>
      </div>` : ''}
    </div>
  `).join('');
}

// توابع کمکی (باید مطمئن شی این‌ها در فایل global هستن یا اینجا تعریف شن)
// اگر تو فایل utils.js داری، نیازی به تعریف مجدد نیست.
if (typeof escapeHtml === 'undefined') {
  window.escapeHtml = (unsafe) => {
    if (!unsafe) return '';
    return unsafe.toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };
}

if (typeof fa === 'undefined') {
  window.fa = (num) => {
    if (num === undefined || num === null) return '';
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().replace(/\d/g, x => farsiDigits[x]);
  };
}

if (typeof formatMinutes === 'undefined') {
  window.formatMinutes = (mins) => {
    if (!mins) return '۰ دقیقه';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    let res = '';
    if (h > 0) res += fa(h) + ' ساعت ';
    res += fa(m) + ' دقیقه';
    return res;
  };
}

if (typeof showToast === 'undefined') {
  window.showToast = (msg, type = 'info') => {
    // یک پیاده‌سازی ساده اگر نداری
    alert(msg); 
  };
}

// attaching global functions for onclick handlers in HTML strings
window.toggleMemberBan = async function(userId, banned) {
  try {
    await Api.adminSetBan(userId, banned);
    showToast(banned ? 'کاربر مسدود شد' : 'مسدودیت برداشته شد', 'success');
    await loadAdminMembers();
  } catch (e) {
    showToast('خطا: ' + e.message, 'error');
  }
};

window.confirmDeleteMember = function(userId, name) {
  if(confirm(`آیا از حذف کامل کاربر "${name}" و تمام داده‌هایش مطمئن هستید؟`)) {
    Api.adminDeleteMember(userId)
      .then(() => {
        showToast('عضو حذف شد', 'success');
        loadAdminMembers();
      })
      .catch(e => showToast('خطا: ' + e.message, 'error'));
  }
};
