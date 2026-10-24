// sales.js
// Quick sell modal, sales history and the PKR prescription calculator.

// SALES TRACKING POS SYSTEM
function openSellModal(id) {
  const med = medicines.find(m => m.id === id);
  if (!med) return;

  currentSellMed = med;
  const formType = med.formType || 'Tablet';
  const packLabel = formType === 'Tablet' ? 'Pata / Strips' : 'Bottles / Packs';
  const unitLabel = formType === 'Tablet' ? 'Loose Tablets' : 'Loose Tablets';

  document.getElementById('sell-med-id').value = med.id;
  document.getElementById('sell-med-name').textContent = med.name;
  document.getElementById('sell-med-stock-text').textContent = '';
  document.getElementById('sell-med-img').src = med.image || placeholderImage(med.name.charAt(0));

  document.getElementById('sell-pack-label').textContent = packLabel;
  document.getElementById('sell-unit-label').textContent = unitLabel;
  document.getElementById('sell-pack-qty').value = 1;
  document.getElementById('sell-unit-qty').value = 0;

  calcSellTotal();
  document.getElementById('sell-modal').classList.remove('hidden');
}

function closeSellModal() {
  document.getElementById('sell-modal').classList.add('hidden');
  currentSellMed = null;
}

function calcSellTotal() {
  if (!currentSellMed) return;

  const packs = parseFloat(document.getElementById('sell-pack-qty').value) || 0;
  const units = parseFloat(document.getElementById('sell-unit-qty').value) || 0;

  const totalBill = (packs * currentSellMed.pataPrice) + (units * currentSellMed.tabletPrice);
  document.getElementById('sell-total-bill').textContent = `Rs. ${totalBill.toFixed(2)}`;
}

