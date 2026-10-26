// ui.js
// Rendering helpers, list/cards, tabs, details modal, search, toast and profile UI.

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

// Home filters: Form (fixed list), Type (fixed list + custom types) and Stock.
function renderListFilters() {
  const fill = (id, groups, selected) => {
    const select = document.getElementById(id);
    if (!select) return selected;
    const all = groups.flatMap(g => g.values);
    select.innerHTML = '<option value="ALL">All</option>' + groups.map(g => {
      const options = g.values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
      return g.label && g.values.length ? `<optgroup label="${escapeHtml(g.label)}">${options}</optgroup>` : options;
    }).join('');
    // Saved value in another letter case still matches; unknown values fall back to "All"
    const value = all.find(v => textKey(v) === textKey(selected)) || 'ALL';
    select.value = value;
    return value;
  };
  const types = getAllTypes();
  listFilters.category = fill('filter-category', [{ values: types.fixed }, { label: 'Your types', values: types.customs }], listFilters.category);
  listFilters.form = fill('filter-form', [{ values: getAllForms() }], listFilters.form);
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
  toggleFilters(true);
  document.querySelector('.mp-toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function activeFilterCount() {
  return ['category', 'form', 'stock'].filter(k => listFilters[k] !== 'ALL').length;
}

// "Filters (2)" label, Clear chip and highlighted dropdowns
function updateFilterHighlight() {
  [['filter-category', 'category'], ['filter-form', 'form'], ['filter-stock', 'stock']].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.closest('.mp-filter').classList.toggle('mp-filter-active', listFilters[key] !== 'ALL');
  });
  const count = activeFilterCount();
  const label = document.getElementById('filters-label');
  if (label) label.textContent = count ? `Filters (${count})` : 'Filters';
  const toggle = document.getElementById('filters-toggle');
  if (toggle) toggle.classList.toggle('is-active', count > 0);
  const reset = document.getElementById('reset-filters-btn');
  if (reset) reset.classList.toggle('hidden', count === 0);
}

function toggleFilters(forceOpen) {
  const panel = document.getElementById('list-filters');
  const toggle = document.getElementById('filters-toggle');
  const open = typeof forceOpen === 'boolean' ? forceOpen : panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !open);
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

// Empty-state button: clear filters AND search
function clearAllFilters() {
  const input = document.getElementById('search-input');
  input.value = '';
  document.getElementById('clear-search').classList.add('hidden');
  resetListFilters();
}

function matchesStockFilter(med) {
  if (listFilters.stock === 'ALL') return true;
  const status = getStockStatus(med);
  // "Low stock" also lists out-of-stock items (0 is below any minimum)
  if (listFilters.stock === 'LOW') return status === 'low' || status === 'out';
  return status === 'out';
}

// ---------- Icons ----------
// Cards use inline SVG strings built once per icon name: much faster than
// running lucide.createIcons() over hundreds of cards.
const iconCache = {};
function iconSvg(name, cls) {
  if (!iconCache[name]) {
    const pascal = name.replace(/(^|-)([a-z0-9])/g, (m, d, c) => c.toUpperCase());
    const node = window.lucide && lucide.icons && lucide.icons[pascal];
    iconCache[name] = node ? lucide.createElement(node).outerHTML : '';
  }
  const svg = iconCache[name];
  return cls ? svg.replace('class="', `class="${cls} `) : svg;
}

const FORM_ICONS = {
  Tablet: 'pill', Capsule: 'tablets', Syrup: 'flask-conical', Suspension: 'beaker', Injection: 'syringe',
  Drops: 'droplet', Cream: 'hand', Gel: 'droplets', Ointment: 'hand-heart', Liquid: 'glass-water',
  Sachet: 'package', Powder: 'box', Inhaler: 'wind'
};
const TYPE_CLASSES = {
  'Antibiotic': 'type-antibiotic', 'Fever': 'type-fever', 'Painkiller': 'type-painkiller', 'Stomach': 'type-stomach',
  'Cough & Cold': 'type-cough', 'Allergy': 'type-allergy', 'Vitamins': 'type-vitamins', 'Diabetes': 'type-diabetes',
  'Blood Pressure / Heart': 'type-heart', 'Skin': 'type-skin', 'Eye / Ear': 'type-eye', 'First Aid': 'type-firstaid',
  'Pampers': 'type-pampers', 'Other': 'type-other'
};

