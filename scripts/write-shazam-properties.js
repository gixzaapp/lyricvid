const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const credentialsDir = path.join(root, 'credentials');
const outFile = path.join(credentialsDir, 'shazam.properties');

const args = process.argv.slice(2);
const teamId = (args[0] || process.env.SHAZAM_TEAM_ID || '').trim();
const keyFileArg = (args[1] || process.env.SHAZAM_P8 || '').trim();

function findP8() {
  if (keyFileArg && fs.existsSync(keyFileArg)) return keyFileArg;
  if (!fs.existsSync(credentialsDir)) return '';
  const match = fs.readdirSync(credentialsDir).find((name) => /^AuthKey_.+\.p8$/i.test(name));
  return match ? path.join(credentialsDir, match) : '';
}

const keyFile = findP8();
const keyIdFromName = path.basename(keyFile).replace(/^AuthKey_/i, '').replace(/\.p8$/i, '');
const keyId = (args[2] || process.env.SHAZAM_KEY_ID || keyIdFromName).trim();

if (!teamId || !keyFile || !keyId) {
  console.error(`Usage:
  node scripts/write-shazam-properties.js <TEAM_ID> [path-to-AuthKey_XXXX.p8] [KEY_ID]

1. Put the downloaded AuthKey_XXXX.p8 in lyricvid/credentials/
2. Run this with your 10-character Team ID
`);
  process.exit(1);
}

const pem = fs.readFileSync(keyFile, 'utf8').trim();
if (!pem.includes('BEGIN PRIVATE KEY')) {
  console.error('That file is not an Apple .p8 private key.');
  process.exit(1);
}

const escaped = pem.replace(/\r\n/g, '\n').replace(/\n/g, '\\n');
fs.mkdirSync(credentialsDir, { recursive: true });
fs.writeFileSync(
  outFile,
  [
    `# Generated from ${path.basename(keyFile)}. Do not commit.`,
    `teamId=${teamId}`,
    `keyId=${keyId}`,
    `privateKey=${escaped}`,
    '',
  ].join('\n'),
);
console.log(`Wrote ${outFile}`);
console.log(`teamId=${teamId}`);
console.log(`keyId=${keyId}`);
