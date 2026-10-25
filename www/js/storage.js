// storage.js
// Global app state and every localStorage read/write.
// NOTE: key names still start with 'mediprice_' on purpose so old data keeps working.

// Global State
let medicines = [];
let salesHistory = [];
let selectedCategory = 'ALL';
let currentImageData = '';
let activeTab = 'home';
let isBulkSelectMode = false;
let selectedMedIds = new Set();
let currentSellMed = null;
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
  activeTab: 'mediprice_active_tab'
};

function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEYS.medicines, JSON.stringify(medicines));
  localStorage.setItem(STORAGE_KEYS.sales, JSON.stringify(salesHistory));
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

  // Normalize legacy category names so the new quick filters work.
  // Also ensure every medicine has complete box pricing + total tablets data.
  medicines.forEach(m => {
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
  });

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

  // Perform deduplication upon initial load
  removeDuplicateMedicines(true);

  saveToLocalStorage();
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
