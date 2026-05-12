import {
  DiffEntry,
  ExpectedDiffs,
  NormalizedResource,
  ParityReport,
  PropertyDiffEntry,
} from './types.js';

function resourceKey(r: NormalizedResource): string {
  return `${r.awsType}::${r.qpqLogicalName}`;
}

export function compareResources(
  cdkResources: NormalizedResource[],
  terraformResources: NormalizedResource[],
  expectedDiffs: ExpectedDiffs,
): ParityReport {
  const cdkMap = new Map(cdkResources.map((r) => [resourceKey(r), r]));
  const tfMap = new Map(terraformResources.map((r) => [resourceKey(r), r]));

  const onlyInCdk: NormalizedResource[] = [];
  const onlyInTerraform: NormalizedResource[] = [];
  const propertyDiffs: PropertyDiffEntry[] = [];

  for (const [key, cdkRes] of cdkMap) {
    if (!tfMap.has(key)) {
      onlyInCdk.push(cdkRes);
    } else {
      const tfRes = tfMap.get(key)!;
      const diffs = compareProperties(cdkRes, tfRes);
      propertyDiffs.push(...diffs);
    }
  }

  for (const [key, tfRes] of tfMap) {
    if (!cdkMap.has(key)) {
      onlyInTerraform.push(tfRes);
    }
  }

  // Count resources by type
  const resourceCounts: Record<string, { cdk: number; terraform: number; diff: number }> = {};
  const allTypes = new Set([...cdkResources.map((r) => r.awsType), ...terraformResources.map((r) => r.awsType)]);
  for (const type of allTypes) {
    const cdkCount = cdkResources.filter((r) => r.awsType === type).length;
    const tfCount = terraformResources.filter((r) => r.awsType === type).length;
    resourceCounts[type] = { cdk: cdkCount, terraform: tfCount, diff: cdkCount - tfCount };
  }

  // Validate against expected diffs
  const allowedDiffs: DiffEntry[] = [];
  const unallowedDiffs: DiffEntry[] = [];

  for (const diff of onlyInCdk) {
    const allowed = expectedDiffs.allowedMissingInTerraform.find(
      (a) => a.awsType === diff.awsType && a.qpqLogicalName === diff.qpqLogicalName,
    );
    if (allowed) {
      allowedDiffs.push({ ...diff, side: 'cdk', reason: allowed.reason });
    } else {
      unallowedDiffs.push({ ...diff, side: 'cdk' });
    }
  }

  for (const diff of onlyInTerraform) {
    const allowed = expectedDiffs.allowedMissingInCdk.find(
      (a) => a.awsType === diff.awsType && a.qpqLogicalName === diff.qpqLogicalName,
    );
    if (allowed) {
      allowedDiffs.push({ ...diff, side: 'terraform', reason: allowed.reason });
    } else {
      unallowedDiffs.push({ ...diff, side: 'terraform' });
    }
  }

  const allowedPropertyDiffs: PropertyDiffEntry[] = [];
  const unallowedPropertyDiffs: PropertyDiffEntry[] = [];

  for (const diff of propertyDiffs) {
    const allowed = expectedDiffs.allowedPropertyDiffs.find(
      (a) =>
        a.awsType === diff.awsType &&
        a.qpqLogicalName === diff.qpqLogicalName &&
        a.propertyPath === diff.propertyPath,
    );
    if (allowed) {
      allowedPropertyDiffs.push({ ...diff, reason: allowed.reason });
    } else {
      unallowedPropertyDiffs.push(diff);
    }
  }

  return {
    resourceCounts,
    onlyInCdk,
    onlyInTerraform,
    propertyDiffs,
    allowedDiffs,
    allowedPropertyDiffs,
    unallowedDiffs,
    unallowedPropertyDiffs,
  };
}

function compareProperties(cdkRes: NormalizedResource, tfRes: NormalizedResource): PropertyDiffEntry[] {
  const diffs: PropertyDiffEntry[] = [];
  const allKeys = new Set([...Object.keys(cdkRes.keyProperties), ...Object.keys(tfRes.keyProperties)]);

  for (const key of allKeys) {
    const cdkValue = cdkRes.keyProperties[key];
    const tfValue = tfRes.keyProperties[key];

    if (!deepEqual(cdkValue, tfValue)) {
      diffs.push({
        awsType: cdkRes.awsType,
        qpqLogicalName: cdkRes.qpqLogicalName,
        propertyPath: key,
        cdkValue,
        tfValue,
      });
    }
  }

  return diffs;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!bKeys.includes(key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }

  return true;
}

export function isParityPassing(report: ParityReport): boolean {
  return report.unallowedDiffs.length === 0 && report.unallowedPropertyDiffs.length === 0;
}
