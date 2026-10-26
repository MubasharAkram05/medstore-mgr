// types.js
// Form (dosage form) and Type (medical use): fixed lists, case-insensitive
// matching, custom types, and guessing a Type from the medicine name.
// Storage fields are unchanged: Form = med.formType, Type = med.category.

const FORMS = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Drops', 'Cream', 'Gel',
  'Ointment', 'Liquid', 'Sachet', 'Powder', 'Inhaler'];

const TYPES = ['Antibiotic', 'Fever', 'Painkiller', 'Stomach', 'Cough & Cold', 'Allergy', 'Vitamins',
  'Diabetes', 'Blood Pressure / Heart', 'Skin', 'Eye / Ear', 'First Aid', 'Other'];

const CUSTOM_TYPE_VALUE = '__custom__';

const textKey = v => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Old / other spellings of form names ("TAB", "Syrups", "IV", ...)
const FORM_ALIASES = {
  tab: 'Tablet', tabs: 'Tablet', tablets: 'Tablet', 'tablet / capsule': 'Tablet',
  cap: 'Capsule', caps: 'Capsule', capsules: 'Capsule',
  syrups: 'Syrup', suspensions: 'Suspension',
  iv: 'Injection', inj: 'Injection', injections: 'Injection', vial: 'Injection', vials: 'Injection', 'injection / vial': 'Injection',
  drop: 'Drops', 'eye drops': 'Drops', 'ear drops': 'Drops', 'eye/ear drops': 'Drops',
  creams: 'Cream', gels: 'Gel', ointments: 'Ointment', liquids: 'Liquid', sachets: 'Sachet', powders: 'Powder', inhalers: 'Inhaler'
};

// Old type names from the previous category list
const TYPE_ALIASES = {
  cardiovascular: 'Blood Pressure / Heart', heart: 'Blood Pressure / Heart', 'blood pressure': 'Blood Pressure / Heart',
  gastro: 'Stomach', general: 'Other', 'eye/ear': 'Eye / Ear', 'eye & ear': 'Eye / Ear',
  'cough and cold': 'Cough & Cold', 'cough & cold': 'Cough & Cold', vitamin: 'Vitamins', antibiotics: 'Antibiotic', painkillers: 'Painkiller'
};

// 'SYRUP', 'syrup', 'Syrups' -> 'Syrup'. Returns '' when it is not a form name.
function canonicalForm(value) {
  const key = textKey(value);
  if (!key) return '';
  return FORMS.find(f => f.toLowerCase() === key) || FORM_ALIASES[key] || '';
}

// Saved custom types (also kept when no medicine uses them any more)
function getCustomTypes() {
  return readJsonArray(STORAGE_KEYS.customTypes).filter(t => typeof t === 'string' && t.trim());
}

function rememberCustomType(type) {
  if (!type || TYPES.includes(type)) return;
  const list = getCustomTypes();
  if (list.some(t => textKey(t) === textKey(type))) return;
  list.push(type);
  try { localStorage.setItem(STORAGE_KEYS.customTypes, JSON.stringify(list)); } catch (e) {}
}

// 'painkiller', 'PAINKILLER' -> 'Painkiller'; a custom type keeps the spelling it was
// first saved with. Returns '' for empty input.
function canonicalType(value, customList) {
  const key = textKey(value);
  if (!key) return '';
  const fixed = TYPES.find(t => t.toLowerCase() === key) || TYPE_ALIASES[key];
  if (fixed) return fixed;
  const custom = (customList || getCustomTypes()).find(t => textKey(t) === key);
  return custom || String(value).trim().replace(/\s+/g, ' ');
}

// All types for dropdowns: fixed list + custom types (saved list and medicines), no duplicates
function getAllTypes() {
  const seen = new Set(TYPES.map(textKey));
  const customs = [];
  [...getCustomTypes(), ...medicines.map(m => m.category)].forEach(t => {
    const key = textKey(t);
    if (!key || seen.has(key)) return;
    seen.add(key);
    customs.push(String(t).trim());
  });
  customs.sort((a, b) => a.localeCompare(b));
  return { fixed: TYPES.slice(), customs };
}

// Forms for the filter: fixed list, plus any non-standard form a saved medicine still has
function getAllForms() {
  const extra = [];
  medicines.forEach(m => {
    const f = m.formType || 'Tablet';
    if (!FORMS.includes(f) && !extra.includes(f)) extra.push(f);
  });
  return [...FORMS, ...extra.sort((a, b) => a.localeCompare(b))];
}

