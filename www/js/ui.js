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

// Home list filters: Category, Form Type and Stock dropdowns.
// Options come from the medicines that are actually saved.
function renderListFilters() {
  const fill = (id, values, selected) => {
    const select = document.getElementById(id);
    if (!select) return selected;
    const sorted = [...new Set(values)].sort((a, b) => a.localeCompare(b));
    select.innerHTML = '<option value="ALL">All</option>' + sorted.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    // A saved filter whose value no longer exists falls back to "All"
    const value = sorted.includes(selected) ? selected : 'ALL';
    select.value = value;
    return value;
  };
  listFilters.category = fill('filter-category', medicines.map(m => m.category || 'Other'), listFilters.category);
  listFilters.form = fill('filter-form', medicines.map(m => m.formType || 'Tablet'), listFilters.form);
  const stockSelect = document.getElementById('filter-stock');
  if (stockSelect) {
    if (!['ALL', 'LOW', 'OUT'].includes(listFilters.stock)) listFilters.stock = 'ALL';
    stockSelect.value = listFilters.stock;
  }
  updateFilterHighlight();
}

function setListFilter(key, value) {
  listFilters[key] = value;
  writeListFilters(listFilters);
  updateFilterHighlight();
  renderMedicineList();
}

function resetListFilters() {
  listFilters = { category: 'ALL', form: 'ALL', stock: 'ALL' };
  writeListFilters(listFilters);
  renderListFilters();
  renderMedicineList();
}

// Dashboard "Low stock" tile
function showLowStock() {
  listFilters.stock = 'LOW';
  writeListFilters(listFilters);
  renderListFilters();
  renderMedicineList();
  document.getElementById('list-filters').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateFilterHighlight() {
  [['filter-category', 'category'], ['filter-form', 'form'], ['filter-stock', 'stock']].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.closest('.mp-filter').classList.toggle('mp-filter-active', listFilters[key] !== 'ALL');
  });
  const reset = document.getElementById('reset-filters-btn');
  if (reset) reset.classList.toggle('invisible', listFilters.category === 'ALL' && listFilters.form === 'ALL' && listFilters.stock === 'ALL');
}

function matchesStockFilter(med) {
  if (listFilters.stock === 'ALL') return true;
  const status = getStockStatus(med);
  // "Low stock" also lists out-of-stock items (0 is below any minimum)
  if (listFilters.stock === 'LOW') return status === 'low' || status === 'out';
  return status === 'out';
}

function renderMedicineList() {
  renderHomeDashboard();
  const listContainer = document.getElementById('medicine-list');
  const emptyState = document.getElementById('empty-state');
  const searchVal = (document.getElementById('search-input').value || '').toLowerCase().trim();
  const sortVal = document.getElementById('sort-select').value;

  let filtered = medicines.filter(m => {
    const matchesCategory = listFilters.category === 'ALL' || (m.category || 'Other') === listFilters.category;
    const matchesForm = listFilters.form === 'ALL' || (m.formType || 'Tablet') === listFilters.form;
    const matchesSearch = !searchVal || m.name.toLowerCase().includes(searchVal) || (m.notes && m.notes.toLowerCase().includes(searchVal)) || (m.formType && m.formType.toLowerCase().includes(searchVal));
    return matchesCategory && matchesForm && matchesStockFilter(m) && matchesSearch;
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
    visibleMedIds = new Set();
    pruneSelectionToVisible();
    return;
  } else {
    emptyState.classList.add('hidden');
  }

  const displayItems = filtered.slice(0, 100);
  visibleMedIds = new Set(displayItems.map(m => m.id));
  pruneSelectionToVisible();

  listContainer.innerHTML = displayItems.map(med => {
    const isSelected = selectedMedIds.has(med.id);
    const formType = med.formType || 'Tablet';
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

        ${cardStockHtml(med)}

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

function cardStockHtml(med) {
  const status = getStockStatus(med);
  if (status === 'unset') {
    return `<button type="button" data-action="editMedicine" data-id="${med.id}" class="mp-card-stock mp-set-stock">
      <i data-lucide="package-plus" class="w-3.5 h-3.5"></i><span>Set stock</span></button>`;
  }
  return `<div class="mp-card-stock mp-card-stock-${status}">
    ${stockBadgeHtml(med)}
    ${status === 'out' ? '' : `<span class="mp-stock-line">${escapeHtml(stockText(med))}</span>`}
  </div>`;
}

// Navigation and Tab switching
function switchTab(tab) {
  // Remember where "Add" was opened from, so Save/Cancel can go back there
  if (tab === 'add' && activeTab !== 'add') tabBeforeAdd = activeTab;
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
  const names = getUnitNames(formType);
  const packLabel = capitalize(names.pack[0]);

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
  document.getElementById('modal-pata-count').textContent = `(${Number(med.tabletsPerPata || 0)} ${names.loose[1]} / ${packLabel})`;
  document.getElementById('modal-tablet-price').textContent = `Rs. ${Number(med.tabletPrice || 0).toFixed(2)}`;
  document.getElementById('modal-stock-text').textContent = '';
  renderDetailsStock(med);
  renderRestockHistory(med);
  const modalPlaceDisplay = document.getElementById('modal-place-display');
  if (modalPlaceDisplay) modalPlaceDisplay.textContent = med.place || 'Not assigned';

  // Sell / Calculator / Edit / Delete buttons are wired once in app.js
  // and read currentDetailsMedicineId.

  document.getElementById('details-modal').classList.remove('hidden');
  lucide.createIcons();
}

function renderDetailsStock(med) {
  const status = getStockStatus(med);
  const card = document.getElementById('modal-stock-card');
  card.className = `mp-detail-stock mp-detail-stock-${status}`;
  document.getElementById('modal-stock-badge').innerHTML = stockBadgeHtml(med);
  document.getElementById('modal-stock-value').textContent = stockText(med);
  const min = med.minStockUnits;
  document.getElementById('modal-stock-min').textContent = status === 'unset'
    ? 'Tap Edit or Restock to set stock'
    : (min !== null && min !== undefined ? `Minimum: ${formatMedUnits(med, min)}` : 'No minimum set');
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

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').textContent = msg;
  toast.classList.remove('hidden');
  // Restart the timer so a new toast is not hidden early by the previous one
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

function loadUserProfile() {
  const storedProfile = readStoredUserProfile();
  if (storedProfile) userProfile = { ...userProfile, ...storedProfile };
  fillProfileInputs();
}

// Put the saved profile into the inputs. Before, the inputs kept their HTML
// defaults after a reload, so the saved name/store never showed (and the next
// "Save Info" wrote the defaults back).
function fillProfileInputs() {
  const set = (id, value) => { const el = document.getElementById(id); if (el && value !== undefined) el.value = value; };
  set('input-user-name', userProfile.name);
  set('input-store-name', userProfile.store);
  set('input-user-location', userProfile.location);
  set('input-user-phone', userProfile.phone);
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
    readImageAsSmallDataUrl(file, 300, dataUrl => {
      userProfile.avatar = dataUrl;
      saveUserProfile();
    });
  }
}
