const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'i18n', 'locales');

function u(...codes) {
  return String.fromCharCode(...codes);
}

const labels = {
  en: { sparkle: 'Sparkle', fly: 'Fly', glow: 'Glow', bounce: 'Bounce', float: 'Float' },
  id: { sparkle: 'Kilau', fly: 'Terbang', glow: 'Sinar', bounce: 'Pantul', float: 'Mengambang' },
  it: { sparkle: 'Scintille', fly: 'Volo', glow: 'Bagliore', bounce: 'Rimbalzo', float: 'Fluttua' },
  fil: { sparkle: 'Kislap', fly: 'Lipad', glow: 'Liwanag', bounce: 'Talon', float: 'Lutang' },
  hi: {
    sparkle: u(0x091a, 0x092e, 0x0915),
    fly: u(0x0909, 0x0921, 0x093c, 0x093e, 0x0928),
    glow: u(0x0926, 0x0940, 0x092a, 0x094d, 0x0924, 0x093f),
    bounce: u(0x0909, 0x091b, 0x093e, 0x0932),
    float: u(0x0924, 0x0948, 0x0930),
  },
  ml: {
    sparkle: u(0x0d24, 0x0d3f, 0x0d33, 0x0d15, 0x0d4d, 0x0d15, 0x0d02),
    fly: u(0x0d2a, 0x0d31, 0x0d15, 0x0d4d, 0x0d15, 0x0d7d),
    glow: u(0x0d2a, 0x0d4d, 0x0d30, 0x0d2d),
    bounce: u(0x0d24, 0x0d46, 0x0d31, 0x0d3f),
    float: u(0x0d2a, 0x0d4a, 0x0d19, 0x0d4d, 0x0d19, 0x0d7d),
  },
  ta: {
    sparkle: u(0x0baa, 0x0bb3, 0x0baa, 0x0bb3, 0x0baa, 0x0bcd, 0x0baa, 0x0bc1),
    fly: u(0x0baa, 0x0bb1, 0x0baa, 0x0bcd, 0x0baa, 0x0bc1),
    glow: u(0x0b92, 0x0bb3, 0x0bbf, 0x0bb0, 0x0bcd, 0x0bb5, 0x0bc1),
    bounce: u(0x0ba4, 0x0ba4, 0x0bcd, 0x0ba4, 0x0bc1),
    float: u(0x0bae, 0x0bbf, 0x0ba4, 0x0baa, 0x0bcd, 0x0baa, 0x0bc1),
  },
  te: {
    sparkle: u(0x0c2e, 0x0c46, 0x0c30, 0x0c41, 0x0c2a, 0x0c41),
    fly: u(0x0c0e, 0x0c17, 0x0c41, 0x0c30, 0x0c41),
    glow: u(0x0c2a, 0x0c4d, 0x0c30, 0x0c15, 0x0c3e, 0x0c36, 0x0c02),
    bounce: u(0x0c17, 0x0c46, 0x0c02, 0x0c24, 0x0c41),
    float: u(0x0c24, 0x0c47, 0x0c32, 0x0c41),
  },
  kn: {
    sparkle: u(0x0cb9, 0x0cca, 0x0cb3, 0x0caa, 0x0cc1),
    fly: u(0x0cb9, 0x0cbe, 0x0cb0, 0x0cbe, 0x0c9f),
    glow: u(0x0c95, 0x0cbe, 0x0c82, 0x0ca4, 0x0cbf),
    bounce: u(0x0c9c, 0x0cbf, 0x0c97, 0x0cbf, 0x0ca4),
    float: u(0x0ca4, 0x0cc7, 0x0cb2, 0x0cc1),
  },
  ur: {
    sparkle: u(0x0686, 0x0645, 0x06a9),
    fly: u(0x067e, 0x0631, 0x0648, 0x0627, 0x0632),
    glow: u(0x0631, 0x0648, 0x0634, 0x0646, 0x06cc),
    bounce: u(0x0627, 0x0686, 0x06be, 0x0627, 0x0644),
    float: u(0x062a, 0x06cc, 0x0631, 0x0646, 0x0627),
  },
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
  const pack = labels[code] ?? labels.en;
  const extras = {
    'style.animSparkle': pack.sparkle,
    'style.animFly': pack.fly,
    'style.animGlow': pack.glow,
    'style.animBounce': pack.bounce,
    'style.animFloat': pack.float,
  };
  fs.writeFileSync(locPath, `${JSON.stringify(insertAfter(loc, 'style.animZoom', extras), null, 2)}\n`, {
    encoding: 'utf8',
  });
  console.log(code, extras['style.animSparkle'], extras['style.animFly']);
}
