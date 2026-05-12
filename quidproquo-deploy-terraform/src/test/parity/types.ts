export interface NormalizedResource {
  awsType: string;
  qpqLogicalName: string;
  keyProperties: Record<string, unknown>;
}

export interface DiffEntry {
  awsType: string;
  qpqLogicalName: string;
  side: 'cdk' | 'terraform';
  reason?: string;
}

export interface PropertyDiffEntry {
  awsType: string;
  qpqLogicalName: string;
  propertyPath: string;
  cdkValue: unknown;
  tfValue: unknown;
  reason?: string;
}

export interface ParityReport {
  resourceCounts: Record<string, { cdk: number; terraform: number; diff: number }>;
  onlyInCdk: NormalizedResource[];
  onlyInTerraform: NormalizedResource[];
  propertyDiffs: PropertyDiffEntry[];
  allowedDiffs: DiffEntry[];
  allowedPropertyDiffs: PropertyDiffEntry[];
  unallowedDiffs: DiffEntry[];
  unallowedPropertyDiffs: PropertyDiffEntry[];
}

export interface ExpectedDiffs {
  version: number;
  description: string;
  allowedMissingInTerraform: Array<{
    awsType: string;
    qpqLogicalName: string;
    reason: string;
  }>;
  allowedMissingInCdk: Array<{
    awsType: string;
    qpqLogicalName: string;
    reason: string;
  }>;
  allowedPropertyDiffs: Array<{
    awsType: string;
    qpqLogicalName: string;
    propertyPath: string;
    reason: string;
  }>;
}
