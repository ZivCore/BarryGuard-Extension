// scripts/build.js
// Copies compiled TypeScript output to extension root
import fs from 'fs';
import path from 'path';

const DIST = 'dist';
const ROOT = '.';

function copy(from, to) {
  const dir = path.dirname(to);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(from, to);
  console.log(`  ${from} → ${to}`);
}

console.log('Building BarryGuard Extension...');

copy(`${DIST}/background/index.js`,        `${ROOT}/background.js`);
copy(`${DIST}/content/index.js`,            `${ROOT}/content-scripts/content.js`);
copy(`${DIST}/popup/extensions.js`,         `${ROOT}/popup-extensions.js`);

console.log('Build complete.');
