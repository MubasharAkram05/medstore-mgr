// ui.js
// Rendering helpers, list/cards, tabs, details modal, search, toast and profile UI.

function getFormBadgeClass(type) {
  if (type === 'Syrup') return 'bg-amber-100 text-amber-800';
  if (type === 'Injection') return 'bg-purple-100 text-purple-800';
  if (type === 'Ointment') return 'bg-blue-100 text-blue-800';
  if (type === 'Drops') return 'bg-cyan-100 text-cyan-800';
  return 'bg-emerald-100 text-emerald-800';
}

// Local stand-in for the old placehold.co images (works offline):
// teal square with a white letter.
function placeholderImage(text) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#0d9488"/>
    <text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" fill="#ffffff">${escapeHtml(String(text || ''))}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function medicineAutoImage(med) {
  // Creates a medicine-specific visual pack when no user photo is attached.
  // Uploaded medicine photos always take priority.
  const name = String(med?.name || 'Medicine').trim();
  const generic = String(med?.generic || med?.composition || '').trim();
  const form = String(med?.form || med?.type || 'Tablet').trim();
  const strength = String(med?.strength || '').trim();
  const key = (name + '|' + generic + '|' + form).toLowerCase();
  let hash = 0; for (let i=0;i<key.length;i++) hash = ((hash<<5)-hash)+key.charCodeAt(i) | 0;
  const hue = Math.abs(hash) % 360;
  const safe = v => escapeHtml(String(v).replace(/&/g,'&amp;'));
  const shortName = name.length > 22 ? name.slice(0,22) + '…' : name;
  const sub = strength || (generic.length > 28 ? generic.slice(0,28) + '…' : generic) || form;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="330" viewBox="0 0 500 330">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},55%,94%)"/><stop offset="1" stop-color="hsl(${(hue+32)%360},48%,88%)"/></linearGradient></defs>
    <rect width="500" height="330" rx="34" fill="url(#g)"/>
    <rect x="62" y="55" width="376" height="220" rx="18" fill="#fff" stroke="hsl(${hue},35%,78%)" stroke-width="4"/>
    <rect x="62" y="55" width="376" height="48" rx="18" fill="hsl(${hue},58%,42%)"/>
    <circle cx="100" cy="79" r="12" fill="#fff" opacity=".95"/><text x="122" y="86" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#fff">PHARMACY</text>
    <text x="88" y="155" font-family="Arial,sans-serif" font-size="25" font-weight="800" fill="#173b36">${safe(shortName)}</text>
    <text x="88" y="185" font-family="Arial,sans-serif" font-size="17" fill="#55716c">${safe(sub)}</text>
    <g transform="translate(365 205) rotate(-18)"><rect x="-46" y="-17" width="92" height="34" rx="17" fill="hsl(${hue},58%,42%)"/><path d="M0-17v34" stroke="#fff" stroke-width="2" opacity=".8"/><circle cx="23" cy="0" r="5" fill="#fff" opacity=".85"/></g>
    <text x="88" y="237" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#0b9275">${safe(form.toUpperCase())}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

// Category Pills + fast TAB/SYRUP/IV filters
function renderFormQuickFilters() {
  const container = document.getElementById('form-filter-row');
  if (!container) return;
  const forms = [
    { key: 'ALL', label: 'ALL', icon: 'layers-3' },
    { key: 'Tablet', label: 'TAB', icon: 'pill' },
    { key: 'Syrup', label: 'SYRUP', icon: 'flask-conical' },
    { key: 'Injection', label: 'IV', icon: 'syringe' },
    { key: 'Suspension', label: 'Suspension', icon: 'beaker' },
    { key: 'Capsule', label: 'Capsule', icon: 'pill' },
    { key: 'Cream', label: 'Cream', icon: 'droplets' },
    { key: 'Gel', label: 'Gel', icon: 'waves' },
    { key: 'Ointment', label: 'Ointment', icon: 'hand' },
    { key: 'Liquid', label: 'Liquid', icon: 'droplet' },
    { key: 'Sachet', label: 'Sachet', icon: 'package' },
    { key: 'Powder', label: 'Powder', icon: 'box' },
    { key: 'Inhaler', label: 'Inhaler', icon: 'wind' }
  ];
  container.innerHTML = forms.map(f => {
    const selected = f.key === 'ALL' ? selectedCategory === 'ALL' : selectedCategory === 'FORM:' + f.key;
    const count = f.key === 'ALL'
      ? medicines.length
      : medicines.filter(m => (m.formType || 'Tablet') === f.key).length;
    const active = selected ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50';
    return `<button type="button" data-action="filterFormType" data-form="${f.key}"
      class="flex-shrink-0 min-w-[78px] px-2.5 py-2 rounded-xl border ${active} transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95">
      <span class="flex items-center gap-1 text-[10px] font-extrabold whitespace-nowrap"><i data-lucide="${f.icon}" class="w-3.5 h-3.5"></i>${f.label}</span>
      <span class="text-[9px] opacity-75 font-semibold">${count.toLocaleString()}</span>
    </button>`;
  }).join('');
  lucide.createIcons();
}

