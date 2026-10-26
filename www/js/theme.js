// theme.js
// Light / Dark / Auto theme. Loaded in <head> so the right colors show
// before the page paints. Setting saved in localStorage 'medstore_theme'.

const THEME_KEY = 'medstore_theme';
const themeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function getThemeSetting() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch (e) {
    return 'auto';
  }
}

function applyTheme() {
  const setting = getThemeSetting();
  const dark = setting === 'dark' || (setting === 'auto' && !!themeQuery && themeQuery.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0b1715' : '#047857');
  // Profile screen buttons (if already on the page)
  document.querySelectorAll('[data-theme-option]').forEach(btn => {
    const active = btn.dataset.themeOption === setting;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function setThemeSetting(value) {
  try {
    if (value === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, value);
  } catch (e) {}
  applyTheme();
}

applyTheme();
// "Auto" follows the phone when the system theme changes
if (themeQuery) {
  const onChange = () => { if (getThemeSetting() === 'auto') applyTheme(); };
  if (themeQuery.addEventListener) themeQuery.addEventListener('change', onChange);
  else if (themeQuery.addListener) themeQuery.addListener(onChange);
}
