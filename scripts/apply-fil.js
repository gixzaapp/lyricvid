const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const filName = 'Filipino';

function u(...codes) {
  return String.fromCharCode(...codes);
}

const namesByLocale = {
  en: { 'language.fil': 'Filipino', 'language.filNative': filName },
  hi: {
    'language.fil': u(0x092b, 0x093f, 0x0932, 0x093f, 0x092a, 0x0940, 0x0928, 0x094b),
    'language.filNative': filName,
  },
  ml: {
    'language.fil': u(0x0d2b, 0x0d3f, 0x0d32, 0x0d3f, 0x0d2a, 0x0d4d, 0x0d2a, 0x0d3f, 0x0d28, 0x0d4b),
    'language.filNative': filName,
  },
  ur: {
    'language.fil': u(0x0641, 0x0644, 0x067e, 0x0627, 0x0626, 0x0646, 0x06cc),
    'language.filNative': filName,
  },
  ta: {
    'language.fil': u(0x0baa, 0x0bbf, 0x0bb2, 0x0bbf, 0x0baa, 0x0bcd, 0x0baa, 0x0bc8, 0x0ba9, 0x0bcb),
    'language.filNative': filName,
  },
  te: {
    'language.fil': u(0x0c2b, 0x0c3f, 0x0c32, 0x0c3f, 0x0c2a, 0x0c4d, 0x0c2a, 0x0c3f, 0x0c28, 0x0c4b),
    'language.filNative': filName,
  },
  kn: {
    'language.fil': u(0x0cab, 0x0cbf, 0x0cb2, 0x0cbf, 0x0caa, 0x0cbf, 0x0ca8, 0x0ccb),
    'language.filNative': filName,
  },
  id: { 'language.fil': 'Filipino', 'language.filNative': filName },
  it: { 'language.fil': 'Filippino', 'language.filNative': filName },
};

const nameKeys = ['language.fil', 'language.filNative'];

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

