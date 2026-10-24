// app.js
// Startup and all event listeners. No inline onclick/oninput in the HTML:
// buttons carry data-action="functionName" and are handled here by delegation.

// Buttons with data-action="..." (static HTML and rendered cards/lists)
const CLICK_ACTIONS = {
  switchTab: el => switchTab(el.dataset.tab),
  cancelForm: () => { resetForm(); switchTab('home'); },
  clearSearch: () => clearSearch(),
  toggleBulkSelectMode: () => toggleBulkSelectMode(),
  deleteSelectedMedicines: () => deleteSelectedMedicines(),
  exitBulkSelectMode: () => exitBulkSelectMode(),
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
  filterCategory: el => filterCategory(el.dataset.category),
  filterFormType: el => filterFormType(el.dataset.form),
  openDetailsModal: el => openDetailsModal(el.dataset.id),
  openCardCalculator: el => openCardCalculator(el.dataset.id),
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

  // Bulk-select checkboxes on medicine cards
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-action="toggleSelectMed"]');
    if (el) toggleSelectMed(el.dataset.id, el.checked);
  });

  // Home: search, sort, bulk select
  on('search-input', 'input', handleSearchFilter);
  on('sort-select', 'change', handleSearchFilter);
  on('select-all-check', 'change', e => toggleSelectAll(e.target.checked));

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

  // Backup
  on('import-file-input', 'change', importDataJSON);
}

bindEvents();

window.addEventListener('load', () => {
  loadLocalStorage();
  loadUserProfile();
  renderCategoryPills();
  renderMedicineList();
  populateCalcDropdown();
  updateStatsScreen();
  calculateStorageUsage();
  lucide.createIcons();
});
