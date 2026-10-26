// app.js
// Startup and all event listeners. No inline onclick/oninput in the HTML:
// buttons carry data-action="functionName" and are handled here by delegation.

// Buttons with data-action="..." (static HTML and rendered cards/lists)
const CLICK_ACTIONS = {
  switchTab: el => switchTab(el.dataset.tab),
  cancelForm: () => { resetForm(); switchTab(tabBeforeAdd || 'home'); },
  clearSearch: () => clearSearch(),
  removeImage: () => removeImage(),
  resetCalculator: () => resetCalculator(),
  clearCalcSearch: () => clearCalcSearch(),
  recordSaleFromCalc: () => recordSaleFromCalc(),
  clearSalesHistoryConfirm: () => clearSalesHistoryConfirm(),
  saveUserProfile: () => saveUserProfile(),
  openBackupModal: () => openBackupModal(),
  closeBackupModal: () => closeBackupModal(),
  exportDataJSON: () => exportDataJSON(),
  removeDuplicateMedicines: () => removeDuplicateMedicines(),
  clearAllDataWithConfirm: () => clearAllDataWithConfirm(),
  closeSellModal: () => closeSellModal(),
  confirmRecordSale: () => confirmRecordSale(),
  closeDetailsModal: () => closeDetailsModal(),
  // Rendered by JS
  resetListFilters: () => resetListFilters(),
  showLowStock: () => showLowStock(),
  showLowStockFromStats: () => { switchTab('home'); showLowStock(); },
  showOutOfStockFromStats: () => { switchTab('home'); setListFilter('stock', 'OUT'); renderListFilters(); },
  closeRestockModal: () => closeRestockModal(),
  saveRestock: () => saveRestock(),
  deleteSale: el => deleteSale(el.dataset.id),
  editMedicine: el => editMedicine(el.dataset.id),
  deleteMedicine: el => deleteMedicine(el.dataset.id),
  toggleFilters: () => toggleFilters(),
  clearAllFilters: () => clearAllFilters(),
  setListView: el => setListView(el.dataset.view),
  setTheme: el => setThemeSetting(el.dataset.themeOption),
  openDetailsModal: el => openDetailsModal(el.dataset.id),
  selectCalcMedicine: el => selectCalcMedicine(el.dataset.id)
};

function on(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

function bindEvents() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = CLICK_ACTIONS[el.dataset.action];
    if (action) action(el);
  });

  // Esc (keyboard) closes the top popup, like the Android back button does
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTopOverlay(); });

  // Medicine cards are role="button": Enter / Space open them like a tap
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-action]')) {
      e.preventDefault();
      e.target.click();
    }
  });

  // Home: search, filters, sort
  // Search: X button updates at once, the list re-renders 200ms after typing stops
  let searchTimer = null;
  on('search-input', 'input', () => {
    updateClearSearchButton();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderMedicineList, 200);
  });
  on('filter-category', 'change', e => setListFilter('category', e.target.value));
  on('filter-form', 'change', e => setListFilter('form', e.target.value));
  on('filter-stock', 'change', e => setListFilter('stock', e.target.value));
  on('sort-select', 'change', handleSearchFilter);

  // Add / edit form
  on('medicine-form', 'submit', saveMedicine);
  on('img-input', 'change', handleImageUpload);
  on('med-form-type', 'change', updateFormTypeLabels);
  on('med-category-select', 'change', e => toggleCustomCategory(e.target.value));
  on('med-box-price', 'input', autoCalcBoxPricing);
  on('med-total-tabs-box', 'input', autoCalcBoxPricing);
  on('med-strips-per-box', 'input', autoCalcBoxPricing);
  on('med-tablets-per-pata', 'input', () => { autoCalcUnitPrice(); autoCalcBoxPricing(); });
  on('med-pata-price', 'input', autoCalcUnitPrice);
  // Stock fields + anything that changes the box/pack size
  ['stock-boxes', 'stock-packs', 'stock-loose', 'min-stock-qty', 'min-stock-unit',
   'med-tablets-per-pata', 'med-strips-per-box', 'med-total-tabs-box']
    .forEach(id => on(id, 'input', updateStockPreview));
  on('min-stock-unit', 'change', updateStockPreview);

  // Restock form (quantity + scheme)
  ['restock-boxes', 'restock-packs', 'restock-loose', 'restock-scheme-buy', 'restock-scheme-free']
    .forEach(id => on(id, 'input', updateRestockPreview));
  // Scheme in Add/Edit
  ['stock-scheme-buy', 'stock-scheme-free'].forEach(id => on(id, 'input', updateStockPreview));

  // Calculator
  on('calc-search-input', 'input', e => {
    populateCalcDropdown();
    const clearBtn = document.getElementById('clear-calc-search');
    if (clearBtn) clearBtn.classList.toggle('hidden', !e.target.value.trim());
  });
  on('calc-search-input', 'click', () => populateCalcDropdown(true));
  // Keep focus in the search box while pressing the X button
  on('clear-calc-search', 'mousedown', e => e.preventDefault());
  on('calc-med-select', 'change', updateCalcDetails);
  ['calc-box-price', 'calc-total-tabs-box', 'calc-strips-box', 'calc-price-pata', 'calc-units-pata']
    .forEach(id => on(id, 'input', calculatePataUnitRate));
  on('calc-pata-qty', 'input', calculateTotal);
  on('calc-tablet-qty', 'input', calculateTotal);

  // Stats
  on('sales-filter-select', 'change', renderSalesHistory);

  // Profile
  on('avatar-input', 'change', handleAvatarUpload);
  ['input-user-name', 'input-store-name', 'input-user-location']
    .forEach(id => on(id, 'input', updateProfilePreview));

  // Sell modal
  on('sell-pack-qty', 'input', calcSellTotal);
  on('sell-unit-qty', 'input', calcSellTotal);

  // Details modal action buttons
  on('modal-sell-btn', 'click', () => { const id = currentDetailsMedicineId; closeDetailsModal(); openSellModal(id); });
  on('modal-edit-btn', 'click', () => { const id = currentDetailsMedicineId; closeDetailsModal(); editMedicine(id); });
  on('modal-delete-btn', 'click', () => { const id = currentDetailsMedicineId; closeDetailsModal(); deleteMedicine(id); });
  on('modal-restock-btn', 'click', () => { const id = currentDetailsMedicineId; closeDetailsModal(); openRestockModal(id); });

  // Backup
  on('import-file-input', 'change', importDataJSON);

  // On phones the keyboard pushes the bottom nav up over the form buttons.
  // While a text field is focused, hide the nav (CSS: body.mp-typing).
  const isTyping = el => el && el.matches && el.matches('input:not([type=checkbox]):not([type=file]):not([type=date]), textarea');
  document.addEventListener('focusin', e => { if (isTyping(e.target)) document.body.classList.add('mp-typing'); });
  document.addEventListener('focusout', () => {
    setTimeout(() => { if (!isTyping(document.activeElement)) document.body.classList.remove('mp-typing'); }, 50);
  });
}

