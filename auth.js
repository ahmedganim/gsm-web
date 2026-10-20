/**
 * auth.js — أدوات الحماية (Guard + Badge + Logout)
 * يُضمَّن في كل صفحة محمية
 */
(function () {
  'use strict';

  const AUTH_KEY = 'gsm_auth_v1';

  const $ = (s, c = document) => c.querySelector(s);

  /* ============================================================
   * قراءة/كتابة الجلسة
   * ============================================================ */
  function getAuth() {
    try {
      const raw = sessionStorage.getItem(AUTH_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.role !== 'user' && parsed.role !== 'admin') return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function setAuth(data) {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(data));
  }

  function clearAuth() {
    sessionStorage.removeItem(AUTH_KEY);
  }

  /* ============================================================
   * حماية الصفحات
   * ============================================================ */
  function guard(minRole) {
    const auth = getAuth();
    const currentFile =
      (location.pathname.split('/').pop() || 'index.html') + location.search;

    if (!auth) {
      location.replace(
        'login.html?redirect=' + encodeURIComponent(currentFile)
      );
      return false;
    }

    if (minRole === 'admin' && auth.role !== 'admin') {
      /* المستخدم مسجّل لكن ليس أدمن */
      location.replace('index.html');
      return false;
    }

    return true;
  }

  /* ============================================================
   * شارة المستخدم + زر الخروج
   * ============================================================ */
  function injectBadge() {
    const auth = getAuth();
    if (!auth) return;

    const headerContent = $('.header-content');
    if (!headerContent) return;
    if (headerContent.querySelector('.user-badge')) return;

    const isAdmin = auth.role === 'admin';

    const badge = document.createElement('div');
    badge.className = 'user-badge';
    badge.innerHTML = `
      <span class="user-badge-icon" aria-hidden="true">
        ${isAdmin ? '👨‍💼' : '👤'}
      </span>
      <span class="user-badge-info">
        <span class="user-badge-role">${isAdmin ? 'أدمن' : 'مستخدم'}</span>
        <span class="user-badge-name">${escapeHtml(auth.username)}</span>
      </span>
      <button type="button" class="user-logout-btn"
              title="تسجيل الخروج" aria-label="تسجيل الخروج">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;

    badge.querySelector('.user-logout-btn').addEventListener('click', () => {
      if (window.confirm('هل تريد تسجيل الخروج؟')) {
        clearAuth();
        location.href = 'login.html';
      }
    });

    headerContent.appendChild(badge);
  }

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  /* ============================================================
   * التشغيل التلقائي
   * ============================================================ */
  function boot() {
    injectBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* API عام */
  window.GSMAuth = { getAuth, setAuth, clearAuth, guard, injectBadge };
})();