function formClass(form) {
  return 'form-' + (FORMS.includes(form) ? form.toLowerCase() : 'tablet');
}

// Photo if the user added one, otherwise a Lucide icon for the form
function medIconInner(med) {
  if (med.image) return `<img src="${med.image}" alt="" loading="lazy" decoding="async">`;
  return iconSvg(FORM_ICONS[med.formType] || 'pill');
}

// ---------- Text helpers (hide the seed filler text) ----------
const FILLER_RE = /common pakistani brand item\.?/ig;
const MANUFACTURER_RE = /manufacturer:\s*([^.\n]+)\.?/i;

function getManufacturer(med) {
  let m = String(med.manufacturer || '').trim();
  if (!m) {
    const match = MANUFACTURER_RE.exec(med.notes || '');
    if (match) m = match[1].trim();
  }
  return /^common pharmacy/i.test(m) ? '' : m;
}

// Notes without the filler sentence and the "Manufacturer: X." part
function cleanNotes(notes) {
  return String(notes || '').replace(FILLER_RE, '').replace(MANUFACTURER_RE, '').replace(/\s+/g, ' ').trim();
}

// Grey line under the name: manufacturer, else notes, else generic name
function cardSubtitle(med) {
  const maker = getManufacturer(med);
  if (maker) return maker;
  const notes = cleanNotes(med.notes);
  if (notes) return notes;
  const generic = String(med.genericName || '').trim();
  if (generic && textKey(generic) !== textKey(med.name)) return generic;
  return 'Generic medicine';
}

// Small stock badge: "10 boxes" / "Low" / "Out of stock" / "Stock not set"
function stockBadgeShort(med) {
  const status = getStockStatus(med);
  if (status === 'unset') return { cls: 'mp-stock-unset', text: 'Stock not set' };
  if (status === 'out') return { cls: 'mp-stock-out', text: 'Out of stock' };
  if (status === 'low') return { cls: 'mp-stock-low', text: 'Low' };
  if (!isPackForm(med.formType)) return { cls: 'mp-stock-ok', text: formatMedUnits(med, med.stockUnits) };
  const sizes = getPackSizes(med);
  const names = getUnitNames(med.formType);
  const parts = splitUnits(Number(med.stockUnits), sizes);
  const [count, pair, rest] = parts.boxes ? [parts.boxes, names.box, parts.packs || parts.loose]
    : parts.packs ? [parts.packs, names.pack, parts.loose] : [parts.loose, names.loose, 0];
  return { cls: 'mp-stock-ok', text: `${count} ${count === 1 ? pair[0] : pair[1]}${rest ? '+' : ''}` };
}

function medCardHtml(med, index) {
  const form = med.formType || 'Tablet';
  const type = med.category || 'Other';
  const badge = stockBadgeShort(med);
  const badgeHtml = `<span class="mp-stock-badge ${badge.cls}">${badge.text}</span>`;
  const sub = cardSubtitle(med);
  // Stagger only the first few cards of a page, so long lists stay light
  const delay = index < 10 ? ` style="animation-delay:${index * 25}ms"` : '';
  return `
    <div class="mp-med" role="button" tabindex="0" data-action="openDetailsModal" data-id="${escapeHtml(String(med.id))}"${delay}
      aria-label="${escapeHtml(`${med.name}, ${form}, ${type}, ${stockText(med)}`)}">
      <div class="mp-med-head">
        <div class="mp-med-icon ${formClass(form)}" aria-hidden="true">${medIconInner(med)}</div>
        ${badgeHtml}
      </div>
      <div class="mp-med-body">
        <div class="mp-med-top"><h3 class="mp-med-name">${escapeHtml(med.name)}</h3>${badgeHtml}</div>
        <p class="mp-med-sub">${escapeHtml(sub)}</p>
        <div class="mp-chips">
          <span class="mp-chip form-chip ${formClass(form)}">${escapeHtml(form)}</span>
          <span class="mp-chip ${TYPE_CLASSES[type] || 'type-other'}">${escapeHtml(type)}</span>
          ${med.place ? `<span class="mp-chip mp-chip-place">${iconSvg('map-pin')}${escapeHtml(med.place)}</span>` : ''}
        </div>
      </div>
    </div>`;
}

