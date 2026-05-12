import fs from 'fs';
import path from 'path';
import { extractCdkResources } from './extractCdkResources.js';
import { extractTerraformResources } from './extractTerraformResources.js';
import { compareResources, isParityPassing } from './compare.js';
import type { ExpectedDiffs, ParityReport } from './types.js';

export async function runParityDiff(options: {
  cdkOutDir: string;
  terraformPlanJsonPath?: string;
  expectedDiffsPath: string;
  baseline?: 'cdk' | 'terraform' | 'none';
  outputReportPath?: string;
}): Promise<{
  report: ParityReport;
  passing: boolean;
}> {
  const cdkResources = extractCdkResources(options.cdkOutDir);

  let terraformResources: ReturnType<typeof extractTerraformResources> = [];
  if (options.terraformPlanJsonPath && fs.existsSync(options.terraformPlanJsonPath)) {
    const planJson = JSON.parse(fs.readFileSync(options.terraformPlanJsonPath, 'utf-8'));
    terraformResources = extractTerraformResources(planJson);
  }

  const expectedDiffs: ExpectedDiffs = JSON.parse(fs.readFileSync(options.expectedDiffsPath, 'utf-8'));

  const report = compareResources(cdkResources, terraformResources, expectedDiffs);

  let passing = isParityPassing(report);

  // In baseline mode, we only validate that the expected side exists and produces
  // a coherent resource graph. We don't fail when the other side is missing.
  if (options.baseline === 'cdk') {
    passing = cdkResources.length > 0;
    if (!passing) {
      console.error('Baseline mode: CDK side produced zero resources');
    }
  } else if (options.baseline === 'terraform') {
    passing = terraformResources.length > 0;
    if (!passing) {
      console.error('Baseline mode: Terraform side produced zero resources');
    }
  }

  if (options.outputReportPath) {
    fs.writeFileSync(options.outputReportPath, JSON.stringify(report, null, 2));
    console.log(`Report written to ${options.outputReportPath}`);
  }

  return { report, passing };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const cdkOutDir = args.find((a) => a.startsWith('--cdk-out='))?.split('=')[1] || 'cdk.out';
  const tfPlanPath = args.find((a) => a.startsWith('--tf-plan='))?.split('=')[1];
  const expectedDiffsPath = args.find((a) => a.startsWith('--expected='))?.split('=')[1] || 'expected-diffs.json';
  const baseline = args.find((a) => a.startsWith('--baseline='))?.split('=')[1] as 'cdk' | 'terraform' | 'none' | undefined;
  const outputReportPath = args.find((a) => a.startsWith('--output='))?.split('=')[1];

  runParityDiff({ cdkOutDir, terraformPlanJsonPath: tfPlanPath, expectedDiffsPath, baseline, outputReportPath }).then(({ report, passing }) => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(passing ? 0 : 1);
  });
}
