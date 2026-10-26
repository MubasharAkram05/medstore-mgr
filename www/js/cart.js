// cart.js
// Cart for multi-item sales. "Confirm" in the sell sheet / "Add to Cart" in the
// calculator only add lines here. Stock is reduced and sales are recorded only
// when "Complete Sale" is pressed: one bill = one sale record per medicine,
// all sharing the same billId (so history, stats and "delete sale" still work).
// Saved in localStorage (STORAGE_KEYS.cart) until Complete Sale or Clear Cart.

// Line: { id, medId, name, formType, unit: 'pack' | 'loose', qty, price, addedAt }
let cart = [];
let cartView = 'cart';      // 'cart' or 'bill' (summary after Complete Sale)
let lastBill = null;

function lineTotal(line) {
  return (Number(line.qty) || 0) * (Number(line.price) || 0);
}

function cartTotal() {
  return cart.reduce((sum, l) => sum + lineTotal(l), 0);
}

function formatRs(n) {
  return `Rs. ${(Number(n) || 0).toFixed(2)}`;
}

// "2 patas" / "5 tabs" / "3 syrups"
function cartQtyText(line) {
  const names = getUnitNames(line.formType);
  const pair = line.unit === 'loose' ? names.loose : names.pack;
  return `${line.qty} ${line.qty === 1 ? pair[0] : pair[1]}`;
}

function cartUnitName(line) {
  const names = getUnitNames(line.formType);
  return line.unit === 'loose' ? names.loose[0] : names.pack[0];
}

// Stock units this medicine already has in the cart (optionally without one line)
function cartUnitsFor(medId, skipLineId) {
  const med = medicines.find(m => m.id === medId);
  if (!med) return 0;
  const pack = getPackSizes(med).pack;
  return cart.filter(l => l.medId === medId && l.id !== skipLineId)
    .reduce((sum, l) => sum + (l.unit === 'loose' ? l.qty : l.qty * pack), 0);
}

// Error text if adding packs/loose would go over the stock left after the cart
function cartStockError(med, packs, loose, skipLineId) {
  if (!hasStock(med)) return '';
  const reserved = cartUnitsFor(med.id, skipLineId);
  const want = packs * getPackSizes(med).pack + loose;
  const left = Number(med.stockUnits) - reserved;
  if (want <= left) return '';
  if (left <= 0) return reserved > 0 ? 'All stock of this item is already in the cart.' : 'Out of stock. Restock first.';
  return `Only ${formatMedUnits(med, left)} left${reserved > 0 ? ` (${formatMedUnits(med, reserved)} already in cart)` : ''}`;
}

// Adds a medicine to the cart. Returns an error message, or '' when added.
function addToCart(med, packs, loose) {
  if (packs < 0 || loose < 0) return 'Quantity can\'t be negative.';
  if (packs <= 0 && loose <= 0) return 'Please enter a valid quantity!';
  if (hasStock(med) && (!Number.isInteger(packs) || !Number.isInteger(loose))) return 'Use whole numbers for items with stock.';
  const stockError = cartStockError(med, packs, loose);
  if (stockError) return stockError;

  const add = (unit, qty, price) => {
    if (qty <= 0) return;
    const same = cart.find(l => l.medId === med.id && l.unit === unit);
    if (same) { same.qty = Math.round((same.qty + qty) * 100) / 100; same.price = price; return; }
    cart.push({
      id: 'cl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      medId: med.id, name: med.name, formType: med.formType || 'Tablet',
      unit, qty, price, addedAt: new Date().toISOString()
    });
  };
  add('pack', packs, Number(med.pataPrice) || 0);
  add('loose', loose, Number(med.tabletPrice) || 0);
  saveCart();
  return '';
}

function saveCart() {
  writeCart(cart);
  renderCartBadge();
  if (isCartOpen()) renderCart();
}