// ---------- List with "load more while scrolling" ----------
const PAGE_SIZE = 30;
let listItems = [];
let listShown = 0;
let listObserver = null;

function getFilteredMedicines() {
  const searchVal = (document.getElementById('search-input').value || '').toLowerCase().trim();
  const sortVal = document.getElementById('sort-select').value;
  const filtered = medicines.filter(m => {
    const matchesCategory = listFilters.category === 'ALL' || textKey(m.category || 'Other') === textKey(listFilters.category);
    const matchesForm = listFilters.form === 'ALL' || textKey(m.formType || 'Tablet') === textKey(listFilters.form);
    const matchesSearch = !searchVal || m.name.toLowerCase().includes(searchVal)
      || (m.genericName && m.genericName.toLowerCase().includes(searchVal))
      || (m.notes && m.notes.toLowerCase().includes(searchVal))
      || (m.formType && m.formType.toLowerCase().includes(searchVal));
    return matchesCategory && matchesForm && matchesStockFilter(m) && matchesSearch;
  });
  filtered.sort((a, b) => {
    if (sortVal === 'name-asc') return a.name.localeCompare(b.name);
    if (sortVal === 'unit-low') return (a.tabletPrice || 0) - (b.tabletPrice || 0);
    if (sortVal === 'pack-low') return (a.pataPrice || 0) - (b.pataPrice || 0);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
  return filtered;
}

function renderMedicineList() {
  renderHomeDashboard();
  updateFilterHighlight();
  const listContainer = document.getElementById('medicine-list');
  listItems = getFilteredMedicines();
  listShown = 0;

  listContainer.className = 'mp-list ' + (listView === 'grid' ? 'mp-view-grid' : 'mp-view-list');
  document.querySelectorAll('[data-action="setListView"]').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.dataset.view === listView ? 'true' : 'false');
  });
  document.getElementById('med-count-badge').textContent = `${listItems.length.toLocaleString()} items found`;

  listContainer.innerHTML = '';
  renderEmptyState();
  if (listItems.length) {
    appendListPage();
    watchListEnd();
  }
}

function appendListPage() {
  const listContainer = document.getElementById('medicine-list');
  const next = listItems.slice(listShown, listShown + PAGE_SIZE);
  listContainer.insertAdjacentHTML('beforeend', next.map((m, i) => medCardHtml(m, i)).join(''));
  listShown += next.length;
}

// Loads the next page when the end of the list comes near the screen
function watchListEnd() {
  const sentinel = document.getElementById('list-sentinel');
  if (!('IntersectionObserver' in window)) {
    while (listShown < listItems.length) appendListPage();
    return;
  }
  if (!listObserver) {
    listObserver = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) fillListViewport();
    }, { root: document.querySelector('main'), rootMargin: '0px 0px 600px 0px' });
    listObserver.observe(sentinel);
  }
  fillListViewport();
}

// Keep adding pages while the end of the list is still within 600px of the screen
function fillListViewport() {
  const main = document.querySelector('main');
  const sentinel = document.getElementById('list-sentinel');
  if (document.getElementById('screen-home').classList.contains('hidden')) return;
  let guard = 0;
  while (listShown < listItems.length && guard++ < 50) {
    if (sentinel.getBoundingClientRect().top > main.getBoundingClientRect().bottom + 600) break;
    appendListPage();
  }
}

function renderEmptyState() {
  const empty = document.getElementById('empty-state');
  if (listItems.length) { empty.classList.add('hidden'); return; }
  const noData = medicines.length === 0;
  document.getElementById('empty-title').textContent = noData ? 'Add your first medicine' : 'No medicines found';
  document.getElementById('empty-text').textContent = noData
    ? 'Your list is empty. Add a medicine to start tracking prices and stock.'
    : 'Try another filter or search word.';
  const action = document.getElementById('empty-action');
  action.dataset.action = noData ? 'switchTab' : 'clearAllFilters';
  action.dataset.tab = 'add';
  action.innerHTML = noData ? `${iconSvg('plus')}<span>Add medicine</span>` : `${iconSvg('x')}<span>Clear filters</span>`;
  document.querySelector('#empty-state .mp-empty-icon').innerHTML = iconSvg(noData ? 'package-plus' : 'search-x');
  empty.classList.remove('hidden');
}

