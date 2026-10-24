// Tailwind is compiled ahead of time into www/css/tailwind.css (no CDN in the APK).
// Run `npm run build:css` after adding new Tailwind classes to HTML or JS.
module.exports = {
  content: ['./www/index.html', './www/js/*.js'],
  theme: { extend: {} },
  plugins: []
};
