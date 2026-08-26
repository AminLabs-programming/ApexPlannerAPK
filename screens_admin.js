/* =========================================================================
   صفحه پنل ادمین (شامل مدیریت اعضا، ناتیون و ریستور پوینت‌ها)
   ========================================================================= */

let adminMembers = null;
let adminLoading = false;
let restorePoints = null;
let restorePointsLoading = false;

async function renderAdminScreen(root) {
  // بررسی دسترسی ادمین
  const user = Api.getCachedUser();
  if (!user || user.role !== 'admin') {
    root.innerHTML = `
      <div class="empty-state" style="margin-top: 50px;">
        <span class="material-symbols-rounded" style="font-size: 48px; color: var(--text-3);">lock</span>
        <h3 style="margin: 16px 0 8px;">دسترسی غیرمجاز</h3>
        <p style="color: var(--text-3); font-size: 14px;">این بخش فقط مخصوص مدیران سیستم است.</p>
        <button class="btn-primary" style="margin-top: 20px;" onclick="go('profile')">بازگشت به پروفایل</button>
      </div>
    `;
    return;
  }

  // ساختار اصلی صفحه
  root.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
      <button class="icon-btn" onclick="go('profile')" aria-label="بازگشت">
        <span class="material-symbols-rounded">arrow_forward</span>
      </button>
      <h1 class="page-title" style="margin:0;">پنل مدیریت</h1>
    </div>

    <!-- بخش ابزارهای سیستمی (ناتیون و ریستور) -->
    <div class="card" style="margin-bottom: 20px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1)); border: 1px solid rgba(59, 130, 246, 0.2);">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">
        <span class="material-symbols-rounded" style="color: var(--primary);">settings_input_component</span>
        ابزارهای سیستمی
      </h3>
      
      <!-- بخش ناتیون -->
      <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-weight: 600; font-size: 14px;">همگام‌سازی با Notion</span>
          <span class="chip" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; font-size: 10px;">Beta</span>
        </div>
        <p style="font-size: 12px; color: var(--text-3); margin: 0 0 10px 0;">دریافت برنامه‌ها از دیتابیس ناتیون بات تلگرام</p>
        <button id="btnSyncNotion" class="btn-primary" style="width: 100%; font-size: 13px; padding: 10px;" onclick="handleSyncNotion()">
          <span class="material-symbols-rounded" style="font-size: 16px; vertical-align: middle; margin-left: 4px;">sync</span>
          شروع همگام‌سازی
        </button>
      </div>

      <!-- بخش ریستور پوینت -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-weight: 600; font-size: 14px;">نقاط بازیابی (Restore)</span>
          <button class="icon-btn" style="width: 24px; height: 24px;" onclick="loadRestorePoints()" title="بارگذاری مجدد">
            <span class="material-symbols-rounded" style="font-size: 18px;">refresh</span>
          </button>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-sm btn-ghost" style="flex: 1; border: 1px dashed var(--text-3);" onclick="showCreateRestorePointDialog()">
            <span class="material-symbols-rounded" style="font-size: 16px; vertical-align: middle;">add</span>
            جدید
          </button>
          <button class="btn-sm btn-ghost" style="flex: 1;" onclick="showRestorePointsList()">
            <span class="material-symbols-rounded" style="font-size: 16px; vertical-align: middle;">history</span>
            لیست بکاپ‌ها
          </button>
        </div>
      </div>
    </div>

    <!-- بخش مدیریت اعضا -->
    <h3 style="margin: 0 0 12px 0; font-size: 16px;">اعضای گروه</h3>
    <div id="adminMembersList">
      <div class="empty-state">
        <span class="material-symbols-rounded" style="font-size: 32px; color: var(--text-3);">hourglass_top</span>
        <p style="margin-top: 8px; color: var(--text-3);">در حال بارگذاری...</p>
      </div>
    </div>
  `;

  // بارگذاری داده‌ها
  loadAdminMembers();
}

// --- توابع مربوط به اعضا ---

async function loadAdminMembers() {
  adminLoading = true;
  const listEl = document.getElementById('adminMembersList');
  if (!listEl) return;
  
  // نمایش لودینگ فقط اگر لیست خالی است
  if (!adminMembers) {
    listEl.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded" style="font-size: 32px; color: var(--text-3);">hourglass_top</span><p style="margin-top: 8px; color: var(--text-3);">در حال بارگذاری...</p></div>`;
  }

  try {
    adminMembers = await Api.adminListMembers();
    renderAdminMembersListInto(listEl);
  } catch (e) {
    showToast('خطا در دریافت لیست اعضا: ' + e.message, 'error');
    adminMembers = [];
    renderAdminMembersListInto(listEl);
  } finally {
    adminLoading = false;
  }
}

