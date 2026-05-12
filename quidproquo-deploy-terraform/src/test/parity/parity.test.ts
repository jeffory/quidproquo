import { describe, it, expect } from 'vitest';
import { extractCdkResources } from './extractCdkResources.js';
import { extractTerraformResources } from './extractTerraformResources.js';
import { compareResources, isParityPassing } from './compare.js';
import type { ExpectedDiffs, NormalizedResource } from './types.js';

const mockExpectedDiffs: ExpectedDiffs = {
  version: 1,
  description: 'Mock expected diffs for tests',
  allowedMissingInTerraform: [
    { awsType: 'AWS::SSM::Parameter', qpqLogicalName: 'allowed-param', reason: 'test' },
  ],
  allowedMissingInCdk: [
    { awsType: 'AWS::S3::Bucket', qpqLogicalName: 'allowed-bucket', reason: 'test' },
  ],
  allowedPropertyDiffs: [
    { awsType: 'AWS::Lambda::Function', qpqLogicalName: 'allowed-fn', propertyPath: 'Handler', reason: 'test' },
  ],
};

describe('extractCdkResources', () => {
  it('extracts resources from a CFN template directory', async () => {
    // We test against the real fixture output if available, otherwise skip
    const fs = await import('fs');
    const path = await import('path');
    const cdkOutDir = path.resolve(
      import.meta.dirname,
      '../../../examples/minimal-app/cdk.out',
    );

    if (!fs.existsSync(cdkOutDir)) {
      console.log('Skipping extractCdkResources test — fixture cdk.out not found');
      return;
    }

    const resources = extractCdkResources(cdkOutDir);
    expect(resources.length).toBeGreaterThan(0);

    const types = new Set(resources.map((r) => r.awsType));
    expect(types).toContain('AWS::DynamoDB::Table');
    expect(types).toContain('AWS::S3::Bucket');
    expect(types).toContain('AWS::SQS::Queue');
    expect(types).toContain('AWS::SSM::Parameter');
    expect(types).toContain('AWS::SecretsManager::Secret');
    expect(types).toContain('AWS::Lambda::Function');
  });
});

describe('extractTerraformResources', () => {
  it('returns empty array for empty plan', () => {
    const resources = extractTerraformResources({});
    expect(resources).toEqual([]);
  });

  it('extracts resources from a terraform plan JSON', () => {
    const planJson = {
      planned_values: {
        root_module: {
          resources: [
            {
              address: 'module.kvs_users.aws_dynamodb_table.this',
              mode: 'managed',
              type: 'aws_dynamodb_table',
              name: 'this',
              provider_name: 'registry.terraform.io/hashicorp/aws',
              schema_version: 1,
              values: {
                name: 'users-minimal-app-main-dev-qpqkvs',
                billing_mode: 'PAY_PER_REQUEST',
              },
            },
          ],
        },
      },
    };

    const resources = extractTerraformResources(planJson);
    expect(resources).toHaveLength(1);
    expect(resources[0].awsType).toBe('AWS::DynamoDB::Table');
    expect(resources[0].qpqLogicalName).toBe('users');
  });
});

describe('compareResources', () => {
  it('reports no diffs for identical resource sets', () => {
    const cdk: NormalizedResource[] = [
      { awsType: 'AWS::DynamoDB::Table', qpqLogicalName: 'items', keyProperties: {} },
    ];
    const tf: NormalizedResource[] = [
      { awsType: 'AWS::DynamoDB::Table', qpqLogicalName: 'items', keyProperties: {} },
    ];

    const report = compareResources(cdk, tf, mockExpectedDiffs);
    expect(report.onlyInCdk).toHaveLength(0);
    expect(report.onlyInTerraform).toHaveLength(0);
    expect(report.unallowedDiffs).toHaveLength(0);
    expect(isParityPassing(report)).toBe(true);
  });

  it('reports missing resources in terraform', () => {
    const cdk: NormalizedResource[] = [
      { awsType: 'AWS::DynamoDB::Table', qpqLogicalName: 'items', keyProperties: {} },
      { awsType: 'AWS::SSM::Parameter', qpqLogicalName: 'allowed-param', keyProperties: {} },
    ];
    const tf: NormalizedResource[] = [
      { awsType: 'AWS::DynamoDB::Table', qpqLogicalName: 'items', keyProperties: {} },
    ];

    const report = compareResources(cdk, tf, mockExpectedDiffs);
    expect(report.onlyInCdk).toHaveLength(1);
    expect(report.unallowedDiffs).toHaveLength(0);
    expect(report.allowedDiffs).toHaveLength(1);
    expect(isParityPassing(report)).toBe(true);
  });

  it('reports unallowed missing resources', () => {
    const cdk: NormalizedResource[] = [
      { awsType: 'AWS::DynamoDB::Table', qpqLogicalName: 'items', keyProperties: {} },
      { awsType: 'AWS::SSM::Parameter', qpqLogicalName: 'unexpected-param', keyProperties: {} },
    ];
    const tf: NormalizedResource[] = [
      { awsType: 'AWS::DynamoDB::Table', qpqLogicalName: 'items', keyProperties: {} },
    ];

    const report = compareResources(cdk, tf, mockExpectedDiffs);
    expect(report.unallowedDiffs).toHaveLength(1);
    expect(isParityPassing(report)).toBe(false);
  });

  it('reports property diffs', () => {
    const cdk: NormalizedResource[] = [
      {
        awsType: 'AWS::Lambda::Function',
        qpqLogicalName: 'fn',
        keyProperties: { Handler: 'index.handler' },
      },
    ];
    const tf: NormalizedResource[] = [
      {
        awsType: 'AWS::Lambda::Function',
        qpqLogicalName: 'fn',
        keyProperties: { Handler: 'index.tfHandler' },
      },
    ];

    const report = compareResources(cdk, tf, mockExpectedDiffs);
    expect(report.propertyDiffs).toHaveLength(1);
    expect(report.unallowedPropertyDiffs).toHaveLength(1);
    expect(isParityPassing(report)).toBe(false);
  });
});