const fil = {
  'language.title': 'Piliin ang iyong wika',
  'language.subtitle': 'Maaari mo itong palitan mamaya sa menu.',
  'language.continue': 'Magpatuloy',
  'language.en': 'Ingles',
  'language.enNative': 'English',
  'language.ml': 'Malayalam',
  'language.hi': 'Hindi',
  'language.ur': 'Urdu',
  'language.ta': 'Tamil',
  'language.id': 'Indonesian',
  'language.it': 'Italyano',
  'language.te': 'Telugu',
  'language.kn': 'Kannada',
  'language.fil': 'Filipino',
  'language.filNative': filName,
  'common.yes': 'Oo',
  'common.no': 'Hindi',
  'common.cancel': 'Kanselahin',
  'common.close': 'Isara',
  'common.unknownError': 'Hindi kilalang error',
  'common.continue': 'Magpatuloy',
  'menu.open': 'Buksan ang menu',
  'menu.about': 'Tungkol',
  'menu.language': 'Wika',
  'home.subtitle':
    'Pumili ng video, piliin ang kanta, at maglalagay ang AI ng may oras na liriko. I-istilo ang mga salita, tapos i-export ang tapos na video.',
  'home.chooseLibrary': 'Pumili mula sa library',
  'home.opening': 'Binubuksan…',
  'home.pickFile': 'Pumili ng video file',
  'home.continue': 'Ipagpatuloy ang proyekto',
  'home.currentVideo': 'Kasalukuyang video',
  'home.openError': 'Hindi mabuksan ang video',
  'about.title': 'Tungkol',
  'about.back': 'Bumalik',
  'about.version': 'Bersyon {{version}}',
  'about.copy1':
    'Naglalagay ang AI LyricVid ng may oras na liriko sa video. Pumili ng clip, maghanap ng kanta, i-istilo ang mga salita, tapos i-export ang tapos na MP4 sa gallery.',
  'about.copy2':
    'Ang pag-edit at export ay nananatili sa device na ito. Ang Detect song ay nagpapadala ng maikling audio clip sa AudD para kilalanin ang kanta. Hindi kailangan ng account.',
  'about.checkUpdate': 'Tingnan kung may update',
  'about.checking': 'Tinitingnan…',
  'about.upToDate': 'Napapanahon',
  'about.upToDateBody': 'Nasa bersyon {{version}} ka.',
  'about.updateRequired': 'Kailangan ang update',
  'about.updateAvailable': 'May available na update',
  'about.updateBody': '{{message}}\n\nNasa {{installed}} ka. Ang pinakabago ay {{latest}}.',
  'about.later': 'Mamaya',
  'about.update': 'I-update',
  'about.checkFailed': 'Hindi matingnan',
  'about.lyricsCourtesy': 'Liriko mula sa',
  'about.songDetection': 'Pagkilala ng kanta mula sa',
  'editor.audio': 'Audio',
  'editor.lyrics': 'Liriko',
  'editor.style': 'Istilo',
  'editor.sync': 'Sync',
  'editor.export': 'Export',
  'editor.detecting': 'Kinikilala ang kanta…',
  'editor.title': 'Editor ng liriko',
  'editor.pickVideo': 'Pumili muna ng video.',
  'editor.backHome': 'Bumalik sa home',
  'detect.title': 'Kilalanin ang kanta?',
  'detect.body': 'Kilalanin ang audio ng video na ito at i-load ang liriko nang kusa?',
  'detect.noLyricsTitle': 'Nahanap ang kanta, walang liriko',
  'detect.noLyricsBody':
    'Nakilala ang {{artist}} — {{title}}, pero walang liriko ang LRCLIB. Gamitin ang Search lyrics para sa ibang match.',
  'detect.loadedTitle': 'Na-load ang liriko',
  'detect.failTitle': 'Hindi makilala ang kanta',
  'detect.failFallback': 'Subukan ang Detect from audio sa Search lyrics.',
  'detect.needsBuild':
    'Kailangan ng AI LyricVid app build ang pagkilala ng kanta para makaputol ng maikling audio clip. Hindi ito kaya ng Expo Go.',
  'detect.unrecognized':
    'Hindi nakilala ng AudD ang clip na ito. Subukan ang ibang parte ng video, o maghanap ayon sa pangalan.',
  'detect.noToken': 'I-set ang EXPO_PUBLIC_AUDD_API_TOKEN sa .env para i-enable ang pagkilala ng kanta.',
  'detect.invalidResponse': 'Invalid ang sagot ng AudD.',
  'detect.requestFailed': 'Nabigo ang request sa AudD ({{status}}).',
  'media.photoPermission': 'Kailangan ng pahintulot sa photo library para pumili ng video.',
  'search.rateLimit': 'Naabot ang limitasyon ng LRCLIB. Subukan ulit sa loob ng {{seconds}}s.',
  'search.trackNotFound': 'Hindi nahanap ang kanta sa LRCLIB.',
  'search.requestFailed': 'Nabigo ang request sa LRCLIB ({{status}}).',
  'search.unknownTrack': 'Hindi kilala',
  'search.unknownArtist': 'Hindi kilalang artist',
  'lyrics.song': 'Kanta',
  'lyrics.noSong': 'Walang napiling kanta',
  'lyrics.search': 'Maghanap ng liriko',
  'lyrics.addLine': 'Magdagdag ng linya',
  'lyrics.synced': 'Na-load ang buong naka-sync na liriko. I-tap ang linya para pumunta doon.',
  'lyrics.beyondVideo':
    'Ipinapakita ang buong kanta. Humihinto ang preview at export sa dulo ng video; nananatili sa listahan ang mga susunod na linya para i-edit.',
  'lyrics.placeholder': 'Linya ng liriko',
  'lyrics.splitA11y': 'Hatiin ang linyang ito',
  'lyrics.cannotSplitTitle': 'Hindi mahati',
  'lyrics.cannotSplitBody': 'Kailangan ng hindi bababa sa dalawang salita ang linyang ito.',
  'lyrics.startFromA11y': 'Magsimula sa linyang ito',
  'lyrics.startFromTitle': 'Magsimula dito',
  'lyrics.startFromBody':
    'Tanggalin ang lahat ng linya sa itaas nito at i-shift ang oras para magsimula sa 00:00.00.',
  'lyrics.removeA11y': 'Tanggalin ang linya',
  'lyrics.removeTitle': 'Tanggalin ang linya?',
  'lyrics.remove': 'Tanggalin',
  'lyrics.pasteLabel': 'I-paste ang liriko',
  'lyrics.pastePlaceholder': 'I-paste ang LRC o plain lyrics sa anumang wika',
  'lyrics.usePaste': 'Gamitin ang na-paste na liriko',
  'lyrics.blankLine': 'Magsimula sa blangkong linya',
  'lyrics.warningPaste':
    'Na-paste bilang hindi naka-sync na liriko. Sumusunod ang timestamp sa kanta, hindi sa haba ng video.',
  'lyrics.warningInstrumental': 'Minarkahan ang track na ito bilang instrumental.',
  'lyrics.warningUnsynced':
    'Unsynced lyrics lang ang nahanap. Pantay na inilatag ang timestamp — i-adjust sa listahan.',
  'lyrics.warningNone': 'Walang nakalakip na liriko sa resultang ito.',
  'search.title': 'Maghanap ng liriko',
  'search.songName': 'Pangalan ng kanta',
  'search.artist': 'Artist (opsyonal)',
  'search.searching': 'Hinahanap…',
  'search.search': 'Hanapin sa LRCLIB',
  'search.detecting': 'Kinikilala…',
  'search.detect': 'Kilalanin mula sa audio',
  'search.needVideo': 'Pumili muna ng video para kilalanin ang kanta mula sa soundtrack nito.',
  'search.noMatches': 'Walang match sa LRCLIB. Subukan ang ibang titulo o idagdag ang artist.',
  'search.pickSong': 'Piliin ang kanta. Ilista ng editor ang buong liriko, kahit mas maikli ang video.',
  'search.failed': 'Nabigo ang paghahanap.',
  'search.detectNeedVideo': 'Pumili muna ng video, tapos kilalanin ang kanta mula sa audio nito.',
  'search.detectNoLyrics':
    'Nahanap ng AudD ang {{artist}} — {{title}}, pero walang liriko ang LRCLIB. Maghanap ng ibang spelling, o i-paste ang liriko.',
  'search.detected': 'Nakilala: {{artist}} — {{title}}. Piliin ang liriko sa ibaba.',
  'search.detectFailed': 'Nabigo ang pagkilala ng kanta.',
  'search.loadFailed': 'Hindi ma-load ang liriko.',
  'search.footerDetect':
    'Nagpapadala ang Detect ng maikling audio clip sa AudD, tapos naglo-load ng liriko mula sa LRCLIB.',
  'search.footerLrc': 'Liriko via LRCLIB · anumang wika, tulad ng na-publish',
  'search.synced': 'naka-sync',
  'search.unsynced': 'hindi naka-sync',
  'split.title': 'Hatiin ang linya',
  'split.help':
    'I-tap ang huling salita na dapat manatili sa linyang ito. Ang natitira ay magiging bagong linya sa ilalim.',
  'split.needWords': 'Kailangan ng hindi bababa sa dalawang salita ang linyang ito para mahati.',
  'split.thisLine': 'Linyang ito',
  'split.nextLine': 'Susunod na linya',
  'split.action': 'Hatiin',
  'sync.title': 'Timing offset',
  'sync.help':
    'I-shift nang sabay ang lahat ng linya kung medyo maaga o huli ang liriko kumpara sa video.',
  'sync.unsynced':
    'Hindi naka-sync per line ang lirikong ito. Gamitin ang offset at per-line timestamp sa Lyrics.',
  'sync.reset': 'I-reset',
  'audio.soundtrack': 'Soundtrack',
  'audio.keep': 'Panatilihin ang orihinal',
  'audio.replace': 'Palitan ang audio',
  'audio.keepHelp': 'Ginagamit ng preview ang audio na nasa video na ({{duration}}).',
  'audio.noTrack': 'Wala pang kapalit na track',
  'audio.replaceDuration': 'Tagal ng kapalit {{duration}}',
  'audio.replaceHelp':
    'Pumili ng mp3 o wav. Humihinto ang preview at export sa haba ng video ({{duration}}).',
  'audio.choose': 'Pumili ng audio file',
  'audio.opening': 'Binubuksan…',
  'audio.pickFailed': 'Hindi mapili ang audio',
  'style.fonts': 'Fonts',
  'style.text': 'Teksto',
  'style.size': 'Sukat {{size}}',
  'style.background': 'Background',
  'style.align': 'Align',
  'style.bold': 'Bold',
  'style.italic': 'Italic',
  'style.outline': 'Outline',
  'style.sample': 'Liriko',
  'style.hint': 'I-drag ang kahon ng liriko sa video para ilipat ito.',
  'style.bgNone': 'Wala',
  'style.bgDim': 'Dim',
  'style.bgSolid': 'Solid',
  'style.bgLight': 'Light',
  'style.alignLeft': 'kaliwa',
  'style.alignCenter': 'gitna',
  'style.alignRight': 'kanan',
  'stage.placeholder': 'Maghanap ng kanta para maglagay ng liriko',
  'export.ready': 'Handa na ang video',
  'export.savedGallery': 'Na-save ang {{filename}} sa gallery mo.',
  'export.readyShare':
    'Handa na ang {{filename}}. Gamitin ang system sheet para i-save o i-share.',
  'export.hiresTitle': 'Hi-Res audio',
  'export.hiresBody': 'Hi-Res ang audio na ito. Pumili ng lo-res file (44.1 o 48 kHz), tapos i-export ulit.',
  'export.failed': 'Nabigo ang export',
  'export.expoGo':
    'Buksan ang AI LyricVid app mula sa Android/iOS build para mag-export. Hindi makagawa ng tapos na MP4 ang Expo Go.',
  'export.busy': 'Ine-export ang video…',
  'export.action': 'I-export ang video',
  'export.noStorage': 'Hindi available ang app storage sa device na ito.',
  'export.copyFailed': 'Hindi makopya ang video sa app storage para sa export.',
  'export.shareUnavailable': 'Hindi available ang sharing sa device na ito.',
  'export.alreadyOnDevice':
    'Nasa device mo na ang video na ito. I-save ang subtitle files at pangalanan ayon sa video.',
  'export.empty': 'Walang laman ang na-export na video.',
  'export.needsBuild':
    'Kailangan ng AI LyricVid app build ang tapos na video export. Hindi ma-burn ng Expo Go ang liriko sa MP4. Buksan ang naka-install na AI LyricVid app mula sa Android/iOS build, tapos mag-export ulit.',
  'update.title': 'Handa na ang bersyon {{version}}',
  'update.youHave': 'Nasa {{version}} ka',
  'update.defaultMessage': 'May mas bagong bersyon ng AI LyricVid.',
  'update.checkFailedStatus': 'Nabigo ang pagtingin ng update ({{status}}).',
  'update.manifestMissing': 'Walang latest version ang update manifest.',
  'update.storeFailed': 'Hindi mabuksan ang store listing.',
};