// ---------- Guessing the Type from the medicine / generic name ----------
// Each word is matched at the start of a word ("fenac" matches "A-Fenac").
const TYPE_RULES = [
  ['Fever', ['paracetamol', 'panadol', 'calpol', 'vamol', 'pracmol', 'acetaminophen']],
  ['Painkiller', ['diclofenac', 'ibuprofen', 'mefenamic', 'fenac', 'brufen', 'brugesic', 'ponstan', 'naproxen', 'synflex',
    'ketoprofen', 'ketorolac', 'aceclofenac', 'etoricoxib', 'celecoxib', 'meloxicam', 'piroxicam', 'indomethacin', 'aspirin',
    'disprin', 'tramadol', 'tramal', 'tapentadol', 'nimesulide', 'etodolac', 'lornoxicam', 'dexketoprofen', 'nuberol',
    'advil', 'voltral', 'voltaren', 'dicloran', 'vee-bufen', 'methyl salicylate', 'orphenadrine', 'thiocolchicoside',
    'tolperisone', 'baclofen', 'tizanidine', 'cyclobenzaprine', 'methocarbamol', 'colchicine', 'allopurinol', 'febuxostat',
    'sumatriptan', 'rizatriptan', 'lidocaine', 'benzocaine', 'pregabalin', 'gabapentin']],
  ['Antibiotic', ['amoxicillin', 'amoxil', 'augmentin', 'co-amoxiclav', 'amoxi-clav', 'calamox', 'amclav', 'azithromycin',
    'cefixime', 'cefuroxime', 'cefpodoxime', 'cefdinir', 'cefaclor', 'cephalexin', 'cephradine', 'cefradine', 'cefadroxil',
    'cefprozil', 'ceftriaxone', 'cefotaxime', 'ceftazidime', 'cefepime', 'cefspan', 'cefiget', 'ciprofloxacin', 'ciproxin',
    'cipesta', 'levofloxacin', 'moxifloxacin', 'ofloxacin', 'norfloxacin', 'nalidixic', 'clarithromycin', 'klaricid',
    'erythromycin', 'roxithromycin', 'clindamycin', 'lincomycin', 'doxycycline', 'minocycline', 'tetracycline',
    'flucloxacillin', 'cloxacillin', 'dicloxacillin', 'penicillin', 'benzylpenicillin', 'ampicillin', 'co-trimoxazole',
    'bactrim', 'trimethoprim', 'nitrofurantoin', 'fosfomycin', 'rifampicin', 'isoniazid', 'pyrazinamide', 'ethambutol',
    'linezolid', 'vancomycin', 'teicoplanin', 'meropenem', 'imipenem', 'ertapenem', 'piperacillin', 'gentamicin', 'amikacin',
    'tobramycin', 'netilmicin', 'streptomycin', 'colistin', 'zinnat', 'velosef', 'keflex', 'tinidazole', 'secnidazole']],
  ['Stomach', ['omeprazole', 'esomeprazole', 'pantoprazole', 'rabeprazole', 'lansoprazole', 'dexlansoprazole', 'famotidine',
    'cimetidine', 'nizatidine', 'sucralfate', 'domperidone', 'metoclopramide', 'itopride', 'levosulpiride', 'mosapride',
    'ondansetron', 'granisetron', 'prochlorperazine', 'meclizine', 'dimenhydrinate', 'loperamide', 'bisacodyl', 'senna',
    'mesalamine', 'sulfasalazine', 'dicyclomine', 'hyoscine', 'buscopan', 'mebeverine', 'pinaverium', 'trimebutine',
    'ursodeoxycholic', 'gaviscon', 'eno', 'antacid', 'risek', 'losec', 'nexum', 'motilium', 'imodium', 'lactulose',
    'picosulfate', 'sodium picosulfate', 'magnesium hydroxide', 'aluminium hydroxide', 'simethicone', 'macrogol',
    'polyethylene glycol', 'psyllium', 'ispaghula', 'racecadotril', 'pancreatin', 'metronidazole', 'flagyl', 'ors',
    'oral rehydration', 'probiotic', 'sodium alginate', 'glycerin']],
  ['Cough & Cold', ['ambroxol', 'bromhexine', 'guaifenesin', 'dextromethorphan', 'acetylcysteine', 'n-acetylcysteine',
    'carbocisteine', 'expectorant', 'cough']],
  ['Allergy', ['cetirizine', 'levocetirizine', 'loratadine', 'desloratadine', 'fexofenadine', 'chlorpheniramine',
    'diphenhydramine', 'promethazine', 'hydroxyzine', 'cyproheptadine', 'ketotifen', 'rupatadine', 'bilastine', 'ebastine',
    'rigix', 'zyrtec', 'avil', 'pheniramine', 'clarityne', 'aerius', 'montelukast', 'montika', 'montiget', 'zafirlukast']],
  ['Diabetes', ['metformin', 'glucophage', 'glimepiride', 'getryl', 'gliclazide', 'glibenclamide', 'daonil', 'glipizide',
    'sitagliptin', 'vildagliptin', 'linagliptin', 'saxagliptin', 'alogliptin', 'empagliflozin', 'dapagliflozin',
    'canagliflozin', 'pioglitazone', 'acarbose', 'repaglinide', 'nateglinide', 'insulin']],
  ['Blood Pressure / Heart', ['amlodipine', 'norvasc', 'nifedipine', 'felodipine', 'lercanidipine', 'diltiazem', 'verapamil',
    'bisoprolol', 'concor', 'metoprolol', 'atenolol', 'carvedilol', 'nebivolol', 'propranolol', 'sotalol', 'enalapril',
    'lisinopril', 'ramipril', 'perindopril', 'captopril', 'losartan', 'cozaar', 'valsartan', 'telmisartan', 'irbesartan',
    'candesartan', 'olmesartan', 'hydrochlorothiazide', 'chlorthalidone', 'indapamide', 'furosemide', 'lasix', 'torsemide',
    'bumetanide', 'spironolactone', 'eplerenone', 'digoxin', 'amiodarone', 'flecainide', 'propafenone', 'ivabradine',
    'ranolazine', 'isosorbide', 'nitroglycerin', 'clopidogrel', 'ticagrelor', 'prasugrel', 'warfarin', 'rivaroxaban',
    'apixaban', 'dabigatran', 'atorvastatin', 'lipitor', 'rosuvastatin', 'simvastatin', 'pravastatin', 'fenofibrate',
    'gemfibrozil', 'ezetimibe', 'loprin', 'heparin']],
  ['Vitamins', ['vitamin', 'vitamins', 'multivitamin', 'multivitamins', 'neurobion', 'surbex', 'centrum', 'fefol', 'iberet',
    'caltrate', 'osteocare', 'evion', 'calcium', 'cholecalciferol', 'ergocalciferol', 'ferrous', 'iron', 'folic',
    'cyanocobalamin', 'methylcobalamin', 'pyridoxine', 'thiamine', 'riboflavin', 'niacinamide', 'biotin', 'ascorbic',
    'zinc sulfate', 'magnesium oxide', 'magnesium citrate', 'selenium', 'coenzyme', 'l carnitine', 'acetyl l carnitine',
    'alpha lipoic', 'b vitamins']],
  ['First Aid', ['dettol', 'antiseptic', 'chloroxylenol', 'povidone iodine', 'hydrogen peroxide', 'isopropyl alcohol',
    'ethanol', 'boric acid', 'chlorhexidine', 'bandage']],
  // Skin words only count for creams / gels / ointments / liquids (see guessType)
  ['Skin', ['fucidin', 'fusidic', 'mupirocin', 'polyfax', 'soframycin', 'betnovate', 'canesten', 'daktarin', 'clotrimazole',
    'miconazole', 'ketoconazole', 'terbinafine', 'betamethasone', 'clobetasol', 'mometasone', 'hydrocortisone', 'tretinoin',
    'adapalene', 'benzoyl', 'azelaic', 'urea', 'calamine', 'emollient', 'permethrin', 'silver sulfadiazine', 'tacrolimus',
    'pimecrolimus', 'zinc oxide', 'petrolatum', 'ichthammol', 'salicylic', 'aloe', 'acyclovir', 'neomycin', 'bacitracin',
    'nystatin']],
  ['Eye / Ear', ['eye', 'ear', 'ophthalmic', 'otic']]
];

