// Builds a clean zip for the Chrome Web Store: only the files the extension needs.
// Usage: npm run package   ->  dist/chess-review-sounds-<version>.zip
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const include = ['manifest.json', 'content.js', 'popup.html', 'popup.js', 'popup.css', 'lib', 'icons', 'sounds'];

const zip = new AdmZip();
for (const entry of include) {
  const full = path.join(root, entry);
  if (fs.statSync(full).isDirectory()) zip.addLocalFolder(full, entry);
  else zip.addLocalFile(full);
}
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', `chess-review-sounds-${manifest.version}.zip`);
zip.writeZip(out);
console.log(`Wrote ${path.relative(root, out)} (${zip.getEntries().length} entries, ${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
