// storage.js
// Global app state and every localStorage read/write.
// NOTE: key names still start with 'mediprice_' on purpose so old data keeps working.

// Global State
let medicines = [];
let salesHistory = [];
let purchases = [];
// Home list filters (saved under STORAGE_KEYS.listFilters)
let listFilters = { category: 'ALL', form: 'ALL', stock: 'ALL' };
let currentImageData = '';
let activeTab = 'home';
let isBulkSelectMode = false;
let selectedMedIds = new Set();
let currentSellMed = null;
let currentRestockMed = null;
let tabBeforeAdd = 'home';
let userProfile = {
  name: 'Pharmacy Admin',
  store: 'MedStoreMgr',
  location: 'Lahore, Pakistan',
  phone: '+92 300 1234567',
  avatar: ''
};

// Medicine currently open in the details modal
let currentDetailsMedicineId = null;

const STORAGE_KEYS = {
  medicines: 'mediprice_pkr_db',
  sales: 'mediprice_sales_db',
  profile: 'mediprice_user_profile',
  activeTab: 'mediprice_active_tab',
  // New in v1.1
  purchases: 'medstore_purchases_db',
  listFilters: 'medstore_list_filters'
};

function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.medicines, JSON.stringify(medicines));
    localStorage.setItem(STORAGE_KEYS.sales, JSON.stringify(salesHistory));
    localStorage.setItem(STORAGE_KEYS.purchases, JSON.stringify(purchases));
  } catch (e) {
    // Usually QuotaExceededError (too many large photos). Data stays in memory
    // for this session, so tell the user to back up and free space.
    showToast('Storage full! Export a backup and remove some photos.');
  }
  updateStatsScreen();
  populateCalcDropdown();
  calculateStorageUsage();
}

function loadLocalStorage() {
  const storedMeds = localStorage.getItem(STORAGE_KEYS.medicines);
  let shouldRegenerate = false;

  if (storedMeds) {
    try {
      const parsed = JSON.parse(storedMeds);
      if (Array.isArray(parsed) && parsed.length > 0) {
        medicines = parsed;
      } else {
        shouldRegenerate = true;
      }
    } catch (e) {
      shouldRegenerate = true;
    }
  } else {
    shouldRegenerate = true;
  }

  if (shouldRegenerate) {
    medicines = generatePakistaniMedsWithSeeds();
  } else {
    // Upgrade existing installs without deleting the user's saved stock/sales.
    const existingSeedIds = new Set(medicines.map(m => m.id));
    const upgradeSeed = generatePakistaniMedsWithSeeds().filter(m => m.id.startsWith('pkr_item_'));
    // Append the expanded seed records; existing records remain untouched.
    const newSeedRecords = upgradeSeed.slice(89);
    newSeedRecords.forEach((m, i) => {
      const newId = "extra_pk_" + String(i + 1).padStart(4, "0");
      if (!existingSeedIds.has(newId)) medicines.push({...m, id: newId});
    });
  }

  normalizeMedicines(medicines);

  // Load sales BEFORE deduplication: removeDuplicateMedicines() saves to
  // localStorage, and saving an empty salesHistory used to wipe the sales.
  const storedSales = localStorage.getItem(STORAGE_KEYS.sales);
  if (storedSales) {
    try {
      salesHistory = JSON.parse(storedSales);
    } catch (e) {
      salesHistory = [];
    }
  } else {
    salesHistory = [];
  }
  if (!Array.isArray(salesHistory)) salesHistory = [];

  purchases = readJsonArray(STORAGE_KEYS.purchases);

  // Remove exact duplicate names only. (A brand-level dedupe here used to delete
  // strength variants like "Augmentin 375mg" / "Augmentin 625mg" on every start.)
  removeExactDuplicateMedicines();

  saveToLocalStorage();
}

// Fills missing fields on old / imported records without removing anything.
function normalizeMedicines(list) {
  list.forEach(m => {
    if (m.category === 'Tablets') m.category = 'TAB';
    if (m.category === 'Syrups') m.category = 'SYRUP';
    if (m.formType === 'Injection' && !m.category) m.category = 'IV';

    const pataPrice = Number(m.pataPrice || 0);
    const stripsPerBox = Number(m.stripsPerBox || 0) || 10;
    const tabletsPerPata = Number(m.tabletsPerPata || 0) || 10;
    const totalTabsBox = Number(m.totalTabsBox || 0) || (stripsPerBox * tabletsPerPata);
    const boxPrice = Number(m.boxPrice || 0) || (pataPrice * stripsPerBox);

    m.stripsPerBox = stripsPerBox;
    m.tabletsPerPata = tabletsPerPata;
    m.totalTabsBox = totalTabsBox;
    m.boxPrice = parseFloat(boxPrice.toFixed(2));
    if (!Number(m.tabletPrice || 0) && totalTabsBox > 0 && boxPrice > 0) {
      m.tabletPrice = parseFloat((boxPrice / totalTabsBox).toFixed(2));
    }

    // v1.1 stock fields. stockUnits = stock in the smallest unit (tablet / unit),
    // null means "Stock not set". The old 'stock' field (never editable in the UI,
    // counted in patas by the old dashboard) is kept and converted once.
    if (m.stockUnits === undefined) {
      const old = Number(m.stock);
      const hasOld = m.stock !== null && m.stock !== undefined && m.stock !== '' && Number.isFinite(old) && old >= 0;
      m.stockUnits = hasOld ? Math.round(old * (Number(m.tabletsPerPata) || 1)) : null;
    }
    if (m.minStockUnits === undefined) m.minStockUnits = null;
    if (m.place === undefined) m.place = '';
  });
}

function calculateStorageUsage() {
  let totalBytes = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      totalBytes += (localStorage[key].length + key.length) * 2;
    }
  }
  const kb = (totalBytes / 1024).toFixed(1);
  const storageElem = document.getElementById('storage-used-text');
  if (storageElem) storageElem.textContent = `${kb} KB`;
}

// Profile
function readStoredUserProfile() {
  const storedProfile = localStorage.getItem(STORAGE_KEYS.profile);
  if (!storedProfile) return null;
  try {
    return JSON.parse(storedProfile);
  } catch (e) {
    return null;
  }
}

function writeUserProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
}

// Last opened tab
function saveActiveTab(tab) {
  try { localStorage.setItem(STORAGE_KEYS.activeTab, tab); } catch (e) {}
}

function readActiveTab() {
  try { return localStorage.getItem(STORAGE_KEYS.activeTab); } catch (e) { return null; }
}

// Wipes every key this origin has saved (used by "Clear All Data")
function clearAllStorage() {
  localStorage.clear();
}

function readJsonArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// Home list filters
function readListFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.listFilters) || 'null');
    if (saved && typeof saved === 'object') return { category: 'ALL', form: 'ALL', stock: 'ALL', ...saved };
  } catch (e) {}
  return { category: 'ALL', form: 'ALL', stock: 'ALL' };
}

function writeListFilters(filters) {
  try { localStorage.setItem(STORAGE_KEYS.listFilters, JSON.stringify(filters)); } catch (e) {}
}