function renderAdminMembersListInto(listEl) {
  if (!listEl) return;

  if (!adminMembers || adminMembers.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded" style="font-size: 32px; color: var(--text-3);">group_off</span><p style="margin-top: 8px; color: var(--text-3);">عضوی یافت نشد</p></div>`;
    return;
  }

  listEl.innerHTML = adminMembers.map(m => `
    <div class="card" style="margin-top:12px; ${m.is_banned ? 'opacity:.6; border-color: rgba(239, 68, 68, 0.3);' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="flex: 1;">
          <div style="font-weight:800; font-size:14.5px; display:flex; align-items:center; gap:6px; flex-wrap: wrap;">
            ${escapeHtml(m.display_name)}
            ${m.role === 'admin' ? '<span class="chip" style="background:rgba(251,191,36,.15); color:var(--gold); font-size: 10px;">ادمین</span>' : ''}
            ${m.is_banned ? '<span class="chip" style="background:rgba(239,68,68,.15); color:var(--danger); font-size: 10px;">مسدود</span>' : ''}
          </div>
          <div style="font-size:11.5px; color:var(--text-3); margin-top:4px;">
            @${escapeHtml(m.username || '-')} 
            ${m.telegram_chat_id ? '· <span style="color: var(--success);">متصل به تلگرام ✓</span>' : '· <span style="color: var(--text-3);">عدم اتصال</span>'}
          </div>
        </div>
      </div>
      
      <div class="grid-2" style="margin-top:12px; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 8px;">
        <div style="text-align:center;">
          <div style="font-weight:800; font-size:15px; color: var(--primary);">${formatMinutes(m.total_minutes_last_7d)}</div>
          <div style="font-size:10.5px; color:var(--text-3);">مطالعه (۷ روز)</div>
        </div>
        <div style="text-align:center;">
          <div style="font-weight:800; font-size:15px; color: var(--accent);">${fa(m.total_tests_last_7d || 0)}</div>
          <div style="font-size:10.5px; color:var(--text-3);">تست (۷ روز)</div>
        </div>
      </div>

      ${m.role !== 'admin' ? `
      <div class="btn-row" style="margin-top:12px;">
        <button class="btn-sm ${m.is_banned ? 'btn-primary' : 'btn-danger-ghost'}" style="flex:1;" onclick="toggleMemberBan(${m.id}, ${!m.is_banned})">
          ${m.is_banned ? 'رفع مسدودیت' : 'مسدود کردن'}
        </button>
        <button class="btn-sm btn-ghost" style="flex:1; color: var(--danger);" onclick="confirmDeleteMember(${m.id}, '${escapeHtml(m.display_name)}')">حذف کاربر</button>
      </div>` : ''}
    </div>
  `).join('');
}

async function toggleMemberBan(userId, banned) {
  if (!confirm(`آیا از ${banned ? 'رفع مسدودیت' : 'مسدود کردن'} این کاربر مطمئن هستید؟`)) return;
  try {
    await Api.adminSetBan(userId, banned);
    showToast(banned ? 'کاربر مسدود شد' : 'مسدودیت کاربر برداشته شد');
    await loadAdminMembers();
  } catch (e) {
    showToast('خطا: ' + e.message, 'error');
  }
}

function confirmDeleteMember(userId, name) {
  openDialog({
    icon: 'warning', 
    iconColor: 'var(--danger)',
    title: `حذف ${name}`,
    text: '⚠️ هشدار جدی: با این کار حساب کاربری، تمام برنامه‌ریزی‌ها، سوالات و آزمون‌های این شخص برای همیشه پاک می‌شود. این عملیات غیرقابل بازگشت است.',
    confirmText: 'بله، حذف کن', 
    confirmClass: 'btn-danger-ghost',
    cancelText: 'انصراف',
    onConfirm: async () => {
      try {
        await Api.adminDeleteMember(userId);
        closeDialog();
        showToast('کاربر با موفقیت حذف شد');
        await loadAdminMembers();
      } catch (e) {
        showToast('خطا در حذف: ' + e.message, 'error');
      }
    }
  });
}

// --- توابع مربوط به Notion ---

