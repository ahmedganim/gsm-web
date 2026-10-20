/**
 * login.js — منطق صفحة تسجيل الدخول
 */
(function () {
  'use strict';

  const AUTH_KEY = 'gsm_auth_v1';

  /* بيانات الدخول المسموح بها */
  const USERS = {
    'user':  { password: 'user',  role: 'user',  label: 'مستخدم' },
    'admin': { password: 'admin', role: 'admin', label: 'أدمن'  }
  };

  const ALLOWED_PAGES = {
    user:  ['index.html', 'vendors.html'],
    admin: ['index.html', 'vendors.html', 'admin.html']
  };

  /* ============================================================
   * الأدوات
   * ============================================================ */
  const form        = document.getElementById('loginForm');
  const errorEl     = document.getElementById('loginError');
  const usernameEl  = document.getElementById('username');
  const passwordEl  = document.getElementById('password');
  const toggleBtn   = document.querySelector('.toggle-password');

  function getRedirectTarget() {
    const raw = new URLSearchParams(location.search).get('redirect');
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch { return null; }
  }

  function isRedirectAllowed(redirect, role) {
    if (!redirect) return false;
    const base = redirect.split('?')[0].split('#')[0];
    return ALLOWED_PAGES[role] && ALLOWED_PAGES[role].includes(base);
  }

  function defaultDestination(role) {
    return role === 'admin' ? 'admin.html' : 'index.html';
  }

  /* ============================================================
   * إذا كان المستخدم مسجل الدخول بالفعل — توجيه تلقائي
   * ============================================================ */
  (function checkExistingSession() {
    try {
      const raw = sessionStorage.getItem(AUTH_KEY);
      if (!raw) return;
      const auth = JSON.parse(raw);
      if (!auth || (auth.role !== 'user' && auth.role !== 'admin')) return;

      const redirect = getRedirectTarget();
      if (isRedirectAllowed(redirect, auth.role)) {
        location.replace(redirect);
      } else {
        location.replace(defaultDestination(auth.role));
      }
    } catch (e) {
      /* تجاهل */
    }
  })();

  /* ============================================================
   * رسائل الخطأ
   * ============================================================ */
  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
    errorEl.classList.remove('shake');
    void errorEl.offsetWidth;
    errorEl.classList.add('shake');
  }

  function hideError() {
    if (errorEl) errorEl.style.display = 'none';
  }

  /* ============================================================
   * إظهار/إخفاء كلمة المرور
   * ============================================================ */
  toggleBtn?.addEventListener('click', () => {
    const isPassword = passwordEl.type === 'password';
    passwordEl.type = isPassword ? 'text' : 'password';
    toggleBtn.classList.toggle('is-visible', isPassword);
    toggleBtn.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
    toggleBtn.setAttribute(
      'aria-label',
      isPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'
    );
    passwordEl.focus();
  });

  /* ============================================================
   * إرسال النموذج
   * ============================================================ */
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    hideError();

    const username = (usernameEl.value || '').trim().toLowerCase();
    const password = passwordEl.value || '';

    if (!username || !password) {
      showError('يرجى إدخال اسم المستخدم وكلمة المرور');
      (!username ? usernameEl : passwordEl).focus();
      return;
    }

    const user = USERS[username];
    if (!user || user.password !== password) {
      showError('اسم المستخدم أو كلمة المرور غير صحيحة');
      passwordEl.value = '';
      passwordEl.focus();
      return;
    }

    /* حفظ الجلسة */
    const auth = {
      username,
      role: user.role,
      label: user.label,
      loginAt: Date.now()
    };

    try {
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    } catch (err) {
      showError('تعذّر حفظ الجلسة. تأكد من تفعيل التخزين في المتصفح.');
      return;
    }

    /* تحديد الوجهة */
    const redirect = getRedirectTarget();
    const dest = isRedirectAllowed(redirect, user.role)
      ? redirect
      : defaultDestination(user.role);

    /* ملاحظة إن كانت الصفحة المطلوبة غير مسموحة */
    if (redirect && !isRedirectAllowed(redirect, user.role)) {
      showError('ليس لديك صلاحية للوصول لهذه الصفحة. جاري توجيهك...');
    }

    /* تعطيل الزر مع رسالة بصرية */
    const btn = form.querySelector('.login-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'جاري التحقق...';
    }

    setTimeout(() => {
      location.href = dest;
    }, redirect && !isRedirectAllowed(redirect, user.role) ? 1200 : 300);
  });

  /* تركيز تلقائي على اسم المستخدم */
  usernameEl?.focus();
})();