// medicines.js
// Add / edit / delete medicines, box & pata pricing, places, Form/Type fields, dedupe, seed data.

// Helper: Clean product names and remove version suffixes like V2, V3, #1, etc.
function cleanMedicineName(name) {
  if (!name) return '';
  return name
    .replace(/\s*#\d+/gi, '')
    .replace(/\s+V\d+\b/gi, '')
    .replace(/\s+v\d+\b/gi, '')
    .trim();
}

// Helper: Deep brand-level deduplication key extraction.
// Removes dosage strengths (e.g., 1g, 500mg, 250 mg) and pack/unit counts (e.g., 100 tab, 10 tab, 20 caps)
function getBrandKey(name) {
  if (!name) return '';
  let cleaned = name.toLowerCase();

  // Remove parenthetical details
  cleaned = cleaned.replace(/\([^)]*\)/g, ' ');

  // Remove strengths and unit measurements (e.g. 1g, 500mg, 10mg/ml, 5ml, 100ml)
  cleaned = cleaned.replace(/\b\d+(\.\d+)?\s*(g|mg|mcg|ml|iu|%|l)\b/gi, ' ');

  // Remove quantity counts and unit descriptors (e.g. 100 tab, 10 tabs, 20 caps, 5 vials)
  cleaned = cleaned.replace(/\b\d+\s*(tablets?|tabs?|capsules?|caps?|vials?|ampoules?|sachets?|bottles?|packs?)\b/gi, ' ');

  // Remove isolated numbers left behind
  cleaned = cleaned.replace(/\b\d+\b/g, ' ');

  // Strip symbols and special punctuation
  cleaned = cleaned.replace(/[\(\)\-\,\.\/\+\#]/g, ' ');

  // Normalize spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

function getMedicinePlaces() {
  const places = [];
  ['R', 'L'].forEach(prefix => {
    for (let row = 1; row <= 3; row++) {
      for (let slot = 1; slot <= 7; slot++) places.push(`${prefix}${row}.${slot}`);
    }
  });
  for (let slot = 1; slot <= 7; slot++) places.push(`B1.${slot}`);
  return places;
}

// Fills the Place dropdown in the Add/Edit form (#med-place). Called on startup
// too: before, the options were only added after a reset, so the first Add had none.
// A place saved earlier that is not in the standard list is kept as an extra option.
function populateEditMedicinePlaces(selectedPlace = '') {
  const select = document.getElementById('med-place');
  if (!select) return;
  const places = getMedicinePlaces();
  if (selectedPlace && !places.includes(selectedPlace)) places.push(selectedPlace);
  select.innerHTML = '<option value="">Select Place</option>' + places.map(place => `<option value="${escapeHtml(place)}">${escapeHtml(place)}</option>`).join('');
  select.value = selectedPlace || '';
}

function autoCalcUnitPrice() {
  const pataPrice = parseFloat(document.getElementById('med-pata-price').value) || 0;
  const tabletsPerPata = parseInt(document.getElementById('med-tablets-per-pata').value) || 1;
  if (pataPrice > 0 && tabletsPerPata > 0) {
    document.getElementById('med-tablet-price').value = (pataPrice / tabletsPerPata).toFixed(2);
  }
}

function autoCalcBoxPricing() {
  const boxPrice = parseFloat(document.getElementById('med-box-price').value) || 0;
  let stripsPerBox = parseInt(document.getElementById('med-strips-per-box').value) || 0;
  const unitsPerStrip = parseInt(document.getElementById('med-tablets-per-pata').value) || 0;
  let totalTabsBox = parseInt(document.getElementById('med-total-tabs-box').value) || 0;

  // If total tablets + strips are provided, derive tablets per strip.
  if (totalTabsBox > 0 && stripsPerBox > 0 && totalTabsBox % stripsPerBox === 0) {
    const derivedUnits = totalTabsBox / stripsPerBox;
    document.getElementById('med-tablets-per-pata').value = derivedUnits;
  }

  const finalUnitsPerStrip = parseInt(document.getElementById('med-tablets-per-pata').value) || unitsPerStrip || 1;

  // Box price + total tablets is the most direct calculation.
  if (boxPrice > 0 && totalTabsBox > 0) {
    const tabletPrice = boxPrice / totalTabsBox;
    document.getElementById('med-tablet-price').value = tabletPrice.toFixed(2);
    if (stripsPerBox > 0) {
      document.getElementById('med-pata-price').value = (boxPrice / stripsPerBox).toFixed(2);
    } else if (finalUnitsPerStrip > 0) {
      document.getElementById('med-pata-price').value = (tabletPrice * finalUnitsPerStrip).toFixed(2);
    }
    return;
  }

  if (boxPrice > 0 && stripsPerBox > 0) {
    const stripPrice = boxPrice / stripsPerBox;
    document.getElementById('med-pata-price').value = stripPrice.toFixed(2);
    if (finalUnitsPerStrip > 0) {
      document.getElementById('med-tablet-price').value = (stripPrice / finalUnitsPerStrip).toFixed(2);
    }
  } else {
    autoCalcUnitPrice();
  }
}

// Pack sizes as currently typed in the Add/Edit form (used by the stock fields)
function getFormPackSizes() {
  return getPackSizes({
    tabletsPerPata: document.getElementById('med-tablets-per-pata').value,
    stripsPerBox: document.getElementById('med-strips-per-box').value,
    totalTabsBox: document.getElementById('med-total-tabs-box').value
  });
}

// Live "Total: ..." line under the stock fields
function updateStockPreview() {
  const formType = document.getElementById('med-form-type').value;
  const sizes = getFormPackSizes();
  const result = readQtyInputs('stock', sizes, formType);
  const preview = document.getElementById('stock-total-preview');
  const error = document.getElementById('stock-error');
  if (error) error.textContent = result.error || '';
  if (!preview) return;
  if (result.error) preview.textContent = '';
  else if (result.empty) preview.textContent = 'Leave empty if you don\'t count stock for this item.';
  else {
    const text = formatUnits(result.units, formType, sizes);
    const raw = `${result.units} ${getUnitNames(formType).loose[1]}`;
    preview.textContent = `Total: ${text}${text === raw ? '' : ` (${raw})`}`;
  }
}

// Add / Edit Form
function saveMedicine(e) {
  e.preventDefault();

  const id = document.getElementById('med-id').value;
  const name = cleanMedicineName(document.getElementById('med-name').value);
  const formType = document.getElementById('med-form-type').value;

  // Type: a fixed type, a saved custom type, or a new custom type typed by the user
  let category = document.getElementById('med-category-select').value;
  const typeError = document.getElementById('type-error');
  typeError.textContent = '';
  if (category === CUSTOM_TYPE_VALUE) {
    const typed = document.getElementById('med-category-custom').value;
    if (!typed.trim()) {
      typeError.textContent = 'Type a name for the new type, or pick one from the list.';
      document.getElementById('med-category-custom').focus();
      return;
    }
    category = canonicalType(typed);
    if (canonicalForm(category)) {
      typeError.textContent = `"${category}" is a form. Choose it under Form instead.`;
      return;
    }
  }
  category = canonicalType(category) || 'Other';

  const pataPrice = parseFloat(document.getElementById('med-pata-price').value) || 0;
  const tabletsPerPata = parseInt(document.getElementById('med-tablets-per-pata').value) || 1;
  const boxPriceRaw = document.getElementById('med-box-price').value;
  const boxPrice = boxPriceRaw === '' ? null : (parseFloat(boxPriceRaw) || 0);
  const stripsPerBoxRaw = document.getElementById('med-strips-per-box').value;
  const stripsPerBox = stripsPerBoxRaw === '' ? null : (parseInt(stripsPerBoxRaw) || 1);
  const totalTabsBoxRaw = document.getElementById('med-total-tabs-box').value;
  const totalTabsBox = totalTabsBoxRaw === '' ? null : (parseInt(totalTabsBoxRaw) || 0);
  const tabletPrice = parseFloat(document.getElementById('med-tablet-price').value) || 0;
  const notes = document.getElementById('med-notes').value.trim();
  const place = document.getElementById('med-place').value;

  // Stock + minimum stock, both stored in the smallest unit
  const sizes = getFormPackSizes();
  const stock = readQtyInputs('stock', sizes, formType);
  const minStock = readMinStockInput(sizes);
  const stockError = stock.error || minStock.error;
  document.getElementById('stock-error').textContent = stockError || '';
  if (stockError) {
    document.getElementById('stock-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const stockUnits = stock.empty ? null : stock.units;
  const minStockUnits = minStock.empty ? null : minStock.units;

  if (id) {
    const medIndex = medicines.findIndex(m => m.id === id);
    if (medIndex !== -1) {
      medicines[medIndex] = {
        ...medicines[medIndex],
        name, formType, category, pataPrice, tabletsPerPata, tabletPrice, boxPrice, stripsPerBox, totalTabsBox, notes, place,
        stockUnits, minStockUnits,
        image: currentImageData || medicines[medIndex].image
      };
    }
  } else {
    const newMed = {
      id: 'med_' + Date.now(),
      name, formType, category, pataPrice, tabletsPerPata, tabletPrice, boxPrice, stripsPerBox, totalTabsBox, notes, place,
      stockUnits, minStockUnits,
      image: currentImageData,
      createdAt: new Date().toISOString()
    };
    medicines.unshift(newMed);
  }

  rememberCustomType(category);
  saveToLocalStorage();
  renderListFilters();
  resetForm();
  // Go back to the screen the user came from (before, it stayed on the Add screen)
  switchTab(tabBeforeAdd || 'home');
  renderMedicineList();
  showToast(id ? 'Medicine updated!' : 'Medicine saved!');
}

function editMedicine(id) {
  const med = medicines.find(m => m.id === id);
  if (!med) return;

  // Start clean so nothing (photo, custom category, labels) leaks from the last form
  resetForm();

  document.getElementById('med-id').value = med.id;
  document.getElementById('med-name').value = cleanMedicineName(med.name);
  document.getElementById('med-form-type').value = med.formType || 'Tablet';
  document.getElementById('med-pata-price').value = med.pataPrice ?? '';
  document.getElementById('med-tablets-per-pata').value = med.tabletsPerPata || 10;
  document.getElementById('med-box-price').value = med.boxPrice ?? '';
  document.getElementById('med-strips-per-box').value = med.stripsPerBox ?? '';
  document.getElementById('med-total-tabs-box').value = med.totalTabsBox ?? '';
  document.getElementById('med-tablet-price').value = med.tabletPrice ?? '';
  document.getElementById('med-notes').value = med.notes || '';
  populateEditMedicinePlaces(med.place || '');

  document.getElementById('med-form-type').value = canonicalForm(med.formType) || 'Tablet';
  populateTypeSelect(med.category || 'Other');

  if (med.image) {
    currentImageData = med.image;
    document.getElementById('image-preview').src = med.image;
    document.getElementById('image-preview').classList.remove('hidden');
    document.getElementById('remove-img-btn').classList.remove('hidden');
    document.getElementById('image-placeholder-icon').classList.add('hidden');
  }

  // Stock: split the saved unit count back into box / pack / loose fields
  const sizes = getPackSizes(med);
  if (hasStock(med)) fillQtyInputs('stock', med.stockUnits, sizes);
  if (med.minStockUnits !== null && med.minStockUnits !== undefined) fillMinStockInput(med.minStockUnits, sizes);

  document.getElementById('form-title').textContent = 'Edit Medicine';
  updateFormTypeLabels();
  // Prices are NOT re-calculated here, so a manually changed tablet/pata
  // price is shown as it was saved.
  switchTab('add');
}

function deleteMedicine(id) {
  const med = medicines.find(m => m.id === id);
  if (!med) return;
  if (confirm(`Delete "${med.name}"? This can't be undone.`)) {
    medicines = medicines.filter(m => m.id !== id);
    saveToLocalStorage();
    renderListFilters();
    renderMedicineList();
    showToast('Medicine deleted.');
  }
}

function resetForm() {
  document.getElementById('medicine-form').reset();
  document.getElementById('med-id').value = '';
  document.getElementById('form-title').textContent = 'Add New Medicine';
  document.getElementById('stock-error').textContent = '';
  document.getElementById('type-error').textContent = '';
  populateTypeSelect('Other');
  populateEditMedicinePlaces('');
  removeImage();
  updateFormTypeLabels();
}

// Photos are shrunk before saving: a full camera photo (2-5 MB as text)
// quickly fills the ~5 MB localStorage limit and then nothing can be saved.
function readImageAsSmallDataUrl(file, maxSize, callback) {
  const reader = new FileReader();
  reader.onload = event => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => callback(event.target.result);
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (file) {
    readImageAsSmallDataUrl(file, 600, dataUrl => {
      currentImageData = dataUrl;
      document.getElementById('image-preview').src = currentImageData;
      document.getElementById('image-preview').classList.remove('hidden');
      document.getElementById('remove-img-btn').classList.remove('hidden');
      document.getElementById('image-placeholder-icon').classList.add('hidden');
    });
  }
}

function removeImage() {
  currentImageData = '';
  document.getElementById('image-preview').src = '';
  document.getElementById('image-preview').classList.add('hidden');
  document.getElementById('remove-img-btn').classList.add('hidden');
  document.getElementById('image-placeholder-icon').classList.remove('hidden');
  document.getElementById('img-input').value = '';
}

// Type dropdown in Add/Edit: fixed types, saved custom types, then "Custom..."
function populateTypeSelect(selected) {
  const select = document.getElementById('med-category-select');
  const { fixed, customs } = getAllTypes();
  const value = canonicalType(selected) || 'Other';
  if (!fixed.includes(value) && !customs.includes(value)) customs.push(value);
  select.innerHTML =
    fixed.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('') +
    (customs.length ? `<optgroup label="Your types">${customs.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}</optgroup>` : '') +
    `<option value="${CUSTOM_TYPE_VALUE}">+ Custom type...</option>`;
  select.value = value;
  document.getElementById('med-category-custom').value = '';
  toggleCustomCategory(select.value);
}

function toggleCustomCategory(val) {
  const box = document.getElementById('custom-cat-container');
  box.classList.toggle('hidden', val !== CUSTOM_TYPE_VALUE);
  document.getElementById('type-error').textContent = '';
  if (val === CUSTOM_TYPE_VALUE) setTimeout(() => document.getElementById('med-category-custom').focus(), 0);
}

const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

// Labels follow the form type: Pata/Tab for tablets, Bottle/Unit for syrups, Pack/Unit for the rest.
// (The old version looked for a missing #label-unit-count element and crashed.)
function updateFormTypeLabels() {
  const type = document.getElementById('med-form-type').value;
  const names = getUnitNames(type);
  const Pack = capitalize(names.pack[0]);
  const Loose = capitalize(names.loose[0]);
  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

  setText('label-pack-price', `Price / ${Pack} (Rs.) *`);
  setText('label-per-unit-title', `Price / ${Loose} (Rs.)`);
  setText('label-unit-count', `${capitalize(names.loose[1])} in 1 ${Pack}`);
  setText('label-total-packs', `Total ${capitalize(names.pack[1])} in Box`);
  setText('label-total-units', `Total ${capitalize(names.loose[1])} in Box`);
  setText('label-stock-packs', capitalize(names.pack[1]));
  setText('label-stock-loose', `Loose ${names.loose[1]}`);
  const minUnit = document.getElementById('min-stock-unit');
  if (minUnit) {
    minUnit.options[1].textContent = capitalize(names.pack[1]);
    minUnit.options[2].textContent = capitalize(names.loose[1]);
  }
  updateStockPreview();
}

// Startup / import cleanup: removes only records with the exact same name
// (ignoring case and spaces). Keeps the first one, which is the newest.
function removeExactDuplicateMedicines() {
  const seen = new Set();
  medicines = medicines.filter(med => {
    const key = String(med.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// "Remove Duplicates" button: brand-level dedupe (also removes strength variants)

function removeDuplicateMedicines(silent = false) {
  const brandMap = new Map();
  let removedCount = 0;

  medicines.forEach(med => {
    const bKey = getBrandKey(med.name);
    if (!bKey) return;

    if (!brandMap.has(bKey)) {
      brandMap.set(bKey, med);
    } else {
      removedCount++;
    }
  });

  medicines = Array.from(brandMap.values());
  saveToLocalStorage();
  renderListFilters();
  renderMedicineList();

  if (!silent) {
    showToast(`Removed ${removedCount} duplicates by brand name!`);
  }
}

function clearAllDataWithConfirm() {
  if (confirm('Clear all data and reset database to standard list?')) {
    clearAllStorage();
    markFormTypeMigrated();
    medicines = generatePakistaniMedsWithSeeds();
    normalizeMedicines(medicines);
    salesHistory = [];
    purchases = [];
    listFilters = { category: 'ALL', form: 'ALL', stock: 'ALL' };
    saveToLocalStorage();
    renderListFilters();
    renderMedicineList();
    showToast('Database reset!');
  }
}

// ============================================================
// Seed data: common Pakistani pharmacy products
// ============================================================

// Auto-Generator for Pakistani medical products list
function generatePakistaniMedsWithSeeds() {
  const commonProducts = [
    ["Panadol", "Paracetamol", "Tablet", "Haleon Pakistan"],
    ["Panadol Extra", "Paracetamol + Caffeine", "Tablet", "Haleon Pakistan"],
    ["Panadol CF", "Paracetamol + Phenylephrine + Chlorpheniramine", "Tablet", "Haleon Pakistan"],
    ["Panadol Children", "Paracetamol", "Suspension", "Haleon Pakistan"],
    ["Calpol", "Paracetamol", "Suspension", "Haleon Pakistan"],
    ["Brufen", "Ibuprofen", "Tablet", "Abbott Laboratories Pakistan"],
    ["Brufen DS", "Ibuprofen", "Suspension", "Abbott Laboratories Pakistan"],
    ["Brufen Plus", "Ibuprofen + Paracetamol", "Tablet", "Abbott Laboratories Pakistan"],
    ["Disprin", "Aspirin", "Tablet", "Reckitt Benckiser Pakistan"],
    ["Ponstan", "Mefenamic acid", "Tablet", "Pfizer Pakistan"],
    ["Voltral", "Diclofenac sodium", "Tablet", "Novartis Pakistan"],
    ["Synflex", "Naproxen", "Tablet", "Martin Dow"],
    ["Dicloran", "Diclofenac sodium", "Tablet", "Sami Pharmaceuticals"],
    ["Nuberol Forte", "Paracetamol + Orphenadrine", "Tablet", "Searle Pakistan"],
    ["Tramal", "Tramadol", "Capsule", "Searle Pakistan"],
    ["Tramal Plus", "Paracetamol + Tramadol", "Tablet", "Searle Pakistan"],
    ["Vamol", "Paracetamol", "Tablet", "Sami Pharmaceuticals"],
    ["Pracmol", "Paracetamol", "Tablet", "Sami Pharmaceuticals"],
    ["Augmentin", "Amoxicillin + Clavulanate", "Tablet", "GSK Pakistan"],
    ["Amoxi-Clav", "Amoxicillin + Clavulanate", "Suspension", "Novartis Pakistan"],
    ["Calamox", "Amoxicillin + Clavulanate", "Suspension", "Bosch Pharmaceuticals"],
    ["Amclav", "Amoxicillin + Clavulanate", "Tablet", "Getz Pharma"],
    ["Flagyl", "Metronidazole", "Tablet", "Sanofi Pakistan"],
    ["Cefspan", "Cefixime", "Capsule", "Hilton Pharma"],
    ["Cefiget", "Cefixime", "Tablet", "Getz Pharma"],
    ["Ciproxin", "Ciprofloxacin", "Tablet", "Bayer Pakistan"],
    ["Cipesta", "Ciprofloxacin", "Tablet", "Getz Pharma"],
    ["Brufen Cream", "Ibuprofen", "Cream", "Abbott Laboratories Pakistan"],
    ["Voltaren Emulgel", "Diclofenac", "Gel", "Novartis Pakistan"],
    ["Betnovate", "Betamethasone", "Cream", "GSK Pakistan"],
    ["Fucidin", "Fusidic acid", "Cream", "LEO Pharma"],
    ["Polyfax", "Polymyxin B + Bacitracin", "Ointment", "Searle Pakistan"],
    ["Soframycin", "Framycetin", "Cream", "Sanofi Pakistan"],
    ["Dettol Antiseptic", "Chloroxylenol", "Liquid", "Reckitt Benckiser Pakistan"],
    ["ORS", "Oral rehydration salts", "Sachet", "Multiple Pakistani suppliers"],
    ["Gaviscon", "Sodium alginate + Antacids", "Suspension", "Reckitt Benckiser Pakistan"],
    ["Eno", "Antacid salts", "Powder", "Haleon Pakistan"],
    ["Buscopan", "Hyoscine butylbromide", "Tablet", "Sanofi Pakistan"],
    ["Motilium", "Domperidone", "Tablet", "Janssen/Johnson & Johnson"],
    ["Imodium", "Loperamide", "Capsule", "Janssen/Johnson & Johnson"],
    ["Losec", "Omeprazole", "Capsule", "AstraZeneca Pakistan"],
    ["Risek", "Omeprazole", "Capsule", "Getz Pharma"],
    ["Nexum", "Esomeprazole", "Tablet", "Getz Pharma"],
    ["Loprin", "Aspirin", "Tablet", "Searle Pakistan"],
    ["Concor", "Bisoprolol", "Tablet", "Merck Pakistan"],
    ["Norvasc", "Amlodipine", "Tablet", "Pfizer Pakistan"],
    ["Cozaar", "Losartan", "Tablet", "Searle Pakistan"],
    ["Lasix", "Furosemide", "Tablet", "Sanofi Pakistan"],
    ["Lipitor", "Atorvastatin", "Tablet", "Pfizer Pakistan"],
    ["Glucophage", "Metformin", "Tablet", "Merck Pakistan"],
    ["Getryl", "Glimepiride", "Tablet", "Getz Pharma"],
    ["Daonil", "Glibenclamide", "Tablet", "Sanofi Pakistan"],
    ["Ventolin", "Salbutamol", "Inhaler", "GSK Pakistan"],
    ["Seretide", "Fluticasone + Salmeterol", "Inhaler", "GSK Pakistan"],
    ["Montika", "Montelukast", "Tablet", "Hilton Pharma"],
    ["Montiget", "Montelukast", "Tablet", "Getz Pharma"],
    ["Rigix", "Cetirizine", "Tablet", "AGP Pharma"],
    ["Zyrtec", "Cetirizine", "Tablet", "GSK Pakistan"],
    ["Avil", "Pheniramine", "Tablet", "Sanofi Pakistan"],
    ["Clarityne", "Loratadine", "Tablet", "Bayer Pakistan"],
    ["Aerius", "Desloratadine", "Tablet", "MSD/Organon Pakistan"],
    ["Brufen Syrup", "Ibuprofen", "Syrup", "Abbott Laboratories Pakistan"],
    ["Ventolin Syrup", "Salbutamol", "Syrup", "GSK Pakistan"],
    ["Klaricid", "Clarithromycin", "Tablet", "Abbott Laboratories Pakistan"],
    ["Augmentin Syrup", "Amoxicillin + Clavulanate", "Suspension", "GSK Pakistan"],
    ["Amoxil", "Amoxicillin", "Capsule", "GSK Pakistan"],
    ["Velosef", "Cephradine", "Capsule", "Searle Pakistan"],
    ["Keflex", "Cephalexin", "Capsule", "GSK Pakistan"],
    ["Bactrim", "Co-trimoxazole", "Tablet", "Searle Pakistan"],
    ["Zinnat", "Cefuroxime", "Tablet", "GSK Pakistan"],
    ["Flagyl Suspension", "Metronidazole", "Suspension", "Sanofi Pakistan"],
    ["Nystatin", "Nystatin", "Suspension", "Multiple Pakistani suppliers"],
    ["Canesten", "Clotrimazole", "Cream", "Bayer Pakistan"],
    ["Daktarin", "Miconazole", "Cream", "Janssen Pakistan"],
    ["Neurobion", "B Vitamins", "Tablet", "Merck Pakistan"],
    ["Surbex-Z", "Multivitamins + Zinc", "Tablet", "Abbott Laboratories Pakistan"],
    ["Centrum", "Multivitamins", "Tablet", "Haleon/Pfizer distribution"],
    ["Fefol", "Iron + Folic acid", "Capsule", "Abbott Laboratories Pakistan"],
    ["Iberet-Folic", "Iron + Vitamins", "Tablet", "Abbott Laboratories Pakistan"],
    ["Caltrate", "Calcium + Vitamin D", "Tablet", "Pfizer Pakistan"],
    ["Osteocare", "Calcium + Vitamin D + Minerals", "Tablet", "Vitabiotics"],
    ["Evion", "Vitamin E", "Capsule", "Merck Pakistan"],
    ["Vitamin D3", "Cholecalciferol", "Capsule", "Multiple Pakistani suppliers"],
    ["Advil", "Ibuprofen", "Tablet", "Pfizer distribution"],
    ["Disprin Extra", "Aspirin + Caffeine", "Tablet", "Reckitt Benckiser Pakistan"],
    ["A-Fenac", "Diclofenac sodium", "Tablet", "AGP Pharma"],
    ["A-Fenac Plus", "Diclofenac + Paracetamol", "Tablet", "AGP Pharma"],
    ["Brugesic", "Ibuprofen", "Suspension", "Hilton Pharma"],
    ["Vee-Bufen", "Ibuprofen", "Tablet", "Venus Pharma"]
  ];

  // Additional 500 common pharmacy medicines for Pakistani medical stores.
  // These are generic/common product seeds; verify current local MRP before relying on prices.
  const additional500 = ['Paracetamol', 'Ibuprofen', 'Diclofenac Sodium', 'Naproxen', 'Mefenamic Acid', 'Ketoprofen', 'Ketorolac', 'Aceclofenac', 'Etoricoxib', 'Celecoxib', 'Meloxicam', 'Piroxicam', 'Indomethacin', 'Aspirin', 'Tramadol', 'Tapentadol', 'Nimesulide', 'Etodolac', 'Lornoxicam', 'Dexketoprofen', 'Amoxicillin', 'Amoxicillin Clavulanate', 'Ampicillin', 'Flucloxacillin', 'Cloxacillin', 'Dicloxacillin', 'Penicillin V', 'Azithromycin', 'Clarithromycin', 'Erythromycin', 'Roxithromycin', 'Clindamycin', 'Lincomycin', 'Doxycycline', 'Minocycline', 'Tetracycline', 'Cefixime', 'Cefuroxime', 'Cefpodoxime', 'Cefdinir', 'Cefaclor', 'Cephalexin', 'Cephradine', 'Cefadroxil', 'Cefprozil', 'Ciprofloxacin', 'Levofloxacin', 'Moxifloxacin', 'Ofloxacin', 'Norfloxacin', 'Nalidixic Acid', 'Co-trimoxazole', 'Trimethoprim', 'Metronidazole', 'Tinidazole', 'Secnidazole', 'Nitrofurantoin', 'Fosfomycin', 'Rifampicin', 'Isoniazid', 'Pyrazinamide', 'Ethambutol', 'Linezolid', 'Vancomycin', 'Teicoplanin', 'Omeprazole', 'Esomeprazole', 'Pantoprazole', 'Rabeprazole', 'Lansoprazole', 'Dexlansoprazole', 'Famotidine', 'Cimetidine', 'Nizatidine', 'Sucralfate', 'Domperidone', 'Metoclopramide', 'Itopride', 'Levosulpiride', 'Mosapride', 'Ondansetron', 'Granisetron', 'Prochlorperazine', 'Meclizine', 'Dimenhydrinate', 'Loperamide', 'Bisacodyl', 'Senna', 'Mesalamine', 'Sulfasalazine', 'Dicyclomine', 'Hyoscine Butylbromide', 'Mebeverine', 'Pinaverium', 'Trimebutine', 'Ursodeoxycholic Acid', 'Orlistat', 'Amlodipine', 'Nifedipine', 'Felodipine', 'Lercanidipine', 'Diltiazem', 'Verapamil', 'Bisoprolol', 'Metoprolol', 'Atenolol', 'Carvedilol', 'Nebivolol', 'Propranolol', 'Sotalol', 'Enalapril', 'Lisinopril', 'Ramipril', 'Perindopril', 'Captopril', 'Losartan', 'Valsartan', 'Telmisartan', 'Irbesartan', 'Candesartan', 'Olmesartan', 'Hydrochlorothiazide', 'Chlorthalidone', 'Indapamide', 'Furosemide', 'Torsemide', 'Spironolactone', 'Eplerenone', 'Acetazolamide', 'Digoxin', 'Amiodarone', 'Flecainide', 'Propafenone', 'Ivabradine', 'Ranolazine', 'Isosorbide Mononitrate', 'Isosorbide Dinitrate', 'Clopidogrel', 'Ticagrelor', 'Prasugrel', 'Warfarin', 'Rivaroxaban', 'Apixaban', 'Dabigatran', 'Atorvastatin', 'Rosuvastatin', 'Simvastatin', 'Pravastatin', 'Fenofibrate', 'Gemfibrozil', 'Ezetimibe', 'Metformin', 'Glimepiride', 'Gliclazide', 'Glibenclamide', 'Glipizide', 'Sitagliptin', 'Vildagliptin', 'Linagliptin', 'Saxagliptin', 'Alogliptin', 'Empagliflozin', 'Dapagliflozin', 'Canagliflozin', 'Pioglitazone', 'Acarbose', 'Repaglinide', 'Nateglinide', 'Levothyroxine', 'Carbimazole', 'Methimazole', 'Propylthiouracil', 'Prednisolone', 'Dexamethasone', 'Methylprednisolone', 'Deflazacort', 'Hydrocortisone', 'Betamethasone', 'Montelukast', 'Zafirlukast', 'Theophylline', 'Aminophylline', 'Bambuterol', 'Terbutaline', 'Formoterol', 'Salmeterol', 'Fluticasone', 'Budesonide', 'Beclometasone', 'Mometasone', 'Tiotropium', 'Ipratropium', 'Glycopyrronium', 'Roflumilast', 'Acetylcysteine', 'Ambroxol', 'Bromhexine', 'Guaifenesin', 'Dextromethorphan', 'Cetirizine', 'Levocetirizine', 'Loratadine', 'Desloratadine', 'Fexofenadine', 'Chlorpheniramine', 'Diphenhydramine', 'Promethazine', 'Hydroxyzine', 'Cyproheptadine', 'Ketotifen', 'Rupatadine', 'Bilastine', 'Ebastine', 'Sertraline', 'Fluoxetine', 'Escitalopram', 'Citalopram', 'Paroxetine', 'Fluvoxamine', 'Venlafaxine', 'Duloxetine', 'Desvenlafaxine', 'Amitriptyline', 'Nortriptyline', 'Imipramine', 'Clomipramine', 'Mirtazapine', 'Bupropion', 'Trazodone', 'Buspirone', 'Zolpidem', 'Zopiclone', 'Sodium Valproate', 'Carbamazepine', 'Oxcarbazepine', 'Lamotrigine', 'Levetiracetam', 'Topiramate', 'Gabapentin', 'Pregabalin', 'Phenytoin', 'Phenobarbital', 'Clobazam', 'Lacosamide', 'Sumatriptan', 'Rizatriptan', 'Flunarizine', 'Betahistine', 'Cinnarizine', 'Baclofen', 'Tizanidine', 'Cyclobenzaprine', 'Methocarbamol', 'Orphenadrine', 'Thiocolchicoside', 'Tolperisone', 'Allopurinol', 'Febuxostat', 'Colchicine', 'Probenecid', 'Alendronate', 'Risedronate', 'Ibandronate', 'Raloxifene', 'Calcium Carbonate', 'Calcium Citrate', 'Cholecalciferol', 'Ergocalciferol', 'Ferrous Sulfate', 'Ferrous Fumarate', 'Ferrous Ascorbate', 'Folic Acid', 'Cyanocobalamin', 'Methylcobalamin', 'Pyridoxine', 'Thiamine', 'Riboflavin', 'Niacinamide', 'Biotin', 'Ascorbic Acid', 'Zinc Sulfate', 'Magnesium Oxide', 'Vitamin A', 'Vitamin E', 'Vitamin K1', 'Selenium', 'Albendazole', 'Mebendazole', 'Ivermectin', 'Praziquantel', 'Pyrantel Pamoate', 'Niclosamide', 'Acyclovir', 'Valacyclovir', 'Famciclovir', 'Oseltamivir', 'Fluconazole', 'Itraconazole', 'Ketoconazole', 'Terbinafine', 'Griseofulvin', 'Clotrimazole', 'Miconazole', 'Hydroxychloroquine', 'Chloroquine', 'Artemether', 'Lumefantrine', 'Atovaquone', 'Proguanil', 'Primaquine', 'Permethrin', 'Tamsulosin', 'Alfuzosin', 'Silodosin', 'Doxazosin', 'Terazosin', 'Finasteride', 'Dutasteride', 'Oxybutynin', 'Solifenacin', 'Tolterodine', 'Mirabegron', 'Sildenafil', 'Tadalafil', 'Vardenafil', 'Norethisterone', 'Medroxyprogesterone', 'Clomiphene', 'Tranexamic Acid', 'Desmopressin', 'Oxytocin', 'Potassium Citrate', 'Sodium Bicarbonate', 'Coenzyme Q10', 'L Carnitine', 'Alpha Lipoic Acid', 'Acetyl L Carnitine', 'Pancreatin', 'Racecadotril', 'Paracetamol Pediatric Suspension', 'Ibuprofen Pediatric Suspension', 'Amoxicillin Pediatric Suspension', 'Amoxicillin Clavulanate Suspension', 'Azithromycin Suspension', 'Cefixime Suspension', 'Cefuroxime Suspension', 'Cephalexin Suspension', 'Cephradine Suspension', 'Cefaclor Suspension', 'Clarithromycin Suspension', 'Erythromycin Suspension', 'Metronidazole Suspension', 'Tinidazole Suspension', 'Co-trimoxazole Suspension', 'Nystatin Oral Suspension', 'Fluconazole Oral Suspension', 'Albendazole Suspension', 'Mebendazole Suspension', 'Lactulose Syrup', 'Sodium Picosulfate Syrup', 'Domperidone Suspension', 'Metoclopramide Syrup', 'Ondansetron Syrup', 'Omeprazole Suspension', 'Magnesium Hydroxide Suspension', 'Aluminium Hydroxide Suspension', 'Gaviscon Suspension', 'Simethicone Suspension', 'Dicyclomine Syrup', 'Mebeverine Suspension', 'Loperamide Suspension', 'Cetirizine Syrup', 'Levocetirizine Syrup', 'Loratadine Syrup', 'Desloratadine Syrup', 'Fexofenadine Suspension', 'Chlorpheniramine Syrup', 'Diphenhydramine Syrup', 'Promethazine Syrup', 'Hydroxyzine Syrup', 'Cyproheptadine Syrup', 'Ketotifen Syrup', 'Montelukast Syrup', 'Salbutamol Syrup', 'Terbutaline Syrup', 'Theophylline Syrup', 'Aminophylline Syrup', 'Bromhexine Syrup', 'Ambroxol Syrup', 'Guaifenesin Syrup', 'Dextromethorphan Syrup', 'Acetylcysteine Syrup', 'Carbocisteine Syrup', 'Levosalbutamol Syrup', 'Expectorant Syrup', 'Iron Polymaltose Syrup', 'Ferrous Sulfate Syrup', 'Folic Acid Syrup', 'Multivitamin Syrup', 'Vitamin B Complex Syrup', 'Vitamin C Syrup', 'Calcium Syrup', 'Calcium Vitamin D Suspension', 'Zinc Sulfate Syrup', 'Magnesium Hydroxide Syrup', 'Potassium Citrate Syrup', 'ORS Oral Solution', 'Chloral Hydrate Syrup', 'Sodium Valproate Syrup', 'Carbamazepine Syrup', 'Levetiracetam Oral Solution', 'Lactulose Oral Solution', 'Ursodeoxycholic Acid Suspension', 'Mesalamine Suspension', 'Prednisolone Syrup', 'Dexamethasone Oral Solution', 'Methylprednisolone Oral Solution', 'Sodium Bicarbonate Oral Solution', 'Potassium Chloride Oral Solution', 'Oral Rehydration Solution', 'Povidone Iodine Gargle', 'Chlorhexidine Mouthwash', 'Benzydamine Mouthwash', 'Lidocaine Oral Solution', 'Paracetamol IV', 'Diclofenac Injection', 'Ketorolac Injection', 'Tramadol Injection', 'Metoclopramide Injection', 'Ondansetron Injection', 'Pantoprazole IV', 'Esomeprazole IV', 'Omeprazole IV', 'Famotidine Injection', 'Hyoscine Butylbromide Injection', 'Diclofenac IV', 'Ketoprofen Injection', 'Methylprednisolone Injection', 'Dexamethasone Injection', 'Hydrocortisone Injection', 'Prednisolone Injection', 'Betamethasone Injection', 'Ceftriaxone IV', 'Cefotaxime IV', 'Ceftazidime IV', 'Cefepime IV', 'Cefuroxime IV', 'Meropenem IV', 'Imipenem Cilastatin IV', 'Ertapenem IV', 'Piperacillin Tazobactam IV', 'Ampicillin IV', 'Amoxicillin Clavulanate IV', 'Flucloxacillin IV', 'Cloxacillin IV', 'Benzylpenicillin IV', 'Clindamycin IV', 'Metronidazole IV', 'Ciprofloxacin IV', 'Levofloxacin IV', 'Moxifloxacin IV', 'Acyclovir IV', 'Ganciclovir IV', 'Fluconazole IV', 'Amphotericin B IV', 'Vancomycin IV', 'Teicoplanin IV', 'Linezolid IV', 'Gentamicin IV', 'Amikacin IV', 'Tobramycin IV', 'Netilmicin IV', 'Streptomycin Injection', 'Colistin IV', 'Azithromycin IV', 'Clarithromycin IV', 'Doxycycline IV', 'Rifampicin IV', 'Isoniazid IV', 'Furosemide IV', 'Bumetanide IV', 'Mannitol IV', 'Aminophylline IV', 'Salbutamol IV', 'Magnesium Sulfate IV', 'Calcium Gluconate IV', 'Calcium Chloride IV', 'Potassium Chloride IV', 'Sodium Chloride IV', 'Sodium Bicarbonate IV', 'Dextrose 5 Percent IV', 'Dextrose 10 Percent IV', 'Dextrose 25 Percent IV', 'Dextrose 50 Percent IV', 'Ringer Lactate IV', 'Normal Saline IV', 'Half Normal Saline IV', 'Human Albumin IV', 'Hydroxyethyl Starch IV', 'Heparin IV'];

  commonProducts.push(...additional500.map((name, i) => {
    const isSyrup = i >= 339 && i < 424;
    const isIV = i >= 424;
    return [
      name,
      name,
      isIV ? "Injection" : isSyrup ? "Syrup" : "Tablet",
      "Common pharmacy / generic"
    ];
  }));

  // Expanded dosage-form seeds requested for the remaining pharmacy categories.
  // These are common/generic formulation names; verify local brands and current MRPs.
  const expandedFormSeeds = {
    Suspension: [
      'Paracetamol 120mg/5mL Suspension','Ibuprofen 100mg/5mL Suspension','Amoxicillin 125mg/5mL Suspension',
      'Amoxicillin 250mg/5mL Suspension','Co-amoxiclav 228.5mg/5mL Suspension','Co-amoxiclav 457mg/5mL Suspension',
      'Azithromycin 200mg/5mL Suspension','Cefixime 100mg/5mL Suspension','Cefixime 200mg/5mL Suspension',
      'Cefuroxime 125mg/5mL Suspension','Cefuroxime 250mg/5mL Suspension','Cephalexin 125mg/5mL Suspension',
      'Cephalexin 250mg/5mL Suspension','Clarithromycin 125mg/5mL Suspension','Clarithromycin 250mg/5mL Suspension',
      'Erythromycin 125mg/5mL Suspension','Metronidazole 125mg/5mL Suspension','Albendazole 200mg/5mL Suspension',
      'Mebendazole 100mg/5mL Suspension','Nystatin 100000IU/mL Suspension','Fluconazole 50mg/5mL Suspension',
      'Domperidone 5mg/5mL Suspension','Ondansetron 4mg/5mL Suspension','Cetirizine 5mg/5mL Suspension',
      'Levocetirizine 2.5mg/5mL Suspension','Fexofenadine 30mg/5mL Suspension','Montelukast 4mg/5mL Suspension',
      'Sodium Valproate 200mg/5mL Suspension','Carbamazepine 100mg/5mL Suspension','Levetiracetam 100mg/mL Suspension'
    ],
    Capsule: [
      'Amoxicillin 250mg Capsule','Amoxicillin 500mg Capsule','Flucloxacillin 250mg Capsule','Flucloxacillin 500mg Capsule',
      'Cloxacillin 250mg Capsule','Cloxacillin 500mg Capsule','Cephalexin 250mg Capsule','Cephalexin 500mg Capsule',
      'Cefradine 250mg Capsule','Cefradine 500mg Capsule','Cefixime 200mg Capsule','Cefixime 400mg Capsule',
      'Cefuroxime 250mg Capsule','Cefuroxime 500mg Capsule','Doxycycline 100mg Capsule','Minocycline 100mg Capsule',
      'Omeprazole 20mg Capsule','Esomeprazole 40mg Capsule','Pantoprazole 40mg Capsule','Rabeprazole 20mg Capsule',
      'Lansoprazole 30mg Capsule','Duloxetine 30mg Capsule','Duloxetine 60mg Capsule','Fluoxetine 20mg Capsule',
      'Sertraline 50mg Capsule','Pregabalin 75mg Capsule','Pregabalin 150mg Capsule','Gabapentin 300mg Capsule',
      'Itraconazole 100mg Capsule','Itraconazole 200mg Capsule'
    ],
    Cream: [
      'Clotrimazole 1% Cream','Miconazole 2% Cream','Ketoconazole 2% Cream','Terbinafine 1% Cream',
      'Hydrocortisone 1% Cream','Betamethasone 0.1% Cream','Mometasone 0.1% Cream','Clobetasol 0.05% Cream',
      'Fusidic Acid 2% Cream','Mupirocin 2% Cream','Acyclovir 5% Cream','Permethrin 5% Cream',
      'Povidone Iodine 5% Cream','Silver Sulfadiazine 1% Cream','Diclofenac 1% Cream','Ketoprofen 2.5% Cream',
      'Ketoconazole + Clobetasol Cream','Clotrimazole + Betamethasone Cream','Hydrocortisone + Clotrimazole Cream','Lidocaine 2% Cream',
      'Benzoyl Peroxide 2.5% Cream','Benzoyl Peroxide 5% Cream','Tretinoin 0.025% Cream','Tretinoin 0.05% Cream',
      'Adapalene 0.1% Cream','Azelaic Acid 20% Cream','Urea 10% Cream','Urea 20% Cream',
      'Calamine Cream','Emollient Moisturizing Cream'
    ],
    Gel: [
      'Diclofenac 1% Gel','Diclofenac 2% Gel','Ketoprofen 2.5% Gel','Ibuprofen 5% Gel',
      'Piroxicam 0.5% Gel','Ketorolac 2% Gel','Methyl Salicylate Gel','Heparinoid Gel',
      'Heparin Sodium Gel','Lidocaine 2% Gel','Benzocaine 20% Gel','Metronidazole 0.75% Gel',
      'Clindamycin 1% Gel','Adapalene 0.1% Gel','Adapalene 0.3% Gel','Benzoyl Peroxide 2.5% Gel',
      'Benzoyl Peroxide 5% Gel','Clindamycin + Adapalene Gel','Clindamycin + Benzoyl Peroxide Gel','Ketoconazole 2% Gel',
      'Miconazole 2% Gel','Acyclovir 5% Gel','Mupirocin 2% Gel','Povidone Iodine Gel',
      'Diclofenac + Methyl Salicylate Gel','Diclofenac + Menthol Gel','Etoricoxib Topical Gel','Aloe Vera Gel',
      'Oral Ulcer Choline Salicylate Gel','Chlorhexidine Oral Gel'
    ],
    Ointment: [
      'Mupirocin 2% Ointment','Fusidic Acid 2% Ointment','Clotrimazole 1% Ointment','Miconazole 2% Ointment',
      'Ketoconazole 2% Ointment','Terbinafine 1% Ointment','Acyclovir 5% Ointment','Hydrocortisone 1% Ointment',
      'Betamethasone 0.1% Ointment','Clobetasol 0.05% Ointment','Mometasone 0.1% Ointment','Tacrolimus 0.03% Ointment',
      'Tacrolimus 0.1% Ointment','Pimecrolimus 1% Ointment','Permethrin 5% Ointment','Zinc Oxide Ointment',
      'Calamine Ointment','Povidone Iodine Ointment','Silver Sulfadiazine 1% Ointment','Petrolatum Ointment',
      'Bacitracin Ointment','Neomycin Ointment','Neomycin + Bacitracin Ointment','Ichthammol Ointment',
      'Salicylic Acid 5% Ointment','Urea 10% Ointment','Urea 20% Ointment','Diclofenac 1% Ointment',
      'Nitroglycerin 0.2% Ointment','Nystatin Ointment'
    ],
    Liquid: [
      'Paracetamol Oral Liquid','Ibuprofen Oral Liquid','Lactulose Oral Liquid','Sodium Picosulfate Oral Liquid',
      'Magnesium Hydroxide Oral Liquid','Aluminium Hydroxide Oral Liquid','Simethicone Oral Liquid','Glycerin Oral Liquid',
      'Sodium Chloride Nasal Liquid','Povidone Iodine Liquid','Chlorhexidine Liquid','Hydrogen Peroxide 3% Liquid',
      'Isopropyl Alcohol 70% Liquid','Ethanol 70% Liquid','Calamine Liquid','Boric Acid Liquid',
      'Salbutamol Oral Liquid','Terbutaline Oral Liquid','Theophylline Oral Liquid','Aminophylline Oral Liquid',
      'Sodium Valproate Oral Liquid','Levetiracetam Oral Liquid','Potassium Citrate Oral Liquid','Sodium Bicarbonate Oral Liquid',
      'Potassium Chloride Oral Liquid','Iron Polymaltose Oral Liquid','Ferrous Sulfate Oral Liquid','Multivitamin Oral Liquid',
      'Vitamin B Complex Oral Liquid','Zinc Sulfate Oral Liquid'
    ],
    Sachet: [
      'Oral Rehydration Salts Sachet','Paracetamol Sachet','Ibuprofen Sachet','Diclofenac Sachet',
      'Nimesulide Sachet','Ketoprofen Sachet','Esomeprazole Sachet','Omeprazole Sachet',
      'Lansoprazole Sachet','Rabeprazole Sachet','Sucralfate Sachet','Macrogol Sachet',
      'Polyethylene Glycol Sachet','Psyllium Husk Sachet','Ispaghula Husk Sachet','Lactulose Powder Sachet',
      'Sodium Picosulfate Sachet','Potassium Citrate Sachet','Sodium Bicarbonate Sachet','Calcium Carbonate Sachet',
      'Calcium + Vitamin D Sachet','Magnesium Citrate Sachet','Magnesium Oxide Sachet','Zinc Sulfate Sachet',
      'Vitamin C Sachet','Vitamin B Complex Sachet','Multivitamin Sachet','Iron + Folic Acid Sachet',
      'N-Acetylcysteine Sachet','Probiotic Sachet'
    ],
    Powder: [
      'Amoxicillin Powder for Suspension','Amoxicillin + Clavulanate Powder for Suspension','Cefixime Powder for Suspension','Cefuroxime Powder for Suspension',
      'Cephalexin Powder for Suspension','Azithromycin Powder for Suspension','Clarithromycin Powder for Suspension','Erythromycin Powder for Suspension',
      'Metronidazole Powder for Suspension','Fluconazole Powder for Suspension','Nystatin Oral Powder','Cholestyramine Powder',
      'Psyllium Husk Powder','Ispaghula Husk Powder','Macrogol Powder','Polyethylene Glycol Powder',
      'Oral Rehydration Powder','Zinc Sulfate Powder','Calcium Carbonate Powder','Calcium + Vitamin D Powder',
      'Magnesium Oxide Powder','Potassium Citrate Powder','Sodium Bicarbonate Powder','Sodium Chloride Powder',
      'Iron Polymaltose Powder','Ferrous Sulfate Powder','Folic Acid Powder','Vitamin C Powder',
      'Vitamin B Complex Powder','Probiotic Powder'
    ],
    Inhaler: [
      'Salbutamol Inhaler','Levosalbutamol Inhaler','Ipratropium Inhaler','Tiotropium Inhaler',
      'Budesonide Inhaler','Beclometasone Inhaler','Fluticasone Inhaler','Mometasone Inhaler',
      'Salmeterol Inhaler','Formoterol Inhaler','Indacaterol Inhaler','Glycopyrronium Inhaler',
      'Umeclidinium Inhaler','Aclidinium Inhaler','Vilanterol Inhaler','Olodaterol Inhaler',
      'Budesonide + Formoterol Inhaler','Fluticasone + Salmeterol Inhaler','Fluticasone + Vilanterol Inhaler','Beclometasone + Formoterol Inhaler',
      'Budesonide + Glycopyrronium + Formoterol Inhaler','Tiotropium + Olodaterol Inhaler','Ipratropium + Salbutamol Inhaler','Ipratropium + Fenoterol Inhaler',
      'Salmeterol + Fluticasone Inhaler','Mometasone + Formoterol Inhaler','Ciclesonide Inhaler','Ciclesonide + Formoterol Inhaler',
      'Acetylcysteine Inhalation Solution','Sodium Chloride Nebulizer Solution'
    ]
  };

  Object.entries(expandedFormSeeds).forEach(([form, names]) => {
    names.forEach(name => {
      commonProducts.push([name, name.replace(/\s+(Sache(t)?|Powder for Suspension|Inhaler|Liquid|Gel|Cream|Ointment|Suspension|Capsule)$/i, ''), form, 'Common pharmacy / generic']);
    });
  });

  const generated = [];
  const seenBrands = new Set();

  for (let p = 0; p < commonProducts.length; p++) {
    const [brand, generic, form, manufacturer] = commonProducts[p];
    const brandKey = getBrandKey(brand);
    if (seenBrands.has(brandKey)) continue;
    seenBrands.add(brandKey);

    const packCount = 10;
    const price = parseFloat((30 + (p * 7.5) % 180).toFixed(2));

    generated.push({
      id: "pkr_item_" + String(generated.length + 1).padStart(4, "0"),
      name: brand,
      formType: form,
      category: guessType({ name: brand, genericName: generic, formType: form }),
      genericName: generic,
      manufacturer,
      pataPrice: price,
      tabletsPerPata: packCount,
      stripsPerBox: 10,
      totalTabsBox: 100,
      boxPrice: parseFloat((price * 10).toFixed(2)),
      tabletPrice: parseFloat((price / packCount).toFixed(2)),
      stock: null,
      notes: `Common Pakistani brand item. Manufacturer: ${manufacturer}.`,
      image: "",
      createdAt: new Date(Date.now() - (generated.length * 60000)).toISOString()
    });
  }

  return generated;
}
