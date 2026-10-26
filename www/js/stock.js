// stock.js
// Stock math, stock text/badges, low-stock status and restock (purchase) entries.
// Stock is stored in the smallest unit (tablet for tablets, "unit" for others):
//   1 pack (pata / bottle / pack) = tabletsPerPata units
//   1 box = totalTabsBox units (or stripsPerBox packs)

function isTabletForm(formType) {
  return ['Tablet', 'Capsule'].includes(formType || 'Tablet');
}

// [singular, plural] names for box / pack / loose unit
function getUnitNames(formType) {
  const f = formType || 'Tablet';
  if (isTabletForm(f)) return { box: ['box', 'boxes'], pack: ['pata', 'patas'], loose: ['tab', 'tabs'] };
  if (['Syrup', 'Suspension', 'Liquid', 'Drops'].includes(f)) return { box: ['box', 'boxes'], pack: ['bottle', 'bottles'], loose: ['unit', 'units'] };
  return { box: ['box', 'boxes'], pack: ['pack', 'packs'], loose: ['unit', 'units'] };
}

// Pack and box size in units. box = 0 means the box size is unknown.
function getPackSizes(src) {
  const pack = Math.max(1, Math.round(Number(src.tabletsPerPata) || 1));
  const strips = Math.round(Number(src.stripsPerBox) || 0);
  const total = Math.round(Number(src.totalTabsBox) || 0);
  return { pack, box: total || strips * pack || 0 };
}

function splitUnits(units, sizes) {
  let rest = Math.max(0, Math.round(units));
  let boxes = 0;
  if (sizes.box > 0) {
    boxes = Math.floor(rest / sizes.box);
    rest = rest % sizes.box;
  }
  const packs = Math.floor(rest / sizes.pack);
  const loose = rest % sizes.pack;
  return { boxes, packs, loose };
}

// e.g. "3 boxes, 4 patas, 6 tabs"
function formatUnits(units, formType, sizes) {
  const names = getUnitNames(formType);
  const n = Math.round(Number(units) || 0);
  if (n <= 0) return `0 ${names.loose[1]}`;
  const parts = splitUnits(n, sizes);
  const word = (count, pair) => `${count} ${count === 1 ? pair[0] : pair[1]}`;
  const out = [];
  if (parts.boxes) out.push(word(parts.boxes, names.box));
  if (parts.packs) out.push(word(parts.packs, names.pack));
  if (parts.loose) out.push(word(parts.loose, names.loose));
  return out.join(', ');
}

function formatMedUnits(med, units) {
  return formatUnits(units, med.formType, getPackSizes(med));
}

function hasStock(med) {
  return !!med && med.stockUnits !== null && med.stockUnits !== undefined && Number.isFinite(Number(med.stockUnits));
}

// 'unset' | 'out' | 'low' | 'ok'
function getStockStatus(med) {
  if (!hasStock(med)) return 'unset';
  const stock = Number(med.stockUnits);
  if (stock <= 0) return 'out';
  if (med.minStockUnits !== null && med.minStockUnits !== undefined && stock <= Number(med.minStockUnits)) return 'low';
  return 'ok';
}

function stockText(med) {
  if (!hasStock(med)) return 'Stock not set';
  if (Number(med.stockUnits) <= 0) return 'Out of stock';
  return formatMedUnits(med, med.stockUnits);
}

function stockBadgeHtml(med) {
  const status = getStockStatus(med);
  if (status === 'out') return '<span class="mp-stock-badge mp-stock-out">Out of stock</span>';
  if (status === 'low') return '<span class="mp-stock-badge mp-stock-low">Low stock</span>';
  return '';
}

// Price of one smallest unit, used for stock value
function getUnitPrice(med) {
  const tablet = Number(med.tabletPrice) || 0;
  if (tablet > 0) return tablet;
  return (Number(med.pataPrice) || 0) / getPackSizes(med).pack;
}

function getStockValue(med) {
  if (!hasStock(med) || Number(med.stockUnits) <= 0) return 0;
  return Number(med.stockUnits) * getUnitPrice(med);
}

