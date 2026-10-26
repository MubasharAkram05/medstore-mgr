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

  // Restock form
  ['restock-boxes', 'restock-packs', 'restock-loose'].forEach(id => on(id, 'input', updateRestockPreview));

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
  on('modal-calc-btn', 'click', () => { const id = currentDetailsMedicineId; closeDetailsModal(); openCalcModal(id); });
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
});