function confirmRecordSale() {
  if (!currentSellMed) return;

  const packs = parseFloat(document.getElementById('sell-pack-qty').value) || 0;
  const units = parseFloat(document.getElementById('sell-unit-qty').value) || 0;

  if (packs <= 0 && units <= 0) {
    showToast('Please enter a valid quantity!');
    return;
  }

  const totalRevenue = (packs * currentSellMed.pataPrice) + (units * currentSellMed.tabletPrice);

  const saleRecord = {
    id: 'sale_' + Date.now(),
    medId: currentSellMed.id,
    medName: currentSellMed.name,
    formType: currentSellMed.formType || 'Tablet',
    packs: packs,
    units: units,
    revenue: totalRevenue,
    date: new Date().toISOString()
  };

  salesHistory.unshift(saleRecord);
  saveToLocalStorage();
  renderMedicineList();
  closeSellModal();
  showToast(`Sale recorded! Revenue: Rs. ${totalRevenue.toFixed(2)}`);
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

    let qtyText = '';
    if (s.packs > 0) qtyText += `${s.packs} Pack/Pata `;
    if (s.units > 0) qtyText += `${s.units} Units`;

    return `
      <div class="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
        <div>
          <h5 class="font-bold text-slate-800">${escapeHtml(s.medName)}</h5>
          <p class="text-[10px] text-slate-400">${dateStr} • ${qtyText}</p>
        </div>
        <div class="text-right">
          <span class="font-bold text-emerald-700 block">Rs. ${s.revenue.toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');
}

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

  const selectedId = select.value;
  const filtered = medicines.filter(m => !filterText || m.name.toLowerCase().includes(filterText) || (m.category && m.category.toLowerCase().includes(filterText))).slice(0, 100);

  select.innerHTML = filtered.length ? filtered.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('') : '<option value="">No items found</option>';
  if (selectedId && medicines.some(m => m.id === selectedId)) select.value = selectedId;

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
  select.innerHTML = `<option value="${med.id}">${escapeHtml(med.name)}</option>`;
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
    select.innerHTML = '';
    select.value = '';
  }
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
  return false;
}

function resetCalculator() {
  // Full Calculator reset: clear search, selection, all auto-filled values and results.
  clearCalcSearch();
  const results = document.getElementById('calc-medicine-results');
  if (results) { results.innerHTML = ''; results.classList.add('hidden'); }
  const select = document.getElementById('calc-med-select');
  if (select) { select.innerHTML = ''; select.value = ''; }
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
  const calcSearch = document.getElementById('calc-search-input');
  if (calcSearch && document.activeElement !== calcSearch) calcSearch.value = med.name;
  document.getElementById('calc-img').src = med.image || placeholderImage(med.name.charAt(0));
  document.getElementById('calc-name').textContent = med.name;
  const boxPrice = Number(med.boxPrice || 0);
  const strips = Number(med.stripsPerBox || 0);
  const unitsPerPata = Number(med.tabletsPerPata || 0);
  const totalTabs = Number(med.totalTabsBox || 0) || (strips * unitsPerPata);
  document.getElementById('calc-prices-text').textContent = `Pata: Rs. ${Number(med.pataPrice || 0).toFixed(2)} | Tablet: Rs. ${Number(med.tabletPrice || 0).toFixed(2)}`;
  document.getElementById('calc-pack-info').textContent = strips > 0 ? `${strips} pata/box • ${unitsPerPata || (totalTabs && strips ? (totalTabs/strips).toFixed(2) : '—')} tablets/pata` : 'Pack details not available';

  const setVal=(id,val)=>{const el=document.getElementById(id); if(el && Number(val)>0) el.value=Number(val).toFixed(2).replace(/\.00$/,'');};
  setVal('calc-box-price', boxPrice);
  setVal('calc-total-tabs-box', totalTabs);
  setVal('calc-strips-box', strips);
  setVal('calc-price-pata', Number(med.pataPrice || 0));
  setVal('calc-units-pata', unitsPerPata || (totalTabs && strips ? totalTabs/strips : 0));
  calculatePataUnitRate();
  document.getElementById('calc-box-price-display').textContent = boxPrice > 0 ? `Rs. ${boxPrice.toFixed(2)}` : 'Rs. —';
  document.getElementById('calc-total-tabs-display').textContent = totalTabs > 0 ? totalTabs.toLocaleString() : '—';

  const formType = med.formType || 'Tablet';
  document.getElementById('calc-pata-label').textContent = formType === 'Tablet' ? 'Strips / Pata' : 'Pack / Bottle';
  document.getElementById('calc-tablet-label').textContent = formType === 'Tablet' ? 'Loose Tablets' : 'Loose Tablets';

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
  const tabQty = parseFloat(document.getElementById('calc-tablet-qty').value) || 0;

  const pataRate = Number(med.pataPrice || 0);
  let tabletRate = Number(med.tabletPrice || 0);
  const boxPrice = Number(med.boxPrice || 0);
  const totalTabs = Number(med.totalTabsBox || 0);
  if (!tabletRate && boxPrice > 0 && totalTabs > 0) tabletRate = boxPrice / totalTabs;
  const total = (pataQty * pataRate) + (tabQty * tabletRate);
  document.getElementById('calc-total-result').textContent = `Rs. ${total.toFixed(2)}`;
  const breakdown=document.getElementById('calc-breakdown');
  if(breakdown) breakdown.textContent = `${pataQty} pata × Rs. ${pataRate.toFixed(2)} + ${tabQty} tablets × Rs. ${tabletRate.toFixed(2)}`;
}

function recordSaleFromCalc() {
  const select = document.getElementById('calc-med-select');
  if (!select) return;

  const med = medicines.find(m => m.id === select.value);
  if (!med) return;

  const pataQty = parseFloat(document.getElementById('calc-pata-qty').value) || 0;
  const tabQty = parseFloat(document.getElementById('calc-tablet-qty').value) || 0;

  if (pataQty <= 0 && tabQty <= 0) {
    showToast('Please enter quantities to record sale.');
    return;
  }

  currentSellMed = med;
  document.getElementById('sell-pack-qty').value = pataQty;
  document.getElementById('sell-unit-qty').value = tabQty;
  confirmRecordSale();
}

// "Calculator" button on a medicine card
function openCardCalculator(id) {
  switchTab('calc');
  // selectCalcMedicine() works for any medicine, not only the first 100 in the dropdown
  setTimeout(() => selectCalcMedicine(id), 80);
}

function openCalcModal(id) {
  switchTab('calc');
  const select = document.getElementById('calc-med-select');
  if (select) {
    select.value = id;
    updateCalcDetails();
  }
}
