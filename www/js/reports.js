// reports.js
// Totals and summaries: home dashboard counts and the Stats screen.

function renderHomeDashboard() {
  const count = medicines.length;
  const categories = new Set(medicines.map(m => m.category || 'Other'));
  const stock = medicines.reduce((sum, m) => sum + (Number(m.stock) || 0), 0);
  const stockValue = medicines.reduce((sum, m) => {
    const qty = Number(m.stock) || 0;
    const price = Number(m.pataPrice) || 0;
    return sum + (qty * price);
  }, 0);
  const byId = (id) => document.getElementById(id);
  if (byId('dash-medicine-count')) byId('dash-medicine-count').textContent = count.toLocaleString();
  if (byId('dash-category-count')) byId('dash-category-count').textContent = categories.size.toLocaleString();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  if (byId('home-greeting')) byId('home-greeting').textContent = greeting;
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
  document.getElementById('stat-total-categories').textContent = `${categories} Categories`;

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