async function handleSyncNotion() {
  const btn = document.getElementById('btnSyncNotion');
  const originalContent = btn.innerHTML;
  
  try {
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-rounded" style="font-size: 16px; vertical-align: middle; margin-left: 4px; animation: spin 1s linear infinite;">sync</span> در حال همگام‌سازی...`;
    
    await Api.syncNotion();
    
    showToast('همگام‌سازی با موفقیت انجام شد! برنامه‌ها از ناتیون اضافه شدند.', 'success');
    // رفرش کردن صفحه پلن اگر کاربر در آنجا بود (اختیاری)
  } catch (e) {
    showToast('خطا در همگام‌سازی: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalContent;
  }
}

// --- توابع مربوط به Restore Points ---

async function loadRestorePoints() {
  restorePointsLoading = true;
  try {
    restorePoints = await Api.listRestorePoints();
    showRestorePointsList();
  } catch (e) {
    showToast('خطا در دریافت لیست بکاپ‌ها: ' + e.message, 'error');
  } finally {
    restorePointsLoading = false;
  }
}

function showCreateRestorePointDialog() {
  let nameInput = '';
  openDialog({
    icon: 'save',
    title: 'ایجاد نقطه بازیابی جدید',
    text: 'یک نام توصیفی برای این بکاپ وارد کنید (مثلاً: قبل از آپدیت ناتیون).',
    inputPlaceholder: 'نام بکاپ...',
    inputType: 'text',
    confirmText: 'ساخت بکاپ',
    onInput: (val) => { nameInput = val; },
    onConfirm: async () => {
      if (!nameInput.trim()) {
        showToast('لطفاً یک نام وارد کنید', 'error');
        return false; // جلوگیری از بسته شدن دیالوگ
      }
      try {
        showToast('در حال ساخت بکاپ...', 'info');
        await Api.createRestorePoint(nameInput);
        closeDialog();
        showToast('نقطه بازیابی با موفقیت ساخته شد', 'success');
        loadRestorePoints();
      } catch (e) {
        showToast('خطا: ' + e.message, 'error');
        return false;
      }
    }
  });
}

function showRestorePointsList() {
  if (restorePointsLoading) {
    showToast('در حال بارگذاری...', 'info');
    loadRestorePoints();
    return;
  }

  if (!restorePoints || restorePoints.length === 0) {
    showToast('هیچ نقطه بازیابی وجود ندارد.', 'info');
    return;
  }

  const listHtml = restorePoints.map(rp => `
    <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-weight: bold; font-size: 14px;">${escapeHtml(rp.name)}</div>
        <div style="font-size: 11px; color: var(--text-3); margin-top: 4px;">
          تاریخ: ${new Date(rp.created_at).toLocaleDateString('fa-IR')} 
          <br>توضیحات: ${rp.description || 'بدون توضیح'}
        </div>
      </div>
      <button class="btn-sm btn-danger-ghost" onclick="applyRestorePointConfirm(${rp.id}, '${escapeHtml(rp.name)}')">
        بازگردانی
      </button>
    </div>
  `).join('');

  openDialog({
    icon: 'history',
    title: 'لیست نقاط بازیابی',
    text: `<div style="max-height: 300px; overflow-y: auto; text-align: right;">${listHtml}</div>`,
    confirmText: 'بستن',
    hideCancel: true,
    onConfirm: () => closeDialog()
  });
}

function applyRestorePointConfirm(id, name) {
  openDialog({
    icon: 'warning',
    iconColor: 'var(--danger)',
    title: `بازگردانی به "${name}"`,
    text: '⚠️ آیا مطمئن هستید؟ تمام تغییرات بعد از این تاریخ حذف خواهند شد و داده‌ها به حالت آن زمان برمی‌گردند.',
    confirmText: 'بله، بازگردانی کن',
    confirmClass: 'btn-danger-ghost',
    cancelText: 'انصراف',
    onConfirm: async () => {
      try {
        closeDialog(); // بستن دیالوگ لیست
        showToast('در حال بازگردانی اطلاعات...', 'info');
        await Api.applyRestorePoint(id);
        showToast('سیستم با موفقیت به حالت قبل بازگردانده شد.', 'success');
        // رفرش کلی اپلیکیشن ممکن است لازم باشد
        setTimeout(() => location.reload(), 2000);
      } catch (e) {
        showToast('خطا در بازگردانی: ' + e.message, 'error');
      }
    }
  });
}
