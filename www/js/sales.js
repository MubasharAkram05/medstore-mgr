// sales.js
// Quick sell modal, sales history and the PKR prescription calculator.

// SALES TRACKING POS SYSTEM
function openSellModal(id) {
  const med = medicines.find(m => m.id === id);
  if (!med) return;

  currentSellMed = med;
  const names = getUnitNames(med.formType);
  const single = !isPackForm(med.formType);
  // Single items (syrup, cream...): one quantity field
  document.getElementById('sell-modal').classList.toggle('is-single', single);

  document.getElementById('sell-med-id').value = med.id;
  document.getElementById('sell-med-name').textContent = med.name;
  renderSellStockText(med);
  document.getElementById('sell-med-img').src = med.image || placeholderImage(med.name.charAt(0));

  document.getElementById('sell-pack-label').textContent = single ? `Quantity (${names.pack[1]})` : capitalize(names.pack[1]);
  document.getElementById('sell-unit-label').textContent = `Loose ${names.loose[1]}`;
  document.getElementById('sell-pack-qty').value = 1;
  document.getElementById('sell-unit-qty').value = 0;
  document.getElementById('sell-error').textContent = '';

  calcSellTotal();
  document.getElementById('sell-modal').classList.remove('hidden');
}

function renderSellStockText(med) {
  const el = document.getElementById('sell-med-stock-text');
  const status = getStockStatus(med);
  el.className = 'text-xs font-semibold ' + (status === 'out' ? 'text-red-600' : status === 'low' ? 'text-amber-600' : status === 'unset' ? 'text-slate-400' : 'text-emerald-700');
  el.textContent = status === 'unset' ? 'Stock not set (sale won\'t change stock)' : `In stock: ${stockText(med)}`;
}

function closeSellModal() {
  document.getElementById('sell-modal').classList.add('hidden');
  currentSellMed = null;
}

// Loose quantity only exists for tablets / capsules
function sellLooseQty(med) {
  return isPackForm(med.formType) ? (parseFloat(document.getElementById('sell-unit-qty').value) || 0) : 0;
}

function calcSellTotal() {
  if (!currentSellMed) return;

  const packs = parseFloat(document.getElementById('sell-pack-qty').value) || 0;
  const units = sellLooseQty(currentSellMed);

  const totalBill = (packs * currentSellMed.pataPrice) + (units * currentSellMed.tabletPrice);
  document.getElementById('sell-total-bill').textContent = `Rs. ${totalBill.toFixed(2)}`;
  // Live stock check while typing
  const check = (packs < 0 || units < 0) ? { error: 'Quantity can\'t be negative.' } : checkStockForSale(currentSellMed, packs, units);
  document.getElementById('sell-error').textContent = check.error || '';
}

// Records one sale and takes it out of stock.
// Returns an error message (sale blocked) or '' when saved.
// "Confirm" only adds the item to the cart. Stock and sales change on Complete Sale (cart.js).
function confirmRecordSale() {
  if (!currentSellMed) return;

  const packs = parseFloat(document.getElementById('sell-pack-qty').value) || 0;
  const units = sellLooseQty(currentSellMed);

  const error = addToCart(currentSellMed, packs, units);
  document.getElementById('sell-error').textContent = error;
  if (error) return;
  document.getElementById('sell-pack-qty').value = 1;
  document.getElementById('sell-unit-qty').value = 0;
  closeSellModal();
  showToast('Added to cart');
}