const SKIN_FORMS = ['Cream', 'Gel', 'Ointment', 'Liquid'];

const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TYPE_MATCHERS = TYPE_RULES.map(([type, words]) => [
  type,
  new RegExp('(^|[^a-z0-9])(' + words.map(escapeRegex).join('|') + ')(?![a-z])', 'i')
]);

function matchTypeIn(text, form) {
  if (!text) return '';
  for (const [type, re] of TYPE_MATCHERS) {
    if (type === 'Skin' && !SKIN_FORMS.includes(form)) continue;
    if (re.test(text)) return type;
  }
  return '';
}

// Medicine name first (brand decides: "Brufen Plus" -> Painkiller), then the generic name.
function guessType(med) {
  const form = canonicalForm(med.formType) || med.formType || 'Tablet';
  const found = matchTypeIn(med.name, form) || matchTypeIn(med.genericName || med.generic, form);
  if (found) return found;
  if (['Cream', 'Gel', 'Ointment'].includes(form)) return 'Skin';
  if (form === 'Drops') return 'Eye / Ear';
  return 'Other';
}

// Fixes one record: Form from the old category when needed, Type from the
// name when the category held a form name. Safe to run more than once.
// Returns true when the record changed.
function migrateFormAndType(med, customList) {
  const before = med.formType + '|' + med.category;
  const formFromField = canonicalForm(med.formType);
  const formFromCategory = canonicalForm(med.category);

  if (formFromField) med.formType = formFromField;
  else if (!med.formType && formFromCategory) med.formType = formFromCategory;
  else if (!med.formType) med.formType = 'Tablet';

  if (formFromCategory || !textKey(med.category)) {
    // Category held a form name (Tablets, SYRUP, IV...) or was empty
    if (med.category && med.oldCategory === undefined) med.oldCategory = med.category;
    med.category = guessType(med);
  } else {
    med.category = canonicalType(med.category, customList);
    if (!TYPES.includes(med.category) && !customList.some(t => textKey(t) === textKey(med.category))) {
      customList.push(med.category);
    }
  }
  return before !== med.formType + '|' + med.category;
}
