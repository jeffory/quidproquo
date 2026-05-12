import { qpqCoreUtils } from 'quidproquo-core';
import { getMinimalAppConfig } from '../src/qpqConfig.js';
import fs from 'fs';
import path from 'path';

const config = getMinimalAppConfig();
const flat = qpqCoreUtils.flattenQpqConfig(config);

const output = {
  qpqConfigVersion: 1,
  exportedAt: new Date().toISOString(),
  settings: flat,
};

const outPath = process.argv[2] || 'qpq.config.json';
fs.writeFileSync(path.resolve(outPath), JSON.stringify(output, null, 2));
console.log(`Config dumped to ${outPath}`);
