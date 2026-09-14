const fs = require('fs');
const path = require('path');

const { te, dir, u, teName, knName } = require('./write-te-kn');
const teRest = require('./te-rest');
const kn = Object.assign({}, require('./kn-overlay'), require('./kn-rest'));

const teAll = Object.assign({}, te, teRest);

const nameKeys = ['language.te', 'language.teNative', 'language.kn', 'language.knNative'];

const namesByLocale = {
  en: {
    'language.te': 'Telugu',
    'language.teNative': teName,
    'language.kn': 'Kannada',
    'language.knNative': knName,
  },
  hi: {
    'language.te': u(0x0924, 0x0947, 0x0932, 0x0941, 0x0917, 0x0941),
    'language.teNative': teName,
    'language.kn': u(0x0915, 0x0928, 0x094d, 0x0928, 0x0921, 0x093c),
    'language.knNative': knName,
  },
  ml: {
    'language.te': u(0x0d24, 0x0d46, 0x0d32, 0x0d41, 0x0d19, 0x0d4d, 0x0d15, 0x0d4d),
    'language.teNative': teName,
    'language.kn': u(0x0d15, 0x0d28, 0x0d4d, 0x0d28, 0x0d21),
    'language.knNative': knName,
  },
  ur: {
    'language.te': u(0x062a, 0x06cc, 0x0644, 0x06af, 0x0648),
    'language.teNative': teName,
    'language.kn': u(0x06a9, 0x0646, 0x0691),
    'language.knNative': knName,
  },
  ta: {
    'language.te': u(0x0ba4, 0x0bc6, 0x0bb2, 0x0bc1, 0x0b99, 0x0bcd, 0x0b95, 0x0bc1),
    'language.teNative': teName,
    'language.kn': u(0x0b95, 0x0ba9, 0x0bcd, 0x0ba9, 0x0b9f, 0x0bae, 0x0bcd),
    'language.knNative': knName,
  },
  id: {
    'language.te': 'Telugu',
    'language.teNative': teName,
    'language.kn': 'Kannada',
    'language.knNative': knName,
  },
  it: {
    'language.te': 'Telugu',
    'language.teNative': teName,
    'language.kn': 'Kannada',
    'language.knNative': knName,
  },
};

function insertAfter(obj, afterKey, extras) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (nameKeys.includes(key)) continue;
    out[key] = value;
    if (key === afterKey) Object.assign(out, extras);
  }
  for (const [key, value] of Object.entries(extras)) {
    if (!(key in out)) out[key] = value;
  }
  return out;
}

function writeJson(file, obj) {
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`, { encoding: 'utf8' });
}

const enPath = path.join(dir, 'en.json');
const en = insertAfter(JSON.parse(fs.readFileSync(enPath, 'utf8')), 'language.itNative', namesByLocale.en);
writeJson(enPath, en);

for (const [code, extras] of Object.entries(namesByLocale)) {
  if (code === 'en') continue;
  const file = path.join(dir, `${code}.json`);
  const current = JSON.parse(fs.readFileSync(file, 'utf8'));
  writeJson(file, insertAfter(current, 'language.itNative', extras));
}

function writeLocale(code, overlay) {
  const out = {};
  for (const key of Object.keys(en)) {
    out[key] = overlay[key] ?? en[key];
  }
  writeJson(path.join(dir, `${code}.json`), out);
  const missing = Object.keys(en).filter((key) => !(key in overlay));
  const extra = Object.keys(overlay).filter((key) => !(key in en));
  const empty = Object.entries(out).filter(([, value]) => !value);
  console.log(code, 'keys', Object.keys(out).length, 'overlay', Object.keys(overlay).length, 'missing', missing.length, missing.join(','), 'extra', extra.join(','), 'empty', empty.length);
  console.log(' ', code, 'language.title', out['language.title']);
  console.log(' ', code, 'menu.language', out['menu.language']);
  console.log(' ', code, 'detect.title', out['detect.title']);
}

writeLocale('te', teAll);
writeLocale('kn', kn);

const check = JSON.parse(fs.readFileSync(path.join(dir, 'te.json'), 'utf8'));
if (Object.keys(check).length !== Object.keys(en).length) {
  throw new Error('te key count mismatch');
}
JSON.parse(fs.readFileSync(path.join(dir, 'kn.json'), 'utf8'));
JSON.parse(fs.readFileSync(path.join(dir, 'hi.json'), 'utf8'));
console.log('all locale JSON parsed');
