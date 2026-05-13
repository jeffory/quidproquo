import * as cdk from 'aws-cdk-lib';
import {
  BootstrapQpqServiceStack,
  InfQpqServiceStack,
  ApiQpqServiceStack,
  WebQpqServiceStack,
} from 'quidproquo-deploy-awscdk';
import { entryNames } from 'quidproquo-actionprocessor-awslambda';
import { qpqCoreUtils } from 'quidproquo-core';
import { getMinimalAppConfig } from '../src/qpqConfig.js';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve(__dirname, '../cdk.out');
const config = getMinimalAppConfig();

// The CDK constructs reference each lambda bundle as an asset at
// `<configRoot>/<apiBuildPath>/<entryName>/`. In a real deployment a bundler
// (webpack/esbuild) produces these. For the parity fixture we only need the
// directories to exist with deterministic contents so CDK synth resolves the
// assets and emits stable hashes.
const buildPath = path.join(qpqCoreUtils.getConfigRoot(config), qpqCoreUtils.getApiBuildPath(config));
for (const entryName of entryNames) {
  const entryDir = path.join(buildPath, entryName);
  fs.mkdirSync(entryDir, { recursive: true });
  fs.writeFileSync(path.join(entryDir, 'index.js'), `// fixture stub for ${entryName}\nmodule.exports = {};\n`);
}

const app = new cdk.App({ outdir: outDir });

const bootstrap = new BootstrapQpqServiceStack(app, 'Bootstrap', { qpqConfig: config });
const inf = new InfQpqServiceStack(app, 'Inf', { qpqConfig: config });
const api = new ApiQpqServiceStack(app, 'Api', { qpqConfig: config, infQpqServiceStack: inf });
const web = new WebQpqServiceStack(app, 'Web', { qpqConfig: config, infQpqServiceStack: inf });

app.synth();
console.log(`CDK synth complete. Output: ${outDir}`);
