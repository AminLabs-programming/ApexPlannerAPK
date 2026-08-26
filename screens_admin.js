import { escapeHtml, fa, formatMinutes, emptyState, openDialog, closeDialog, showToast } from '../utils/helpers.js';
import { Api } from '../services/api.js';

let adminMembers = null;
let adminLoading = false;
let restorePoints = null;
let restoreLoading = false;

export function renderAdmin(root, user) {
  if (user.role !== 'admin') {
    root.innerHTML = emptyState('lock', 'دسترسی نداری', 'این بخش فقط مخصوص ادمین کل سیستم است.');
    return;
  }

  root.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px;">
      <button class="icon-btn" onclick="window.navigate('profile')"><span class="material-symbols-rounded">arrow_back</span></button>
      <h1 class="page-title" style="margin:0;">پنل مدیریت کل</h1>
    </div>

    <!-- بخش ابزارهای سیستمی (ناتیون و ریستور) -->
    <div class="card" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1)); border: 1px solid rgba(99, 102, 241, 0.2); margin-bottom: 20px;">
      <div style="font-weight:800; font-size:14px; margin-bottom:10px; color: var(--primary);">
        <span class="material-symbols-rounded" style="vertical-align:middle; font-size:18px;">settings_input_component</span>
        ابزارهای پیشرفته سیستم
      </div>
      <div class="grid-2" style="gap:10px;">
        <button class="btn-sm btn-primary" onclick="handleSyncNotion()" style="display:flex; align-items:center; justify-content:center; gap:6px;">
          <span class="material-symbols-rounded">sync</span>
          همگام‌سازی Notion
        </button>
        <button class="btn-sm btn-ghost" onclick="renderRestorePointsSection()" style="display:flex; align-items:center; justify-content:center; gap:6px;">
          <span class="material-symbols-rounded">history</span>
          نقاط بازیابی
        </button>
      </div>
      <div id="systemMessage" style="font-size:11px; margin-top:8px; color:var(--text-3); min-height:15px;"></div>
    </div>

    <!-- بخش مدیریت اعضا -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <h2 style="font-size:16px; font-weight:800; margin:0;">اعضای گروه</h2>
      <button class="icon-btn" onclick="loadAdminMembers(true)"><span class="material-symbols-rounded">refresh</span></button>
    </div>
    
    <div id="adminMembersList"></div>
    
    <!-- کانتینر مخفی برای نمایش نقاط بازیابی -->
    <div id="restorePointsContainer" style="display:none; margin-top:20px;"></div>
  `;

  loadAdminMembers();
}

async function handleSyncNotion() {
  const msgEl = document.getElementById('systemMessage');
  if (!msgEl) return;
  
  msgEl.innerHTML = '<span class="material-symbols-rounded" style="vertical-align:middle; animation:spin 1s linear infinite;">sync</span> در حال ارتباط با ناتیون...';
  msgEl.style.color = 'var(--warning)';
  
  try {
    await Api.syncNotion();
    msgEl.innerHTML = '<span class="material-symbols-rounded" style="vertical-align:middle; color:var(--success)">check_circle</span> همگام‌سازی با موفقیت انجام شد.';
    msgEl.style.color = 'var(--success)';
    showToast('برنامه‌ها از ناتیون دریافت شدند', 'success');
  } catch (e) {
    msgEl.innerHTML = `<span class="material-symbols-rounded" style="vertical-align:middle; color:var(--danger)">error</span> خطا: ${e.message}`;
    msgEl.style.color = 'var(--danger)';
    showToast('خطا در همگام‌سازی: ' + e.message, 'error');
  }
}

async function loadAdminMembers(force = false) {
  if (adminLoading && !force) return;
  adminLoading = true;
  const listEl = document.getElementById('adminMembersList');
  if (listEl && !force) {
     listEl.innerHTML = `<div class="empty"><span class="material-symbols-rounded">hourglass_top</span><p>در حال بروزرسانی...</p></div>`;
  }
  
  try {
    adminMembers = await Api.adminListMembers();
    renderAdminMembersList();
  } catch (e) {
    showToast('خطا در بارگذاری اعضا: ' + e.message, 'error');
    adminMembers = [];
    renderAdminMembersList();
  } finally {
    adminLoading = false;
  }
}

function renderAdminMembersList() {
  const listEl = document.getElementById('adminMembersList');
  if (!listEl) return;

  if (!adminMembers || adminMembers.length === 0) {
    listEl.innerHTML = emptyState('group', 'عضوی یافت نشد', '');
    return;
  }

  listEl.innerHTML = adminMembers.map(m => `
    <div class="card" style="margin-top:12px; ${m.is_banned ? 'opacity:.6; border-color: var(--danger);' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-weight:800; font-size:14.5px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            ${escapeHtml(m.display_name)}
            ${m.role === 'admin' ? '<span class="chip" style="background:rgba(251,191,36,.15); color:var(--gold); font-size:10px;">ادمین</span>' : ''}
            ${m.is_banned ? '<span class="chip" style="background:rgba(239,68,68,.15); color:var(--danger); font-size:10px;">مسدود</span>' : ''}
          </div>
          <div style="font-size:11.5px; color:var(--text-3); margin-top:2px;">
            @${escapeHtml(m.username || 'بدون یوزرنیم')} 
            ${m.telegram_chat_id ? '· <span style="color:var(--success)">وصل به تلگرام ✓</span>' : '· <span style="color:var(--text-3)">قطع از تلگرام</span>'}
          </div>
        </div>
      </div>
      
      <div class="grid-2" style="margin-top:12px; background:rgba(0,0,0,0.02); padding:8px; border-radius:8px;">
        <div style="text-align:center;">
          <div style="font-weight:800; font-size:15px; color:var(--primary);">${formatMinutes(m.total_minutes_last_7d)}</div>
          <div style="font-size:10.5px; color:var(--text-3);">مطالعه (۷ روز)</div>
        </div>
        <div style="text-align:center;">
          <div style="font-weight:800; font-size:15px; color:var(--secondary);">${fa(m.total_tests_last_7d || 0)}</div>
          <div style="font-size:10.5px; color:var(--text-3);">تست (۷ روز)</div>
        </div>
      </div>

      ${m.role !== 'admin' ? `
      <div class="btn-row" style="margin-top:12px;">
        <button class="btn-sm ${m.is_banned ? 'btn-primary' : 'btn-danger-ghost'}" style="flex:1;" onclick="window.toggleMemberBan(${m.id}, ${!m.is_banned})">
          ${m.is_banned ? 'رفع مسدودیت' : 'مسدود کردن'}
        </button>
        <button class="btn-sm btn-ghost" style="flex:1; color:var(--text-3);" onclick="window.confirmDeleteMember(${m.id}, '${escapeHtml(m.display_name)}')">حذف کاربر</button>
      </div>` : ''}
    </div>
  `).join('');
}

// --- منطق نقاط بازیابی (Restore Points) ---
async function renderRestorePointsSection() {
  const container = document.getElementById('restorePointsContainer');
  const membersList = document.getElementById('adminMembersList');
  
  if (!container) return;

  if (container.style.display === 'block') {
    container.style.display = 'none';
    membersList.style.display = 'block';
    return;
  }

  container.style.display = 'block';
  membersList.style.display = 'none';
  container.innerHTML = `<div class="empty"><span class="material-symbols-rounded">hourglass_top</span><p>دریافت نقاط بازیابی...</p></div>`;

  try {
    restorePoints = await Api.listRestorePoints();
    
    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <h2 style="font-size:16px; font-weight:800; margin:0;">نقاط بازیابی</h2>
        <button class="btn-sm btn-primary" onclick="handleCreateRestorePoint()">
          <span class="material-symbols-rounded" style="font-size:16px;">add</span> ساخت نقطه جدید
        </button>
        <button class="icon-btn" onclick="renderRestorePointsSection()"><span class="material-symbols-rounded">close</span></button>
      </div>
    `;

    if (!restorePoints || restorePoints.length === 0) {
      html += emptyState('history', 'نقطه بازیابی وجود ندارد', 'قبل از تغییرات بزرگ یک نقطه بسازید.');
    } else {
      html += restorePoints.map(rp => `
        <div class="card" style="margin-bottom:10px; border-left: 4px solid var(--primary);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:800; font-size:14px;">${escapeHtml(rp.name || 'بدون نام')}</div>
              <div style="font-size:11px; color:var(--text-3); margin-top:4px;">
                ایجاد شده در: ${new Date(rp.created_at).toLocaleString('fa-IR')}
              </div>
            </div>
            <button class="btn-sm btn-danger-ghost" onclick="handleApplyRestorePoint(${rp.id})">
              بازگردانی
            </button>
          </div>
        </div>
      `).join('');
    }
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="empty" style="color:var(--danger)">خطا: ${e.message}</div>`;
  }
}

async function handleCreateRestorePoint() {
  const name = prompt('نام این نقطه بازیابی را وارد کنید (مثلا: قبل از سینک ناتیون):', 'Backup-' + new Date().toLocaleDateString('fa-IR').replace(/\//g,'-'));
  if (!name) return;

  try {
    showToast('در حال ساخت نقطه بازیابی...', 'info');
    await Api.createRestorePoint(name);
    showToast('نقطه بازیابی با موفقیت ساخته شد', 'success');
    renderRestorePointsSection(); // رفرش لیست
  } catch (e) {
    showToast('خطا در ساخت نقطه: ' + e.message, 'error');
  }
}

async function handleApplyRestorePoint(id) {
  if(!confirm('آیا مطمئن هستید؟ تمام داده‌های فعلی پاک شده و به حالت این نقطه برمی‌گردند. این عملیات غیرقابل بازگشت است.')) return;
  
  try {
    showToast('در حال بازگردانی داده‌ها...', 'info');
    await Api.applyRestorePoint(id);
    showToast('سیستم با موفقیت بازیابی شد', 'success');
    renderRestorePointsSection();
  } catch (e) {
    showToast('خطا در بازیابی: ' + e.message, 'error');
  }
}

// attaching functions to window for HTML onclick handlers
if (typeof window !== 'undefined') {
  window.toggleMemberBan = async (userId, banned) => {
    try {
      await Api.adminSetBan(userId, banned);
      showToast(banned ? 'کاربر مسدود شد' : 'مسدودیت برداشته شد');
      await loadAdminMembers(true);
    } catch (e) {
      showToast('خطا: ' + e.message, 'error');
    }
  };

  window.confirmDeleteMember = (userId, name) => {
    openDialog({
      icon: 'person_remove', 
      title: `حذف ${name}`,
      text: 'حساب این عضو و تمام برنامه/سوال/آزمون‌هاش برای همیشه حذف می‌شه. مطمئنی؟',
      confirmText: 'حذف کن', 
      confirmClass: 'btn-danger-ghost',
      onConfirm: async () => {
        try {
          await Api.adminDeleteMember(userId);
          closeDialog();
          showToast('عضو حذف شد');
          await loadAdminMembers(true);
        } catch (e) {
          showToast('خطا: ' + e.message, 'error');
        }
      }
    });
  };
}