function setListView(view) {
  listView = view === 'grid' ? 'grid' : 'list';
  writeListView(listView);
  renderMedicineList();
}

// Navigation and Tab switching
// Tabs visited, for the back button (Add/Edit is never re-opened by "back")
let tabHistory = [];

function popTabHistory() {
  while (tabHistory.length) {
    const t = tabHistory.pop();
    if (t !== activeTab && t !== 'add') return t;
  }
  return null;
}

// Values of the Add/Edit form, to tell if the user changed something
let addFormSnapshot = '';
function addFormState() {
  const form = document.getElementById('medicine-form');
  const values = [...form.querySelectorAll('input:not([type=file]), select, textarea')].map(el => el.id + '=' + el.value);
  return values.join('|') + '|img=' + (currentImageData || '').length;
}
function isAddFormDirty() {
  return addFormState() !== addFormSnapshot;
}

function switchTab(tab, opts = {}) {
  // Remember where "Add" was opened from, so Save/Cancel can go back there
  if (tab === 'add' && activeTab !== 'add') tabBeforeAdd = activeTab;
  if (!opts.fromBack && tab !== activeTab && activeTab !== 'add') {
    tabHistory.push(activeTab);
    if (tabHistory.length > 20) tabHistory.shift();
  }
  const enteringAdd = tab === 'add' && activeTab !== 'add';
  activeTab = tab;
  if (enteringAdd) addFormSnapshot = addFormState();
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

  if (tab === 'home') fillListViewport();
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
  document.getElementById('modal-notes').textContent = cleanNotes(med.notes);
  const icon = document.getElementById('modal-icon');
  icon.className = `mp-med-icon ${formClass(formType)}`;
  icon.innerHTML = medIconInner(med);
  const maker = getManufacturer(med);
  const makerEl = document.getElementById('modal-manufacturer');
  makerEl.innerHTML = maker ? `${iconSvg('factory')}<span>${escapeHtml(maker)}</span>` : '';
  makerEl.classList.toggle('hidden', !maker);

  const boxPrice = Number(med.boxPrice || 0);
  const totalTabs = Number(med.totalTabsBox || 0) || (Number(med.stripsPerBox || 0) * Number(med.tabletsPerPata || 0));
  document.getElementById('modal-box-price').textContent = boxPrice > 0 ? `Rs. ${boxPrice.toFixed(2)}` : 'Rs. —';
  document.getElementById('modal-box-detail').textContent = Number(med.stripsPerBox || 0) > 0 ? `${med.stripsPerBox} patas / box` : 'Complete box';
  document.getElementById('modal-total-tabs').textContent = totalTabs > 0 ? totalTabs.toLocaleString() : '—';
  document.getElementById('modal-total-tabs-detail').textContent = totalTabs > 0 ? 'Tablets in box' : 'Not added';
  const single = !isPackForm(formType);
  // Single items: one price tile ("Price per Syrup")
  document.getElementById('details-modal').classList.toggle('is-single', single);
  document.getElementById('modal-pack-title').textContent = single ? `Price per ${itemLabel(formType)}` : 'Price Per Pata';
  document.getElementById('modal-pata-price').textContent = `Rs. ${Number(med.pataPrice || 0).toFixed(2)}`;
  document.getElementById('modal-pata-count').textContent = single ? `1 ${names.pack[0]}` : `(${Number(med.tabletsPerPata || 0)} ${names.loose[1]} / ${packLabel})`;
  document.getElementById('modal-tablet-price').textContent = `Rs. ${Number(med.tabletPrice || 0).toFixed(2)}`;
  document.getElementById('modal-stock-text').textContent = '';
  renderDetailsStock(med);
  const modalPlaceDisplay = document.getElementById('modal-place-display');
  if (modalPlaceDisplay) modalPlaceDisplay.textContent = med.place || 'Not assigned';

  // Sell / Restock / Edit / Delete buttons are wired once in app.js
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
function updateClearSearchButton() {
  const val = document.getElementById('search-input').value;
  document.getElementById('clear-search').classList.toggle('hidden', !val);
}

function handleSearchFilter() {
  updateClearSearchButton();
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