function renderCartBadge() {
  const badge = document.getElementById('cart-badge');
  const btn = document.getElementById('header-cart-btn');
  if (!badge || !btn) return;
  const count = cart.length;
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.classList.toggle('hidden', count === 0);
  btn.setAttribute('aria-label', count ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Cart, empty');
}

// ---------- Cart sheet ----------
function isCartOpen() {
  const el = document.getElementById('cart-modal');
  return el && !el.classList.contains('hidden');
}

function openCart() {
  cartView = 'cart';
  renderCart();
  document.getElementById('cart-modal').classList.remove('hidden');
}

function closeCart() {
  const el = document.getElementById('cart-modal');
  if (!el || el.classList.contains('hidden')) return;
  el.classList.add('is-closing');
  setTimeout(() => {
    el.classList.add('hidden');
    el.classList.remove('is-closing');
    cartView = 'cart';
  }, 180);
}

function renderCart() {
  const body = document.getElementById('cart-body');
  const footer = document.getElementById('cart-footer');
  const title = document.getElementById('cart-title');
  document.getElementById('cart-error').textContent = '';

  if (cartView === 'bill' && lastBill) {
    title.textContent = 'Sale completed';
    body.innerHTML = billSummaryHtml(lastBill);
    footer.innerHTML = `
      <div class="mp-cart-total"><span>Bill total</span><strong>${formatRs(lastBill.total)}</strong></div>
      <button type="button" data-action="closeCart" class="mp-btn w-full bg-emerald-600 text-white">${iconSvg('check')}<span>Done</span></button>`;
    return;
  }

  title.textContent = cart.length ? `Cart (${cart.length})` : 'Cart';
  if (!cart.length) {
    body.innerHTML = `
      <div class="mp-cart-empty">
        <div class="mp-empty-icon">${iconSvg('shopping-cart')}</div>
        <h3>Your cart is empty</h3>
        <p>Open a medicine, tap Sell Now and press Confirm to add it here.</p>
        <button type="button" data-action="closeCart" class="mp-btn bg-emerald-600 text-white px-5">${iconSvg('search')}<span>Find medicines</span></button>
      </div>`;
    footer.innerHTML = '';
    footer.classList.add('hidden');
    return;
  }
  footer.classList.remove('hidden');

  body.innerHTML = cart.map(line => {
    const med = medicines.find(m => m.id === line.medId);
    return `
      <div class="mp-cart-line" data-line="${escapeHtml(line.id)}">
        <div class="mp-cart-line-top">
          <div class="mp-med-icon ${formClass(line.formType)}" aria-hidden="true">${med ? medIconInner(med) : iconSvg('pill')}</div>
          <div class="min-w-0 flex-1">
            <h4>${escapeHtml(line.name)}</h4>
            <p>${formatRs(line.price)} / ${escapeHtml(cartUnitName(line))}</p>
          </div>
          <button type="button" class="mp-icon-btn mp-cart-remove" data-action="removeCartLine" data-id="${escapeHtml(line.id)}" aria-label="Remove ${escapeHtml(line.name)}">${iconSvg('trash-2')}</button>
        </div>
        <div class="mp-cart-line-bottom">
          <div class="mp-stepper" role="group" aria-label="Quantity">
            <button type="button" data-action="cartQtyMinus" data-id="${escapeHtml(line.id)}" aria-label="Less" ${line.qty <= 1 ? 'disabled' : ''}>${iconSvg('minus')}</button>
            <span>${escapeHtml(cartQtyText(line))}</span>
            <button type="button" data-action="cartQtyPlus" data-id="${escapeHtml(line.id)}" aria-label="More">${iconSvg('plus')}</button>
          </div>
          <strong>${formatRs(lineTotal(line))}</strong>
        </div>
      </div>`;
  }).join('');

  footer.innerHTML = `
    <div class="mp-cart-total"><span>Grand total</span><strong id="cart-grand-total">${formatRs(cartTotal())}</strong></div>
    <div class="grid grid-cols-3 gap-2">
      <button type="button" data-action="clearCartConfirm" class="mp-btn mp-btn-sm border border-red-200 bg-red-50 text-red-600">${iconSvg('trash-2')}<span>Clear</span></button>
      <button type="button" data-action="completeSale" class="col-span-2 mp-btn bg-emerald-600 text-white">${iconSvg('check-circle-2')}<span>Complete Sale</span></button>
    </div>`;
}

function changeCartQty(lineId, delta) {
  const line = cart.find(l => l.id === lineId);
  if (!line) return;
  const next = Math.round((line.qty + delta) * 100) / 100;
  if (next < 1) return;
  if (delta > 0) {
    const med = medicines.find(m => m.id === line.medId);
    const extraPacks = line.unit === 'pack' ? delta : 0;
    const extraLoose = line.unit === 'loose' ? delta : 0;
    const err = med ? cartStockError(med, extraPacks, extraLoose) : '';
    if (err) { document.getElementById('cart-error').textContent = err; return; }
  }
  line.qty = next;
  saveCart();
}

function removeCartLine(lineId) {
  cart = cart.filter(l => l.id !== lineId);
  saveCart();
}

function clearCartConfirm() {
  if (!cart.length) return;
  if (!confirm('Clear all items from the cart?')) return;
  cart = [];
  saveCart();
  showToast('Cart cleared');
}

// Saves the whole cart as one bill: stock goes down, sales are recorded.
function completeSale() {
  const errorEl = document.getElementById('cart-error');
  if (!cart.length) return;

  // Check every medicine again (stock may have changed since it was added)
  const groups = new Map();
  for (const line of cart) {
    const med = medicines.find(m => m.id === line.medId);
    if (!med) { errorEl.textContent = `"${line.name}" was deleted. Remove it from the cart first.`; return; }
    const g = groups.get(med.id) || { med, packs: 0, loose: 0, revenue: 0 };
    if (line.unit === 'loose') g.loose += line.qty; else g.packs += line.qty;
    g.revenue += lineTotal(line);
    groups.set(med.id, g);
  }
  for (const g of groups.values()) {
    const check = checkStockForSale(g.med, g.packs, g.loose);
    if (check.error) { errorEl.textContent = `${g.med.name}: ${check.error}`; return; }
  }

  const now = new Date();
  const billId = 'bill_' + now.getTime();
  const billNo = now.getTime().toString(36).toUpperCase().slice(-6);
  let i = 0;
  for (const g of groups.values()) {
    const check = checkStockForSale(g.med, g.packs, g.loose);
    if (hasStock(g.med)) g.med.stockUnits = Number(g.med.stockUnits) - check.units;
    salesHistory.unshift({
      id: `sale_${now.getTime()}_${i++}`,
      billId, billNo,
      medId: g.med.id,
      medName: g.med.name,
      formType: g.med.formType || 'Tablet',
      packs: g.packs,
      units: g.loose,
      stockUnits: check.units,
      revenue: Math.round(g.revenue * 100) / 100,
      date: now.toISOString()
    });
  }

  lastBill = {
    billNo, date: now.toISOString(), total: cartTotal(),
    lines: cart.map(l => ({ name: l.name, qtyText: cartQtyText(l), price: l.price, unit: cartUnitName(l), total: lineTotal(l) }))
  };
  cart = [];
  saveToLocalStorage();
  writeCart(cart);
  renderCartBadge();
  renderMedicineList();
  cartView = 'bill';
  renderCart();
  showToast(`Sale completed: ${formatRs(lastBill.total)}`);
}

function billSummaryHtml(bill) {
  const d = new Date(bill.date);
  return `
    <div class="mp-bill">
      <div class="mp-bill-head">
        <div class="mp-empty-icon">${iconSvg('receipt')}</div>
        <div>
          <strong>Bill #${escapeHtml(bill.billNo)}</strong>
          <span>${escapeHtml(d.toLocaleDateString())} ${escapeHtml(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</span>
        </div>
      </div>
      ${bill.lines.map(l => `
        <div class="mp-bill-row">
          <div class="min-w-0"><p>${escapeHtml(l.name)}</p><small>${escapeHtml(l.qtyText)} × ${formatRs(l.price)}</small></div>
          <strong>${formatRs(l.total)}</strong>
        </div>`).join('')}
    </div>`;
}