const enPath = path.join(dir, 'en.json');
let en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
en = insertAfter(en, 'language.knNative', namesByLocale.en);
writeJson(enPath, en);

for (const [code, extras] of Object.entries(namesByLocale)) {
  if (code === 'en') continue;
  const file = path.join(dir, `${code}.json`);
  const current = JSON.parse(fs.readFileSync(file, 'utf8'));
  writeJson(file, insertAfter(current, 'language.knNative', extras));
}

const out = {};
for (const key of Object.keys(en)) {
  out[key] = fil[key] ?? en[key];
}
writeJson(path.join(dir, 'fil.json'), out);

const missing = Object.keys(en).filter((key) => !(key in fil));
const extra = Object.keys(fil).filter((key) => !(key in en));
if (Object.keys(out).length !== Object.keys(en).length) {
  throw new Error(`fil key count mismatch ${Object.keys(out).length} vs ${Object.keys(en).length}`);
}
console.log('fil keys', Object.keys(out).length, 'missing overlay', missing.join(',') || 0, 'extra', extra.join(',') || 0);
console.log('fil language.title', out['language.title']);
console.log('fil menu.language', out['menu.language']);
console.log('en language.fil', en['language.fil']);

for (const code of ['en', 'ml', 'hi', 'ur', 'ta', 'te', 'kn', 'id', 'it', 'fil']) {
  JSON.parse(fs.readFileSync(path.join(dir, `${code}.json`), 'utf8'));
}
console.log('all locale JSON parsed');
