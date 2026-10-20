/**
 * admin.js — لوحة تحكم الأدمن
 * CRUD للأجهزة + الشركات + تصدير data.js
 */
(function () {
  'use strict';

  /* ============================================================
   * إعدادات
   * ============================================================ */
  const DEVICES_KEY = 'gsm_devices_admin_v1';
  const VENDORS_KEY = 'gsm_vendors_admin_v1';
  const FORM_FIELDS = [
    'retailName', 'vendor', 'deviceModel', 'soc',
    'processorModel', 'encryptionType', 'systemVersion',
    'image', 'extractionMethods'
  ];

  /* ============================================================
   * الحالة
   * ============================================================ */
  let devices = [];
  let vendors = [];
  let deviceSearch = '';
  let vendorSearch = '';
  let editingDeviceIndex = null;
  let editingVendorIndex = null;
  let deleteType  = null;  // 'device' | 'vendor'
  let deleteIndex = null;

  /* ============================================================
   * أدوات مساعدة
   * ============================================================ */
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  function debounce(fn, wait = 150) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  const FALLBACK_IMG =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Crect width='60' height='60' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='9' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'%3ENo%20Img%3C/text%3E%3C/svg%3E";

  function showToast(msg, type = 'success') {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast toast-${type} toast-show`;
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('toast-show'), 2800);
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /* ============================================================
   * تحميل / حفظ البيانات
   * ============================================================ */
  function getOriginalDevices() {
    return window.devices ? JSON.parse(JSON.stringify(window.devices)) : [];
  }

  function getOriginalVendors() {
    const map = new Map();
    const logos = window.VENDOR_LOGOS || {};
    Object.entries(logos).forEach(([name, logo]) => {
      map.set(name.toLowerCase(), { name, logo });
    });
    const originals = window.devices || [];
    originals.forEach(d => {
      const v = (d.vendor || '').trim();
      if (v && !map.has(v.toLowerCase())) map.set(v.toLowerCase(), { name: v, logo: '' });
    });
    return Array.from(map.values());
  }

  function loadDevices() {
    try {
      const stored = localStorage.getItem(DEVICES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { console.error('loadDevices:', e); }
    return getOriginalDevices();
  }

  function loadVendors() {
    try {
      const stored = localStorage.getItem(VENDORS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { console.error('loadVendors:', e); }
    return getOriginalVendors();
  }

  function saveDevices(list) {
    try { localStorage.setItem(DEVICES_KEY, JSON.stringify(list)); }
    catch (e) { showToast('فشل حفظ الأجهزة', 'error'); }
  }

  function saveVendors(list) {
    try { localStorage.setItem(VENDORS_KEY, JSON.stringify(list)); }
    catch (e) { showToast('فشل حفظ الشركات', 'error'); }
  }

  /* ============================================================
   * مزامنة الشركات مع الأجهزة
   * ============================================================ */
  function ensureVendorExists(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    const exists = vendors.some(v => v.name.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      vendors.push({ name: trimmed, logo: '' });
      saveVendors(vendors);
      renderVendorTable();
    }
  }

  function renameVendorInDevices(oldName, newName) {
    if (oldName.toLowerCase() === newName.toLowerCase()) return;
    let changed = false;
    devices.forEach(d => {
      if ((d.vendor || '').trim() === oldName) {
        d.vendor = newName;
        changed = true;
      }
    });
    if (changed) {
      saveDevices(devices);
      renderDeviceTable();
    }
  }

  function countDevicesForVendor(name) {
    return devices.filter(d => (d.vendor || '').trim().toLowerCase() === name.toLowerCase()).length;
  }

  /* ============================================================
   * جدول الأجهزة
   * ============================================================ */
  function getFilteredDevices() {
    if (!deviceSearch) return devices.map((d, i) => ({ device: d, index: i }));
    const q = deviceSearch.toLowerCase();
    return devices
      .map((d, i) => ({ device: d, index: i }))
      .filter(({ device: d }) => (
        (d.retailName || '').toLowerCase().includes(q) ||
        (d.vendor || '').toLowerCase().includes(q) ||
        (d.deviceModel || '').toLowerCase().includes(q) ||
        (d.soc || '').toLowerCase().includes(q) ||
        (d.processorModel || '').toLowerCase().includes(q) ||
        (d.systemVersion || '').toLowerCase().includes(q) ||
        (d.encryptionType || '').toLowerCase().includes(q)
      ));
  }

  function renderDeviceTable() {
    const tbody = $('#devicesTbody');
    const empty = $('#tableEmpty');
    if (!tbody || !empty) return;

    const filtered = getFilteredDevices();

    const totalEl   = $('#statTotal');
    const vendorsEl = $('#statVendors');
    const filterEl  = $('#statFiltered');

    if (totalEl) totalEl.textContent = devices.length;
    if (vendorsEl) {
      const set = new Set(devices.map(d => (d.vendor || '').trim()).filter(Boolean));
      vendorsEl.textContent = set.size;
    }
    if (filterEl) filterEl.textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      empty.textContent = deviceSearch
        ? 'لا توجد أجهزة تطابق البحث.'
        : 'لا توجد أجهزة. اضغط على "إضافة جهاز جديد" للبدء.';
      return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = filtered.map(({ device: d, index }) => `
      <tr>
        <td class="cell-index">${index + 1}</td>
        <td>
          <div class="thumb">
            <img src="${escapeHtml(d.image || '')}" alt="" loading="lazy"
                 onerror="this.onerror=null;this.src='${FALLBACK_IMG}';">
          </div>
        </td>
        <td class="cell-strong">${escapeHtml(d.retailName || '—')}</td>
        <td><span class="badge badge-vendor">${escapeHtml(d.vendor || '—')}</span></td>
        <td class="cell-mono">${escapeHtml(d.deviceModel || '—')}</td>
        <td>${escapeHtml(d.soc || '—')}</td>
        <td class="cell-mono">${escapeHtml(d.systemVersion || '—')}</td>
        <td class="cell-actions">
          <button class="icon-btn edit-btn" type="button" data-index="${index}" title="تعديل">✏️</button>
          <button class="icon-btn delete-btn" type="button" data-index="${index}" title="حذف">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  /* ============================================================
   * جدول الشركات
   * ============================================================ */
  function getFilteredVendors() {
    if (!vendorSearch) return vendors.map((v, i) => ({ vendor: v, index: i }));
    const q = vendorSearch.toLowerCase();
    return vendors
      .map((v, i) => ({ vendor: v, index: i }))
      .filter(({ vendor: v }) => v.name.toLowerCase().includes(q));
  }

  function renderVendorTable() {
    const tbody = $('#vendorsTbody');
    const empty = $('#vendorsEmpty');
    if (!tbody || !empty) return;

    const filtered = getFilteredVendors();

    const totalEl   = $('#statVendorTotal');
    const withDevEl = $('#statVendorWithDevices');
    const filterEl  = $('#statVendorFiltered');

    if (totalEl) totalEl.textContent = vendors.length;
    if (withDevEl) {
      withDevEl.textContent = vendors.filter(v => countDevicesForVendor(v.name) > 0).length;
    }
    if (filterEl) filterEl.textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      empty.textContent = vendorSearch
        ? 'لا توجد شركات تطابق البحث.'
        : 'لا توجد شركات. اضغط على "إضافة شركة جديدة" للبدء.';
      return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = filtered.map(({ vendor: v, index }) => {
      const count   = countDevicesForVendor(v.name);
      const initial = escapeHtml(v.name.charAt(0).toUpperCase());
      const hue     = hashString(v.name) % 360;

      const logoHTML = v.logo
        ? `<div class="vendor-thumb"><img src="${escapeHtml(v.logo)}" alt="شعار ${escapeHtml(v.name)}" loading="lazy"
                onerror="this.parentElement.classList.add('fallback');this.parentElement.style.color='hsl(${hue},65%,38%)';this.parentElement.textContent='${initial}';"></div>`
        : `<div class="vendor-thumb fallback" style="color:hsl(${hue},65%,38%);">${initial}</div>`;

      const badgeCls = count > 0 ? 'badge badge-count' : 'badge badge-count zero';

      return `
        <tr>
          <td class="cell-index">${index + 1}</td>
          <td>${logoHTML}</td>
          <td class="cell-strong">${escapeHtml(v.name)}</td>
          <td><span class="${badgeCls}">${count} ${count === 1 ? 'جهاز' : 'أجهزة'}</span></td>
          <td class="cell-actions">
            <button class="icon-btn edit-vendor-btn" type="button" data-index="${index}" title="تعديل">✏️</button>
            <button class="icon-btn delete-vendor-btn" type="button" data-index="${index}" title="حذف">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  /* ============================================================
   * نموذج الجهاز
   * ============================================================ */
  function openDeviceFormModal(index = null) {
    const modal = $('#deviceModal');
    const form  = $('#deviceForm');
    const title = $('#modalTitle');
    if (!modal || !form || !title) return;

    editingDeviceIndex = index;
    form.reset();
    delete form.dataset.originalData;

    if (index !== null && devices[index]) {
      const d = devices[index];
      title.textContent = `تعديل: ${d.retailName || 'جهاز'}`;
      form.dataset.originalData = JSON.stringify(d);
      FORM_FIELDS.forEach(key => {
        const input = form.elements[key];
        if (input) input.value = d[key] ?? '';
      });
    } else {
      title.textContent = 'إضافة جهاز جديد';
    }

    updateDeviceImagePreview();
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => form.querySelector('input[name="retailName"]')?.focus(), 60);
  }

  function closeDeviceFormModal() {
    const modal = $('#deviceModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    editingDeviceIndex = null;
  }

  function updateDeviceImagePreview() {
    const form = $('#deviceForm');
    const preview = $('#imagePreview');
    if (!form || !preview) return;
    const value = (form.elements.image?.value || '').trim();
    if (!value) { preview.innerHTML = '<span>معاينة الصورة</span>'; return; }
    preview.innerHTML = `<img src="${escapeHtml(value)}" alt="معاينة" onerror="this.parentElement.innerHTML='<span>تعذّر تحميل الصورة</span>';">`;
  }

  function handleDeviceSubmit(e) {
    e.preventDefault();
    const form = e.target;

    let data = {};
    if (editingDeviceIndex !== null && form.dataset.originalData) {
      try { data = JSON.parse(form.dataset.originalData); } catch (_) {}
    }

    FORM_FIELDS.forEach(key => {
      const el = form.elements[key];
      data[key] = el ? String(el.value || '').trim() : '';
    });

    if (!data.retailName || !data.vendor || !data.deviceModel) {
      showToast('يرجى تعبئة: الاسم التجاري، الشركة، والموديل', 'warning');
      return;
    }

    if (editingDeviceIndex !== null && devices[editingDeviceIndex]) {
      devices[editingDeviceIndex] = data;
      showToast(`تم تعديل: ${data.retailName}`, 'success');
    } else {
      devices.push(data);
      showToast(`تمت إضافة: ${data.retailName}`, 'success');
    }

    saveDevices(devices);
    ensureVendorExists(data.vendor);
    renderDeviceTable();
    closeDeviceFormModal();
  }

  /* ============================================================
   * نموذج الشركة
   * ============================================================ */
  function openVendorFormModal(index = null) {
    const modal = $('#vendorModal');
    const form  = $('#vendorForm');
    const title = $('#vendorModalTitle');
    if (!modal || !form || !title) return;

    editingVendorIndex = index;
    form.reset();

    if (index !== null && vendors[index]) {
      title.textContent = `تعديل: ${vendors[index].name}`;
      form.elements.name.value = vendors[index].name;
      form.elements.logo.value = vendors[index].logo || '';
    } else {
      title.textContent = 'إضافة شركة جديدة';
    }

    updateVendorLogoPreview();
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => form.elements.name?.focus(), 60);
  }

  function closeVendorFormModal() {
    const modal = $('#vendorModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    editingVendorIndex = null;
  }

  function updateVendorLogoPreview() {
    const form = $('#vendorForm');
    const preview = $('#vendorLogoPreview');
    if (!form || !preview) return;
    const value = (form.elements.logo?.value || '').trim();
    if (!value) { preview.innerHTML = '<span>معاينة الشعار</span>'; return; }
    preview.innerHTML = `<img src="${escapeHtml(value)}" alt="معاينة" onerror="this.parentElement.innerHTML='<span>تعذّر تحميل الشعار</span>';">`;
  }

  function handleVendorSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const name = String(form.elements.name.value || '').trim();
    const logo = String(form.elements.logo.value || '').trim();

    if (!name) {
      showToast('اسم الشركة مطلوب', 'warning');
      return;
    }

    /* منع التكرار */
    const duplicate = vendors.some((v, i) =>
      v.name.toLowerCase() === name.toLowerCase() && i !== editingVendorIndex
    );
    if (duplicate) {
      showToast('هذه الشركة موجودة بالفعل', 'warning');
      return;
    }

    if (editingVendorIndex !== null && vendors[editingVendorIndex]) {
      const oldName = vendors[editingVendorIndex].name;
      vendors[editingVendorIndex] = { name, logo };
      saveVendors(vendors);
      renameVendorInDevices(oldName, name);
      showToast(`تم تعديل: ${name}`, 'success');
    } else {
      vendors.push({ name, logo });
      saveVendors(vendors);
      showToast(`تمت إضافة: ${name}`, 'success');
    }

    renderVendorTable();
    closeVendorFormModal();
  }

  /* ============================================================
   * تأكيد الحذف (مشترك)
   * ============================================================ */
  function openDeleteModal(type, index) {
    const modal = $('#deleteModal');
    const msg   = $('#deleteMessage');
    if (!modal || !msg) return;

    deleteType = type;
    deleteIndex = index;

    if (type === 'device') {
      const d = devices[index];
      if (!d) return;
      msg.innerHTML =
        `هل أنت متأكد من حذف <strong>${escapeHtml(d.retailName || 'هذا الجهاز')}</strong> ` +
        `(${escapeHtml(d.deviceModel || '')})؟<br>` +
        `<span style="color:#dc2626;font-size:0.9em;">لا يمكن التراجع.</span>`;
    } else if (type === 'vendor') {
      const v = vendors[index];
      if (!v) return;
      const count = countDevicesForVendor(v.name);
      const warning = count > 0
        ? `<br><span style="color:#d97706;font-size:0.9em;">⚠️ يوجد ${count} جهاز مرتبط بهذه الشركة. الأجهزة ستبقى كما هي، لكن الشركة ستُحذف من القائمة.</span>`
        : '';
      msg.innerHTML =
        `هل أنت متأكد من حذف <strong>${escapeHtml(v.name)}</strong>؟` + warning;
    }

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeDeleteModal() {
    const modal = $('#deleteModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    deleteType  = null;
    deleteIndex = null;
  }

  function confirmDelete() {
    if (deleteType === 'device' && deleteIndex !== null && devices[deleteIndex]) {
      const removed = devices.splice(deleteIndex, 1)[0];
      saveDevices(devices);
      renderDeviceTable();
      showToast(`تم حذف: ${removed.retailName || 'الجهاز'}`, 'success');
    } else if (deleteType === 'vendor' && deleteIndex !== null && vendors[deleteIndex]) {
      const removed = vendors.splice(deleteIndex, 1)[0];
      saveVendors(vendors);
      renderVendorTable();
      showToast(`تم حذف: ${removed.name}`, 'success');
    }
    closeDeleteModal();
  }

  /* ============================================================
   * تصدير data.js
   * ============================================================ */
  function downloadFile(filename, content, mime = 'application/javascript') {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function exportDataJs() {
    const devicesJson = JSON.stringify(devices, null, 2);

    /* بناء VENDOR_LOGOS من قائمة الشركات */
    const logosObj = {};
    vendors.forEach(v => {
      if (v.logo && v.logo.trim()) logosObj[v.name] = v.logo.trim();
    });
    const logosJson = JSON.stringify(logosObj, null, 4);

    try {
      const res = await fetch('data.js', { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch failed');

      let text = await res.text();
      let changed = false;

      const devRegex = /const devices = \[[\s\S]*?\];/;
      if (devRegex.test(text)) {
        text = text.replace(devRegex, `const devices = ${devicesJson};`);
        changed = true;
      }
      const logoRegex = /const VENDOR_LOGOS = \{[\s\S]*?\};/;
      if (logoRegex.test(text)) {
        text = text.replace(logoRegex, `const VENDOR_LOGOS = ${logosJson};`);
        changed = true;
      }

      if (!changed) throw new Error('patterns not matched');

      downloadFile('data.js', text);
      showToast('تم تنزيل data.js — استبدل الملف الأصلي به', 'success');
    } catch (err) {
      console.warn('Full export unavailable:', err);
      const content =
        `// انسخ هذا المحتوى واستبدل به مصفوفة devices و VENDOR_LOGOS داخل data.js\n\n` +
        `const devices = ${devicesJson};\n\n` +
        `const VENDOR_LOGOS = ${logosJson};\n`;
      downloadFile('devices-and-logos.js', content);
      showToast('تم تنزيل البيانات — انسخها يدوياً إلى data.js', 'warning');
    }
  }

  /* ============================================================
   * استعادة / مسح
   * ============================================================ */
  function resetToOriginal() {
    if (!window.confirm('استعادة البيانات الأصلية من data.js؟\nسيتم فقدان جميع التعديلات.')) return;
    devices = getOriginalDevices();
    vendors = getOriginalVendors();
    saveDevices(devices);
    saveVendors(vendors);
    renderDeviceTable();
    renderVendorTable();
    showToast('تمت استعادة البيانات الأصلية', 'success');
  }

  function clearLocalStorage() {
    if (!window.confirm('سيتم حذف البيانات المحلية (أجهزة + شركات) نهائياً.\nبعد ذلك data.js هو المصدر.\n\nهل تريد المتابعة؟')) return;
    try {
      localStorage.removeItem(DEVICES_KEY);
      localStorage.removeItem(VENDORS_KEY);
      devices = getOriginalDevices();
      vendors = getOriginalVendors();
      renderDeviceTable();
      renderVendorTable();
      showToast('تم مسح الذاكرة — data.js هو المصدر الآن', 'success');
    } catch (e) {
      console.error(e);
      showToast('تعذّر مسح الذاكرة', 'error');
    }
  }

  /* ============================================================
   * التبويبات
   * ============================================================ */
  function switchTab(tabName) {
    $$('.admin-tab').forEach(btn => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $$('.tab-panel').forEach(panel => {
      panel.classList.toggle('is-active', panel.id === `tab-${tabName}`);
    });
  }

  /* ============================================================
   * ربط الأحداث
   * ============================================================ */
  function bindEvents() {
    /* التبويبات */
    $$('.admin-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    /* الأجهزة */
    $('#addBtn')?.addEventListener('click', () => openDeviceFormModal(null));

    const adminSearch = $('#adminSearch');
    if (adminSearch) {
      adminSearch.addEventListener('input', debounce(() => {
        deviceSearch = adminSearch.value.trim();
        renderDeviceTable();
      }, 140));
    }

    $('#exportBtn')?.addEventListener('click', exportDataJs);
    $('#resetBtn')?.addEventListener('click', resetToOriginal);
    $('#clearStorageBtn')?.addEventListener('click', clearLocalStorage);

    $('#devicesTbody')?.addEventListener('click', e => {
      const editBtn   = e.target.closest('.edit-btn');
      const delBtn    = e.target.closest('.delete-btn');
      if (editBtn) openDeviceFormModal(parseInt(editBtn.dataset.index, 10));
      else if (delBtn) openDeleteModal('device', parseInt(delBtn.dataset.index, 10));
    });

    /* الشركات */
    $('#addVendorBtn')?.addEventListener('click', () => openVendorFormModal(null));

    const vendorSearchEl = $('#vendorSearchAdmin');
    if (vendorSearchEl) {
      vendorSearchEl.addEventListener('input', debounce(() => {
        vendorSearch = vendorSearchEl.value.trim();
        renderVendorTable();
      }, 140));
    }

    $('#vendorsTbody')?.addEventListener('click', e => {
      const editBtn = e.target.closest('.edit-vendor-btn');
      const delBtn  = e.target.closest('.delete-vendor-btn');
      if (editBtn) openVendorFormModal(parseInt(editBtn.dataset.index, 10));
      else if (delBtn) openDeleteModal('vendor', parseInt(delBtn.dataset.index, 10));
    });

    /* النماذج */
    const deviceForm = $('#deviceForm');
    if (deviceForm) {
      deviceForm.addEventListener('submit', handleDeviceSubmit);
      deviceForm.elements.image?.addEventListener('input', debounce(updateDeviceImagePreview, 300));
    }

    const vendorForm = $('#vendorForm');
    if (vendorForm) {
      vendorForm.addEventListener('submit', handleVendorSubmit);
      vendorForm.elements.logo?.addEventListener('input', debounce(updateVendorLogoPreview, 300));
    }

    /* الإغلاق */
    $$('.modal-close, .modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if ($('#deviceModal')?.classList.contains('show')) closeDeviceFormModal();
        if ($('#vendorModal')?.classList.contains('show')) closeVendorFormModal();
        if ($('#deleteModal')?.classList.contains('show')) closeDeleteModal();
      });
    });

    ['#deviceModal', '#vendorModal', '#deleteModal'].forEach(sel => {
      $(sel)?.addEventListener('click', e => {
        if (e.target.id === sel.slice(1)) {
          if (sel === '#deviceModal') closeDeviceFormModal();
          else if (sel === '#vendorModal') closeVendorFormModal();
          else closeDeleteModal();
        }
      });
    });

    $('#cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);
    $('#confirmDeleteBtn')?.addEventListener('click', confirmDelete);

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if ($('#deviceModal')?.classList.contains('show')) closeDeviceFormModal();
      if ($('#vendorModal')?.classList.contains('show')) closeVendorFormModal();
      if ($('#deleteModal')?.classList.contains('show')) closeDeleteModal();
    });
  }

  /* ============================================================
   * الإقلاع
   * ============================================================ */
  function boot() {
    devices = loadDevices();
    vendors = loadVendors();
    bindEvents();
    renderDeviceTable();
    renderVendorTable();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();