// Render Sales History & Analytics
function renderSalesHistory() {
  const container = document.getElementById('sales-history-container');
  const filter = document.getElementById('sales-filter-select').value;
  const todayStr = new Date().toDateString();

  let filtered = salesHistory;
  if (filter === 'today') {
    filtered = salesHistory.filter(s => new Date(s.date).toDateString() === todayStr);
  }

  if (filtered.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-4">No sales recorded ${filter === 'today' ? 'today' : 'yet'}.</p>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const d = new Date(s.date);
    const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const names = getUnitNames(s.formType);
    const qtyParts = [];
    if (s.packs > 0) qtyParts.push(`${s.packs} ${s.packs === 1 ? names.pack[0] : names.pack[1]}`);
    if (s.units > 0) qtyParts.push(`${s.units} ${s.units === 1 ? names.loose[0] : names.loose[1]}`);
    const qtyText = qtyParts.join(' + ');

    return `
      <div class="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
        <div class="min-w-0">
          <h5 class="font-bold text-slate-800 truncate">${escapeHtml(s.medName)}</h5>
          <p class="text-[10px] text-slate-400">${dateStr} • ${qtyText}${s.billNo ? ` • Bill #${escapeHtml(String(s.billNo))}` : ''}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <span class="font-bold text-emerald-700">Rs. ${Number(s.revenue || 0).toFixed(2)}</span>
          <button type="button" data-action="deleteSale" data-id="${escapeHtml(String(s.id))}" class="mp-icon-btn text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label="Delete sale">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

// Deletes one sale and puts its quantity back into stock
function deleteSale(id) {
  const sale = salesHistory.find(s => String(s.id) === String(id));
  if (!sale) return;
  if (!confirm(`Delete this sale of ${sale.medName}? Its quantity will be added back to stock.`)) return;

  const med = medicines.find(m => m.id === sale.medId);
  const restore = Number(sale.stockUnits) || 0;
  if (med && hasStock(med) && restore > 0) med.stockUnits = Number(med.stockUnits) + restore;

  salesHistory = salesHistory.filter(s => s !== sale);
  saveToLocalStorage();
  renderMedicineList();
  showToast(restore > 0 && med ? `Sale deleted. ${formatMedUnits(med, restore)} back in stock.` : 'Sale deleted.');
}

// Clears the history only. Stock is NOT changed.
function clearSalesHistoryConfirm() {
  if (confirm('Reset all recorded sales history? This action cannot be undone.')) {
    salesHistory = [];
    saveToLocalStorage();
    updateStatsScreen();
    showToast('Sales history cleared!');
  }
}

function calculatePataUnitRate() {
  let price = parseFloat(document.getElementById('calc-price-pata')?.value) || 0;
  let units = parseFloat(document.getElementById('calc-units-pata')?.value) || 0;
  const boxPrice = parseFloat(document.getElementById('calc-box-price')?.value) || 0;
  const stripsBox = parseFloat(document.getElementById('calc-strips-box')?.value) || 0;
  const totalTabsBox = parseFloat(document.getElementById('calc-total-tabs-box')?.value) || 0;

  // Automatically derive tablets per pata when total tablets and total patas are available.
  if (totalTabsBox > 0 && stripsBox > 0) {
    const derivedUnits = totalTabsBox / stripsBox;
    if (Number.isFinite(derivedUnits) && derivedUnits > 0) {
      const unitsInput = document.getElementById('calc-units-pata');
      if (unitsInput) unitsInput.value = Number.isInteger(derivedUnits) ? derivedUnits : derivedUnits.toFixed(2);
    }
  }
  units = parseFloat(document.getElementById('calc-units-pata')?.value) || 0;

  // Preferred calculation: Box price ÷ total tablets = price per tablet.
  if (boxPrice > 0 && totalTabsBox > 0) {
    const unitPrice = boxPrice / totalTabsBox;
    const output = document.getElementById('calc-unit-price');
    if (output) output.textContent = unitPrice.toFixed(2);

    // If strip count is known, derive strip price too.
    if (stripsBox > 0) {
      price = boxPrice / stripsBox;
      const pataInput = document.getElementById('calc-price-pata');
      if (pataInput) pataInput.value = price.toFixed(2);
    } else if (units > 0) {
      price = unitPrice * units;
      const pataInput = document.getElementById('calc-price-pata');
      if (pataInput) pataInput.value = price.toFixed(2);
    }
    return;
  }

  if (boxPrice > 0 && stripsBox > 0) {
    price = boxPrice / stripsBox;
    const pataInput = document.getElementById('calc-price-pata');
    if (pataInput) pataInput.value = price.toFixed(2);
  }
  const output = document.getElementById('calc-unit-price');
  if (!output) return;
  output.textContent = units > 0 ? (price / units).toFixed(2) : '0.00';
}

// Calculator Helpers
function populateCalcDropdown(showResults = false) {
  const select = document.getElementById('calc-med-select');
  const searchInput = document.getElementById('calc-search-input');
  const clearBtn = document.getElementById('clear-calc-search');
  const results = document.getElementById('calc-medicine-results');
  if (!select) return;

  const filterText = searchInput ? (searchInput.value || '').toLowerCase().trim() : '';
  if (clearBtn) clearBtn.classList.toggle('hidden', !filterText);

  // Only a medicine the user picked is selected. (Before, the hidden dropdown
  // fell back to its first option, so Panadol came back after Reset.)
  const selectedId = calcSelectedId && medicines.some(m => m.id === calcSelectedId) ? calcSelectedId : '';
  const filtered = medicines.filter(m => !filterText || m.name.toLowerCase().includes(filterText) || (m.category && m.category.toLowerCase().includes(filterText))).slice(0, 100);

  const selectedMed = selectedId ? medicines.find(m => m.id === selectedId) : null;
  const options = filtered.filter(m => m.id !== selectedId);
  select.innerHTML = '<option value="">Select medicine</option>' +
    (selectedMed ? `<option value="${selectedMed.id}">${escapeHtml(selectedMed.name)}</option>` : '') +
    options.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  select.value = selectedId;

  if (results) {
    if (!showResults && document.activeElement !== searchInput) { results.classList.add('hidden'); }
    else {
      results.innerHTML = filtered.length ? filtered.map(m => {
        const selected = m.id === selectedId;
        return `<button type="button" data-action="selectCalcMedicine" data-id="${m.id}" class="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-emerald-50 ${selected ? 'bg-emerald-50' : ''}">
          <span class="min-w-0"><span class="block text-sm font-semibold text-slate-800 truncate">${escapeHtml(m.name)}</span><span class="block text-[10px] text-slate-400 truncate">${escapeHtml(m.category || 'General')}</span></span>
          <span class="shrink-0 text-[10px] font-bold text-emerald-700">Rs. ${Number(m.pataPrice || 0).toFixed(2)}</span>
        </button>`;
      }).join('') : '<div class="px-3 py-4 text-xs text-slate-400 text-center">No medicine found</div>';
      results.classList.remove('hidden');
    }
  }

  updateCalcDetails();
}

function selectCalcMedicine(id) {
  const select = document.getElementById('calc-med-select');
  const input = document.getElementById('calc-search-input');
  const results = document.getElementById('calc-medicine-results');
  const med = medicines.find(m => m.id === id);
  if (!select || !med) return;
  calcSelectedId = med.id;
  select.innerHTML = `<option value="">Select medicine</option><option value="${med.id}">${escapeHtml(med.name)}</option>`;
  select.value = med.id;
  if (input) input.value = med.name;
  if (results) results.classList.add('hidden');
  updateCalcDetails();
}

function clearCalcSearch() {
  // X = clear the combined search + selection cleanly.
  const searchInput = document.getElementById('calc-search-input');
  const clearBtn = document.getElementById('clear-calc-search');
  const results = document.getElementById('calc-medicine-results');
  const select = document.getElementById('calc-med-select');
  if (searchInput) {
    searchInput.value = '';
    searchInput.blur();
  }
  if (clearBtn) clearBtn.classList.add('hidden');
  if (results) { results.innerHTML = ''; results.classList.add('hidden'); }
  if (select) {
    select.innerHTML = '<option value="">Select medicine</option>';
    select.value = '';
  }
  calcSelectedId = null;
  // Clear auto-filled medicine/pricing details and calculation result.
  ['calc-box-price','calc-total-tabs-box','calc-strips-box','calc-price-pata','calc-units-pata'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['calc-pata-qty','calc-tablet-qty'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '0';
  });
  const result = document.getElementById('calc-total-result');
  if (result) result.textContent = 'Rs. 0.00';
  const breakdown = document.getElementById('calc-breakdown');
  if (breakdown) breakdown.textContent = '0 pata + 0 tablets';
  const boxDisplay = document.getElementById('calc-box-price-display');
  const tabsDisplay = document.getElementById('calc-total-tabs-display');
  if (boxDisplay) boxDisplay.textContent = 'Rs. —';
  if (tabsDisplay) tabsDisplay.textContent = '—';
  const card = document.getElementById('calc-summary-card');
  if (card) card.classList.add('hidden');
  ['calc-name', 'calc-prices-text', 'calc-pack-info', 'calc-stock-text'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  const unitPrice = document.getElementById('calc-unit-price');
  if (unitPrice) unitPrice.textContent = '0.00';
  const saleError = document.getElementById('calc-sale-error');
  if (saleError) saleError.textContent = '';
  setCalcGroup(true);
  return false;
}

function resetCalculator() {
  // Full Calculator reset: clear search, selection, all auto-filled values and results.
  clearCalcSearch();
  const results = document.getElementById('calc-medicine-results');
  if (results) { results.innerHTML = ''; results.classList.add('hidden'); }
  const select = document.getElementById('calc-med-select');
  if (select) { select.innerHTML = '<option value="">Select medicine</option>'; select.value = ''; }
  calcSelectedId = null;
  const searchInput = document.getElementById('calc-search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('clear-calc-search');
  if (clearBtn) clearBtn.classList.add('hidden');
  // Leave the calculator ready for a fresh search; do not auto-select any medicine.
  return false;
}


function updateCalcDetails() {
  const select = document.getElementById('calc-med-select');
  const card = document.getElementById('calc-summary-card');
  if (!select || medicines.length === 0) return;

  const med = medicines.find(m => m.id === select.value);
  if (!med) {
    card.classList.add('hidden');
    document.getElementById('calc-total-result').textContent = 'Rs. 0.00';
    return;
  }

  card.classList.remove('hidden');
  const single = !isPackForm(med.formType);
  const names = getUnitNames(med.formType);
  setCalcGroup(!single);
  const calcSearch = document.getElementById('calc-search-input');
  if (calcSearch && document.activeElement !== calcSearch) calcSearch.value = med.name;
  document.getElementById('calc-img').src = med.image || placeholderImage(med.name.charAt(0));
  document.getElementById('calc-name').textContent = med.name;
  const boxPrice = Number(med.boxPrice || 0);
  const strips = Number(med.stripsPerBox || 0);
  const unitsPerPata = Number(med.tabletsPerPata || 0);
  const totalTabs = Number(med.totalTabsBox || 0) || (strips * unitsPerPata);
  document.getElementById('calc-prices-text').textContent = single
    ? `Price per ${names.pack[0]}: Rs. ${Number(med.pataPrice || 0).toFixed(2)}`
    : `Pata: Rs. ${Number(med.pataPrice || 0).toFixed(2)} | Tablet: Rs. ${Number(med.tabletPrice || 0).toFixed(2)}`;
  document.getElementById('calc-pack-info').textContent = single ? itemLabel(med.formType) : (strips > 0 ? `${strips} pata/box • ${unitsPerPata || (totalTabs && strips ? (totalTabs/strips).toFixed(2) : '—')} tablets/pata` : 'Pack details not available');

  // Clear the previous medicine's values first (empty fields used to keep them)
  ['calc-box-price', 'calc-total-tabs-box', 'calc-strips-box', 'calc-price-pata', 'calc-units-pata'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const setVal=(id,val)=>{const el=document.getElementById(id); if(el && Number(val)>0) el.value=Number(val).toFixed(2).replace(/\.00$/,'');};
  setVal('calc-box-price', boxPrice);
  setVal('calc-total-tabs-box', totalTabs);
  setVal('calc-strips-box', strips);
  setVal('calc-price-pata', Number(med.pataPrice || 0));
  setVal('calc-units-pata', unitsPerPata || (totalTabs && strips ? totalTabs/strips : 0));
  calculatePataUnitRate();
  document.getElementById('calc-box-price-display').textContent = boxPrice > 0 ? `Rs. ${boxPrice.toFixed(2)}` : 'Rs. —';
  document.getElementById('calc-total-tabs-display').textContent = totalTabs > 0 ? totalTabs.toLocaleString() : '—';

  document.getElementById('calc-pata-label').textContent = single ? `Quantity (${names.pack[1]})` : 'Strips / Pata';
  document.getElementById('calc-tablet-label').textContent = 'Loose Tablets';
  document.getElementById('calc-price-label').textContent = single ? `Price per ${itemLabel(med.formType)} (Rs.)` : 'Price / Pata (Rs.) *';
  document.getElementById('calc-qty-help').textContent = single ? `Enter how many ${names.pack[1]}` : 'Enter pata/strip and loose tablet quantity';
  const calcStock = document.getElementById('calc-stock-text');
  if (calcStock) calcStock.textContent = `Stock: ${stockText(med)}`;

  calculateTotal();
}

function calculateTotal() {
  const select = document.getElementById('calc-med-select');
  if (!select) return;

  const med = medicines.find(m => m.id === select.value);
  if (!med) {
    document.getElementById('calc-total-result').textContent = 'Rs. 0.00';
    return;
  }

  const pataQty = parseFloat(document.getElementById('calc-pata-qty').value) || 0;
  const tabQty = isPackForm(med.formType) ? (parseFloat(document.getElementById('calc-tablet-qty').value) || 0) : 0;

  const pataRate = Number(med.pataPrice || 0);
  let tabletRate = Number(med.tabletPrice || 0);
  const boxPrice = Number(med.boxPrice || 0);
  const totalTabs = Number(med.totalTabsBox || 0);
  if (!tabletRate && boxPrice > 0 && totalTabs > 0) tabletRate = boxPrice / totalTabs;
  const total = (pataQty * pataRate) + (tabQty * tabletRate);
  document.getElementById('calc-total-result').textContent = `Rs. ${total.toFixed(2)}`;
  const breakdown=document.getElementById('calc-breakdown');
  if (breakdown) {
    const names = getUnitNames(med.formType);
    // Single items: quantity x price per item
    breakdown.textContent = isPackForm(med.formType)
      ? `${pataQty} pata × Rs. ${pataRate.toFixed(2)} + ${tabQty} tablets × Rs. ${tabletRate.toFixed(2)}`
      : `${pataQty} ${pataQty === 1 ? names.pack[0] : names.pack[1]} × Rs. ${pataRate.toFixed(2)}`;
  }
  // Live stock check for "Record as Completed Sale"
  const saleError = document.getElementById('calc-sale-error');
  if (saleError) saleError.textContent = (pataQty > 0 || tabQty > 0) ? checkStockForSale(med, pataQty, tabQty).error : '';
}

function recordSaleFromCalc() {
  const select = document.getElementById('calc-med-select');
  if (!select) return;

  const med = medicines.find(m => m.id === select.value);
  if (!med) return;

  const pataQty = parseFloat(document.getElementById('calc-pata-qty').value) || 0;
  const tabQty = isPackForm(med.formType) ? (parseFloat(document.getElementById('calc-tablet-qty').value) || 0) : 0;

  if (pataQty <= 0 && tabQty <= 0) {
    showToast('Please enter a quantity first.');
    return;
  }

  const error = addToCart(med, pataQty, tabQty);
  document.getElementById('calc-sale-error').textContent = error;
  if (error) return;
  resetCalculator();
  showToast('Added to cart');
}

// Details popup "Calculator" button. selectCalcMedicine() works for any medicine;
// setting the dropdown value only worked for the first 100 (others showed the wrong one).
function openCalcModal(id) {
  switchTab('calc');
  selectCalcMedicine(id);
}

// Calculator layout: tablet / capsule (box, pata, loose) or single item (one price, one quantity)
function setCalcGroup(pack) {
  const screen = document.getElementById('screen-calc');
  if (screen) screen.classList.toggle('is-single', !pack);
}
