const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const ASSETS = vm.runInNewContext(`${read('sw.js')}\nASSETS`, {
  self: { addEventListener() {}, location: { origin: 'http://localhost' } },
  URL,
});

const PAGES = { '/': 'index.html', '/izle': 'izle.html' };

test('önbellek listesindeki her dosya projede var', () => {
  for (const asset of ASSETS) {
    assert.ok(fs.existsSync(path.join(root, PAGES[asset] || asset)), asset);
  }
  for (const page of Object.keys(PAGES)) assert.ok(ASSETS.includes(page), page);
});

for (const file of Object.values(PAGES)) {
  test(`${file} sayfasının yüklediği her dosya önbellek listesinde`, () => {
    const refs = [...read(file).matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => `/${m[1]}`);
    assert.ok(refs.length >= 5, refs.join(', '));
    for (const ref of refs) assert.ok(ASSETS.includes(ref), `${ref} sw.js listesinde yok`);
  });
}

test('yazı tipi dosyalarının hepsi önbellek listesinde', () => {
  const fonts = [...read('fonts/fonts.css').matchAll(/url\("([^"]+)"\)/g)].map((m) => `/fonts/${m[1]}`);
  assert.ok(fonts.length > 0);
  for (const font of fonts) assert.ok(ASSETS.includes(font), `${font} sw.js listesinde yok`);
});