bindEvents();

window.addEventListener('load', () => {
  listFilters = readListFilters();
  listView = readListView();
  loadLocalStorage();
  loadUserProfile();
  populateEditMedicinePlaces('');
  populateTypeSelect('Other');
  updateFormTypeLabels();
  renderListFilters();
  renderMedicineList();
  populateCalcDropdown();
  updateStatsScreen();
  calculateStorageUsage();
  lucide.createIcons();
  applyTheme(); // marks the active Light / Dark / Auto button in Profile
  setupBackButton();
  watchKeyboard();
});

// ---------- Android back button ----------
// Order: close a popup -> leave Add/Edit (ask if there are unsaved changes)
// -> previous tab -> on Home, "Press back again to exit" within 2 seconds.
let lastBackPress = 0;

function setupBackButton() {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (App && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    // With a listener registered, Android no longer closes the app by itself
    App.addListener('backButton', handleBackButton);
  }
}

// Closes the top-most open popup / panel. Returns true if something was closed.
function closeTopOverlay() {
  const open = id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); };
  if (open('restock-modal')) { closeRestockModal(); return true; }
  if (open('sell-modal')) { closeSellModal(); return true; }
  if (open('backup-modal')) { closeBackupModal(); return true; }
  if (open('details-modal')) { closeDetailsModal(); return true; }
  if (open('calc-medicine-results') && activeTab === 'calc') { document.getElementById('calc-medicine-results').classList.add('hidden'); return true; }
  if (activeTab === 'home' && open('list-filters')) { toggleFilters(false); return true; }
  return false;
}

function handleBackButton() {
  if (closeTopOverlay()) return;

  if (activeTab === 'add') {
    if (isAddFormDirty() && !confirm('Discard changes?')) return;
    resetForm();
    switchTab(tabBeforeAdd || 'home', { fromBack: true });
    return;
  }

  const previous = popTabHistory();
  if (previous) { switchTab(previous, { fromBack: true }); return; }
  if (activeTab !== 'home') { switchTab('home', { fromBack: true }); return; }

  const now = Date.now();
  if (now - lastBackPress < 2000) {
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && App.exitApp) App.exitApp();
    return;
  }
  lastBackPress = now;
  showToast('Press back again to exit');
}

// ---------- Keyboard: keep the Save bar above it ----------
// If the WebView does not shrink when the keyboard opens, the visual viewport
// does: move the bottom bars up by the hidden height.
function watchKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--mp-kb', (hidden > 80 ? hidden : 0) + 'px');
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
}
