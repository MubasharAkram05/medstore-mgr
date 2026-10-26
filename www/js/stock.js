// stock.js
// Stock math, stock text/badges, low-stock status and restock (purchase) entries.
// Stock is stored in the smallest unit:
//   Tablet / Capsule (pack forms): units = tablets; 1 pata = tabletsPerPata,
//     1 box = totalTabsBox (or stripsPerBox patas)
//   Every other form (single items): units = items (12 syrups = 12)

function isTabletForm(formType) {
  return isPackForm(formType);
}

// [singular, plural] names for box / pack / loose unit.
// Single items: "pack" is the item itself (syrup / syrups, cream / creams...).
function getUnitNames(formType) {
  const f = canonicalForm(formType) || formType || 'Tablet';
  if (isPackForm(f)) return { box: ['box', 'boxes'], pack: ['pata', 'patas'], loose: ['tab', 'tabs'] };
  const one = f.toLowerCase();
  const many = one === 'drops' ? 'drops' : one + 's';
  return { box: ['box', 'boxes'], pack: [one === 'drops' ? 'drops' : one, many], loose: [one, many] };
}

// "Syrup" -> label used in prices: "Price per Syrup"
function itemLabel(formType) {
  return canonicalForm(formType) || formType || 'Item';
}

// Pack and box size in units. box = 0 means the box size is unknown.
// Single items are counted one by one: pack = 1, no boxes.
function getPackSizes(src) {
  if (!isPackForm(src.formType)) return { pack: 1, box: 0 };
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

// e.g. "3 boxes, 4 patas, 6 tabs" or "12 syrups"
function formatUnits(units, formType, sizes) {
  const names = getUnitNames(formType);
  if (!isPackForm(formType)) {
    // Item count (can have decimals only for stock converted from old data)
    const items = Math.round((Number(units) || 0) * 100) / 100;
    return `${items} ${items === 1 ? names.pack[0] : names.pack[1]}`;
  }
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
  const single = !isPackForm(formType);
  const raw = ['boxes', 'packs', 'loose'].map(k => (single && k !== 'packs') ? '' : (document.getElementById(`${prefix}-${k}`)?.value || '').trim());
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
  // Single items (box = 0, pack = 1): whole count goes in the item field
  const parts = sizes.box === 0 && sizes.pack === 1 ? { boxes: 0, packs: Number(units) || 0, loose: 0 } : splitUnits(units, sizes);
  const set = (k, v) => { const el = document.getElementById(`${prefix}-${k}`); if (el) el.value = v ? v : ''; };
  set('boxes', parts.boxes);
  set('packs', parts.packs);
  set('loose', parts.loose);
  // 0 stock must stay "0", not empty (empty means "Stock not set")
  if (!units) document.getElementById(sizes.box === 0 && sizes.pack === 1 ? `${prefix}-packs` : `${prefix}-loose`).value = '0';
}

// Minimum stock: #min-stock-qty + #min-stock-unit (box / pack / loose)
function readMinStockInput(sizes) {
  const raw = (document.getElementById('min-stock-qty').value || '').trim();
  if (raw === '') return { empty: true, units: 0, error: '' };
  const qty = Number(raw);
  if (!Number.isInteger(qty) || qty < 0) return { empty: false, units: 0, error: 'Minimum stock must be a whole number.' };
  // Single items: the minimum is a number of items
  const unit = sizes.box === 0 && sizes.pack === 1 ? 'pack' : document.getElementById('min-stock-unit').value;
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

// ---------- Free scheme: "Buy 10 + 1 Free" ----------
// Reads #<prefix>-scheme-buy / -free. Returns { buy, free, active, error }.
function readScheme(prefix) {
  const buyRaw = (document.getElementById(`${prefix}-scheme-buy`)?.value || '').trim();
  const freeRaw = (document.getElementById(`${prefix}-scheme-free`)?.value || '').trim();
  if (buyRaw === '' && freeRaw === '') return { buy: 0, free: 0, active: false, error: '' };
  const buy = Number(buyRaw), free = Number(freeRaw || 0);
  if (!Number.isInteger(buy) || buy < 1 || !Number.isInteger(free) || free < 0) {
    return { buy: 0, free: 0, active: false, error: 'Scheme must be whole numbers, like Buy 10 + 1 Free.' };
  }
  return { buy, free, active: free > 0, error: '' };
}

function fillScheme(prefix, scheme) {
  const buy = document.getElementById(`${prefix}-scheme-buy`);
  const free = document.getElementById(`${prefix}-scheme-free`);
  if (!buy || !free) return;
  buy.value = scheme && scheme.buy ? scheme.buy : '';
  free.value = scheme && scheme.buy ? scheme.free : '';
}

// Free quantity per field: floor(qty / buy) x free (boxes, patas and loose
// are counted separately, in the same unit the user typed).
function applyScheme(qty, scheme, sizes) {
  const freeOf = n => (scheme.active ? Math.floor(n / scheme.buy) * scheme.free : 0);
  const free = { boxes: freeOf(qty.boxes), packs: freeOf(qty.packs), loose: freeOf(qty.loose) };
  const freeUnits = free.boxes * sizes.box + free.packs * sizes.pack + free.loose;
  return { free, freeUnits, totalUnits: qty.units + freeUnits };
}

// "Adding 22 boxes (20 + 2 free)" / "Adding 33 syrups (30 + 3 free)"
function schemePreviewText(verb, qty, applied, formType, sizes) {
  const fmt = u => formatUnits(u, formType, sizes);
  if (!applied.freeUnits) return `${verb} ${fmt(qty.units)}`;
  return `${verb} ${fmt(applied.totalUnits)} (${fmt(qty.units)} + ${fmt(applied.freeUnits)} free)`;
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
  const single = !isPackForm(med.formType);
  document.getElementById('restock-modal').classList.toggle('is-single', single);
  document.getElementById('label-restock-packs').textContent = single ? `${capitalize(names.pack[1])} received` : capitalize(names.pack[1]);
  document.getElementById('label-restock-loose').textContent = `Loose ${names.loose[1]}`;
  document.getElementById('label-restock-price').textContent = single ? `Price / ${names.pack[0]} (optional)` : 'Price / box (optional)';
  document.getElementById('restock-boxes').disabled = !getPackSizes(med).box;
  ['restock-boxes', 'restock-packs', 'restock-loose', 'restock-supplier', 'restock-price-box', 'restock-notes']
    .forEach(fieldId => { document.getElementById(fieldId).value = ''; });
  // Last scheme used for this medicine is filled in again
  fillScheme('restock', med.lastScheme);
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
  const sizes = getPackSizes(med);
  const result = readQtyInputs('restock', sizes, med.formType);
  const scheme = readScheme('restock');
  document.getElementById('restock-error').textContent = result.error || scheme.error || '';
  if (result.error || scheme.error || result.empty || result.units <= 0) { preview.textContent = ''; return; }
  const applied = applyScheme(result, scheme, sizes);
  const after = (hasStock(med) ? Number(med.stockUnits) : 0) + applied.totalUnits;
  preview.textContent = `${schemePreviewText('Adding', result, applied, med.formType, sizes)}. New stock: ${formatMedUnits(med, after)}`;
}

function saveRestock() {
  const med = currentRestockMed;
  if (!med) return;
  const errorEl = document.getElementById('restock-error');
  const sizes = getPackSizes(med);
  const qty = readQtyInputs('restock', sizes, med.formType);
  if (qty.error) { errorEl.textContent = qty.error; return; }
  if (qty.empty || qty.units <= 0) { errorEl.textContent = 'Enter how much stock you received.'; return; }
  const scheme = readScheme('restock');
  if (scheme.error) { errorEl.textContent = scheme.error; return; }
  const applied = applyScheme(qty, scheme, sizes);

  const date = document.getElementById('restock-date').value || todayInputValue();
  const priceRaw = document.getElementById('restock-price-box').value.trim();
  const pricePerBox = priceRaw === '' ? null : Number(priceRaw);
  if (pricePerBox !== null && (!Number.isFinite(pricePerBox) || pricePerBox < 0)) {
    errorEl.textContent = 'Purchase price must be 0 or more.';
    return;
  }

  purchases.unshift(buildPurchaseRecord(med, {
    date, qty, scheme, applied, sizes, price: pricePerBox,
    supplier: document.getElementById('restock-supplier').value.trim(),
    notes: document.getElementById('restock-notes').value.trim()
  }));
  med.stockUnits = (hasStock(med) ? Number(med.stockUnits) : 0) + applied.totalUnits;
  if (scheme.active) med.lastScheme = { buy: scheme.buy, free: scheme.free };

  saveToLocalStorage();
  renderMedicineList();
  closeRestockModal();
  showToast(`Added ${formatMedUnits(med, applied.totalUnits)} to stock`);
  openDetailsModal(med.id);
}

// One purchase record. units = total added (bought + free).
// Price: per box for tablets/capsules, per item for single items.
// effectiveCostPerUnit spreads the cost over the free items too.
function buildPurchaseRecord(med, { date, qty, scheme, applied, sizes, price, supplier, notes }) {
  const single = !isPackForm(med.formType);
  let cost = null;
  if (price !== null && price !== undefined) {
    if (single) cost = price * qty.units;
    else if (sizes.box) cost = price * (qty.units / sizes.box);
  }
  return {
    id: 'pur_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    medId: med.id,
    medName: med.name,
    date,
    units: applied.totalUnits,
    boughtUnits: qty.units,
    freeUnits: applied.freeUnits,
    scheme: scheme.active ? { buy: scheme.buy, free: scheme.free } : null,
    boxes: qty.boxes,
    packs: qty.packs,
    loose: qty.loose,
    freeBoxes: applied.free.boxes,
    freePacks: applied.free.packs,
    freeLoose: applied.free.loose,
    supplier,
    pricePerBox: single ? null : price,
    pricePerItem: single ? price : null,
    totalCost: cost === null ? null : Math.round(cost * 100) / 100,
    effectiveCostPerUnit: cost === null || !applied.totalUnits ? null : Math.round((cost / applied.totalUnits) * 10000) / 10000,
    effectiveCostPerBox: cost === null || single || !sizes.box || !applied.totalUnits ? null : Math.round((cost / applied.totalUnits) * sizes.box * 100) / 100,
    notes,
    createdAt: new Date().toISOString()
  };
}
