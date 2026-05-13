import * as cdk from 'aws-cdk-lib';
import {
  BootstrapQpqServiceStack,
  InfQpqServiceStack,
  ApiQpqServiceStack,
  WebQpqServiceStack,
} from 'quidproquo-deploy-awscdk';
import { getMinimalAppConfig } from '../src/qpqConfig.js';
import path from 'path';

const outDir = path.resolve(__dirname, '../cdk.out');

const app = new cdk.App({ outdir: outDir });
const config = getMinimalAppConfig();

const bootstrap = new BootstrapQpqServiceStack(app, 'Bootstrap', { qpqConfig: config });
const inf = new InfQpqServiceStack(app, 'Inf', { qpqConfig: config });
const api = new ApiQpqServiceStack(app, 'Api', { qpqConfig: config, infQpqServiceStack: inf });
const web = new WebQpqServiceStack(app, 'Web', { qpqConfig: config, infQpqServiceStack: inf });

app.synth();
console.log(`CDK synth complete. Output: ${outDir}`);
