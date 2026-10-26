// storage.js
// Global app state and every localStorage read/write.
// NOTE: key names still start with 'mediprice_' on purpose so old data keeps working.

// Global State
let medicines = [];
let salesHistory = [];
let purchases = [];
// Home list filters (saved under STORAGE_KEYS.listFilters)
let listFilters = { category: 'ALL', form: 'ALL', stock: 'ALL' };
// Home list layout: 'list' (1 per row) or 'grid' (2 columns)
let listView = 'list';
let currentImageData = '';
let activeTab = 'home';
let currentSellMed = null;
let currentRestockMed = null;
// Medicine picked in the Calculator (null = empty calculator)
let calcSelectedId = null;
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
  listFilters: 'medstore_list_filters',
  // New in v1.2
  customTypes: 'medstore_custom_types',
  formTypeMigrated: 'medstore_migrated_form_type_v1',
  preFormTypeBackup: 'medstore_backup_before_form_type',
  // New in v1.3
  listView: 'medstore_list_view',
  // New in v1.4
  singleItemsMigrated: 'medstore_migrated_single_items_v1',
  preSingleItemsBackup: 'medstore_backup_before_single_items'
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
  migrateFormTypeOnce(shouldRegenerate);

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

  // v1.4: syrups, creams, injections... count whole items (needs sales + purchases loaded)
  migrateSingleItemsOnce(shouldRegenerate);

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

// ---------- v1.2: separate Form and Type ----------
// Old data stored a form name (TAB, SYRUP, IV, Cream...) as the category.
// Runs once: copies the raw saved medicines to a backup key, moves form names
// into Form, guesses Type from the name, then saves a flag. Later starts only
// fix letter case.
function migrateFormTypeOnce(isFreshInstall) {
  const customs = getCustomTypes();
  let done = false;
  try { done = !!localStorage.getItem(STORAGE_KEYS.formTypeMigrated); } catch (e) {}

  if (done) {
    medicines.forEach(m => canonicalizeFormAndType(m, customs));
    saveCustomTypes(customs);
    return;
  }

  if (!isFreshInstall) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.medicines);
      if (raw && !localStorage.getItem(STORAGE_KEYS.preFormTypeBackup)) {
        localStorage.setItem(STORAGE_KEYS.preFormTypeBackup, raw);
      }
    } catch (e) {
      // No room for the backup: leave the data as it is and try again next start
      showToast('Storage full: Form/Type update skipped. Export a backup and free space.');
      return;
    }
  }

  medicines.forEach(m => migrateFormAndType(m, customs));
  saveCustomTypes(customs);
  markFormTypeMigrated();
}

function markFormTypeMigrated() {
  try { localStorage.setItem(STORAGE_KEYS.formTypeMigrated, new Date().toISOString()); } catch (e) {}
}

// Same value in any letter case counts as one: "SYRUP" / "syrup" -> "Syrup"
function canonicalizeFormAndType(med, customs) {
  const form = canonicalForm(med.formType);
  if (form) med.formType = form;
  if (!med.formType) med.formType = 'Tablet';
  const type = canonicalType(med.category, customs);
  med.category = type || 'Other';
  if (!TYPES.includes(med.category) && !customs.some(t => textKey(t) === textKey(med.category))) customs.push(med.category);
}

function saveCustomTypes(list) {
  const clean = [];
  list.forEach(t => {
    if (t && !TYPES.includes(t) && !clean.some(c => textKey(c) === textKey(t))) clean.push(t);
  });
  try { localStorage.setItem(STORAGE_KEYS.customTypes, JSON.stringify(clean)); } catch (e) {}
}

// List / Grid choice. Default: list on phones, grid on wider screens.
function readListView() {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.listView);
    if (v === 'list' || v === 'grid') return v;
  } catch (e) {}
  return window.innerWidth >= 768 ? 'grid' : 'list';
}

function writeListView(view) {
  try { localStorage.setItem(STORAGE_KEYS.listView, view); } catch (e) {}
}

// ---------- v1.4: single-item forms count whole items ----------
// Before v1.4 every form used patas + loose "units" (1 syrup bottle = 10 units
// in the built-in list). Now Syrup, Cream, Injection... have one price per item
// (the old "Price / Bottle" = pataPrice, kept as it is) and stock is a plain item count.
// Runs once: backs up the raw saved data, converts, saves a flag.
function migrateSingleItemsOnce(isFreshInstall) {
  let done = false;
  try { done = !!localStorage.getItem(STORAGE_KEYS.singleItemsMigrated); } catch (e) {}
  if (done) return;

  if (!isFreshInstall) {
    try {
      if (!localStorage.getItem(STORAGE_KEYS.preSingleItemsBackup)) {
        localStorage.setItem(STORAGE_KEYS.preSingleItemsBackup, JSON.stringify({
          savedAt: new Date().toISOString(),
          medicines: localStorage.getItem(STORAGE_KEYS.medicines),
          sales: localStorage.getItem(STORAGE_KEYS.sales),
          purchases: localStorage.getItem(STORAGE_KEYS.purchases)
        }));
      }
    } catch (e) {
      // No room for the backup: change nothing, try again next start
      showToast('Storage full: item update skipped. Export a backup and free space.');
      return;
    }
  }

  convertSingleItemRecords(medicines, salesHistory, purchases);
  markSingleItemsMigrated();
}

function markSingleItemsMigrated() {
  try { localStorage.setItem(STORAGE_KEYS.singleItemsMigrated, new Date().toISOString()); } catch (e) {}
}

const round2 = n => Math.round(n * 100) / 100;

// Converts single-item medicines (and their sales / purchases) that still use
// the old unit count. Old values are kept in a "legacy" field on each record.
// Safe to run more than once (records are marked with singleItemUnits: true).
function convertSingleItemRecords(meds, sales, buys) {
  meds.forEach(med => {
    if (isPackForm(med.formType) || med.singleItemUnits) return;
    const per = Math.max(1, Number(med.tabletsPerPata) || 1);
    med.legacy = {
      tabletsPerPata: med.tabletsPerPata,
      tabletPrice: med.tabletPrice,
      stockUnits: med.stockUnits,
      minStockUnits: med.minStockUnits
    };
    // Per-item price: the old pack (bottle) price. Only if that was empty,
    // rebuild it from the old unit price.
    if (!(Number(med.pataPrice) > 0) && Number(med.tabletPrice) > 0) med.pataPrice = round2(Number(med.tabletPrice) * per);
    med.tabletPrice = Number(med.pataPrice) || 0;
    med.tabletsPerPata = 1;
    if (hasStock(med)) med.stockUnits = round2(Number(med.stockUnits) / per);
    if (med.minStockUnits !== null && med.minStockUnits !== undefined) med.minStockUnits = round2(Number(med.minStockUnits) / per);
    med.singleItemUnits = true;

    if (per === 1) return;
    (sales || []).forEach(sale => {
      if (sale.medId !== med.id || sale.singleItemUnits) return;
      sale.legacy = { packs: sale.packs, units: sale.units, stockUnits: sale.stockUnits };
      sale.packs = round2((Number(sale.packs) || 0) + (Number(sale.units) || 0) / per);
      sale.units = 0;
      if (sale.stockUnits) sale.stockUnits = round2(Number(sale.stockUnits) / per);
      sale.singleItemUnits = true;
    });
    (buys || []).forEach(buy => {
      if (buy.medId !== med.id || buy.singleItemUnits) return;
      buy.legacy = { units: buy.units };
      buy.units = round2((Number(buy.units) || 0) / per);
      buy.singleItemUnits = true;
    });
  });
}
