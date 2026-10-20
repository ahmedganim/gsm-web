/**
 * data.js
 * قاعدة البيانات + قارئ localStorage (أجهزة + شركات) + منطق الصفحات
 */
(function () {
  'use strict';

  /* ============================================================
   * 1) بيانات الأجهزة الأصلية
   * ============================================================ */
  const devices = [
    { retailName: "Honor 10", vendor: "Huawei", deviceModel: "COL-AL10", soc: "HiSilicon Kirin", processorModel: "970", encryptionType: "AES-256", systemVersion: "Android 9", extractionMethods: "Android full file system, Kirin Extraction", image: "image_1.jpg" },
    { retailName: "Nova 4e", vendor: "Huawei", deviceModel: "MAR-AL00", soc: "HiSilicon Kirin", processorModel: "710", encryptionType: "WPA2-PSK", systemVersion: "V16", extractionMethods: "Android full file system, Kirin Extraction", image: "image_2.jpg" },
    { retailName: "Galaxy J7 Duos", vendor: "Samsung", deviceModel: "SM-J710F", soc: "Exynos", processorModel: "7870", encryptionType: "FDE", systemVersion: "Android 8.0", extractionMethods: "Android full file system, Samsung Exynos", image: "image_3.jpg" },
    { retailName: "iPhone 12 Pro Max", vendor: "Apple", deviceModel: "A2342", soc: "Apple", processorModel: "A14 Bionic", encryptionType: "AES-256", systemVersion: "iOS 14", extractionMethods: "iOS full logical via SSH", image: "image_4.jpg" },
    { retailName: "A1-734", vendor: "Acer", deviceModel: "A1-734", soc: "MediaTek", processorModel: "MT8735", encryptionType: "WPA2-PSK", systemVersion: "Android 16", extractionMethods: "Android full file system, MTK Android via boot modification, MTK Android Extraction", image: "imge/image_5.jpg" },
    { retailName: "X4 Soul Mini S", vendor: "AllView", deviceModel: "X4_Soul_Mini_S_TM", soc: "MediaTek", processorModel: "MT6737", encryptionType: "Full Disk", systemVersion: "Android 7.0", extractionMethods: "Android full file system, MTK Android via boot modification, MTK Android Extraction", image: "imge/image_6.jpg" },
    { retailName: "ZenFone 3 Laser", vendor: "ASUS", deviceModel: "Z01BD", soc: "Qualcomm", processorModel: "MSM8937", encryptionType: "Full Disk", systemVersion: "Android 6.0.1", extractionMethods: "Android full file system, Qualcomm EDL Extraction", image: "image_7.jpg" },
    { retailName: "DTEK60", vendor: "BlackBerry", deviceModel: "BBA100-1", soc: "Qualcomm", processorModel: "MSM8996", encryptionType: "Full Disk", systemVersion: "Android 6.0.1", extractionMethods: "Android full file system, Qualcomm EDL Extraction", image: "image_8.jpg" },
    { retailName: "3600i", vendor: "Coolpad", deviceModel: "3600i", soc: "Qualcomm", processorModel: "MSM8952", encryptionType: "AES", systemVersion: "AireOS 8.5", extractionMethods: "Android full file system, Qualcomm EDL Extraction", image: "image_9.jpg" },
    { retailName: "IQ4516 Octa", vendor: "Fly", deviceModel: "IQ4516", soc: "MediaTek", processorModel: "MT6592", encryptionType: "Full Disk", systemVersion: "Android 4.4.2", extractionMethods: "Android full file system, MTK Android via boot modification, MTK Android Extraction", image: "image_10.jpg" }
  ];

  /* ============================================================
   * 2) خريطة شعارات الشركات (fallback)
   * ============================================================ */
  const VENDOR_LOGOS = {
    "Acer":       "Acer5.png",
    "AllView":    "ALLVIEW6.png",
    "Apple":      "apple 4.png",
    "ASUS":       "asus7.png",
    "BlackBerry": "BLACKBERRY8.png",
    "Coolpad":    "coolpad9.png",
    "Fly":        "fly.jpg",
    "Huawei":     "HUAWEI1+2.png",
    "Samsung":    "sumsung 3.png"
  };

  window.devices      = devices;
  window.VENDOR_LOGOS = VENDOR_LOGOS;

  /* ============================================================
   * 3) قارئ localStorage (أجهزة + شركات)
   * ============================================================ */
  const DEVICES_KEY = 'gsm_devices_admin_v1';
  const VENDORS_KEY = 'gsm_vendors_admin_v1';

  function loadActiveDevices() {
    try {
      const stored = localStorage.getItem(DEVICES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { console.warn('devices storage:', e); }
    return devices;
  }

  function loadActiveVendors() {
    try {
      const stored = localStorage.getItem(VENDORS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) { console.warn('vendors storage:', e); }

    /* بناء تلقائي من VENDOR_LOGOS + أسماء الشركات في الأجهزة */
    const map = new Map();
    Object.entries(VENDOR_LOGOS).forEach(([name, logo]) => {
      map.set(name.toLowerCase(), { name, logo });
    });
    devices.forEach(d => {
      const v = (d.vendor || '').trim();
      if (v && !map.has(v.toLowerCase())) {
        map.set(v.toLowerCase(), { name: v, logo: '' });
      }
    });
    return Array.from(map.values());
  }

  const activeDevices = loadActiveDevices();
  const activeVendors = loadActiveVendors();

  /* ============================================================
   * 4) أدوات مساعدة
   * ============================================================ */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
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

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function getUrlParam(name) {
    const val = new URLSearchParams(window.location.search).get(name);
    return val ? decodeURIComponent(val).trim() : null;
  }

  const FALLBACK_IMG =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='14' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'%3ENo Image%3C/text%3E%3C/svg%3E";

  function renderChips(methods) {
    return String(methods || '').split(',')
      .map(m => m.trim()).filter(Boolean)
      .map(m => `<span class="chip">${escapeHtml(m)}</span>`).join('');
  }

  /* ============================================================
   * 5) صفحة index.html
   * ============================================================ */
  function initIndexPage() {
    const container = $('#devices-container');
    if (!container) return;

    const modal            = $('#deviceModal');
    const modalBody        = $('#modal-body');
    const modalClose       = modal ? modal.querySelector('.modal-close') : null;
    const resultsCount     = $('#resultsCount');
    const searchInput      = $('#searchInput');
    const filterBanner     = $('#filterBanner');
    const filterBannerText = $('#filterBannerText');

    const selectedVendor = getUrlParam('vendor');
    let lastFocusedElement = null;

    function displayDevices(list, showExtra = false) {
      container.innerHTML = '';

      if (resultsCount) {
        resultsCount.textContent = list.length === 1 ? 'جهاز واحد' : `${list.length} جهاز`;
      }

      if (list.length === 0) {
        container.innerHTML = `<div class="empty-state">لا توجد أجهزة مطابقة لبحثك.</div>`;
        return;
      }

      const frag = document.createDocumentFragment();

      list.forEach(device => {
        const card = document.createElement('article');
        card.className = 'device-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `فتح تفاصيل ${device.retailName}`);

        const extraHTML = showExtra ? `
          <div class="spec-row">
            <span class="spec-label">موديل المعالج:</span>
            <span class="spec-val">${escapeHtml(device.processorModel)}</span>
          </div>
          <div class="spec-row">
            <span class="spec-label">نوع التشفير:</span>
            <span class="spec-val">${escapeHtml(device.encryptionType)}</span>
          </div>
          <div class="search-extraction-box">
            <strong>طرق الاستخراج:</strong>
            <div class="extraction-chips">${renderChips(device.extractionMethods)}</div>
          </div>
        ` : '';

        card.innerHTML = `
          <div class="card-img-wrapper">
            <span class="os-badge">${escapeHtml(device.systemVersion)}</span>
            <img src="${escapeHtml(device.image)}" alt="${escapeHtml(device.retailName)}" loading="lazy"
                 onerror="this.onerror=null;this.src='${FALLBACK_IMG}';">
          </div>
          <div class="card-body">
            <h3 class="device-title">${escapeHtml(device.retailName)}</h3>
            <div class="specs-mini-list">
              <div class="spec-row"><span class="spec-label">الشركة المصنعة:</span><span class="spec-val strong-dark">${escapeHtml(device.vendor)}</span></div>
              <div class="spec-row"><span class="spec-label">موديل الجهاز:</span><span class="spec-val strong-primary">${escapeHtml(device.deviceModel)}</span></div>
              <div class="spec-row"><span class="spec-label">المعالج (SoC):</span><span class="spec-val">${escapeHtml(device.soc)}</span></div>
              <div class="spec-row"><span class="spec-label">إصدار النظام:</span><span class="spec-val">${escapeHtml(device.systemVersion)}</span></div>
              ${extraHTML}
            </div>
            <div class="card-footer-btn">عرض البطاقة التقنية الكاملة</div>
          </div>
        `;

        card.addEventListener('click', () => openDeviceModal(device));
        card.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDeviceModal(device); }
        });
        frag.appendChild(card);
      });

      container.appendChild(frag);
    }

    function openDeviceModal(device) {
      if (!modal || !modalBody) return;
      lastFocusedElement = document.activeElement;

      modalBody.innerHTML = `
        <div class="modal-visual">
          <img src="${escapeHtml(device.image)}" alt="${escapeHtml(device.retailName)}"
               onerror="this.onerror=null;this.src='${FALLBACK_IMG}';">
          <h2>${escapeHtml(device.retailName)}</h2>
          <span class="model-pill">${escapeHtml(device.deviceModel)}</span>
        </div>
        <div class="modal-specs">
          <div class="modal-section-title">المواصفات التقنية الكاملة</div>
          <div class="specs-grid">
            <div class="spec-box"><span class="label">الاسم التجاري</span><span class="value">${escapeHtml(device.retailName)}</span></div>
            <div class="spec-box"><span class="label">الشركة المصنعة</span><span class="value value-primary">${escapeHtml(device.vendor)}</span></div>
            <div class="spec-box"><span class="label">موديل الجهاز</span><span class="value value-primary">${escapeHtml(device.deviceModel)}</span></div>
            <div class="spec-box"><span class="label">المعالج (SoC)</span><span class="value">${escapeHtml(device.soc)}</span></div>
            <div class="spec-box"><span class="label">موديل المعالج</span><span class="value">${escapeHtml(device.processorModel)}</span></div>
            <div class="spec-box"><span class="label">إصدار النظام</span><span class="value">${escapeHtml(device.systemVersion)}</span></div>
            <div class="spec-box"><span class="label">نوع التشفير</span><span class="value">${escapeHtml(device.encryptionType)}</span></div>
          </div>
          <div class="extraction-panel">
            <span class="label">طرق الاستخراج المدعومة</span>
            <div class="extraction-chips">${renderChips(device.extractionMethods)}</div>
          </div>
        </div>
      `;

      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      modal.setAttribute('aria-label', `تفاصيل ${device.retailName}`);
      document.body.style.overflow = 'hidden';
      if (modalClose) modalClose.focus();
    }

    function closeModal() {
      if (!modal) return;
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
    }

    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    if (modalClose) modalClose.addEventListener('click', closeModal);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modal && modal.style.display === 'flex') closeModal();
    });

    function filterDevices() {
      const query = (searchInput ? searchInput.value : '').trim().toLowerCase();

      const filtered = activeDevices.filter(d => {
        const matchesVendor = !selectedVendor ||
          (d.vendor || '').trim().toLowerCase() === selectedVendor.toLowerCase();

        const matchesQuery = query === '' || (
          (d.retailName || '').toLowerCase().includes(query) ||
          (d.vendor || '').toLowerCase().includes(query) ||
          (d.deviceModel || '').toLowerCase().includes(query) ||
          (d.soc || '').toLowerCase().includes(query) ||
          (d.processorModel || '').toLowerCase().includes(query) ||
          (d.encryptionType || '').toLowerCase().includes(query) ||
          (d.systemVersion || '').toLowerCase().includes(query) ||
          (d.extractionMethods || '').toLowerCase().includes(query)
        );
        return matchesVendor && matchesQuery;
      });

      displayDevices(filtered, query !== '' || Boolean(selectedVendor));
    }

    if (searchInput) searchInput.addEventListener('input', debounce(filterDevices, 120));

    if (selectedVendor) {
      if (filterBanner && filterBannerText) {
        filterBannerText.textContent = `عرض أجهزة شركة: ${selectedVendor.toUpperCase()}`;
        filterBanner.style.display = 'flex';
      }
      if (searchInput) searchInput.placeholder = `ابحث داخل أجهزة شركة ${selectedVendor}...`;
    }

    filterDevices();
  }

  /* ============================================================
   * 6) صفحة vendors.html
   * ============================================================ */
  function initVendorsPage() {
    const container = $('#vendorsContainer');
    if (!container) return;

    const searchInput = $('#vendorSearch');
    const statsEl     = $('#vendorStats');

    /* عدد الأجهزة لكل شركة */
    const counts = {};
    activeDevices.forEach(d => {
      const v = (d.vendor || '').trim();
      if (v) counts[v] = (counts[v] || 0) + 1;
    });

    /* دمج الشركات: من قائمة activeVendors + أي شركة موجودة في الأجهزة */
    const allNames = new Set([
      ...activeVendors.map(v => v.name),
      ...Object.keys(counts)
    ]);

    const vendorList = Array.from(allNames).map(name => {
      const vend = activeVendors.find(v =>
        v.name.toLowerCase() === name.toLowerCase()
      );
      const logo = ((vend && vend.logo) || VENDOR_LOGOS[name] || '').trim();
      return { name, logo, count: counts[name] || 0 };
    }).sort((a, b) => a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' }));

    container.innerHTML = vendorList.map(v => {
      const initial = escapeHtml(v.name.charAt(0).toUpperCase());
      const hue     = hashString(v.name) % 360;
      const label   = v.count === 1 ? 'جهاز واحد' : (v.count ? `${v.count} أجهزة` : 'لا توجد أجهزة');

      const avatarHTML = v.logo
        ? `
          <div class="vendor-avatar vendor-avatar-logo">
            <img src="${escapeHtml(v.logo)}" alt="شعار ${escapeHtml(v.name)}" loading="lazy"
                 onerror="this.style.display='none';
                          this.parentElement.classList.remove('vendor-avatar-logo');
                          this.parentElement.style.background='hsl(${hue},90%,95%)';
                          this.parentElement.style.color='hsl(${hue},65%,38%)';
                          this.parentElement.textContent='${initial}';">
          </div>`
        : `
          <div class="vendor-avatar"
               style="background:hsl(${hue},90%,95%);color:hsl(${hue},65%,38%);">${initial}</div>`;

      return `
        <a class="vendor-box-card"
           href="index.html?vendor=${encodeURIComponent(v.name)}"
           data-vendor="${escapeHtml(v.name.toLowerCase())}"
           aria-label="عرض أجهزة ${escapeHtml(v.name)}">
          ${avatarHTML}
          <h3 class="vendor-name">${escapeHtml(v.name)}</h3>
          <span class="vendor-count-badge">${label}</span>
        </a>
      `;
    }).join('');

    function updateStats(visible) {
      if (!statsEl) return;
      statsEl.textContent = `${visible} ${visible === 1 ? 'شركة' : 'شركات'} • ${activeDevices.length} جهاز`;
    }

    updateStats(vendorList.length);

    if (searchInput) {
      const onSearch = debounce(() => {
        const q = searchInput.value.trim().toLowerCase();
        let visible = 0;
        $$('.vendor-box-card', container).forEach(card => {
          const match = !q || card.dataset.vendor.includes(q);
          card.style.display = match ? '' : 'none';
          if (match) visible++;
        });
        updateStats(visible);
      }, 120);
      searchInput.addEventListener('input', onSearch);
    }
  }

  /* ============================================================
   * 7) الإقلاع
   * ============================================================ */
  function boot() { initIndexPage(); initVendorsPage(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