function renderCategoryPills() {
  const categories = ['ALL', ...new Set(medicines.map(m => m.category || 'Other'))];
  const container = document.getElementById('category-pills');
  container.innerHTML = categories.map(cat => {
    const isSelected = selectedCategory === cat;
    return `
      <button data-action="filterCategory" data-category="${escapeHtml(cat)}" class="flex-shrink-0 min-w-[110px] min-h-[38px] px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition text-center ${isSelected ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}">
        ${escapeHtml(cat)}
      </button>`;
  }).join('');
}

function filterCategory(cat) {
  selectedCategory = cat;
  renderCategoryPills();
  renderMedicineList();
}

function filterFormType(formType) {
  selectedCategory = formType === 'ALL' ? 'ALL' : 'FORM:' + formType;
  renderCategoryPills();
  renderMedicineList();
}

function renderMedicineList() {
  renderHomeDashboard();
  const listContainer = document.getElementById('medicine-list');
  const emptyState = document.getElementById('empty-state');
  const searchVal = (document.getElementById('search-input').value || '').toLowerCase().trim();
  const sortVal = document.getElementById('sort-select').value;

  let filtered = medicines.filter(m => {
    const matchesCategory =
      selectedCategory === 'ALL' ||
      (selectedCategory.startsWith('FORM:') && (m.formType || 'Tablet') === selectedCategory.slice(5)) ||
      m.category === selectedCategory;
    const matchesSearch = !searchVal || m.name.toLowerCase().includes(searchVal) || (m.notes && m.notes.toLowerCase().includes(searchVal)) || (m.formType && m.formType.toLowerCase().includes(searchVal));
    return matchesCategory && matchesSearch;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (sortVal === 'name-asc') return a.name.localeCompare(b.name);
    if (sortVal === 'unit-low') return (a.tabletPrice || 0) - (b.tabletPrice || 0);
    if (sortVal === 'pack-low') return (a.pataPrice || 0) - (b.pataPrice || 0);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  document.getElementById('med-count-badge').textContent = `${filtered.length.toLocaleString()} items found`;

  if (filtered.length === 0) {
    listContainer.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  } else {
    emptyState.classList.add('hidden');
  }

  const displayItems = filtered.slice(0, 100);

  listContainer.innerHTML = displayItems.map(med => {
    const isSelected = selectedMedIds.has(med.id);
    const formType = med.formType || 'Tablet';
    const packLabel = formType === 'Tablet' ? 'Pata' : formType === 'Syrup' ? 'Bottle' : 'Pack';
    const unitLabel = 'Tablet';
    const initials = escapeHtml((med.name || '?').trim().charAt(0).toUpperCase());
    const tabs = Number(med.tabletsPerPata || med.tabletsPerPack || med.tabletsPerBox || 0);
    const packPrice = Number(med.pataPrice || 0);
    const tabletPrice = Number(med.tabletPrice || 0);
    const boxPrice = Number(med.boxPrice || 0);
    const generic = med.notes ? String(med.notes).split(',')[0].trim() : (med.generic || 'Medicine');

    return `
      <div class="mp-medicine-card group ${isSelected ? 'mp-card-selected' : ''}">
        <div class="mp-card-glow"></div>
        ${isBulkSelectMode ? `
          <div class="mp-select-wrap">
            <input type="checkbox" ${isSelected ? 'checked' : ''} data-action="toggleSelectMed" data-id="${med.id}" class="w-5 h-5 accent-emerald-600 rounded cursor-pointer">
          </div>
        ` : ''}

        <div class="mp-card-top">
          <span class="mp-form-badge ${getFormBadgeClass(formType)}">${escapeHtml(formType)}</span>
          <button type="button" data-action="openDetailsModal" data-id="${med.id}" class="mp-more" aria-label="More details">
            <i data-lucide="more-vertical" class="w-4 h-4"></i>
          </button>
        </div>

        <div data-action="openDetailsModal" data-id="${med.id}" class="mp-product-image cursor-pointer">
          <img src="${med.image || medicineAutoImage(med)}" alt="${escapeHtml(med.name)}" loading="lazy">
        </div>

        <div data-action="openDetailsModal" data-id="${med.id}" class="mp-card-info cursor-pointer">
          <h3 title="${escapeHtml(med.name)}">${escapeHtml(med.name)}</h3>
          <p class="mp-generic">${escapeHtml(generic || 'Medicine')}</p>
        </div>

        <div class="mp-card-actions">
          <button type="button" data-action="openCardCalculator" data-id="${med.id}" class="mp-calc-btn mp-calc-btn-compact">
            <i data-lucide="calculator" class="w-3.5 h-3.5"></i><span>Calculator</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (filtered.length > 100) {
    listContainer.innerHTML += `
      <div class="text-center py-3 text-xs text-slate-400 font-medium">
        Showing top 100 results of ${filtered.length.toLocaleString()} medicines. Use search to narrow down further.
      </div>
    `;
  }

  lucide.createIcons();
}

// Navigation and Tab switching
function switchTab(tab) {
  activeTab = tab;
  saveActiveTab(tab);
  ['home', 'add', 'calc', 'stats', 'profile'].forEach(t => {
    const sec = document.getElementById(`screen-${t}`);
    const navBtn = document.getElementById(`nav-${t}`);
    if (sec) sec.classList.add('hidden');
    if (navBtn) {
      navBtn.classList.remove('text-emerald-600');
      navBtn.classList.add('text-slate-400');
    }
  });

  const currentSec = document.getElementById(`screen-${tab}`);
  const currentNav = document.getElementById(`nav-${tab}`);
  if (currentSec) currentSec.classList.remove('hidden');
  if (currentNav) {
    currentNav.classList.remove('text-slate-400');
    currentNav.classList.add('text-emerald-600');
  }

  if (tab === 'calc') populateCalcDropdown();
  if (tab === 'stats') updateStatsScreen();
  lucide.createIcons();
}

function openDetailsModal(id) {
  const med = medicines.find(m => m.id === id);
  if (!med) return;
  currentDetailsMedicineId = id;

  const formType = med.formType || 'Tablet';
  const packLabel = formType === 'Tablet' ? 'Pata' : formType === 'Syrup' ? 'Bottle' : 'Pack';

  document.getElementById('modal-title').textContent = med.name;
  document.getElementById('modal-form-tag').textContent = formType;
  document.getElementById('modal-category-tag').textContent = med.category || 'General';
  document.getElementById('modal-notes').textContent = med.notes || 'No dosage or medicine notes attached.';
  document.getElementById('modal-img').src = med.image || medicineAutoImage(med);

  const boxPrice = Number(med.boxPrice || 0);
  const totalTabs = Number(med.totalTabsBox || 0) || (Number(med.stripsPerBox || 0) * Number(med.tabletsPerPata || 0));
  document.getElementById('modal-box-price').textContent = boxPrice > 0 ? `Rs. ${boxPrice.toFixed(2)}` : 'Rs. —';
  document.getElementById('modal-box-detail').textContent = Number(med.stripsPerBox || 0) > 0 ? `${med.stripsPerBox} patas / box` : 'Complete box';
  document.getElementById('modal-total-tabs').textContent = totalTabs > 0 ? totalTabs.toLocaleString() : '—';
  document.getElementById('modal-total-tabs-detail').textContent = totalTabs > 0 ? 'Tablets in box' : 'Not added';
  document.getElementById('modal-pata-price').textContent = `Rs. ${Number(med.pataPrice || 0).toFixed(2)}`;
  document.getElementById('modal-pata-count').textContent = `(${Number(med.tabletsPerPata || 0)} tablets / ${packLabel})`;
  document.getElementById('modal-tablet-price').textContent = `Rs. ${Number(med.tabletPrice || 0).toFixed(2)}`;
  document.getElementById('modal-stock-text').textContent = '';
  const modalPlaceDisplay = document.getElementById('modal-place-display');
  if (modalPlaceDisplay) modalPlaceDisplay.textContent = med.place || 'Not assigned';

  // Sell / Calculator / Edit / Delete buttons are wired once in app.js
  // and read currentDetailsMedicineId.

  document.getElementById('details-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeDetailsModal() {
  document.getElementById('details-modal').classList.add('hidden');
}

// Search and Filters
function handleSearchFilter() {
  const val = document.getElementById('search-input').value;
  const clearBtn = document.getElementById('clear-search');
  if (val) clearBtn.classList.remove('hidden');
  else clearBtn.classList.add('hidden');
  renderMedicineList();
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('clear-search').classList.add('hidden');
  renderMedicineList();
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

function loadUserProfile() {
  const storedProfile = readStoredUserProfile();
  if (storedProfile) userProfile = storedProfile;
  updateProfilePreview();
}

function saveUserProfile() {
  userProfile.name = document.getElementById('input-user-name').value;
  userProfile.store = document.getElementById('input-store-name').value;
  userProfile.location = document.getElementById('input-user-location').value;
  userProfile.phone = document.getElementById('input-user-phone').value;

  writeUserProfile(userProfile);
  updateProfilePreview();
  showToast('Profile updated!');
}

function updateProfilePreview() {
  const name = document.getElementById('input-user-name') ? document.getElementById('input-user-name').value : userProfile.name;
  const store = document.getElementById('input-store-name') ? document.getElementById('input-store-name').value : userProfile.store;
  const location = document.getElementById('input-user-location') ? document.getElementById('input-user-location').value : userProfile.location;

  document.getElementById('display-user-name').textContent = name;
  document.getElementById('display-store-name').textContent = store;
  document.getElementById('display-user-location').querySelector('span').textContent = location;

  if (userProfile.avatar) {
    document.getElementById('profile-avatar-preview').src = userProfile.avatar;
    document.getElementById('header-avatar-img').src = userProfile.avatar;
    document.getElementById('header-avatar-img').classList.remove('hidden');
    document.getElementById('header-avatar-icon').classList.add('hidden');
  }
}

function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      userProfile.avatar = event.target.result;
      saveUserProfile();
    };
    reader.readAsDataURL(file);
  }
}