// Checks a sale against stock. Returns { units, error }.
// units = how many smallest units leave the stock (0 when stock is not set).
function checkStockForSale(med, packs, loose) {
  if (!hasStock(med)) return { units: 0, error: '' };
  if (!Number.isInteger(packs) || !Number.isInteger(loose)) {
    return { units: 0, error: 'Use whole numbers for items with stock.' };
  }
  const units = packs * getPackSizes(med).pack + loose;
  const stock = Number(med.stockUnits);
  if (units > stock) {
    return { units, error: stock <= 0 ? 'Out of stock. Restock first.' : `Only ${formatMedUnits(med, stock)} left` };
  }
  return { units, error: '' };
}

// Reads 3 inputs: #<prefix>-boxes, #<prefix>-packs, #<prefix>-loose
// Returns { empty, units, boxes, packs, loose, error }
function readQtyInputs(prefix, sizes, formType) {
  const raw = ['boxes', 'packs', 'loose'].map(k => (document.getElementById(`${prefix}-${k}`)?.value || '').trim());
  if (raw.every(v => v === '')) return { empty: true, units: 0, boxes: 0, packs: 0, loose: 0, error: '' };
  const [boxes, packs, loose] = raw.map(v => (v === '' ? 0 : Number(v)));
  if ([boxes, packs, loose].some(v => !Number.isInteger(v) || v < 0)) {
    return { empty: false, units: 0, boxes, packs, loose, error: 'Use whole numbers (0 or more).' };
  }
  if (boxes > 0 && !sizes.box) {
    const names = getUnitNames(formType);
    return {
      empty: false, units: 0, boxes, packs, loose,
      error: `Box size unknown. Fill "Total ${names.pack[1]}" or "Total ${names.loose[1]}" in Box Pricing first.`
    };
  }
  return { empty: false, units: boxes * sizes.box + packs * sizes.pack + loose, boxes, packs, loose, error: '' };
}

function fillQtyInputs(prefix, units, sizes) {
  const parts = splitUnits(units, sizes);
  const set = (k, v) => { const el = document.getElementById(`${prefix}-${k}`); if (el) el.value = v ? v : ''; };
  set('boxes', parts.boxes);
  set('packs', parts.packs);
  set('loose', parts.loose);
  // 0 stock must stay "0", not empty (empty means "Stock not set")
  if (!units) document.getElementById(`${prefix}-loose`).value = '0';
}

// Minimum stock: #min-stock-qty + #min-stock-unit (box / pack / loose)
function readMinStockInput(sizes) {
  const raw = (document.getElementById('min-stock-qty').value || '').trim();
  if (raw === '') return { empty: true, units: 0, error: '' };
  const qty = Number(raw);
  if (!Number.isInteger(qty) || qty < 0) return { empty: false, units: 0, error: 'Minimum stock must be a whole number.' };
  const unit = document.getElementById('min-stock-unit').value;
  if (unit === 'box' && !sizes.box) return { empty: false, units: 0, error: 'Box size unknown, so minimum stock can\'t use boxes.' };
  const size = unit === 'box' ? sizes.box : unit === 'pack' ? sizes.pack : 1;
  return { empty: false, units: qty * size, error: '' };
}

function fillMinStockInput(units, sizes) {
  let unit = 'loose';
  let qty = units;
  if (sizes.box && units >= sizes.box && units % sizes.box === 0) { unit = 'box'; qty = units / sizes.box; }
  else if (units >= sizes.pack && units % sizes.pack === 0) { unit = 'pack'; qty = units / sizes.pack; }
  document.getElementById('min-stock-qty').value = qty;
  document.getElementById('min-stock-unit').value = unit;
}

// ---------- Restock / purchase entry ----------

function todayInputValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "2026-10-26" -> local date text
function formatInputDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!m) return value || '';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function openRestockModal(id) {
  const med = medicines.find(m => m.id === id);
  if (!med) return;
  currentRestockMed = med;
  const names = getUnitNames(med.formType);

  document.getElementById('restock-med-name').textContent = med.name;
  document.getElementById('restock-current-stock').textContent = `Current: ${stockText(med)}`;
  document.getElementById('label-restock-packs').textContent = capitalize(names.pack[1]);
  document.getElementById('label-restock-loose').textContent = `Loose ${names.loose[1]}`;
  document.getElementById('restock-boxes').disabled = !getPackSizes(med).box;
  ['restock-boxes', 'restock-packs', 'restock-loose', 'restock-supplier', 'restock-price-box', 'restock-notes']
    .forEach(fieldId => { document.getElementById(fieldId).value = ''; });
  document.getElementById('restock-date').value = todayInputValue();
  document.getElementById('restock-error').textContent = '';
  updateRestockPreview();

  document.getElementById('restock-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeRestockModal() {
  document.getElementById('restock-modal').classList.add('hidden');
  currentRestockMed = null;
}

function updateRestockPreview() {
  const med = currentRestockMed;
  const preview = document.getElementById('restock-preview');
  if (!med || !preview) return;
  const result = readQtyInputs('restock', getPackSizes(med), med.formType);
  document.getElementById('restock-error').textContent = result.error || '';
  if (result.error || result.empty || result.units <= 0) { preview.textContent = ''; return; }
  const after = (hasStock(med) ? Number(med.stockUnits) : 0) + result.units;
  preview.textContent = `Adds ${formatMedUnits(med, result.units)}. New stock: ${formatMedUnits(med, after)}`;
}

function saveRestock() {
  const med = currentRestockMed;
  if (!med) return;
  const errorEl = document.getElementById('restock-error');
  const qty = readQtyInputs('restock', getPackSizes(med), med.formType);
  if (qty.error) { errorEl.textContent = qty.error; return; }
  if (qty.empty || qty.units <= 0) { errorEl.textContent = 'Enter how much stock you received.'; return; }

  const date = document.getElementById('restock-date').value || todayInputValue();
  const priceRaw = document.getElementById('restock-price-box').value.trim();
  const pricePerBox = priceRaw === '' ? null : Number(priceRaw);
  if (pricePerBox !== null && (!Number.isFinite(pricePerBox) || pricePerBox < 0)) {
    errorEl.textContent = 'Purchase price must be 0 or more.';
    return;
  }

  purchases.unshift({
    id: 'pur_' + Date.now(),
    medId: med.id,
    medName: med.name,
    date,
    units: qty.units,
    boxes: qty.boxes,
    packs: qty.packs,
    loose: qty.loose,
    supplier: document.getElementById('restock-supplier').value.trim(),
    pricePerBox,
    notes: document.getElementById('restock-notes').value.trim(),
    createdAt: new Date().toISOString()
  });
  med.stockUnits = (hasStock(med) ? Number(med.stockUnits) : 0) + qty.units;

  saveToLocalStorage();
  renderMedicineList();
  closeRestockModal();
  showToast(`Added ${formatMedUnits(med, qty.units)} to stock`);
  openDetailsModal(med.id);
}

function renderRestockHistory(med) {
  const container = document.getElementById('modal-restock-history');
  if (!container) return;
  const list = purchases
    .filter(p => p.medId === med.id)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));

  if (list.length === 0) {
    container.innerHTML = '<p class="text-[11px] text-slate-400 italic py-1">No restock entries yet.</p>';
    return;
  }
  container.innerHTML = list.slice(0, 20).map(p => {
    const extra = [
      p.supplier ? escapeHtml(p.supplier) : '',
      p.pricePerBox !== null && p.pricePerBox !== undefined ? `Rs. ${Number(p.pricePerBox).toFixed(2)} / box` : ''
    ].filter(Boolean).join(' • ');
    return `
      <div class="mp-history-row">
        <div class="min-w-0">
          <p class="text-xs font-bold text-slate-800">+ ${escapeHtml(formatMedUnits(med, p.units))}</p>
          <p class="text-[10px] text-slate-400 truncate">${escapeHtml(formatInputDate(p.date))}${extra ? ' • ' + extra : ''}</p>
          ${p.notes ? `<p class="text-[10px] text-slate-500 truncate">${escapeHtml(p.notes)}</p>` : ''}
        </div>
      </div>`;
  }).join('') + (list.length > 20 ? `<p class="text-[10px] text-slate-400 text-center pt-1">Showing latest 20 of ${list.length}</p>` : '');
}
