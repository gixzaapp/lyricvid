const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'node_modules', 'react-native', 'gradle', 'libs.versions.toml'),
  path.join(
    __dirname,
    '..',
    'node_modules',
    '@react-native',
    'gradle-plugin',
    'gradle',
    'libs.versions.toml',
  ),
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const next = fs.readFileSync(file, 'utf8').replace(/agp = "8\.11\.0"/g, 'agp = "8.10.0"');
  fs.writeFileSync(file, next);
}
