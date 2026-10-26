// reports.js
// Totals and summaries: home dashboard counts and the Stats screen.

function renderHomeDashboard() {
  const count = medicines.length;
  const categories = new Set(medicines.map(m => m.category || 'Other'));
  const byId = (id) => document.getElementById(id);
  if (byId('dash-medicine-count')) byId('dash-medicine-count').textContent = count.toLocaleString();
  if (byId('dash-category-count')) byId('dash-category-count').textContent = categories.size.toLocaleString();
  const counts = getStockCounts();
  if (byId('dash-low-stock-count')) byId('dash-low-stock-count').textContent = (counts.low + counts.out).toLocaleString();
  if (byId('dash-low-stock-detail')) byId('dash-low-stock-detail').textContent = `${counts.out} out of stock`;
  // One greeting only, based on the time
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  if (byId('home-greeting')) byId('home-greeting').textContent = greeting;
  if (byId('home-greeting-icon')) byId('home-greeting-icon').outerHTML = iconSvg(hour < 17 ? 'sun' : 'moon', 'w-4 h-4').replace('<svg', '<svg id="home-greeting-icon"');
  if (byId('home-date')) byId('home-date').textContent = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  if (byId('home-store-name')) byId('home-store-name').textContent = userProfile.store || 'MedStoreMgr';
  // Today's sales
  const today = now.toDateString();
  const todaySales = salesHistory.filter(s => new Date(s.date).toDateString() === today);
  const todayTotal = todaySales.reduce((sum, s) => sum + (Number(s.revenue) || 0), 0);
  if (byId('dash-today-sales')) byId('dash-today-sales').textContent = `Rs. ${Math.round(todayTotal).toLocaleString()}`;
  if (byId('dash-today-orders')) byId('dash-today-orders').textContent = `${todaySales.length} ${todaySales.length === 1 ? 'sale' : 'sales'}`;
}

// Low / out-of-stock counts and total stock value (stock x unit price)
function getStockCounts() {
  let low = 0, out = 0, value = 0, tracked = 0;
  medicines.forEach(m => {
    const status = getStockStatus(m);
    if (status !== 'unset') tracked++;
    if (status === 'low') low++;
    if (status === 'out') out++;
    value += getStockValue(m);
  });
  return { low, out, value, tracked };
}

function updateStatsScreen() {
  const totalMeds = medicines.length;
  const categories = new Set(medicines.map(m => m.category || 'Other')).size;

  const totalRevenue = salesHistory.reduce((acc, s) => acc + (s.revenue || 0), 0);
  const totalSalesCount = salesHistory.length;

  const todayStr = new Date().toDateString();
  const todaySales = salesHistory.filter(s => new Date(s.date).toDateString() === todayStr);
  const todayRevenue = todaySales.reduce((acc, s) => acc + (s.revenue || 0), 0);

  document.getElementById('stat-total-revenue').textContent = `Rs. ${totalRevenue.toFixed(2)}`;
  document.getElementById('stat-today-revenue').textContent = `Today: Rs. ${todayRevenue.toFixed(2)}`;
  document.getElementById('stat-total-sales-count').textContent = totalSalesCount;
  document.getElementById('stat-today-sales-count').textContent = `Today: ${todaySales.length} orders`;

  document.getElementById('stat-total-meds').textContent = totalMeds.toLocaleString();
  document.getElementById('stat-total-categories').textContent = `${categories} Types`;

  const counts = getStockCounts();
  document.getElementById('stat-stock-value').textContent = `Rs. ${counts.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('stat-stock-tracked').textContent = `${counts.tracked.toLocaleString()} items with stock set`;
  document.getElementById('stat-low-stock').textContent = counts.low.toLocaleString();
  document.getElementById('stat-out-stock').textContent = counts.out.toLocaleString();

  renderSalesHistory();

  // Form Distribution Breakdown
  const formCounts = {};
  medicines.forEach(m => {
    const form = m.formType || 'Tablet';
    formCounts[form] = (formCounts[form] || 0) + 1;
  });

  const breakdownContainer = document.getElementById('form-type-breakdown-list');
  if (breakdownContainer) {
    breakdownContainer.innerHTML = Object.keys(formCounts).map(form => {
      const count = formCounts[form];
      const percentage = ((count / (totalMeds || 1)) * 100).toFixed(1);
      return `
        <div>
          <div class="flex justify-between font-semibold text-slate-700 mb-1">
            <span>${form}</span>
            <span>${count} (${percentage}%)</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div class="bg-emerald-600 h-1.5 rounded-full" style="width: ${percentage}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}
