const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'i18n', 'locales');

function u(...codes) {
  return String.fromCharCode(...codes);
}

const titles = {
  en: 'Animation',
  id: 'Animasi',
  it: 'Animazione',
  fil: 'Animasyon',
  hi: u(0x090f, 0x0928, 0x093f, 0x092e, 0x0947, 0x0936, 0x0928),
  ml: u(0x0d06, 0x0d28, 0x0d3f, 0x0d2e, 0x0d47, 0x0d37, 0x0d7b),
  ta: u(0x0b85, 0x0ba9, 0x0bbf, 0x0bae, 0x0bc7, 0x0bb7, 0x0ba9, 0x0bcd),
  te: u(0x0c2f, 0x0c3e, 0x0c28, 0x0c3f, 0x0c2e, 0x0c47, 0x0c37, 0x0c28, 0x0c4d),
  kn: u(0x0c85, 0x0ca8, 0x0cbf, 0x0cae, 0x0cc7, 0x0cb7, 0x0ca8, 0x0ccd),
  ur: u(0x0627, 0x06cc, 0x0646, 0x06cc, 0x0645, 0x06cc, 0x0634, 0x0646),
};

const names = {
  en: { fade: 'Fade', rise: 'Rise', drop: 'Drop', pop: 'Pop', slide: 'Slide', zoom: 'Zoom' },
  id: { fade: 'Pudar', rise: 'Naik', drop: 'Turun', pop: 'Pop', slide: 'Geser', zoom: 'Perbesar' },
  it: { fade: 'Dissolvenza', rise: 'Salita', drop: 'Discesa', pop: 'Pop', slide: 'Scorrimento', zoom: 'Zoom' },
  fil: { fade: 'Fade', rise: 'Rise', drop: 'Drop', pop: 'Pop', slide: 'Slide', zoom: 'Zoom' },
};

const nameKeys = [
  'style.animation',
  'style.animNone',
  'style.animFade',
  'style.animRise',
  'style.animDrop',
  'style.animPop',
  'style.animSlide',
  'style.animZoom',
];

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

const files = fs.readdirSync(dir).filter((file) => file.endsWith('.json'));
for (const file of files) {
  const code = file.replace('.json', '');
  const locPath = path.join(dir, file);
  const loc = JSON.parse(fs.readFileSync(locPath, 'utf8'));
  const pack = names[code] ?? names.en;
  const extras = {
    'style.animation': titles[code] ?? titles.en,
    'style.animNone': loc['style.bgNone'] ?? 'None',
    'style.animFade': pack.fade,
    'style.animRise': pack.rise,
    'style.animDrop': pack.drop,
    'style.animPop': pack.pop,
    'style.animSlide': pack.slide,
    'style.animZoom': pack.zoom,
  };
  const next = insertAfter(loc, 'style.fonts', extras);
  fs.writeFileSync(locPath, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8' });
  console.log(code, next['style.animation'], Object.keys(next).length);
}
