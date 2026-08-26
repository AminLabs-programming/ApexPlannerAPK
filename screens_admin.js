if (DB.profile.role !== 'admin') {
    root.innerHTML = emptyState('lock', 'دسترسی نداری', 'این بخش فقط برای ادمین گروهه');
    return;
  }

  root.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
      <button class="icon-btn" onclick="go('profile')"><span class="material-symbols-rounded">arrow_forward</span></button>
      <h1 class="page-title" style="margin:0;">پنل ادمین</h1>
    </div>
    <p class="page-sub">مدیریت سیستم و اعضا</p>
    
    <!-- بخش جدید: ابزارهای ناتیون و بازیابی -->
    <div class="card" style="margin-bottom:16px; background: linear-gradient(135deg, rgba(129, 140, 248, 0.1), rgba(129, 140, 248, 0.05)); border: 1px solid rgba(129, 140, 248, 0.2);">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
        <span class="material-symbols-rounded" style="color:var(--primary);">database</span>
        <h3 style="margin:0; font-size:14px; color:var(--primary);">ابزارهای پیشرفته</h3>
      </div>
      
      <div class="btn-row" style="margin-bottom:8px;">
        <button class="btn-sm btn-primary" style="flex:1;" onclick="syncWithNotion()">
          <span class="material-symbols-rounded" style="font-size:16px; vertical-align:middle; margin-left:4px;">sync</span>
          همگام‌سازی با Notion
        </button>
      </div>
      
      <div class="btn-row">
        <button class="btn-sm btn-ghost" style="flex:1; border:1px solid var(--border);" onclick="showRestorePoints()">
          <span class="material-symbols-rounded" style="font-size:16px; vertical-align:middle; margin-left:4px;">history</span>
          نقاط بازیابی
        </button>
        <button class="btn-sm btn-ghost" style="flex:1; border:1px solid var(--border);" onclick="createNewRestorePoint()">
          <span class="material-symbols-rounded" style="font-size:16px; vertical-align:middle; margin-left:4px;">add_task</span>
          ساخت Restore Point
        </button>
      </div>
    </div>

    <!-- لیست اعضا (کد قبلی) -->
    <h3 style="font-size:13px; color:var(--text-2); margin:16px 0 8px;">اعضای گروه</h3>
    <div id="adminMembersList"></div>
  `;

  const listEl = root.querySelector('#adminMembersList');
  if (adminLoading) {
    listEl.innerHTML = `<div class="empty"><span class="material-symbols-rounded">hourglass_top</span><p>در حال بارگذاری...</p></div>`;
  }

  loadAdminMembers().then(() => {
    if (currentScreen === 'admin') renderAdminMembersList();
  });

  if (adminMembers) renderAdminMembersListInto(listEl);
};

// ---- توابع جدید ناتیون و ریستور ----

async function syncWithNotion() {
  openDialog({
    icon: 'sync',
    title: 'همگام‌سازی با Notion',
    text: 'آیا مطمئن هستید؟ تمام داده‌های جدید از دیتابیس ناتیون خوانده شده و به اپلیکیشن اضافه می‌شوند. این عملیات ممکن است چند ثانیه طول بکشد.',
    confirmText: 'شروع همگام‌سازی',
    onConfirm: async () => {
      closeDialog();
      const loadingId = showToast('در حال ارتباط با ناتیون...', 'loading');
      try {
        await Api.syncNotion();
        dismissToast(loadingId);
        showToast('همگام‌سازی با موفقیت انجام شد!', 'success');
        // رفرش کردن صفحه اصلی اگر کاربر بخواهد
      } catch (e) {
        dismissToast(loadingId);
        showToast('خطا در همگام‌سازی: ' + e.message, 'error');
      }
    }
  });
}

async function createNewRestorePoint() {
  const name = prompt("نام این نقطه بازیابی را وارد کنید (مثلاً: قبل از آپدیت ناتیون):", "Backup_" + new Date().toLocaleDateString('fa-IR').replace(/\//g, '-'));
  if (!name) return;

  const loadingId = showToast('در حال ساخت نقطه بازیابی...', 'loading');
  try {
    await Api.createRestorePoint(name);
    dismissToast(loadingId);
    showToast('نقطه بازیابی با موفقیت ساخته شد', 'success');
  } catch (e) {
    dismissToast(loadingId);
    showToast('خطا: ' + e.message, 'error');
  }
}

async function showRestorePoints() {
  const loadingId = showToast('در حال دریافت لیست...', 'loading');
  try {
    const points = await Api.listRestorePoints();
    dismissToast(loadingId);
    
    if (!points || points.length === 0) {
      showToast('هیچ نقطه بازیابی یافت نشد', 'info');
      return;
    }

    // ساخت لیست نمایشی
    const listHtml = points.map(p => `
      <div style="padding:12px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:bold; font-size:13px;">${escapeHtml(p.name)}</div>
          <div style="font-size:11px; color:var(--text-3); margin-top:2px;">
            ${new Date(p.created_at).toLocaleString('fa-IR')}
            <br>
            <span style="color:${p.is_safe ? 'var(--success)' : 'var(--danger)'}">
              ${p.is_safe ? 'سالم' : 'احتمال مشکل'}
            </span>
          </div>
        </div>
        <button class="btn-sm btn-danger-ghost" onclick='applyRestorePoint(${p.id}, "${escapeHtml(p.name)}")'>
          بازگردانی
        </button>
      </div>
    `).join('');

    openDialog({
      icon: 'history',
      title: 'نقاط بازیابی',
      text: `<div style="max-height:300px; overflow-y:auto; width:100%;">${listHtml}</div>`,
      confirmText: 'بستن',
      confirmClass: 'btn-ghost',
      onConfirm: () => closeDialog()
    });

  } catch (e) {
    dismissToast(loadingId);
    showToast('خطا در دریافت لیست: ' + e.message, 'error');
  }
}

window.applyRestorePoint = function(id, name) {
  openDialog({
    icon: 'warning',
    title: 'تایید بازگردانی',
    text: `آیا مطمئن هستید که می‌خواهید کل برنامه را به وضعیت "${name}" بازگردانید؟ <br><strong style="color:var(--danger)">تمام تغییرات بعد از این تاریخ حذف خواهند شد!</strong>`,
    confirmText: 'بله، بازگردانی کن',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      closeDialog();
      const loadingId = showToast('در حال بازگردانی اطلاعات...', 'loading');
      try {
        await Api.applyRestorePoint(id);
        dismissToast(loadingId);
        showToast('سیستم با موفقیت بازگردانی شد', 'success');
        setTimeout(() => location.reload(), 2000); // ریلود صفحه برای اعمال تغییرات
      } catch (e) {
        dismissToast(loadingId);
        showToast('خطا در بازگردانی: ' + e.message, 'error');
      }
    }
  });
};

// ---- توابع قبلی (بدون تغییر) ----

async function loadAdminMembers() {
  adminLoading = true;
  try {
    adminMembers = await Api.adminListMembers();
  } catch (e) {
    showToast('خطا در بارگذاری اعضا: ' + e.message, 'error');
    adminMembers = [];
  }
  adminLoading = false;
}

function renderAdminMembersList() {
  const listEl = document.getElementById('adminMembersList');
  if (listEl) renderAdminMembersListInto(listEl);
}

function renderAdminMembersListInto(listEl) {
  if (!adminMembers || !adminMembers.length) {
    listEl.innerHTML = emptyState('group', 'عضوی پیدا نشد', '');
    return;
  }
  listEl.innerHTML = adminMembers.map(m => `
    <div class="card" style="margin-top:12px; ${m.is_banned ? 'opacity:.6;' : ''}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-weight:800; font-size:14.5px; display:flex; align-items:center; gap:6px;">
            ${escapeHtml(m.display_name)}
            ${m.role === 'admin' ? '<span class="chip" style="background:rgba(251,191,36,.15); color:var(--gold);">ادمین</span>' : ''}
            ${m.is_banned ? '<span class="chip" style="background:rgba(239,68,68,.15); color:var(--danger);">مسدود</span>' : ''}
          </div>
          <div style="font-size:11.5px; color:var(--text-3); margin-top:2px;">@${escapeHtml(m.username)} ${m.telegram_chat_id ? '· وصل به تلگرام ✓' : '· به تلگرام وصل نیست'}</div>
        </div>
      </div>
      <div class="grid-2" style="margin-top:12px;">
        <div style="text-align:center;">
          <div style="font-weight:800; font-size:15px;">${formatMinutes(m.total_minutes_last_7d)}</div>
          <div style="font-size:10.5px; color:var(--text-3);">مطالعه ۷ روز اخیر</div>
        </div>
        <div style="text-align:center;">
          <div style="font-weight:800; font-size:15px;">${fa(m.total_tests_last_7d)}</div>
          <div style="font-size:10.5px; color:var(--text-3);">تست ۷ روز اخیر</div>
        </div>
      </div>
      ${m.role !== 'admin' ? `
      <div class="btn-row" style="margin-top:12px;">
        <button class="btn-sm ${m.is_banned ? 'btn-primary' : 'btn-danger-ghost'}" style="flex:1;" onclick="toggleMemberBan(${m.id}, ${!m.is_banned})">
          ${m.is_banned ? 'رفع مسدودیت' : 'مسدود کردن'}
        </button>
        <button class="btn-sm btn-ghost" style="flex:1;" onclick="confirmDeleteMember(${m.id}, '${escapeHtml(m.display_name)}')">حذف کامل</button>
      </div>` : ''}
    </div>
  `).join('');
}

async function toggleMemberBan(userId, banned) {
  try {
    await Api.adminSetBan(userId, banned);
    showToast(banned ? 'کاربر مسدود شد' : 'مسدودیت برداشته شد');
    await loadAdminMembers();
    renderAdminMembersList();
  } catch (e) {
    showToast('خطا: ' + e.message, 'error');
  }
}

function confirmDeleteMember(userId, name) {
  openDialog({
    icon: 'person_remove', title: `حذف ${name}`,
    text: 'حساب این عضو و تمام برنامه/سوال/آزمون‌هاش برای همیشه حذف می‌شه. مطمئنی؟',
    confirmText: 'حذف کن', confirmClass: 'btn-danger-ghost',
    onConfirm: async () => {
      try {
        await Api.adminDeleteMember(userId);
        closeDialog();
        showToast('عضو حذف شد');
        await loadAdminMembers();
        renderAdminMembersList();
      } catch (e) {
        showToast('خطا: ' + e.message, 'error');
      }
    }
  });
}
