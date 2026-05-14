import * as fs from 'fs';
import * as path from 'path';
import { qpqConfig } from '../qpqConfig';

const outPath = path.join(process.cwd(), 'qpq.config.json');

const raw = {
  qpqConfigVersion: 1,
  exportedAt: new Date().toISOString(),
  settings: qpqConfig,
};

fs.writeFileSync(outPath, JSON.stringify(raw, null, 2));
process.stdout.write(`Wrote QPQ config to ${outPath}\n`);
