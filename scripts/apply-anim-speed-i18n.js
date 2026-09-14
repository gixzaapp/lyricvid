const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'i18n', 'locales');

function u(...codes) {
  return String.fromCharCode(...codes);
}

const labels = {
  en: 'Speed {{speed}}×',
  id: 'Kecepatan {{speed}}×',
  it: 'Velocità {{speed}}×',
  fil: 'Bilis {{speed}}×',
  hi: `${u(0x0917, 0x0924, 0x093f)} {{speed}}×`,
  ml: `${u(0x0d35, 0x0d47, 0x0d17, 0x0d24)} {{speed}}×`,
  ta: `${u(0x0bb5, 0x0bc7, 0x0b95, 0x0bae, 0x0bcd)} {{speed}}×`,
  te: `${u(0x0c35, 0x0c47, 0x0c17, 0x0c02)} {{speed}}×`,
  kn: `${u(0x0cb5, 0x0cc7, 0x0c97)} {{speed}}×`,
  ur: `${u(0x0631, 0x0641, 0x062a, 0x0627, 0x0631)} {{speed}}×`,
};

function insertAfter(obj, afterKey, extras) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key in extras) continue;
    out[key] = value;
    if (key === afterKey) Object.assign(out, extras);
  }
  for (const [key, value] of Object.entries(extras)) {
    if (!(key in out)) out[key] = value;
  }
  return out;
}

for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.json'))) {
  const code = file.replace('.json', '');
  const locPath = path.join(dir, file);
  const loc = JSON.parse(fs.readFileSync(locPath, 'utf8'));
  const extras = { 'style.animSpeed': labels[code] ?? labels.en };
  fs.writeFileSync(locPath, `${JSON.stringify(insertAfter(loc, 'style.animZoom', extras), null, 2)}\n`, {
    encoding: 'utf8',
  });
  console.log(code, extras['style.animSpeed']);
}
