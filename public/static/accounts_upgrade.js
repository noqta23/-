// ============================================================================
// NUKHAA (01) PLATFORM — UNIFIED ACCOUNTS, SETTINGS, PRIVACY & SESSIONS UPGRADE
// ============================================================================
(function () {
  'use strict';

  // ─── 1. Fix Confirmation Modal & Popup Z-Index Globally ───
  const styleEl = document.createElement('style');
  styleEl.id = 'nukhaa-accounts-upgrade-styles';
  styleEl.textContent = `
    #modal-confirm-action {
      z-index: 99999 !important;
    }
    #modal-change-password,
    #modal-owner-login,
    #modal-multi-accounts,
    #modal-user-profile {
      z-index: 96000 !important;
    }
    .settings-drawer {
      z-index: 9000 !important;
    }
    #top-bar-accounts-dropdown {
      z-index: 95000 !important;
      backdrop-filter: blur(22px) saturate(180%);
      -webkit-backdrop-filter: blur(22px) saturate(180%);
      background: rgba(22, 24, 32, 0.92) !important;
      border: 1px solid rgba(201, 149, 108, 0.35) !important;
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.55) !important;
    }
    body.light-mode #top-bar-accounts-dropdown {
      background: rgba(255, 255, 255, 0.95) !important;
      border: 1px solid rgba(201, 149, 108, 0.4) !important;
    }
    #top-bar-user-btn,
    #drawer-avatar,
    #settings-avatar {
      position: relative !important;
      overflow: hidden !important;
      border-radius: 50% !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 !important;
    }
    #top-bar-user-btn img,
    #drawer-avatar img,
    #settings-avatar img {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      border-radius: 50% !important;
      display: block !important;
      flex-shrink: 0 !important;
    }
    .nk-top-tabs {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      padding: 6px;
      border-radius: 14px;
      background: rgba(128, 128, 128, 0.09);
      border: 1px solid rgba(201, 149, 108, 0.22);
      margin-bottom: 10px;
      position: sticky;
      top: 0;
      z-index: 15;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
    .nk-top-tab-btn {
      height: 36px;
      border-radius: 10px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.18s ease;
    }
    .nk-top-tab-btn:hover {
      color: var(--text);
      background: rgba(201, 149, 108, 0.1);
    }
    .nk-top-tab-btn.active {
      background: linear-gradient(135deg, var(--accent), var(--accent-dark));
      color: #fff;
      box-shadow: 0 3px 10px rgba(201, 149, 108, 0.32);
    }
    .nk-sub-tabs {
      display: flex;
      gap: 6px;
      margin-bottom: 10px;
    }
    .nk-sub-tab-btn {
      flex: 1;
      height: 32px;
      border-radius: 10px;
      border: 1px solid rgba(128, 128, 128, 0.2);
      background: rgba(128, 128, 128, 0.06);
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.18s ease;
    }
    .nk-sub-tab-btn.active {
      border-color: var(--accent);
      background: rgba(201, 149, 108, 0.16);
      color: var(--text);
    }
    .nk-glass-card {
      padding: 10px;
      border-radius: 13px;
      background: rgba(128, 128, 128, 0.06);
      border: 1px solid rgba(128, 128, 128, 0.16);
      margin-bottom: 8px;
      box-sizing: border-box;
    }
    .nk-adopt-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid rgba(128, 128, 128, 0.25);
      background: rgba(128, 128, 128, 0.08);
      color: var(--text-muted);
      transition: all 0.15s ease;
    }
    .nk-adopt-chip.active {
      border-color: #26a69a;
      background: rgba(38, 166, 154, 0.18);
      color: #26a69a;
    }
    .nk-field-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 9px;
      background: rgba(0, 0, 0, 0.12);
      font-size: 11px;
      min-width: 0;
    }
    body.light-mode .nk-field-row {
      background: rgba(0, 0, 0, 0.04);
    }
  `;
  document.head.appendChild(styleEl);

  // ─── 2. Persistent Device & Session Identifiers ───
  function getDeviceFingerprint() {
    let fp = localStorage.getItem('nukhaa_device_fp');
    if (!fp) {
      fp = 'dfp_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem('nukhaa_device_fp', fp);
    }
    return fp;
  }

  function getSessionId() {
    let sid = localStorage.getItem('nukhaa_session_id');
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem('nukhaa_session_id', sid);
    }
    return sid;
  }

  // Attach X-Session-Id and X-Device-Fp headers automatically to API requests
  const origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.startsWith('/api/')) {
        init = init || {};
        const headers = new Headers(init.headers || {});
        if (!headers.has('X-Session-Id')) headers.set('X-Session-Id', getSessionId());
        if (!headers.has('X-Device-Fp')) headers.set('X-Device-Fp', getDeviceFingerprint());
        init.headers = headers;
      }
    } catch (e) {}
    return origFetch(input, init);
  };

  // ─── 3. Fix Cropped Avatar Next to First Letter Bug Permanently ───
  window._setAvatarWithoutFlicker = function (containerEl, imgUrl, fallbackHtml, letterSize = '15px') {
    if (!containerEl) return;
    const renderFallback = () => {
      containerEl.dataset.avatarCurrentSrc = '__fallback__';
      containerEl.innerHTML = fallbackHtml || `<span style="font-size:${letterSize};font-weight:700;color:#fff;">؟</span>`;
    };
    if (!imgUrl) {
      renderFallback();
      return;
    }
    const existingImg = containerEl.querySelector('img');
    if (existingImg && containerEl.dataset.avatarCurrentSrc === imgUrl && containerEl.childNodes.length === 1) {
      return;
    }
    containerEl.dataset.avatarCurrentSrc = imgUrl;
    containerEl.innerHTML = '';
    const img = document.createElement('img');
    img.src = imgUrl;
    img.alt = '';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;flex-shrink:0;';
    img.onerror = renderFallback;
    containerEl.appendChild(img);
  };

  // ─── 4. Full Server User Preferences Sync ───
  const origApplyPrefs = window._applyServerUserPreferences;
  window._applyServerUserPreferences = function (u) {
    if (!u) return;
    if (typeof origApplyPrefs === 'function') {
      try { origApplyPrefs(u); } catch (e) {}
    }
    const saved = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const copyKeys = [
      'id', 'platform_id', 'telegram_id', 'primary_bot_telegram_id', 'telegram_linked', 'telegram_unlinked',
      'tg_first_name', 'tg_last_name', 'tg_username', 'tg_phone', 'tg_bio', 'tg_birth_date', 'tg_photo_file_id',
      'selected_tg_photo_file_id', 'telegram_accounts',
      'google_id', 'google_linked', 'google_unlinked', 'google_email', 'google_given_name', 'google_family_name',
      'google_name', 'google_nickname', 'google_photo_url', 'google_phone', 'google_birth_date', 'google_gender',
      'google_bio', 'google_organization', 'google_occupation', 'google_address', 'google_locale', 'google_urls',
      'google_accounts',
      'field_sources', 'name_source', 'username_source', 'photo_source', 'email_source', 'phone_source', 'bio_source',
      'custom_first_name', 'custom_last_name', 'custom_name', 'custom_username', 'custom_email', 'custom_phone',
      'custom_birth_date', 'custom_gender', 'custom_bio', 'custom_bio_msg_id',
      'first_name', 'last_name', 'display_name', 'username', 'email', 'phone', 'birth_date', 'gender', 'bio',
      'email_verified', 'phone_verified', 'contact_verified',
      'has_custom_photo', 'custom_photo_file_id', 'custom_photos', 'hidden_photo_ids',
      'has_password', 'is_registered_account', 'privacy',
      'sessions', 'blocked_devices', 'deletion_scheduled_at', 'deletion_execute_at', 'deletion_execute_ts'
    ];
    copyKeys.forEach((k) => {
      if (u[k] !== undefined) saved[k] = u[k];
    });
    if (saved.platform_id) {
      saved.platform_id = String(saved.platform_id).replace(/^NK-/i, '01-');
    }
    localStorage.setItem('appSettings', JSON.stringify(saved));
    window._latestUserObj = u;
    if (typeof window._saveAccountToMultiList === 'function' && u.id) {
      try { window._saveAccountToMultiList(u); } catch (e) {}
    }
  };

  // Override _effectiveName and _effectiveUsername to respect granular field_sources
  window._effectiveName = function () {
    const s = JSON.parse(localStorage.getItem('appSettings') || '{}');
    if (s.display_name && String(s.display_name).trim()) return String(s.display_name).trim();
    const full = [s.first_name, s.last_name].filter(Boolean).join(' ').trim();
    return full || s.custom_name || s.tg_first_name || s.google_given_name || '';
  };

  window._effectiveUsername = function () {
    const s = JSON.parse(localStorage.getItem('appSettings') || '{}');
    return String(s.username || s.custom_username || s.tg_username || '').replace(/^@/, '').trim();
  };

  // ─── 5. Top-Bar Avatar Long-Press / Right-Click Dropdown Menu ───
  let _lpTimer = null;
  let _lpTriggered = false;

  window.toggleTopBarAccountsDropdown = function (ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    const dd = document.getElementById('top-bar-accounts-dropdown');
    if (!dd) return;
    if (dd.style.display === 'block') {
      dd.style.display = 'none';
      return;
    }
    renderTopBarAccountsDropdown();
    dd.style.display = 'block';
  };

  function renderTopBarAccountsDropdown() {
    const dd = document.getElementById('top-bar-accounts-dropdown');
    if (!dd) return;
    const s = JSON.parse(localStorage.getItem('appSettings') || '{}');
    if (typeof userId !== 'undefined' && userId && typeof _saveAccountToMultiList === 'function') {
      _saveAccountToMultiList({
        id: userId,
        platform_id: s.platform_id,
        display_name: _effectiveName() || s.display_name || 'مستخدم',
        username: _effectiveUsername(),
        role: typeof userRole !== 'undefined' ? userRole : 'user',
      });
    }
    const accounts = typeof _getSavedAccountsList === 'function' ? _getSavedAccountsList() : [];
    const curUid = typeof userId !== 'undefined' ? String(userId || '') : '';
    const ts = typeof _pageLoadTs !== 'undefined' ? _pageLoadTs : Date.now();

    const rowsHtml = accounts.length
      ? accounts.map((acc) => {
          const aid = String(acc.id || '');
          const isCur = aid === curUid;
          const pid = String(acc.platform_id || `01-${aid.slice(0, 6).toUpperCase()}`).replace(/^NK-/i, '01-');
          const letter = ((acc.display_name || acc.username || '؟')[0] || '؟').toUpperCase();
          return `
            <div onclick="window._switchAccountFromDropdown('${escHtml(aid)}')" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 8px;border-radius:11px;cursor:pointer;background:${isCur ? 'rgba(201,149,108,0.18)' : 'transparent'};border:1px solid ${isCur ? 'rgba(201,149,108,0.45)' : 'transparent'};margin-bottom:4px;transition:background 0.15s;">
              <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
                <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-dark));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;overflow:hidden;flex-shrink:0;">
                  <img src="/api/user/photo/${encodeURIComponent(aid)}?v=${ts}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" onerror="this.remove();this.parentElement.textContent='${escHtml(letter)}';">
                </div>
                <div style="min-width:0;flex:1;">
                  <div style="font-size:12px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:5px;">
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(acc.display_name || 'مستخدم')}</span>
                    ${isCur ? '<i class="fas fa-circle-check" style="color:#26a69a;font-size:10px;" title="الحساب النشط"></i>' : ''}
                  </div>
                  <div style="font-size:10px;color:var(--text-muted);direction:ltr;text-align:right;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    ${acc.username ? '@' + escHtml(acc.username) + ' • ' : ''}${escHtml(pid)}
                  </div>
                </div>
              </div>
              <button type="button" onclick="event.stopPropagation();window._removeAccountFromDropdown('${escHtml(aid)}')" title="إزالة الحساب من القائمة" style="width:24px;height:24px;border-radius:50%;background:rgba(239,68,68,0.12);color:#ef4444;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;">
                <i class="fas fa-xmark" style="font-size:10px;"></i>
              </button>
            </div>
          `;
        }).join('')
      : `<div style="text-align:center;padding:10px;font-size:11px;color:var(--text-muted);">لا توجد حسابات محفوظة</div>`;

    dd.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:2px 4px 6px;border-bottom:1px solid rgba(128,128,128,0.16);margin-bottom:6px;">
        <span style="font-size:11px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:5px;"><i class="fas fa-users"></i> تبديل الحساب</span>
        <button type="button" onclick="document.getElementById('top-bar-accounts-dropdown').style.display='none';openSettingsDrawer();" title="فتح الإعدادات" style="width:24px;height:24px;border-radius:7px;border:none;background:rgba(128,128,128,0.12);color:var(--text);cursor:pointer;display:flex;align-items:center;justify-content:center;">
          <i class="fas fa-gear" style="font-size:11px;"></i>
        </button>
      </div>
      <div style="max-height:220px;overflow-y:auto;">
        ${rowsHtml}
      </div>
      <div style="display:flex;gap:6px;padding-top:6px;margin-top:4px;border-top:1px solid rgba(128,128,128,0.16);">
        <button type="button" class="btn btn-primary btn-sm" style="flex:1;font-size:11px;padding:6px 8px;display:flex;align-items:center;justify-content:center;gap:5px;" onclick="document.getElementById('top-bar-accounts-dropdown').style.display='none';openAuthModal('login');" title="إضافة حساب موجود">
          <i class="fas fa-plus"></i> <i class="fas fa-right-to-bracket"></i>
        </button>
        <button type="button" class="btn btn-secondary btn-sm" style="flex:1;font-size:11px;padding:6px 8px;display:flex;align-items:center;justify-content:center;gap:5px;" onclick="document.getElementById('top-bar-accounts-dropdown').style.display='none';openAuthModal('register');" title="إنشاء حساب 01 جديد">
          <i class="fas fa-user-plus"></i>
        </button>
      </div>
    `;
  }

  window._switchAccountFromDropdown = function (targetId) {
    const dd = document.getElementById('top-bar-accounts-dropdown');
    if (dd) dd.style.display = 'none';
    if (typeof switchActiveAccount === 'function') {
      switchActiveAccount(targetId);
    }
  };

  window._removeAccountFromDropdown = function (targetId) {
    const cleanId = String(targetId || '').trim();
    const list = (typeof _getSavedAccountsList === 'function' ? _getSavedAccountsList() : []).filter((a) => String(a.id) !== cleanId);
    localStorage.setItem('nukhaa_saved_accounts', JSON.stringify(list));
    if (typeof userId !== 'undefined' && cleanId === String(userId)) {
      const dd = document.getElementById('top-bar-accounts-dropdown');
      if (dd) dd.style.display = 'none';
      if (typeof logoutCurrentAccount === 'function') logoutCurrentAccount();
    } else {
      renderTopBarAccountsDropdown();
      if (document.getElementById('settings-drawer')?.classList.contains('open')) {
        window._populateDrawer();
      }
    }
  };

  function bindTopBarDropdownLongPress() {
    const oldBtn = document.getElementById('top-bar-user-btn');
    if (!oldBtn || oldBtn.dataset.nkDropdownBound === '1') return;
    // Clone button to remove old long-press listener that opened modal-multi-accounts
    const btn = oldBtn.cloneNode(true);
    btn.dataset.nkDropdownBound = '1';
    oldBtn.parentNode.replaceChild(btn, oldBtn);

    const startPress = () => {
      _lpTriggered = false;
      if (_lpTimer) clearTimeout(_lpTimer);
      _lpTimer = setTimeout(() => {
        _lpTriggered = true;
        window.toggleTopBarAccountsDropdown();
      }, 420);
    };
    const cancelPress = () => {
      if (_lpTimer) {
        clearTimeout(_lpTimer);
        _lpTimer = null;
      }
    };

    btn.addEventListener('touchstart', startPress, { passive: true });
    btn.addEventListener('touchend', cancelPress, { passive: true });
    btn.addEventListener('touchmove', cancelPress, { passive: true });
    btn.addEventListener('mousedown', (e) => { if (e.button === 0) startPress(); });
    btn.addEventListener('mouseup', cancelPress);
    btn.addEventListener('mouseleave', cancelPress);
    btn.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      cancelPress();
      window.toggleTopBarAccountsDropdown(e);
    };
    btn.onclick = (e) => {
      if (_lpTriggered) {
        _lpTriggered = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const dd = document.getElementById('top-bar-accounts-dropdown');
      if (dd) dd.style.display = 'none';
      if (typeof openSettingsDrawer === 'function') openSettingsDrawer();
    };
    if (typeof _updateDrawerHeader === 'function') _updateDrawerHeader();
  }

  document.addEventListener('click', (e) => {
    const dd = document.getElementById('top-bar-accounts-dropdown');
    const btn = document.getElementById('top-bar-user-btn');
    if (dd && dd.style.display === 'block' && !dd.contains(e.target) && (!btn || !btn.contains(e.target))) {
      dd.style.display = 'none';
    }
  });

  // ─── 6. Unified Google OAuth (Single Popup for Profile + People + Drive + Classroom) ───
  const UNIFIED_GOOGLE_SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/user.birthday.read',
    'https://www.googleapis.com/auth/user.phonenumbers.read',
    'https://www.googleapis.com/auth/user.gender.read',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
    'https://www.googleapis.com/auth/classroom.announcements.readonly',
  ].join(' ');

  window.triggerOfficialGoogleAuth = async function (mode = 'login', onUploadConnectedCallback = null) {
    const isLink = mode === 'link' || mode === 'verify_email' || mode === 'drive_classroom';
    if (isLink && (!userId || !String(userId).trim())) {
      showToast('⚠️ سجل الدخول أو أنشئ حساباً أولاً قبل ربط كوكل');
      if (typeof openAuthModal === 'function') openAuthModal('login');
      return;
    }
    const cfg = typeof _getBotAuthConfig === 'function' ? await _getBotAuthConfig() : {};
    const clientId = cfg.google_client_id || window._googleClientId;
    if (!clientId) {
      showToast('⚠️ لم يتم العثور على معرف عميل Google OAuth');
      return;
    }
    const gsiReady = typeof _ensureGoogleGsiLoaded === 'function' ? await _ensureGoogleGsiLoaded() : Boolean(window.google?.accounts?.oauth2?.initTokenClient);
    if (!gsiReady || !window.google?.accounts?.oauth2?.initTokenClient) {
      showToast('⚠️ تعذر تحميل مكتبة Google الرسمية');
      return;
    }
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: UNIFIED_GOOGLE_SCOPES,
        prompt: 'select_account',
        error_callback: (err) => {
          if (err && err.type === 'popup_closed') return;
          const origin = window.location.origin;
          showToast(`⚠️ تأكد من إضافة النطاق (${origin}) في Google Cloud Console ضمن Authorized JavaScript origins`, 5000);
        },
        callback: async (tokenResponse) => {
          if (!tokenResponse || tokenResponse.error || !tokenResponse.access_token) {
            if (tokenResponse?.error && tokenResponse.error !== 'popup_closed_by_user') {
              showToast('⚠️ تعذر مصادقة كوكل: ' + tokenResponse.error);
            }
            return;
          }
          // Save token immediately for Drive & Classroom so a second popup is NEVER needed
          window._googleAccessToken = tokenResponse.access_token;
          try { sessionStorage.setItem('nk_google_access_token', tokenResponse.access_token); } catch (e) {}

          try {
            const r = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                access_token: tokenResponse.access_token,
                mode: isLink ? 'link' : 'login',
                account_id: isLink ? userId : '',
                session_id: getSessionId(),
                device_fp: getDeviceFingerprint(),
              }),
            });
            const d = await r.json();
            if (r.ok && d.success && d.user) {
              if (d.user.google_email) {
                window._googleUserEmail = d.user.google_email;
              }
              if (isLink) {
                window._applyServerUserPreferences(d.user);
                window._pageLoadTs = Date.now();
                if (typeof loadSettings === 'function') loadSettings();
                if (typeof _updateDrawerHeader === 'function') _updateDrawerHeader();
                if (document.getElementById('settings-drawer')?.classList.contains('open')) {
                  window._populateDrawer();
                }
                if (typeof _updateGoogleUploadUI === 'function') {
                  try { _updateGoogleUploadUI(true); } catch (e) {}
                }
                renderUploadModalGoogleSwitcher();
                showToast('✅ تم ربط حساب كوكل وجلب البيانات وصلاحيات Drive و Classroom بنجاح!');
                if (typeof onUploadConnectedCallback === 'function') {
                  onUploadConnectedCallback(tokenResponse.access_token);
                }
              } else {
                if (typeof _completeBrowserUserAuth === 'function') {
                  _completeBrowserUserAuth(d.user, '✅ تم تسجيل الدخول عبر كوكل بنجاح!');
                }
              }
            } else {
              showToast('⚠️ ' + (d.error || 'تعذر التحقق من حساب كوكل'));
            }
          } catch (err) {
            showToast('❌ خطأ أثناء الاتصال بالخادم للتحقق من كوكل');
          }
        },
      });
      tokenClient.requestAccessToken();
    } catch (e) {
      showToast('❌ تعذر فتح نافذة مصادقة كوكل');
    }
  };

  // Restore cached Google token in session so Drive/Classroom work immediately
  try {
    const savedTok = sessionStorage.getItem('nk_google_access_token');
    if (savedTok && !window._googleAccessToken) {
      window._googleAccessToken = savedTok;
    }
  } catch (e) {}

  window.connectGoogleForUpload = async function () {
    if (window._googleAccessToken) {
      if (typeof _updateGoogleUploadUI === 'function') _updateGoogleUploadUI(true);
      renderUploadModalGoogleSwitcher();
      showToast('✅ حساب كوكل جاهز للرفع من Drive و Classroom');
      return;
    }
    await window.triggerOfficialGoogleAuth(userId ? 'drive_classroom' : 'login', () => {
      if (typeof _updateGoogleUploadUI === 'function') _updateGoogleUploadUI(true);
      renderUploadModalGoogleSwitcher();
    });
  };

  function renderUploadModalGoogleSwitcher() {
    const s = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const gAccounts = Array.isArray(s.google_accounts) ? s.google_accounts : [];
    const statusBar = document.getElementById('google-account-bar');
    if (!statusBar) return;
    if (gAccounts.length > 0 || window._googleAccessToken) {
      statusBar.style.display = 'flex';
      statusBar.style.flexWrap = 'wrap';
      statusBar.style.gap = '6px';
      const activeId = s.google_id || (gAccounts[0]?.sub || '');
      statusBar.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;flex-wrap:wrap;">
          <i class="fab fa-google" style="color:#34a853;"></i>
          ${gAccounts.map((ga) => {
            const gid = String(ga.sub || ga.google_id || '');
            const isAct = gid === String(activeId);
            return `<button type="button" onclick="window._switchUploadGoogleAccount('${escHtml(gid)}')" title="التبديل إلى ${escHtml(ga.email || ga.name || '')}" style="padding:3px 8px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;border:1px solid ${isAct ? '#34a853' : 'rgba(128,128,128,0.3)'};background:${isAct ? 'rgba(52,168,83,0.18)' : 'transparent'};color:var(--text);display:inline-flex;align-items:center;gap:4px;">
              ${ga.picture ? `<img src="${escHtml(ga.picture)}" style="width:14px;height:14px;border-radius:50%;object-fit:cover;">` : ''}
              <span dir="ltr">${escHtml(ga.email || ga.name || gid)}</span>
            </button>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:4px;">
          <button type="button" onclick="window.triggerOfficialGoogleAuth('drive_classroom')" title="ربط حساب كوكل آخر أو تجديد الصلاحية" style="background:rgba(52,168,83,0.14);border:1px solid rgba(52,168,83,0.35);color:#34a853;border-radius:8px;padding:4px 8px;font-size:10px;cursor:pointer;">
            <i class="fas fa-plus"></i> <i class="fab fa-google"></i>
          </button>
        </div>
      `;
    }
  }

  window._switchUploadGoogleAccount = async function (targetSub) {
    if (!userId || !targetSub) return;
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(userId)}/switch-google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetSub }),
      });
      const d = await r.json();
      if (r.ok && d.success && d.user) {
        window._applyServerUserPreferences(d.user);
        renderUploadModalGoogleSwitcher();
        if (document.getElementById('settings-drawer')?.classList.contains('open')) {
          window._populateDrawer();
        }
        showToast('✅ تم تبديل حساب كوكل النشط: ' + (d.user.google_email || ''));
        // Request fresh token for the selected account if needed
        window.triggerOfficialGoogleAuth('drive_classroom');
      }
    } catch (e) {}
  };

  // ─── 7. Organized Settings Drawer State (Top Icon Bar + Sub-Tabs, Zero Jump) ───
  window._nkDrawerTab = 'account'; // 'account' | 'custom' | 'privacy' | 'security' | 'prefs'
  window._nkAccountSubTab = 'overview'; // 'overview' | 'telegram' | 'google'
  window._nkCachedSessions = null;
  window._nkSessionsLoading = false;

  window.switchNkDrawerTab = function (tab) {
    window._nkDrawerTab = tab;
    if (tab === 'security' && userId) {
      window._fetchUserSessions();
    }
    window._populateDrawer();
  };

  window.switchNkAccountSubTab = function (sub) {
    window._nkAccountSubTab = sub;
    window._populateDrawer();
    if (sub === 'telegram' && userId) {
      setTimeout(() => {
        if (typeof loadTelegramPhotosGallery === 'function') loadTelegramPhotosGallery(false);
      }, 30);
    }
  };

  // Adopt a specific field from a specific source ('custom', 'tg:<id>', 'google:<sub>')
  window.adoptFieldSource = async function (fieldKey, sourceVal) {
    if (!userId) {
      showToast('⚠️ سجل الدخول أولاً');
      return;
    }
    const s = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const fs = (s.field_sources && typeof s.field_sources === 'object') ? { ...s.field_sources } : {};
    fs[fieldKey] = sourceVal;
    s.field_sources = fs;

    const payload = { field_sources: fs };
    if (fieldKey === 'first_name' || fieldKey === 'last_name') {
      payload.name_source = sourceVal.startsWith('tg:') ? 'telegram' : sourceVal.startsWith('google:') ? 'google' : 'custom';
      s.name_source = payload.name_source;
    }
    if (fieldKey === 'username') {
      payload.username_source = sourceVal.startsWith('tg:') ? 'telegram' : 'custom';
      s.username_source = payload.username_source;
    }
    if (fieldKey === 'photo') {
      payload.photo_source = sourceVal.startsWith('tg:') ? 'telegram' : sourceVal.startsWith('google:') ? 'google' : 'custom';
      s.photo_source = payload.photo_source;
    }
    if (fieldKey === 'email') {
      payload.email_source = sourceVal.startsWith('google:') ? 'google' : 'custom';
      s.email_source = payload.email_source;
    }
    if (fieldKey === 'phone') {
      payload.phone_source = sourceVal.startsWith('tg:') ? 'telegram' : 'custom';
      s.phone_source = payload.phone_source;
    }
    if (fieldKey === 'bio') {
      payload.bio_source = sourceVal.startsWith('tg:') ? 'telegram' : 'custom';
      s.bio_source = payload.bio_source;
    }

    localStorage.setItem('appSettings', JSON.stringify(s));
    window._populateDrawer();

    try {
      const r = await fetch(`/api/users/${encodeURIComponent(userId)}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok && d.user) {
        window._applyServerUserPreferences(d.user);
        window._pageLoadTs = Date.now();
        if (typeof _updateDrawerHeader === 'function') _updateDrawerHeader();
        if (typeof loadSettings === 'function') loadSettings(true);
        if (typeof _refreshAllCreatorAvatarsInDOM === 'function') _refreshAllCreatorAvatarsInDOM();
        window._populateDrawer();
        showToast('✅ تم اعتماد المعلومة في حسابك');
      }
    } catch (e) {
      showToast('❌ تعذر حفظ المصدر');
    }
  };

  window.setPrimaryBotTelegramAccount = async function (tgId) {
    if (!userId || !tgId) return;
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(userId)}/switch-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_telegram_id: tgId }),
      });
      const d = await r.json();
      if (r.ok && d.success && d.user) {
        window._applyServerUserPreferences(d.user);
        window._pageLoadTs = Date.now();
        if (typeof _updateDrawerHeader === 'function') _updateDrawerHeader();
        window._populateDrawer();
        showToast('✅ تم تعيين حساب تلگرام الرئيسي للتواصل مع البوت');
      }
    } catch (e) {}
  };

  window.unlinkSpecificTelegramAccount = function (tgId) {
    if (!userId) return;
    askConfirmAction('إلغاء ربط حساب تلگرام', `هل أنت متأكد من إلغاء ربط حساب تلگرام (${tgId})؟`, async () => {
      try {
        const r = await fetch(`/api/users/${encodeURIComponent(userId)}/unlink-telegram`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_telegram_id: tgId }),
        });
        const d = await r.json();
        if (r.ok && d.success && d.user) {
          window._applyServerUserPreferences(d.user);
          window._pageLoadTs = Date.now();
          if (typeof _updateDrawerHeader === 'function') _updateDrawerHeader();
          if (typeof loadSettings === 'function') loadSettings();
          window._populateDrawer();
          showToast('✅ تم إلغاء ربط حساب تلگرام');
        } else {
          showToast('❌ ' + (d.error || 'تعذر إلغاء الربط'));
        }
      } catch (e) {
        showToast('❌ خطأ في الاتصال');
      }
    });
  };

  window.unlinkSpecificGoogleAccount = function (subId) {
    if (!userId) return;
    askConfirmAction('إلغاء ربط حساب كوكل', 'هل أنت متأكد من إلغاء ربط حساب كوكل هذا؟', async () => {
      try {
        const r = await fetch(`/api/users/${encodeURIComponent(userId)}/unlink-google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: subId }),
        });
        const d = await r.json();
        if (r.ok && d.success && d.user) {
          window._applyServerUserPreferences(d.user);
          window._pageLoadTs = Date.now();
          if (typeof _updateDrawerHeader === 'function') _updateDrawerHeader();
          if (typeof loadSettings === 'function') loadSettings();
          window._populateDrawer();
          showToast('✅ تم إلغاء ربط حساب كوكل');
        } else {
          showToast('❌ ' + (d.error || 'تعذر إلغاء الربط'));
        }
      } catch (e) {
        showToast('❌ خطأ في الاتصال');
      }
    });
  };

  window.requestPhoneForSpecificTgAccount = async function (tgId) {
    if (!userId) return;
    try {
      const r = await fetch('/api/auth/request-phone-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, target_telegram_id: tgId }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        showToast('📲 تم إرسال زر مشاركة الرقم (مع خيار الإلغاء) إلى هذا الحساب في البوت');
        if (d.bot_username) {
          const a = document.createElement('a');
          a.href = `https://t.me/${d.bot_username}`;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      } else {
        showToast('⚠️ ' + (d.error || 'افتح البوت أولاً وأرسل /start'));
      }
    } catch (e) {
      showToast('❌ خطأ في الاتصال');
    }
  };

  window.syncTelegramLiveNow = async function () {
    if (!userId) return;
    showToast('⏳ جاري جلب أحدث البيانات والصور من تلگرام...');
    await syncUserDataLive(true);
    if (typeof loadTelegramPhotosGallery === 'function') {
      await loadTelegramPhotosGallery(true);
    }
    window._populateDrawer();
    showToast('✅ تمت المزامنة الفورية مع تلگرام');
  };

  // Custom Photos Archive actions: Select, Reorder, Hide/Show, Delete
  window.selectCustomArchivePhoto = async function (fileId) {
    if (!userId || !fileId) return;
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(userId)}/custom-photos/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId }),
      });
      const d = await r.json();
      if (r.ok && d.success && d.user) {
        window._applyServerUserPreferences(d.user);
        window._pageLoadTs = Date.now();
        if (typeof _updateDrawerHeader === 'function') _updateDrawerHeader();
        if (typeof _refreshAllCreatorAvatarsInDOM === 'function') _refreshAllCreatorAvatarsInDOM();
        window._populateDrawer();
        showToast('✅ تم تعيين الصورة المخصصة كرئيسية');
      }
    } catch (e) {}
  };

  window.reorderCustomArchivePhoto = async function (fileId, direction) {
    if (!userId || !fileId) return;
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(userId)}/custom-photos/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId, direction }),
      });
      const d = await r.json();
      if (r.ok && d.success && d.user) {
        window._applyServerUserPreferences(d.user);
        window._pageLoadTs = Date.now();
        if (typeof _updateDrawerHeader === 'function') _updateDrawerHeader();
        window._populateDrawer();
        showToast('✅ تم تحديث ترتيب الصور');
      }
    } catch (e) {}
  };

  window.deleteCustomArchivePhoto = function (fileId) {
    if (!userId || !fileId) return;
    askConfirmAction('حذف الصورة المخصصة', 'هل تريد حذف هذه الصورة من أرشيف صورك المخصصة؟', async () => {
      try {
        const r = await fetch(`/api/users/${encodeURIComponent(userId)}/custom-photos/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: fileId }),
        });
        const d = await r.json();
        if (r.ok && d.success && d.user) {
          window._applyServerUserPreferences(d.user);
          window._pageLoadTs = Date.now();
          if (typeof _updateDrawerHeader === 'function') _updateDrawerHeader();
          window._populateDrawer();
          showToast('🗑️ تم حذف الصورة');
        }
      } catch (e) {}
    });
  };

  window.togglePhotoVisibilityForOthers = async function (fileId) {
    if (!userId || !fileId) return;
    const s = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const hidden = Array.isArray(s.hidden_photo_ids) ? [...s.hidden_photo_ids] : [];
    const idx = hidden.indexOf(fileId);
    if (idx >= 0) hidden.splice(idx, 1);
    else hidden.push(fileId);
    s.hidden_photo_ids = hidden;
    localStorage.setItem('appSettings', JSON.stringify(s));
    window._populateDrawer();
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(userId)}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden_photo_ids: hidden }),
      });
      const d = await r.json();
      if (r.ok && d.user) {
        window._applyServerUserPreferences(d.user);
        window._populateDrawer();
        showToast(idx >= 0 ? '👁️ الصورة ظاهرة للآخرين الآن' : '🔒 تم إخفاء الصورة عن الآخرين');
      }
    } catch (e) {}
  };

  window.saveCustomProfileFields = async function () {
    if (!userId) {
      showToast('⚠️ سجل الدخول أولاً');
      return;
    }
    const s = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const firstInp = document.getElementById('nk-custom-first-name');
    const lastInp = document.getElementById('nk-custom-last-name');
    const userInp = document.getElementById('nk-custom-username');
    const emailInp = document.getElementById('nk-custom-email');
    const phoneInp = document.getElementById('nk-custom-phone');
    const birthInp = document.getElementById('nk-custom-birth');
    const bioInp = document.getElementById('nk-custom-bio');

    const firstVal = firstInp ? firstInp.value.trim() : (s.custom_first_name || '');
    const lastVal = lastInp ? lastInp.value.trim() : (s.custom_last_name || '');
    const userVal = userInp ? userInp.value.trim().replace(/^@/, '') : (s.custom_username || '');
    const emailVal = emailInp ? emailInp.value.trim().toLowerCase() : (s.custom_email || s.email || '');
    const phoneVal = phoneInp ? phoneInp.value.trim() : (s.custom_phone || s.phone || '');
    const birthVal = birthInp ? birthInp.value.trim() : (s.custom_birth_date || s.birth_date || '');
    const bioVal = bioInp ? bioInp.value.trim() : (s.custom_bio || '');
    const genderVal = window._nkDraftGender !== undefined ? window._nkDraftGender : (s.custom_gender || s.gender || '');

    const payload = {
      custom_first_name: firstVal,
      custom_last_name: lastVal,
      custom_name: [firstVal, lastVal].filter(Boolean).join(' ').trim(),
      custom_username: userVal,
      email: emailVal,
      phone: phoneVal,
      custom_birth_date: birthVal,
      birth_date: birthVal,
      custom_gender: genderVal,
      gender: genderVal,
      custom_bio: bioVal,
    };

    try {
      const r = await fetch(`/api/users/${encodeURIComponent(userId)}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok && d.user) {
        window._applyServerUserPreferences(d.user);
        if (typeof _updateDrawerHeader === 'function') _updateDrawerHeader();
        if (typeof loadSettings === 'function') loadSettings(true);
        window._populateDrawer();
        showToast('✅ تم حفظ البيانات المخصصة بنجاح');
      } else {
        showToast('❌ ' + (d.error || 'تعذر الحفظ'));
      }
    } catch (e) {
      showToast('❌ خطأ أثناء الحفظ');
    }
  };

  window.setNkCustomGender = function (gVal) {
    window._nkDraftGender = gVal;
    const s = JSON.parse(localStorage.getItem('appSettings') || '{}');
    s.custom_gender = gVal;
    s.gender = gVal;
    localStorage.setItem('appSettings', JSON.stringify(s));
    window.saveCustomProfileFields();
  };

  // Sessions & 30-Day Account Deletion API Helpers
  window._fetchUserSessions = async function () {
    if (!userId || window._nkSessionsLoading) return;
    window._nkSessionsLoading = true;
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(userId)}/sessions`);
      if (r.ok) {
        const d = await r.json();
        window._nkCachedSessions = d;
        if (document.getElementById('settings-drawer')?.classList.contains('open') && window._nkDrawerTab === 'security') {
          window._populateDrawer();
        }
      }
    } catch (e) {}
    window._nkSessionsLoading = false;
  };

  window.manageNkSessionAction = async function (action, targetSessionId, targetFp) {
    if (!userId) return;
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(userId)}/sessions/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          session_id: targetSessionId,
          device_fp: targetFp,
        }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        if (d.user) window._applyServerUserPreferences(d.user);
        await window._fetchUserSessions();
        window._populateDrawer();
        showToast('✅ تم تحديث حالة الجلسة / الجهاز');
      } else {
        showToast('⚠️ ' + (d.error || 'تعذر تنفيذ الإجراء'));
      }
    } catch (e) {}
  };

  window.scheduleNkAccountDeletion = async function () {
    if (!userId) return;
    const pw = document.getElementById('nk-delete-acc-password')?.value || '';
    if (!pw) {
      showToast('⚠️ أدخل كلمة المرور لتأكيد جدولة حذف الحساب');
      return;
    }
    askConfirmAction(
      'تأكيد جدولة حذف الحساب',
      'سيتم جدولة حذف حسابك نهائياً بعد 30 يوماً من الآن، مع إمكانية إلغاء الحذف في أي وقت خلال هذه المهلة. هل أنت متأكد؟',
      async () => {
        try {
          const r = await fetch(`/api/users/${encodeURIComponent(userId)}/schedule-delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw }),
          });
          const d = await r.json();
          if (r.ok && d.success && d.user) {
            window._applyServerUserPreferences(d.user);
            window._populateDrawer();
            showToast('⏳ تم جدولة حذف الحساب بعد 30 يوماً وإرسال إشعار التأكيد للبوت');
          } else {
            showToast('❌ ' + (d.error || 'كلمة المرور غير صحيحة'));
          }
        } catch (e) {
          showToast('❌ خطأ في الاتصال بالخادم');
        }
      }
    );
  };

  window.cancelNkAccountDeletion = async function () {
    if (!userId) return;
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(userId)}/cancel-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await r.json();
      if (r.ok && d.success && d.user) {
        window._applyServerUserPreferences(d.user);
        window._populateDrawer();
        showToast('✅ تم إلغاء جدولة حذف الحساب بنجاح!');
      }
    } catch (e) {}
  };

  // ─── 8. Render Organized Top-Icon-Bar Settings Drawer (#drawer-body) ───
  window._populateDrawer = function () {
    const body = document.getElementById('drawer-body');
    if (!body) return;
    const savedScroll = body.scrollTop;

    const s = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const curTab = window._nkDrawerTab || 'account';
    const subTab = window._nkAccountSubTab || 'overview';
    const fs = (s.field_sources && typeof s.field_sources === 'object') ? s.field_sources : {};
    const ts = typeof _pageLoadTs !== 'undefined' ? _pageLoadTs : Date.now();

    const topTabsHtml = `
      <div class="nk-top-tabs" role="tablist">
        <button type="button" class="nk-top-tab-btn ${curTab === 'account' ? 'active' : ''}" onclick="switchNkDrawerTab('account')" title="الحساب والارتباطات (01 / تلگرام / كوكل)">
          <i class="fas fa-user-shield"></i>
        </button>
        <button type="button" class="nk-top-tab-btn ${curTab === 'custom' ? 'active' : ''}" onclick="switchNkDrawerTab('custom')" title="البيانات المخصصة وأرشيف الصور">
          <i class="fas fa-id-card-clip"></i>
        </button>
        <button type="button" class="nk-top-tab-btn ${curTab === 'privacy' ? 'active' : ''}" onclick="switchNkDrawerTab('privacy')" title="الظهور والخصوصية الشاملة">
          <i class="fas fa-eye"></i>
        </button>
        <button type="button" class="nk-top-tab-btn ${curTab === 'security' ? 'active' : ''}" onclick="switchNkDrawerTab('security')" title="الأجهزة والجلسات وحذف الحساب">
          <i class="fas fa-laptop-medical"></i>
        </button>
        <button type="button" class="nk-top-tab-btn ${curTab === 'prefs' ? 'active' : ''}" onclick="switchNkDrawerTab('prefs')" title="المظهر واللغة والتفضيلات">
          <i class="fas fa-sliders"></i>
        </button>
      </div>
    `;

    let tabContentHtml = '';

    // =========================================================================
    // TAB 1: ACCOUNT & LINKED PLATFORMS (01 / TELEGRAM / GOOGLE)
    // =========================================================================
    if (curTab === 'account') {
      const tgAccounts = Array.isArray(s.telegram_accounts) ? s.telegram_accounts : [];
      const gAccounts = Array.isArray(s.google_accounts) ? s.google_accounts : [];

      const subTabsHtml = `
        <div class="nk-sub-tabs">
          <button type="button" class="nk-sub-tab-btn ${subTab === 'overview' ? 'active' : ''}" onclick="switchNkAccountSubTab('overview')" title="حساب المنصة (01) وتبديل الحسابات">
            <i class="fas fa-fingerprint" style="color:var(--accent);"></i> <span>01</span>
          </button>
          <button type="button" class="nk-sub-tab-btn ${subTab === 'telegram' ? 'active' : ''}" onclick="switchNkAccountSubTab('telegram')" title="حسابات تلگرام المرتبطة (${tgAccounts.length})">
            <i class="fab fa-telegram" style="color:#29b6f6;"></i> <span>${tgAccounts.length}</span>
          </button>
          <button type="button" class="nk-sub-tab-btn ${subTab === 'google' ? 'active' : ''}" onclick="switchNkAccountSubTab('google')" title="حسابات كوكل المرتبطة (${gAccounts.length})">
            <i class="fab fa-google" style="color:#ea4335;"></i> <span>${gAccounts.length}</span>
          </button>
        </div>
      `;

      if (subTab === 'overview') {
        const savedAccs = typeof _getSavedAccountsList === 'function' ? _getSavedAccountsList() : [];
        tabContentHtml = `
          ${subTabsHtml}
          <div class="nk-glass-card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:6px;" title="إدارة الحساب الحالي"><i class="fas fa-user-gear"></i> التحكم بالحساب</span>
              ${userId ? `<span style="font-size:10px;color:#26a69a;display:flex;align-items:center;gap:4px;"><i class="fas fa-circle-check"></i> متصل</span>` : ''}
            </div>
            <div style="display:flex;gap:6px;margin-bottom:10px;">
              ${userId ? `
                <button type="button" class="btn btn-secondary" style="flex:1;padding:8px;" onclick="openChangePasswordModal()" title="تغيير كلمة المرور">
                  <i class="fas fa-key"></i>
                </button>
                <button type="button" class="btn btn-secondary" style="flex:1;padding:8px;" onclick="closeSettingsDrawer();openAuthModal('login')" title="إضافة حساب آخر">
                  <i class="fas fa-user-plus"></i>
                </button>
                <button type="button" class="btn btn-danger" style="flex:1;padding:8px;" onclick="logoutCurrentAccount()" title="تسجيل الخروج">
                  <i class="fas fa-right-from-bracket"></i>
                </button>
              ` : `
                <button type="button" class="btn btn-primary" style="flex:1;padding:8px;" onclick="closeSettingsDrawer();openAuthModal('login')" title="تسجيل الدخول">
                  <i class="fas fa-right-to-bracket"></i>
                </button>
                <button type="button" class="btn btn-secondary" style="flex:1;padding:8px;" onclick="closeSettingsDrawer();openAuthModal('register')" title="إنشاء حساب 01 جديد">
                  <i class="fas fa-user-plus"></i>
                </button>
              `}
            </div>

            <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;">
              <span title="الحسابات المحفوظة على هذا المتصفح للتبديل السريع"><i class="fas fa-users"></i> الحسابات المحفوظة (${savedAccs.length})</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${savedAccs.length ? savedAccs.map((acc) => {
                const aid = String(acc.id || '');
                const isCur = aid === String(userId || '');
                const pid = String(acc.platform_id || `01-${aid.slice(0, 6).toUpperCase()}`).replace(/^NK-/i, '01-');
                const letter = ((acc.display_name || acc.username || '؟')[0] || '؟').toUpperCase();
                return `
                  <div onclick="switchActiveAccount('${escHtml(aid)}')" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px;border-radius:11px;cursor:pointer;background:${isCur ? 'rgba(201,149,108,0.16)' : 'rgba(128,128,128,0.06)'};border:1px solid ${isCur ? 'var(--accent)' : 'rgba(128,128,128,0.15)'};">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                      <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-dark));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;overflow:hidden;flex-shrink:0;">
                        <img src="/api/user/photo/${encodeURIComponent(aid)}?v=${ts}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" onerror="this.remove();this.parentElement.textContent='${escHtml(letter)}';">
                      </div>
                      <div style="min-width:0;">
                        <div style="font-size:12px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:5px;">
                          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(acc.display_name || 'مستخدم')}</span>
                          ${isCur ? '<i class="fas fa-circle-check" style="color:#26a69a;font-size:10px;" title="نشط الآن"></i>' : ''}
                        </div>
                        <div style="font-size:10px;color:var(--text-muted);direction:ltr;text-align:right;font-family:monospace;">
                          ${acc.username ? '@' + escHtml(acc.username) + ' • ' : ''}${escHtml(pid)}
                        </div>
                      </div>
                    </div>
                    <button type="button" onclick="event.stopPropagation();window._removeAccountFromDropdown('${escHtml(aid)}')" title="إزالة من القائمة" style="width:26px;height:26px;border-radius:50%;background:rgba(239,68,68,0.12);color:#ef4444;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;">
                      <i class="fas fa-trash-can" style="font-size:10px;"></i>
                    </button>
                  </div>
                `;
              }).join('') : `<div style="text-align:center;font-size:11px;color:var(--text-muted);padding:8px;">لا توجد حسابات محفوظة</div>`}
            </div>
          </div>

          <!-- Summary of currently adopted sources -->
          <div class="nk-glass-card">
            <div style="font-size:11px;font-weight:700;color:var(--accent);margin-bottom:6px;display:flex;align-items:center;gap:6px;" title="ملخص المعلومات المعتمدة حالياً في حسابك">
              <i class="fas fa-check-double"></i> الهوية المعتمدة حالياً في المنصة
            </div>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;">
              <div class="nk-field-row" title="الاسم الكامل المعروض (الاسم الأول + الثاني)">
                <span><i class="fas fa-signature" style="color:var(--accent);width:14px;"></i> <b>${escHtml(_effectiveName() || '—')}</b></span>
              </div>
              <div class="nk-field-row" title="اسم المستخدم">
                <span><i class="fas fa-at" style="color:var(--accent);width:14px;"></i> <span dir="ltr">${_effectiveUsername() ? '@' + escHtml(_effectiveUsername()) : '—'}</span></span>
              </div>
              <div class="nk-field-row" title="البريد الإلكتروني المعتمد">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-envelope" style="color:#60a5fa;width:14px;"></i> <span dir="ltr">${escHtml(s.email || '—')}</span></span>
                ${s.email ? (s.email_verified ? '<i class="fas fa-circle-check" style="color:#26a69a;font-size:10px;" title="مؤكد"></i>' : '<i class="fas fa-circle-exclamation" style="color:#f59e0b;font-size:10px;" title="غير مؤكد"></i>') : ''}
              </div>
              <div class="nk-field-row" title="رقم الهاتف المعتمد">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-phone" style="color:#34d399;width:14px;"></i> <span dir="ltr">${escHtml(s.phone || '—')}</span></span>
                ${s.phone ? (s.phone_verified ? '<i class="fas fa-circle-check" style="color:#26a69a;font-size:10px;" title="مؤكد"></i>' : '<i class="fas fa-circle-exclamation" style="color:#f59e0b;font-size:10px;" title="غير مؤكد"></i>') : ''}
              </div>
            </div>
          </div>
        `;
      } else if (subTab === 'telegram') {
        const tgCardsHtml = tgAccounts.length
          ? tgAccounts.map((ta) => {
              const tid = String(ta.telegram_id || ta.id || '');
              const isPrimaryBot = Boolean(ta.is_primary_bot || tid === String(s.primary_bot_telegram_id || s.telegram_id || ''));
              const srcTag = `tg:${tid}`;
              const isFirstAdopted = fs.first_name === srcTag || (!fs.first_name && s.name_source === 'telegram' && isPrimaryBot);
              const isLastAdopted = fs.last_name === srcTag || (!fs.last_name && s.name_source === 'telegram' && isPrimaryBot);
              const isUserAdopted = fs.username === srcTag || (!fs.username && s.username_source === 'telegram' && isPrimaryBot);
              const isPhoneAdopted = fs.phone === srcTag || s.phone_source === 'telegram';
              const isBioAdopted = fs.bio === srcTag || s.bio_source === 'telegram';
              const isBirthAdopted = fs.birth_date === srcTag;
              const isPhotoAdopted = fs.photo === srcTag || s.photo_source === 'telegram';

              return `
                <div class="nk-glass-card" style="border-color:rgba(41,182,246,0.32);background:rgba(41,182,246,0.05);">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                      <div style="width:40px;height:40px;border-radius:50%;background:rgba(41,182,246,0.16);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;border:1.5px solid #29b6f6;">
                        <img src="/api/user/photo/${encodeURIComponent(userId)}?source=telegram_main&v=${ts}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" onerror="this.remove();this.parentElement.innerHTML='<i class=\\'fab fa-telegram\\' style=\\'color:#29b6f6;font-size:18px;\\'></i>';">
                      </div>
                      <div style="min-width:0;">
                        <div style="font-size:12px;font-weight:700;color:#29b6f6;display:flex;align-items:center;gap:5px;">
                          <span>${escHtml([ta.first_name, ta.last_name].filter(Boolean).join(' ') || 'Telegram')}</span>
                          ${ta.is_premium ? '<i class="fas fa-star" style="color:#f59e0b;font-size:10px;" title="Telegram Premium"></i>' : ''}
                          <i class="fas fa-circle-check" style="color:#26a69a;font-size:10px;" title="مرتبط رسمياً"></i>
                        </div>
                        <div onclick="copyText('${escHtml(tid)}')" title="انقر لنسخ معرف تلگرام" style="font-size:10px;color:var(--text-muted);cursor:pointer;font-family:monospace;direction:ltr;text-align:right;">
                          ID: ${escHtml(tid)} ${ta.language_code ? `• ${escHtml(ta.language_code.toUpperCase())}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:5px;align-items:center;">
                      <button type="button" onclick="setPrimaryBotTelegramAccount('${escHtml(tid)}')" title="${isPrimaryBot ? 'الحساب الرئيسي للتواصل مع البوت' : 'تعيين كحساب رئيسي للبوت'}" style="height:28px;padding:0 8px;border-radius:8px;border:1px solid ${isPrimaryBot ? '#26a69a' : 'rgba(41,182,246,0.35)'};background:${isPrimaryBot ? 'rgba(38,166,154,0.18)' : 'rgba(41,182,246,0.1)'};color:${isPrimaryBot ? '#26a69a' : '#29b6f6'};font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;">
                        <i class="fas fa-robot"></i>
                        ${isPrimaryBot ? '<i class="fas fa-check"></i>' : ''}
                      </button>
                      <button type="button" onclick="syncTelegramLiveNow()" title="تحديث ومزامنة جميع البيانات والصور من تلگرام" style="width:28px;height:28px;border-radius:8px;border:1px solid rgba(41,182,246,0.35);background:rgba(41,182,246,0.12);color:#29b6f6;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                        <i class="fas fa-arrows-rotate" style="font-size:11px;"></i>
                      </button>
                      <button type="button" onclick="unlinkSpecificTelegramAccount('${escHtml(tid)}')" title="إلغاء ربط حساب تلگرام هذا" style="width:28px;height:28px;border-radius:8px;border:1px solid rgba(239,68,68,0.35);background:rgba(239,68,68,0.12);color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                        <i class="fas fa-unlink" style="font-size:11px;"></i>
                      </button>
                    </div>
                  </div>

                  <!-- All Fetched Telegram Fields + 1-Click Adoption Chips -->
                  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:8px;">
                    <div class="nk-field-row" title="الاسم الأول في تلگرام">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-user" style="color:#29b6f6;width:14px;"></i> <b>${escHtml(ta.first_name || '—')}</b></span>
                      <button type="button" class="nk-adopt-chip ${isFirstAdopted ? 'active' : ''}" onclick="adoptFieldSource('first_name','${escHtml(srcTag)}')" title="اعتماد الاسم الأول من هذا الحساب">
                        <i class="fas ${isFirstAdopted ? 'fa-check-circle' : 'fa-circle'}"></i>
                      </button>
                    </div>
                    <div class="nk-field-row" title="الاسم الثاني في تلگرام">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-users" style="color:#29b6f6;width:14px;"></i> <b>${escHtml(ta.last_name || '—')}</b></span>
                      <button type="button" class="nk-adopt-chip ${isLastAdopted ? 'active' : ''}" onclick="adoptFieldSource('last_name','${escHtml(srcTag)}')" title="اعتماد الاسم الثاني من هذا الحساب">
                        <i class="fas ${isLastAdopted ? 'fa-check-circle' : 'fa-circle'}"></i>
                      </button>
                    </div>
                    <div class="nk-field-row" title="اسم المستخدم في تلگرام">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-at" style="color:#29b6f6;width:14px;"></i> <span dir="ltr">${ta.username ? '@' + escHtml(ta.username) : '—'}</span></span>
                      ${ta.username ? `<button type="button" class="nk-adopt-chip ${isUserAdopted ? 'active' : ''}" onclick="adoptFieldSource('username','${escHtml(srcTag)}')" title="اعتماد اسم المستخدم من هذا الحساب"><i class="fas ${isUserAdopted ? 'fa-check-circle' : 'fa-circle'}"></i></button>` : ''}
                    </div>
                    <div class="nk-field-row" title="تاريخ الميلاد في تلگرام">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-cake-candles" style="color:#29b6f6;width:14px;"></i> <span dir="ltr">${escHtml(ta.birth_date || '—')}</span></span>
                      ${ta.birth_date ? `<button type="button" class="nk-adopt-chip ${isBirthAdopted ? 'active' : ''}" onclick="adoptFieldSource('birth_date','${escHtml(srcTag)}')" title="اعتماد تاريخ الميلاد من هذا الحساب"><i class="fas ${isBirthAdopted ? 'fa-check-circle' : 'fa-circle'}"></i></button>` : ''}
                    </div>
                    <div class="nk-field-row" style="grid-column:1 / -1;" title="رقم الهاتف المؤكد من تلگرام">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-phone" style="color:#29b6f6;width:14px;"></i> <span dir="ltr">${escHtml(ta.phone || 'غير مشارك بعد')}</span></span>
                      <div style="display:flex;gap:4px;align-items:center;">
                        <button type="button" class="nk-adopt-chip" style="border-color:#29b6f6;color:#29b6f6;" onclick="requestPhoneForSpecificTgAccount('${escHtml(tid)}')" title="مشاركة أو تحديث الرقم عبر البوت لهذا الحساب تحديداً">
                          <i class="fas fa-share-nodes"></i>
                        </button>
                        ${ta.phone ? `<button type="button" class="nk-adopt-chip ${isPhoneAdopted ? 'active' : ''}" onclick="adoptFieldSource('phone','${escHtml(srcTag)}')" title="اعتماد رقم هذا الحساب في المنصة"><i class="fas ${isPhoneAdopted ? 'fa-check-circle' : 'fa-circle'}"></i></button>` : ''}
                      </div>
                    </div>
                    <div class="nk-field-row" style="grid-column:1 / -1;" title="النبذة التعريفية (البايو) في تلگرام">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-quote-right" style="color:#29b6f6;width:14px;"></i> ${escHtml(ta.bio || '—')}</span>
                      ${ta.bio ? `<button type="button" class="nk-adopt-chip ${isBioAdopted ? 'active' : ''}" onclick="adoptFieldSource('bio','${escHtml(srcTag)}')" title="اعتماد النبذة التعريفية من تلگرام"><i class="fas ${isBioAdopted ? 'fa-check-circle' : 'fa-circle'}"></i></button>` : ''}
                    </div>
                    ${(ta.personal_chat_title || ta.personal_chat_username) ? `
                      <div class="nk-field-row" style="grid-column:1 / -1;" title="القناة الشخصية المربوطة بالملف الشخصي في تلگرام">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-bullhorn" style="color:#29b6f6;width:14px;"></i> ${escHtml(ta.personal_chat_title || '')} ${ta.personal_chat_username ? `<span dir="ltr" style="color:#29b6f6;">(@${escHtml(ta.personal_chat_username)})</span>` : ''}</span>
                      </div>
                    ` : ''}
                  </div>

                  <!-- Telegram Photos Strip (Only in Telegram Tab!) -->
                  <div style="padding-top:6px;border-top:1px solid rgba(41,182,246,0.2);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                      <span style="font-size:10px;font-weight:700;color:#29b6f6;display:flex;align-items:center;gap:5px;" title="صور حساب تلگرام (مع إزالة التكرار تلقائياً)"><i class="fas fa-images"></i> صور تلگرام</span>
                      <button type="button" class="nk-adopt-chip ${isPhotoAdopted ? 'active' : ''}" onclick="adoptFieldSource('photo','${escHtml(srcTag)}')" title="اعتماد صورة تلگرام كصورة رئيسية للمنصة">
                        <i class="fas ${isPhotoAdopted ? 'fa-check-circle' : 'fa-camera'}"></i>
                      </button>
                    </div>
                    <div id="drawer-tg-photos-gallery" style="display:flex;gap:6px;overflow-x:auto;padding:4px 2px;"></div>
                  </div>
                </div>
              `;
            }).join('')
          : `<div class="nk-glass-card" style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px;">لا يوجد حساب تلگرام مرتبط حالياً</div>`;

        tabContentHtml = `
          ${subTabsHtml}
          ${tgCardsHtml}
          <button type="button" class="btn btn-secondary" style="width:100%;padding:9px;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;border-color:rgba(41,182,246,0.4);color:#29b6f6;" onclick="triggerOfficialTelegramAuth('link')" title="ربط حساب تلگرام جديد أو إضافي">
            <i class="fas fa-plus"></i> <i class="fab fa-telegram"></i>
          </button>
        `;
      } else if (subTab === 'google') {
        const gCardsHtml = gAccounts.length
          ? gAccounts.map((ga) => {
              const gid = String(ga.sub || ga.google_id || '');
              const isPrimaryG = Boolean(ga.is_primary || gid === String(s.google_id || ''));
              const srcTag = `google:${gid}`;
              const isFirstAdopted = fs.first_name === srcTag || (!fs.first_name && s.name_source === 'google' && isPrimaryG);
              const isLastAdopted = fs.last_name === srcTag || (!fs.last_name && s.name_source === 'google' && isPrimaryG);
              const isEmailAdopted = fs.email === srcTag || s.email_source === 'google';
              const isPhoneAdopted = fs.phone === srcTag;
              const isBirthAdopted = fs.birth_date === srcTag;
              const isGenderAdopted = fs.gender === srcTag;
              const isBioAdopted = fs.bio === srcTag;
              const isPhotoAdopted = fs.photo === srcTag || s.photo_source === 'google';

              return `
                <div class="nk-glass-card" style="border-color:rgba(234,67,53,0.32);background:rgba(234,67,53,0.05);">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                      <div style="width:40px;height:40px;border-radius:50%;background:rgba(234,67,53,0.14);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;border:1.5px solid #ea4335;">
                        ${ga.picture ? `<img src="${escHtml(ga.picture)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" onerror="this.remove();this.parentElement.innerHTML='<i class=\\'fab fa-google\\' style=\\'color:#ea4335;font-size:17px;\\'></i>';">` : `<i class="fab fa-google" style="color:#ea4335;font-size:17px;"></i>`}
                      </div>
                      <div style="min-width:0;">
                        <div style="font-size:12px;font-weight:700;color:#ea4335;display:flex;align-items:center;gap:5px;">
                          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(ga.name || [ga.given_name, ga.family_name].filter(Boolean).join(' ') || 'Google')}</span>
                          <i class="fas fa-circle-check" style="color:#26a69a;font-size:10px;" title="مرتبط ومؤكد رسمياً"></i>
                        </div>
                        <div onclick="copyText('${escHtml(gid)}')" title="انقر لنسخ معرف كوكل" style="font-size:10px;color:var(--text-muted);cursor:pointer;font-family:monospace;direction:ltr;text-align:right;">
                          ID: ${escHtml(gid.slice(0, 14))}... ${ga.locale ? `• ${escHtml(String(ga.locale).toUpperCase())}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:5px;align-items:center;">
                      <button type="button" onclick="window._switchUploadGoogleAccount('${escHtml(gid)}')" title="${isPrimaryG ? 'الحساب النشط لـ Drive و Classroom' : 'تعيين كحساب نشط لـ Drive و Classroom'}" style="height:28px;padding:0 8px;border-radius:8px;border:1px solid ${isPrimaryG ? '#26a69a' : 'rgba(234,67,53,0.35)'};background:${isPrimaryG ? 'rgba(38,166,154,0.18)' : 'rgba(234,67,53,0.1)'};color:${isPrimaryG ? '#26a69a' : '#ea4335'};font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;">
                        <i class="fab fa-google-drive"></i>
                        ${isPrimaryG ? '<i class="fas fa-check"></i>' : ''}
                      </button>
                      <button type="button" onclick="triggerOfficialGoogleAuth('link')" title="تحديث ومزامنة جميع البيانات من Google People API" style="width:28px;height:28px;border-radius:8px;border:1px solid rgba(234,67,53,0.35);background:rgba(234,67,53,0.12);color:#ea4335;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                        <i class="fas fa-arrows-rotate" style="font-size:11px;"></i>
                      </button>
                      <button type="button" onclick="unlinkSpecificGoogleAccount('${escHtml(gid)}')" title="إلغاء ربط حساب كوكل هذا" style="width:28px;height:28px;border-radius:8px;border:1px solid rgba(239,68,68,0.35);background:rgba(239,68,68,0.12);color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                        <i class="fas fa-unlink" style="font-size:11px;"></i>
                      </button>
                    </div>
                  </div>

                  <!-- All Fetched Google & People API Fields + 1-Click Adoption Chips -->
                  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;">
                    <div class="nk-field-row" title="الاسم الأول في كوكل">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-user" style="color:#ea4335;width:14px;"></i> <b>${escHtml(ga.given_name || '—')}</b></span>
                      <button type="button" class="nk-adopt-chip ${isFirstAdopted ? 'active' : ''}" onclick="adoptFieldSource('first_name','${escHtml(srcTag)}')" title="اعتماد الاسم الأول من كوكل">
                        <i class="fas ${isFirstAdopted ? 'fa-check-circle' : 'fa-circle'}"></i>
                      </button>
                    </div>
                    <div class="nk-field-row" title="الاسم الثاني في كوكل">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-users" style="color:#ea4335;width:14px;"></i> <b>${escHtml(ga.family_name || '—')}</b></span>
                      <button type="button" class="nk-adopt-chip ${isLastAdopted ? 'active' : ''}" onclick="adoptFieldSource('last_name','${escHtml(srcTag)}')" title="اعتماد الاسم الثاني من كوكل">
                        <i class="fas ${isLastAdopted ? 'fa-check-circle' : 'fa-circle'}"></i>
                      </button>
                    </div>
                    <div class="nk-field-row" style="grid-column:1 / -1;" title="البريد الإلكتروني المؤكد من كوكل">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-envelope-circle-check" style="color:#26a69a;width:14px;"></i> <span dir="ltr">${escHtml(ga.email || '—')}</span></span>
                      <button type="button" class="nk-adopt-chip ${isEmailAdopted ? 'active' : ''}" onclick="adoptFieldSource('email','${escHtml(srcTag)}')" title="اعتماد هذا البريد المؤكد في حسابك">
                        <i class="fas ${isEmailAdopted ? 'fa-check-circle' : 'fa-circle'}"></i>
                      </button>
                    </div>
                    <div class="nk-field-row" title="تاريخ الميلاد (Google People API)">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-cake-candles" style="color:#ea4335;width:14px;"></i> <span dir="ltr">${escHtml(ga.birth_date || '—')}</span></span>
                      ${ga.birth_date ? `<button type="button" class="nk-adopt-chip ${isBirthAdopted ? 'active' : ''}" onclick="adoptFieldSource('birth_date','${escHtml(srcTag)}')" title="اعتماد تاريخ الميلاد من كوكل"><i class="fas ${isBirthAdopted ? 'fa-check-circle' : 'fa-circle'}"></i></button>` : ''}
                    </div>
                    <div class="nk-field-row" title="الجنس (Google People API)">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        <i class="fas ${ga.gender === 'male' ? 'fa-mars' : ga.gender === 'female' ? 'fa-venus' : 'fa-venus-mars'}" style="color:${ga.gender === 'male' ? '#3b82f6' : ga.gender === 'female' ? '#ec4899' : '#ea4335'};width:14px;"></i>
                        <b>${ga.gender === 'male' ? 'ذكر' : ga.gender === 'female' ? 'أنثى' : '—'}</b>
                      </span>
                      ${ga.gender ? `<button type="button" class="nk-adopt-chip ${isGenderAdopted ? 'active' : ''}" onclick="adoptFieldSource('gender','${escHtml(srcTag)}')" title="اعتماد الجنس من كوكل"><i class="fas ${isGenderAdopted ? 'fa-check-circle' : 'fa-circle'}"></i></button>` : ''}
                    </div>
                    <div class="nk-field-row" style="grid-column:1 / -1;" title="رقم الهاتف في كوكل (Google People API)">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-phone" style="color:#ea4335;width:14px;"></i> <span dir="ltr">${escHtml(ga.phone || '—')}</span></span>
                      ${ga.phone ? `<button type="button" class="nk-adopt-chip ${isPhoneAdopted ? 'active' : ''}" onclick="adoptFieldSource('phone','${escHtml(srcTag)}')" title="اعتماد رقم الهاتف من كوكل"><i class="fas ${isPhoneAdopted ? 'fa-check-circle' : 'fa-circle'}"></i></button>` : ''}
                    </div>
                    ${ga.bio ? `
                      <div class="nk-field-row" style="grid-column:1 / -1;" title="النبذة التعريفية في كوكل">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-quote-right" style="color:#ea4335;width:14px;"></i> ${escHtml(ga.bio)}</span>
                        <button type="button" class="nk-adopt-chip ${isBioAdopted ? 'active' : ''}" onclick="adoptFieldSource('bio','${escHtml(srcTag)}')" title="اعتماد النبذة من كوكل"><i class="fas ${isBioAdopted ? 'fa-check-circle' : 'fa-circle'}"></i></button>
                      </div>
                    ` : ''}
                    ${(ga.organization || ga.occupation) ? `
                      <div class="nk-field-row" style="grid-column:1 / -1;" title="المؤسسة التعليمية / العمل / التخصص في كوكل">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-building-columns" style="color:#ea4335;width:14px;"></i> ${escHtml([ga.organization, ga.occupation].filter(Boolean).join(' • '))}</span>
                      </div>
                    ` : ''}
                    ${ga.address ? `
                      <div class="nk-field-row" style="grid-column:1 / -1;" title="العنوان / المدينة في كوكل">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="fas fa-location-dot" style="color:#ea4335;width:14px;"></i> ${escHtml(ga.address)}</span>
                      </div>
                    ` : ''}
                    <div class="nk-field-row" style="grid-column:1 / -1;" title="الصورة الشخصية لحساب كوكل">
                      <span><i class="fas fa-camera" style="color:#ea4335;width:14px;"></i> صورة حساب كوكل</span>
                      <button type="button" class="nk-adopt-chip ${isPhotoAdopted ? 'active' : ''}" onclick="adoptFieldSource('photo','${escHtml(srcTag)}')" title="اعتماد صورة كوكل كصورة رئيسية للمنصة">
                        <i class="fas ${isPhotoAdopted ? 'fa-check-circle' : 'fa-circle'}"></i>
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')
          : `<div class="nk-glass-card" style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px;">لا يوجد حساب كوكل مرتبط حالياً</div>`;

        tabContentHtml = `
          ${subTabsHtml}
          ${gCardsHtml}
          <button type="button" class="btn btn-secondary" style="width:100%;padding:9px;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;border-color:rgba(234,67,53,0.4);color:#ea4335;" onclick="triggerOfficialGoogleAuth('link')" title="ربط حساب كوكل (نافذة موحدة للبيانات و Drive و Classroom)">
            <i class="fas fa-plus"></i> <i class="fab fa-google"></i>
          </button>
        `;
      }
    }

    // =========================================================================
    // TAB 2: DEDICATED CUSTOM DATA & CUSTOM PHOTOS ARCHIVE
    // =========================================================================
    else if (curTab === 'custom') {
      const cFirst = s.custom_first_name || (s.custom_name ? String(s.custom_name).split(/\s+/)[0] : '') || '';
      const cLast = s.custom_last_name || (s.custom_name ? String(s.custom_name).split(/\s+/).slice(1).join(' ') : '') || '';
      const cUser = (s.custom_username || '').replace(/^@/, '');
      const cEmail = s.custom_email || (s.email_source === 'custom' ? s.email : '') || '';
      const cPhone = s.custom_phone || (s.phone_source === 'custom' ? s.phone : '') || '';
      const cBirth = s.custom_birth_date || s.birth_date || '';
      const cGender = s.custom_gender || s.gender || '';
      const cBio = s.custom_bio || '';
      const customPhotos = Array.isArray(s.custom_photos) ? s.custom_photos : [];
      const hiddenPhotoIds = Array.isArray(s.hidden_photo_ids) ? s.hidden_photo_ids : [];
      const activeCustomFid = s.custom_photo_file_id || (customPhotos[0]?.file_id || '');

      tabContentHtml = `
        <div class="nk-glass-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:12px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:6px;" title="تُحفظ بياناتك المخصصة هنا دائماً ويمكنك اعتماد أي حقل منها بنقرة واحدة"><i class="fas fa-pen-ruler"></i> البيانات المخصصة</span>
            <button type="button" class="btn btn-primary btn-sm" onclick="saveCustomProfileFields()" title="حفظ جميع الحقول المخصصة" style="padding:5px 12px;font-size:11px;">
              <i class="fas fa-check"></i>
            </button>
          </div>

          <!-- First Name & Last Name (Separate fields, combined in platform display) -->
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:8px;">
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:10px;color:var(--text-muted);" title="الاسم الأول المخصص"><i class="fas fa-user"></i> الأول</span>
                <button type="button" class="nk-adopt-chip ${fs.first_name === 'custom' ? 'active' : ''}" onclick="adoptFieldSource('first_name','custom')" title="اعتماد الاسم الأول المخصص"><i class="fas ${fs.first_name === 'custom' ? 'fa-check-circle' : 'fa-circle'}"></i></button>
              </div>
              <input type="text" id="nk-custom-first-name" value="${escHtml(cFirst)}" placeholder="الاسم الأول" style="font-size:12px;padding:7px;margin:0;">
            </div>
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:10px;color:var(--text-muted);" title="الاسم الثاني / اللقب المخصص"><i class="fas fa-users"></i> الثاني</span>
                <button type="button" class="nk-adopt-chip ${fs.last_name === 'custom' ? 'active' : ''}" onclick="adoptFieldSource('last_name','custom')" title="اعتماد الاسم الثاني المخصص"><i class="fas ${fs.last_name === 'custom' ? 'fa-check-circle' : 'fa-circle'}"></i></button>
              </div>
              <input type="text" id="nk-custom-last-name" value="${escHtml(cLast)}" placeholder="الاسم الثاني" style="font-size:12px;padding:7px;margin:0;">
            </div>
          </div>

          <!-- Custom Username -->
          <div style="margin-bottom:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:10px;color:var(--text-muted);" title="اسم المستخدم المخصص"><i class="fas fa-at"></i> المعرف</span>
              <button type="button" class="nk-adopt-chip ${fs.username === 'custom' ? 'active' : ''}" onclick="adoptFieldSource('username','custom')" title="اعتماد اسم المستخدم المخصص"><i class="fas ${fs.username === 'custom' ? 'fa-check-circle' : 'fa-circle'}"></i></button>
            </div>
            <input type="text" id="nk-custom-username" dir="ltr" value="${escHtml(cUser)}" placeholder="username" style="font-size:12px;padding:7px;margin:0;text-align:right;">
          </div>

          <!-- Custom Email + Inline Verification inside the same field card -->
          <div style="margin-bottom:8px;padding:8px;border-radius:10px;background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.2);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:10px;color:#60a5fa;display:flex;align-items:center;gap:5px;" title="البريد الإلكتروني المخصص">
                <i class="fas fa-envelope"></i>
                ${cEmail ? (s.email_verified && fs.email === 'custom' ? '<i class="fas fa-circle-check" style="color:#26a69a;" title="مؤكد"></i>' : '<i class="fas fa-circle-exclamation" style="color:#f59e0b;" title="يتطلب رمز تحقق"></i>') : ''}
              </span>
              <button type="button" class="nk-adopt-chip ${fs.email === 'custom' ? 'active' : ''}" onclick="adoptFieldSource('email','custom')" title="اعتماد البريد المخصص"><i class="fas ${fs.email === 'custom' ? 'fa-check-circle' : 'fa-circle'}"></i></button>
            </div>
            <div style="display:flex;gap:5px;align-items:center;">
              <input type="email" id="nk-custom-email" dir="ltr" value="${escHtml(cEmail)}" placeholder="example@mail.com" style="flex:1;font-size:12px;padding:7px;margin:0;text-align:right;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="saveCustomProfileFields().then(()=>requestContactVerificationCode())" title="إرسال رمز التحقق إلى هذا البريد" style="padding:7px 9px;flex-shrink:0;">
                <i class="fas fa-paper-plane" style="color:#60a5fa;"></i>
              </button>
            </div>
            ${(cEmail && !s.email_verified) ? `
              <div style="display:flex;gap:5px;margin-top:6px;">
                <input type="text" id="settings-verify-code-input" dir="ltr" maxlength="6" placeholder="رمز التحقق (6 أرقام)" style="flex:1;font-size:11px;padding:6px;margin:0;text-align:center;letter-spacing:2px;">
                <button type="button" class="btn btn-primary btn-sm" onclick="submitContactVerificationCode()" title="تأكيد الرمز" style="padding:6px 10px;">
                  <i class="fas fa-check"></i>
                </button>
              </div>
            ` : ''}
          </div>

          <!-- Custom Phone + Inline Verification -->
          <div style="margin-bottom:8px;padding:8px;border-radius:10px;background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.2);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:10px;color:#34d399;display:flex;align-items:center;gap:5px;" title="رقم الهاتف المخصص">
                <i class="fas fa-phone"></i>
                ${cPhone ? (s.phone_verified ? '<i class="fas fa-circle-check" style="color:#26a69a;" title="مؤكد"></i>' : '<i class="fas fa-circle-exclamation" style="color:#f59e0b;" title="غير مؤكد"></i>') : ''}
              </span>
              <div style="display:flex;gap:4px;">
                ${cPhone ? `<button type="button" class="nk-adopt-chip" style="color:#ef4444;border-color:rgba(239,68,68,0.3);" onclick="deleteUserPhone()" title="حذف الرقم"><i class="fas fa-trash-can"></i></button>` : ''}
                <button type="button" class="nk-adopt-chip ${fs.phone === 'custom' ? 'active' : ''}" onclick="adoptFieldSource('phone','custom')" title="اعتماد الرقم المخصص"><i class="fas ${fs.phone === 'custom' ? 'fa-check-circle' : 'fa-circle'}"></i></button>
              </div>
            </div>
            <div style="display:flex;gap:5px;align-items:center;">
              <input type="tel" id="nk-custom-phone" dir="ltr" value="${escHtml(cPhone)}" placeholder="+964..." style="flex:1;font-size:12px;padding:7px;margin:0;text-align:right;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="requestTelegramPhoneVerification()" title="تأكيد الرقم عبر مطابقته مع تلگرام" style="padding:7px 9px;flex-shrink:0;">
                <i class="fab fa-telegram" style="color:#29b6f6;"></i>
              </button>
            </div>
          </div>

          <!-- Birth Date & Distinct Color Gender Buttons (Blue Male / Pink Female) -->
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:8px;">
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:10px;color:var(--text-muted);" title="تاريخ الميلاد المخصص"><i class="fas fa-calendar-day"></i></span>
                <button type="button" class="nk-adopt-chip ${fs.birth_date === 'custom' ? 'active' : ''}" onclick="adoptFieldSource('birth_date','custom')" title="اعتماد تاريخ الميلاد المخصص"><i class="fas ${fs.birth_date === 'custom' ? 'fa-check-circle' : 'fa-circle'}"></i></button>
              </div>
              <input type="date" id="nk-custom-birth" dir="ltr" value="${escHtml(cBirth)}" style="font-size:11px;padding:6px;margin:0;">
            </div>
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:10px;color:var(--text-muted);" title="الجنس (أزرق للذكر / وردي للأنثى)"><i class="fas fa-venus-mars"></i></span>
                <button type="button" class="nk-adopt-chip ${fs.gender === 'custom' ? 'active' : ''}" onclick="adoptFieldSource('gender','custom')" title="اعتماد الجنس المخصص"><i class="fas ${fs.gender === 'custom' ? 'fa-check-circle' : 'fa-circle'}"></i></button>
              </div>
              <div style="display:flex;gap:5px;height:33px;">
                <button type="button" onclick="setNkCustomGender('male')" title="ذكر" style="flex:1;border-radius:8px;border:1.5px solid ${cGender === 'male' ? '#3b82f6' : 'rgba(59,130,246,0.28)'};background:${cGender === 'male' ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.06)'};color:#3b82f6;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;">
                  <i class="fas fa-mars"></i>
                </button>
                <button type="button" onclick="setNkCustomGender('female')" title="أنثى" style="flex:1;border-radius:8px;border:1.5px solid ${cGender === 'female' ? '#ec4899' : 'rgba(236,72,153,0.28)'};background:${cGender === 'female' ? 'rgba(236,72,153,0.22)' : 'rgba(236,72,153,0.06)'};color:#ec4899;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;">
                  <i class="fas fa-venus"></i>
                </button>
                ${cGender ? `<button type="button" onclick="setNkCustomGender('')" title="إلغاء تحديد الجنس" style="width:28px;border-radius:8px;border:1px solid rgba(128,128,128,0.25);background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;"><i class="fas fa-xmark"></i></button>` : ''}
              </div>
            </div>
          </div>

          <!-- Custom Bio (Saved to Telegram storage channel via message_id) -->
          <div style="margin-bottom:6px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:10px;color:var(--text-muted);display:flex;align-items:center;gap:5px;" title="النبذة المخصصة (تُحفظ سحابياً على خوادم تلگرام بمعرف الرسالة لتوفير المساحة)">
                <i class="fas fa-quote-right"></i> النبذة المخصصة
                ${s.custom_bio_msg_id ? `<span style="color:#29b6f6;font-size:9px;" title="محفوظة على خوادم تلگرام (#${s.custom_bio_msg_id})"><i class="fab fa-telegram"></i> #${s.custom_bio_msg_id}</span>` : ''}
              </span>
              <button type="button" class="nk-adopt-chip ${fs.bio === 'custom' ? 'active' : ''}" onclick="adoptFieldSource('bio','custom')" title="اعتماد النبذة المخصصة"><i class="fas ${fs.bio === 'custom' ? 'fa-check-circle' : 'fa-circle'}"></i></button>
            </div>
            <textarea id="nk-custom-bio" rows="2" placeholder="اكتب نبذة تعريفية عنك..." style="width:100%;font-size:11px;padding:7px;border-radius:8px;background:var(--input-bg);color:var(--text);border:1px solid var(--input-border);resize:vertical;box-sizing:border-box;">${escHtml(cBio)}</textarea>
          </div>
          <button type="button" class="btn btn-primary" style="width:100%;font-size:12px;padding:8px;" onclick="saveCustomProfileFields()" title="حفظ البيانات المخصصة">
            <i class="fas fa-floppy-disk"></i>
          </button>
        </div>

        <!-- Custom Photos Archive with Reorder, Hide/Show, Select, Delete -->
        <div class="nk-glass-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:12px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:6px;" title="جميع الصور التي رفعتها سابقاً لاختيار أي منها أو إعادة ترتيبها أو إخفائها"><i class="fas fa-images"></i> أرشيف الصور المخصصة (${customPhotos.length})</span>
            <div style="display:flex;gap:5px;">
              <button type="button" class="nk-adopt-chip ${fs.photo === 'custom' || s.photo_source === 'custom' ? 'active' : ''}" onclick="adoptFieldSource('photo','custom')" title="اعتماد الصورة المخصصة كصورة رئيسية">
                <i class="fas ${fs.photo === 'custom' || s.photo_source === 'custom' ? 'fa-check-circle' : 'fa-circle'}"></i>
              </button>
              <button type="button" class="btn btn-primary btn-sm" onclick="triggerCustomAvatarUpload()" title="رفع صورة مخصصة جديدة" style="padding:5px 10px;font-size:11px;">
                <i class="fas fa-cloud-arrow-up"></i>
              </button>
            </div>
          </div>
          ${customPhotos.length ? `
            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;">
              ${customPhotos.map((cp, idx) => {
                const fid = String(cp.file_id || '');
                const isMain = fid === String(activeCustomFid) && (s.photo_source === 'custom' || fs.photo === 'custom');
                const isHidden = hiddenPhotoIds.includes(fid);
                return `
                  <div style="position:relative;border-radius:12px;overflow:hidden;border:2px solid ${isMain ? 'var(--accent)' : 'rgba(128,128,128,0.22)'};background:rgba(0,0,0,0.2);aspect-ratio:1/1;">
                    <img src="/api/user/photo/${encodeURIComponent(userId)}?file_id=${encodeURIComponent(fid)}" alt="" onclick="selectCustomArchivePhoto('${escHtml(fid)}')" title="انقر لتعيينها كصورة رئيسية" style="width:100%;height:100%;object-fit:cover;cursor:pointer;opacity:${isHidden ? '0.45' : '1'};">
                    <div style="position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-around;padding:3px;background:rgba(0,0,0,0.68);backdrop-filter:blur(4px);">
                      ${idx > 0 ? `<button type="button" onclick="event.stopPropagation();reorderCustomArchivePhoto('${escHtml(fid)}','up')" title="تقديم للأمام" style="background:none;border:none;color:#fff;cursor:pointer;font-size:10px;padding:2px;"><i class="fas fa-arrow-right"></i></button>` : ''}
                      ${idx < customPhotos.length - 1 ? `<button type="button" onclick="event.stopPropagation();reorderCustomArchivePhoto('${escHtml(fid)}','down')" title="تأخير للخلف" style="background:none;border:none;color:#fff;cursor:pointer;font-size:10px;padding:2px;"><i class="fas fa-arrow-left"></i></button>` : ''}
                      <button type="button" onclick="event.stopPropagation();togglePhotoVisibilityForOthers('${escHtml(fid)}')" title="${isHidden ? 'مخفية عن الآخرين (انقر لإظهارها)' : 'ظاهرة للآخرين (انقر لإخفائها)'}" style="background:none;border:none;color:${isHidden ? '#f59e0b' : '#34d399'};cursor:pointer;font-size:10px;padding:2px;">
                        <i class="fas ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
                      </button>
                      <button type="button" onclick="event.stopPropagation();deleteCustomArchivePhoto('${escHtml(fid)}')" title="حذف الصورة" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:10px;padding:2px;">
                        <i class="fas fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `<div style="text-align:center;font-size:11px;color:var(--text-muted);padding:10px;">لم ترفع صوراً مخصصة بعد</div>`}
        </div>
      `;
    }

    // =========================================================================
    // TAB 3: GRANULAR PRIVACY & VISIBILITY CONTROLS (EVERY FIELD & TAB)
    // =========================================================================
    else if (curTab === 'privacy') {
      const p = (s.privacy && typeof s.privacy === 'object') ? s.privacy : {};
      const privRows = [
        { key: 'show_platform_id', icon: 'fas fa-fingerprint', color: '#c9956c', label: 'معرف المنصة (01)', def: true },
        { key: 'show_first_name', icon: 'fas fa-user', color: '#38bdf8', label: 'الاسم الأول', def: true },
        { key: 'show_last_name', icon: 'fas fa-users', color: '#38bdf8', label: 'الاسم الثاني / اللقب', def: true },
        { key: 'show_username', icon: 'fas fa-at', color: '#818cf8', label: 'اسم المستخدم (@)', def: true },
        { key: 'show_bio', icon: 'fas fa-quote-right', color: '#c084fc', label: 'النبذة التعريفية (البايو)', def: true },
        { key: 'show_gender', icon: 'fas fa-venus-mars', color: '#f472b6', label: 'الجنس', def: true },
        { key: 'show_birth_date', icon: 'fas fa-cake-candles', color: '#fbbf24', label: 'تاريخ الميلاد', def: false },
        { key: 'show_email', icon: 'fas fa-envelope', color: '#60a5fa', label: 'البريد الإلكتروني', def: false },
        { key: 'show_phone', icon: 'fas fa-phone', color: '#34d399', label: 'رقم الهاتف', def: false },
        { key: 'show_telegram', icon: 'fab fa-telegram', color: '#29b6f6', label: 'حسابات تلگرام المرتبطة', def: true },
        { key: 'show_google', icon: 'fab fa-google', color: '#ea4335', label: 'حسابات كوكل المرتبطة', def: false },
        { key: 'show_photos_custom', icon: 'fas fa-images', color: '#c9956c', label: 'تبويب الصور المخصصة للآخرين', def: true },
        { key: 'show_photos_telegram', icon: 'fab fa-telegram', color: '#29b6f6', label: 'تبويب صور تلگرام للآخرين', def: true },
        { key: 'show_photos_google', icon: 'fab fa-google', color: '#ea4335', label: 'تبويب صور كوكل للآخرين', def: true },
        { key: 'show_stats', icon: 'fas fa-chart-pie', color: '#a78bfa', label: 'الإحصائيات والنشاط', def: true },
      ];

      tabContentHtml = `
        <div class="nk-glass-card">
          <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px;display:flex;align-items:center;gap:6px;" title="تحكم كامل بظهور كل معلومة وكل تبويب صور في ملفك الشخصي للآخرين">
            <i class="fas fa-user-shield"></i> التحكم الكامل بالظهور للآخرين
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            ${privRows.map((item) => {
              const isChecked = p[item.key] !== undefined ? Boolean(p[item.key]) : item.def;
              return `
                <div class="settings-row" onclick="window._toggleGranularPrivacy('${item.key}', ${item.def})" title="إظهار / إخفاء ${item.label}" style="cursor:pointer;padding:7px 8px;">
                  <i class="${item.icon}" style="color:${item.color};width:18px;text-align:center;"></i>
                  <span style="font-size:12px;flex:1;">${item.label}</span>
                  <label class="settings-row-right" style="pointer-events:none;">
                    <input type="checkbox" class="toggle" ${isChecked ? 'checked' : ''} style="pointer-events:none;">
                  </label>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // =========================================================================
    // TAB 4: ACTIVE SESSIONS, DEVICE BLOCKING & 30-DAY ACCOUNT DELETION
    // =========================================================================
    else if (curTab === 'security') {
      const sessData = window._nkCachedSessions || {};
      const sessions = Array.isArray(sessData.sessions) ? sessData.sessions : (Array.isArray(s.sessions) ? s.sessions : []);
      const blocked = Array.isArray(sessData.blocked_devices) ? sessData.blocked_devices : (Array.isArray(s.blocked_devices) ? s.blocked_devices : []);
      const curSid = getSessionId();
      const delExecAt = s.deletion_execute_at || '';
      const delExecTs = Number(s.deletion_execute_ts || 0);
      const daysLeft = delExecTs ? Math.max(0, Math.ceil((delExecTs - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

      tabContentHtml = `
        <!-- Active Sessions & Devices -->
        <div class="nk-glass-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:12px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:6px;" title="الأجهزة والمتصفحات المتصلة بحسابك"><i class="fas fa-laptop-code"></i> الجلسات والأجهزة النشطة (${sessions.length})</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window._fetchUserSessions()" title="تحديث قائمة الجلسات" style="padding:4px 8px;font-size:10px;">
              <i class="fas fa-arrows-rotate"></i>
            </button>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${sessions.length ? sessions.map((sess) => {
              const sid = String(sess.session_id || '');
              const dfp = String(sess.device_fp || '');
              const isThis = sid === curSid;
              return `
                <div style="padding:8px;border-radius:10px;background:rgba(0,0,0,0.14);border:1px solid ${isThis ? 'rgba(38,166,154,0.4)' : 'rgba(128,128,128,0.16)'};display:flex;align-items:center;justify-content:space-between;gap:8px;">
                  <div style="min-width:0;flex:1;">
                    <div style="font-size:11px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:5px;">
                      <i class="fas ${/Android|iPhone|iPad|Mobile/i.test(sess.os || sess.user_agent || '') ? 'fa-mobile-screen' : 'fa-desktop'}" style="color:var(--accent);"></i>
                      <span>${escHtml(sess.browser || 'متصفح')} — ${escHtml(sess.os || 'جهاز')}</span>
                      ${isThis ? '<span style="font-size:9px;padding:1px 6px;border-radius:999px;background:rgba(38,166,154,0.2);color:#26a69a;">الجلسة الحالية</span>' : ''}
                    </div>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">
                      ${sess.last_active ? formatDate(sess.last_active) : ''} ${sess.ip ? `• IP: ${escHtml(sess.ip)}` : ''}
                    </div>
                  </div>
                  ${!isThis ? `
                    <div style="display:flex;gap:4px;">
                      <button type="button" onclick="manageNkSessionAction('revoke','${escHtml(sid)}','')" title="تسجيل الخروج من هذه الجلسة" style="width:26px;height:26px;border-radius:7px;border:none;background:rgba(245,158,11,0.15);color:#f59e0b;cursor:pointer;">
                        <i class="fas fa-right-from-bracket" style="font-size:10px;"></i>
                      </button>
                      <button type="button" onclick="manageNkSessionAction('block','${escHtml(sid)}','${escHtml(dfp)}')" title="حظر هذا الجهاز والمتصفح" style="width:26px;height:26px;border-radius:7px;border:none;background:rgba(239,68,68,0.15);color:#ef4444;cursor:pointer;">
                        <i class="fas fa-ban" style="font-size:10px;"></i>
                      </button>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('') : `<div style="text-align:center;font-size:11px;color:var(--text-muted);padding:8px;">لا توجد جلسات أخرى مسجلة</div>`}
          </div>

          ${blocked.length ? `
            <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(128,128,128,0.16);">
              <div style="font-size:11px;font-weight:700;color:#ef4444;margin-bottom:6px;"><i class="fas fa-ban"></i> الأجهزة المحظورة (${blocked.length})</div>
              ${blocked.map((b) => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:8px;background:rgba(239,68,68,0.08);margin-bottom:4px;font-size:11px;">
                  <span>${escHtml(b.label || b.device_fp || 'جهاز محظور')}</span>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="manageNkSessionAction('unblock','','${escHtml(b.device_fp || '')}')" title="إلغاء الحظر" style="padding:3px 8px;font-size:10px;">
                    <i class="fas fa-unlock"></i>
                  </button>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- 30-Day Scheduled Account Deletion -->
        <div class="nk-glass-card" style="border-color:rgba(239,68,68,0.35);background:rgba(239,68,68,0.05);">
          <div style="font-size:12px;font-weight:700;color:#ef4444;margin-bottom:6px;display:flex;align-items:center;gap:6px;" title="حذف الحساب نهائياً بعد مهلة 30 يوماً">
            <i class="fas fa-user-xmark"></i> حذف الحساب (مهلة 30 يوماً)
          </div>
          ${delExecAt ? `
            <div style="padding:8px;border-radius:9px;background:rgba(239,68,68,0.12);margin-bottom:8px;font-size:11px;line-height:1.6;">
              <div>⏳ <b>الحساب مجدول للحذف النهائي:</b></div>
              <div>📅 تاريخ التنفيذ: <b>${escHtml(formatDate(delExecAt))}</b></div>
              <div>⏱️ المتبقي: <b>${daysLeft} يوم</b></div>
            </div>
            <button type="button" class="btn btn-primary" style="width:100%;font-size:12px;background:#26a69a;border-color:#26a69a;" onclick="cancelNkAccountDeletion()" title="إلغاء جدولة حذف الحساب فوراً">
              <i class="fas fa-rotate-left"></i> إلغاء حذف الحساب واستعادته
            </button>
          ` : `
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">
              عند تأكيد الحذف بكلمة المرور، يُجدول حذف حسابك بعد 30 يوماً ويُرسل تأكيد للبوت مع إمكانية الإلغاء في أي وقت.
            </div>
            <div style="display:flex;gap:6px;">
              <input type="password" id="nk-delete-acc-password" placeholder="أدخل كلمة المرور للتأكيد" style="flex:1;font-size:11px;padding:7px;margin:0;">
              <button type="button" class="btn btn-danger btn-sm" onclick="scheduleNkAccountDeletion()" title="جدولة حذف الحساب بعد 30 يوماً" style="padding:7px 12px;flex-shrink:0;">
                <i class="fas fa-trash-can"></i>
              </button>
            </div>
          `}
        </div>
      `;
    }

    // =========================================================================
    // TAB 5: APPEARANCE, LANGUAGE & PREFERENCES
    // =========================================================================
    else if (curTab === 'prefs') {
      const currentTheme = localStorage.getItem('theme') || 'system';
      const curLang = typeof appLang !== 'undefined' ? appLang : (localStorage.getItem('lang') || 'ar');
      const gesOn = localStorage.getItem('gesturesEnabled') === 'true';
      const transOn = localStorage.getItem('tabTransitions') === 'true';
      const notifFiles = s.notif_files === true;
      const notifGroups = s.notif_groups === true;
      const curTagView = typeof tagViewMode !== 'undefined' ? tagViewMode : 'current';

      tabContentHtml = `
        <div class="nk-glass-card">
          <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <i class="fas fa-palette"></i> المظهر واللغة
          </div>
          <div class="settings-row" style="justify-content:space-between;">
            <span title="المظهر"><i class="fas fa-circle-half-stroke"></i></span>
            <div style="display:flex;gap:5px;">
              <button type="button" class="btn ${currentTheme === 'system' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="applyTheme('system');window._populateDrawer()" title="تلقائي حسب النظام"><i class="fas fa-desktop"></i></button>
              <button type="button" class="btn ${currentTheme === 'dark' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="applyTheme('dark');window._populateDrawer()" title="الوضع الداكن"><i class="fas fa-moon"></i></button>
              <button type="button" class="btn ${currentTheme === 'light' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="applyTheme('light');window._populateDrawer()" title="الوضع الفاتح"><i class="fas fa-sun"></i></button>
            </div>
          </div>
          <div class="settings-row" style="justify-content:space-between;">
            <span title="اللغة"><i class="fas fa-globe"></i></span>
            <div style="display:flex;gap:5px;">
              <button type="button" class="btn ${curLang === 'ar' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="_setLangDrawer('ar')" title="العربية">ع</button>
              <button type="button" class="btn ${curLang === 'en' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="_setLangDrawer('en')" title="English">EN</button>
              <button type="button" class="btn ${curLang === 'ku' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="_setLangDrawer('ku')" title="کوردی">کو</button>
            </div>
          </div>
        </div>

        <div class="nk-glass-card">
          <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <i class="fas fa-sliders"></i> التفضيلات والإشعارات
          </div>
          <div class="settings-row" title="طريقة عرض قوائم الوسوم">
            <i class="fas fa-tags"></i>
            <span>الوسوم</span>
            <div class="tag-view-mode-control" role="group">
              <button type="button" data-tag-view-mode="current" aria-pressed="${curTagView !== 'all'}" title="عرض القوائم طولياً" onclick="setTagViewMode('current');window._populateDrawer()">
                <i class="fas fa-list-ul"></i>
              </button>
              <button type="button" data-tag-view-mode="all" aria-pressed="${curTagView === 'all'}" title="عرض القوائم في صفوف" onclick="setTagViewMode('all');window._populateDrawer()">
                <i class="fas fa-grip"></i>
              </button>
            </div>
          </div>
          <div class="settings-row" onclick="_toggleDrawerNotif('files');window._populateDrawer()" title="إشعارات الملفات" style="cursor:pointer;">
            <i class="fas fa-file-arrow-down"></i> <span>الملفات</span>
            <label class="settings-row-right" style="pointer-events:none;"><input type="checkbox" class="toggle" ${notifFiles ? 'checked' : ''} style="pointer-events:none;"></label>
          </div>
          <div class="settings-row" onclick="_toggleDrawerNotif('groups');window._populateDrawer()" title="إشعارات المجموعات" style="cursor:pointer;">
            <i class="fas fa-users"></i> <span>المجموعات</span>
            <label class="settings-row-right" style="pointer-events:none;"><input type="checkbox" class="toggle" ${notifGroups ? 'checked' : ''} style="pointer-events:none;"></label>
          </div>
          <div class="settings-row" onclick="_toggleGestures();window._populateDrawer()" title="إيماءات السحب للتنقل" style="cursor:pointer;">
            <i class="fas fa-hand-pointer"></i> <span>الإيماءات</span>
            <label class="settings-row-right" style="pointer-events:none;"><input type="checkbox" class="toggle" ${gesOn ? 'checked' : ''} style="pointer-events:none;"></label>
          </div>
          <div class="settings-row" onclick="_toggleTabTransitions();window._populateDrawer()" title="حركات الانتقال بين التبويبات" style="cursor:pointer;">
            <i class="fas fa-wand-magic-sparkles"></i> <span>الحركات</span>
            <label class="settings-row-right" style="pointer-events:none;"><input type="checkbox" class="toggle" ${transOn ? 'checked' : ''} style="pointer-events:none;"></label>
          </div>
        </div>
        ${typeof _buildAiDrawerSection === 'function' ? _buildAiDrawerSection() : ''}
      `;
    }

    body.innerHTML = topTabsHtml + tabContentHtml;
    body.scrollTop = savedScroll;

    if (curTab === 'account' && subTab === 'telegram' && typeof loadTelegramPhotosGallery === 'function') {
      loadTelegramPhotosGallery(false);
    }
  };
  window._nkRenderUnifiedDrawer = window._populateDrawer;

  window._toggleGranularPrivacy = async function (key, defaultVal) {
    const s = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const p = (s.privacy && typeof s.privacy === 'object') ? { ...s.privacy } : {};
    const cur = p[key] !== undefined ? Boolean(p[key]) : defaultVal;
    p[key] = !cur;
    s.privacy = p;
    localStorage.setItem('appSettings', JSON.stringify(s));
    window._populateDrawer();
    if (userId) {
      try {
        const r = await fetch(`/api/users/${encodeURIComponent(userId)}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ privacy: p }),
        });
        const d = await r.json();
        if (r.ok && d.user) {
          window._applyServerUserPreferences(d.user);
          showToast(p[key] ? '👁️ تم تفعيل الظهور للآخرين' : '🔒 تم الإخفاء عن الآخرين');
        }
      } catch (e) {}
    }
  };

  // Also replace openMultiAccountModal so any legacy button calling it opens the drawer or dropdown cleanly
  window.openMultiAccountModal = function () {
    const drawer = document.getElementById('settings-drawer');
    if (drawer && drawer.classList.contains('open')) {
      window._nkDrawerTab = 'account';
      window._nkAccountSubTab = 'overview';
      window._populateDrawer();
    } else {
      window.toggleTopBarAccountsDropdown();
    }
  };

  // ─── 9. Enhanced Public User Profile Modal (Browse Photos by Tab + Gender + Bio) ───
  const origOpenUserProfile = window.openUserProfile;
  window.openUserProfile = async function (uid) {
    if (typeof origOpenUserProfile === 'function') {
      await origOpenUserProfile(uid);
    }
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(uid)}?viewer_id=${encodeURIComponent(userId || '')}`);
      if (!r.ok) return;
      const u = await r.json();
      const bodyEl = document.getElementById('user-profile-body');
      if (!bodyEl) return;

      const priv = (u.privacy && typeof u.privacy === 'object') ? u.privacy : {};
      const isSelfOrOwner = String(uid) === String(userId) || (typeof userRole !== 'undefined' && userRole === 'owner');
      const hiddenIds = Array.isArray(u.hidden_photo_ids) ? u.hidden_photo_ids : [];

      const extraRows = [];
      if (u.bio && (isSelfOrOwner || priv.show_bio !== false)) {
        extraRows.push(`
          <div class="profile-detail-row">
            <span class="profile-detail-label" title="النبذة التعريفية"><i class="fas fa-quote-right" style="color:var(--accent);"></i></span>
            <span class="profile-detail-value">${escHtml(u.bio)}</span>
          </div>
        `);
      }
      if (u.gender && (isSelfOrOwner || priv.show_gender !== false)) {
        const gIcon = u.gender === 'male' ? 'fa-mars' : 'fa-venus';
        const gColor = u.gender === 'male' ? '#3b82f6' : '#ec4899';
        const gLabel = u.gender === 'male' ? 'ذكر' : 'أنثى';
        extraRows.push(`
          <div class="profile-detail-row">
            <span class="profile-detail-label" title="الجنس"><i class="fas ${gIcon}" style="color:${gColor};"></i></span>
            <span class="profile-detail-value" style="color:${gColor};font-weight:700;">${gLabel}</span>
          </div>
        `);
      }

      const customPhotos = (isSelfOrOwner || priv.show_photos_custom !== false)
        ? (Array.isArray(u.custom_photos) ? u.custom_photos : []).filter((p) => isSelfOrOwner || !hiddenIds.includes(String(p.file_id || '')))
        : [];
      const googlePhotos = (isSelfOrOwner || priv.show_photos_google !== false)
        ? (Array.isArray(u.google_accounts) ? u.google_accounts : []).filter((g) => g.picture)
        : [];

      let tgPhotos = [];
      if ((isSelfOrOwner || priv.show_photos_telegram !== false) && u.telegram_linked) {
        try {
          const tr = await fetch(`/api/users/${encodeURIComponent(uid)}/telegram-photos`);
          if (tr.ok) {
            const td = await tr.json();
            tgPhotos = (Array.isArray(td.photos) ? td.photos : []).filter((p) => isSelfOrOwner || !hiddenIds.includes(String(p.file_id || '')));
          }
        } catch (e) {}
      }

      const hasAnyGallery = customPhotos.length > 0 || tgPhotos.length > 0 || googlePhotos.length > 0;
      const galleryHtml = hasAnyGallery ? `
        <div class="nk-glass-card" style="margin-top:10px;">
          <div style="font-size:11px;font-weight:700;color:var(--accent);margin-bottom:6px;display:flex;align-items:center;gap:5px;">
            <i class="fas fa-images"></i> تصفح صور المستخدم حسب التبويب
          </div>
          ${customPhotos.length ? `
            <div style="margin-bottom:6px;">
              <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;"><i class="fas fa-image" style="color:var(--accent);"></i> الصور المخصصة (${customPhotos.length})</div>
              <div style="display:flex;gap:6px;overflow-x:auto;padding:2px;">
                ${customPhotos.map((cp) => `<img src="/api/user/photo/${encodeURIComponent(uid)}?file_id=${encodeURIComponent(cp.file_id)}" onclick="window.open(this.src,'_blank')" style="width:46px;height:46px;border-radius:10px;object-fit:cover;cursor:pointer;border:1px solid rgba(201,149,108,0.35);flex-shrink:0;">`).join('')}
              </div>
            </div>
          ` : ''}
          ${tgPhotos.length ? `
            <div style="margin-bottom:6px;">
              <div style="font-size:10px;color:#29b6f6;margin-bottom:4px;"><i class="fab fa-telegram"></i> صور تلگرام (${tgPhotos.length})</div>
              <div style="display:flex;gap:6px;overflow-x:auto;padding:2px;">
                ${tgPhotos.map((tp) => `<img src="/api/user/photo/${encodeURIComponent(uid)}?file_id=${encodeURIComponent(tp.file_id)}" onclick="window.open(this.src,'_blank')" style="width:46px;height:46px;border-radius:10px;object-fit:cover;cursor:pointer;border:1px solid rgba(41,182,246,0.35);flex-shrink:0;">`).join('')}
              </div>
            </div>
          ` : ''}
          ${googlePhotos.length ? `
            <div>
              <div style="font-size:10px;color:#ea4335;margin-bottom:4px;"><i class="fab fa-google"></i> صور كوكل (${googlePhotos.length})</div>
              <div style="display:flex;gap:6px;overflow-x:auto;padding:2px;">
                ${googlePhotos.map((gp) => `<img src="${escHtml(gp.picture)}" style="width:46px;height:46px;border-radius:10px;object-fit:cover;border:1px solid rgba(234,67,53,0.35);flex-shrink:0;">`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      ` : '';

      if (extraRows.length || galleryHtml) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = extraRows.join('') + galleryHtml;
        bodyEl.appendChild(wrapper);
      }
    } catch (e) {}
  };

  // ─── 10. Bootstrapping on DOM Ready ───
  function initUpgrade() {
    bindTopBarDropdownLongPress();
    if (typeof _updateDrawerHeader === 'function') _updateDrawerHeader();
    renderUploadModalGoogleSwitcher();
    if (document.getElementById('settings-drawer')?.classList.contains('open')) {
      window._populateDrawer();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUpgrade);
  } else {
    initUpgrade();
  }
})();

