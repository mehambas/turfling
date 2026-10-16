const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I18n = require('../js/i18n.js');

const ROOT = path.join(__dirname, '..');
const SOURCES = ['js', 'worker/src'].flatMap((dir) =>
  fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.js') && f !== 'i18n.js').map((f) => path.join(dir, f)),
).concat(['sw.js']);
const PAGES = ['index.html', 'izle.html'];

const unquote = (s) => s.replace(/\\(.)/g, '$1');
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function usedKeys() {
  const keys = new Map();
  const add = (key, file) => keys.set(key, keys.get(key) || file);
  for (const file of SOURCES) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of src.matchAll(/(?:\bt\(|\btranslate\([^,()]+,)\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)) add(unquote(m[1] ?? m[2]), file);
    for (const m of src.matchAll(/\btc\(\s*'([\w-]+)',\s*'((?:[^'\\]|\\.)*)'/g)) add(`${m[1]}|${unquote(m[2])}`, file);
  }
  for (const file of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of html.matchAll(/<[^>]*\bdata-i18n(?:="([^"]*)")?[^>]*>([^<]*)/g)) add((m[1] || m[2]).trim(), file);
    for (const m of html.matchAll(/<[^>]*\bdata-i18n-attr="([^"]+)"[^>]*>/g)) {
      for (const attr of m[1].split(',')) {
        const value = m[0].match(new RegExp(`\\s${attr.trim()}="([^"]*)"`));
        if (value) add(value[1], file);
      }
    }
  }
  keys.delete('');
  return keys;
}

test('browser language decides only on the portfolio address; a manual choice wins', () => {
  const nav = (...languages) => ({ languages, language: languages[0] });
  const portfolio = 'turfling.hamzabasaran.com';
  assert.equal(I18n.detect(nav('tr-TR', 'en'), null, portfolio), 'tr');
  assert.equal(I18n.detect(nav('de-DE', 'tr'), null, portfolio), 'en');
  assert.equal(I18n.detect(nav('en-US'), null, portfolio), 'en');
  assert.equal(I18n.detect(nav('de-DE'), null, 'hali-saha.mehambas91.workers.dev'), 'tr');
  assert.equal(I18n.detect(nav('en-US'), null, 'localhost'), 'tr');
  assert.equal(I18n.detect(nav('de-DE'), 'en', 'hali-saha.mehambas91.workers.dev'), 'en');
  assert.equal(I18n.detect(nav('en-US'), 'tr', portfolio), 'tr');
  assert.equal(I18n.detect(nav('en-US'), 'xx', portfolio), 'en');
});

test('Turkish is the source text; English fills placeholders and may use functions', () => {
  assert.equal(I18n.translate('tr', 'Kurulum'), 'Kurulum');
  assert.equal(I18n.translate('tr', '{a}–{b}', { a: 2, b: 1 }), '2–1');
  assert.equal(I18n.translate('en', 'Bilinmeyen metin {x}', { x: 1 }), 'Bilinmeyen metin 1');
  assert.equal(I18n.t('Kurulum'), 'Kurulum');
  assert.equal(I18n.translate('en', 'Puan', null, 'tab'), 'Standings');
  assert.equal(I18n.translate('en', 'Puan'), 'Points');
  assert.equal(I18n.translate('tr', 'Puan', null, 'tab'), 'Puan');
  assert.equal(I18n.translate('en', 'Puan', null, 'unknown'), 'Points');
  for (const [key, value] of Object.entries(I18n.EN)) {
    if (typeof value === 'function') assert.equal(typeof value(Object.fromEntries(placeholders(key).map((p) => [p, 1]))), 'string', key);
  }
});

test('every translated key used in the code has an English text with the same placeholders', () => {
  const missing = [];
  const mismatched = [];
  for (const [key, file] of usedKeys()) {
    if (!Object.prototype.hasOwnProperty.call(I18n.EN, key)) {
      missing.push(`${file}: ${key}`);
      continue;
    }
    const value = I18n.EN[key];
    if (typeof value === 'string' && placeholders(value).join() !== placeholders(key).join()) mismatched.push(key);
  }
  assert.deepEqual(missing, []);
  assert.deepEqual(mismatched, []);
});
