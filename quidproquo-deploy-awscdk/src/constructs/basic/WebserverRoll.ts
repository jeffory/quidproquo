import { qpqConfigAwsUtils } from 'quidproquo-config-aws';
import { qpqCoreUtils } from 'quidproquo-core';

import { aws_iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { QpqConstructBlock, QpqConstructBlockProps } from '../base/QpqConstructBlock';

export interface WebserverRollProps extends QpqConstructBlockProps {}

export class WebserverRoll extends QpqConstructBlock {
  role: aws_iam.IRole;

  constructor(scope: Construct, id: string, props: WebserverRollProps) {
    super(scope, id, props);

    const region = qpqConfigAwsUtils.getApplicationModuleDeployRegion(props.qpqConfig);
    const accountId = qpqConfigAwsUtils.getApplicationModuleDeployAccountId(props.qpqConfig);
    const applicationName = qpqCoreUtils.getApplicationName(props.qpqConfig);
    const environment = qpqCoreUtils.getApplicationModuleEnvironment(props.qpqConfig);

    // Resource names follow `<resource>-<application>-<module>-<environment>[-<feature>]`
    // (see awsNamingUtils.getConfigRuntimeResourceName). Scope wildcard ARNs
    // to this application + environment so the role cannot reach resources
    // owned by other applications or environments in the same account.
    const appResourceSuffix = `-${applicationName}-*-${environment}*`;

    const role = new aws_iam.Role(this, 'role', {
      roleName: this.resourceName('service-role'),
      assumedBy: new aws_iam.CompositePrincipal(
        new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
        new aws_iam.ServicePrincipal('transfer.amazonaws.com'),
        new aws_iam.ServicePrincipal('edgelambda.amazonaws.com'),
        // new aws_iam.ServicePrincipal('neptune.amazonaws.com'),
      ),
    });

    const policies: aws_iam.PolicyStatementProps[] = [
      // cloudformation:ListExports does not support resource-level
      // permissions; restrict to this region instead.
      {
        sid: 'CloudFormationListExports',
        actions: ['cloudformation:ListExports'],
        resources: ['*'],
        conditions: {
          StringEquals: { 'aws:RequestedRegion': region },
        },
      },

      {
        sid: 'APIGatewayGetOperations',
        actions: ['apigateway:GET'],
        resources: [`arn:aws:apigateway:${region}::/*`],
      },

      {
        sid: 'CloudFrontCreateInvalidation',
        actions: ['cloudfront:CreateInvalidation'],
        resources: [`arn:aws:cloudfront::${accountId}:distribution/*`],
      },

      {
        sid: 'SNSPublishMessages',
        actions: ['sns:Publish'],
        resources: [
          `arn:aws:sns:${region}:${accountId}:*${appResourceSuffix}`,
          `arn:aws:sns:${region}:${accountId}:*-${applicationName}-${environment}*`,
        ],
      },

      {
        sid: 'LambdaInvokeFunction',
        actions: ['lambda:InvokeFunction'],
        resources: [`arn:aws:lambda:${region}:${accountId}:function:*sfunc*`],
      },

      {
        sid: 'S3BucketOperations',
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
        resources: [
          `arn:aws:s3:::*${appResourceSuffix}`,
          `arn:aws:s3:::*${appResourceSuffix}/*`,
        ],
      },

      {
        sid: 'APIGatewayManageConnections',
        actions: ['execute-api:ManageConnections'],
        resources: [`arn:aws:execute-api:${region}:${accountId}:*/*/*/@connections/*`],
      },

      // acm:ListCertificates does not support resource-level permissions;
      // restrict to this region. DescribeCertificate supports resource ARNs.
      {
        sid: 'ACMListCertificates',
        actions: ['acm:ListCertificates'],
        resources: ['*'],
        conditions: {
          StringEquals: { 'aws:RequestedRegion': region },
        },
      },
      {
        sid: 'ACMDescribeCertificate',
        actions: ['acm:DescribeCertificate'],
        resources: [`arn:aws:acm:${region}:${accountId}:certificate/*`],
      },

      {
        sid: 'DynamoDBTableOperations',
        actions: [
          'dynamodb:GetItem',
          'dynamodb:Scan',
          'dynamodb:Query',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
        ],
        resources: [
          `arn:aws:dynamodb:${region}:${accountId}:table/*${appResourceSuffix}`,
          `arn:aws:dynamodb:${region}:${accountId}:table/*${appResourceSuffix}/index/*`,
        ],
      },

      {
        sid: 'CloudWatchLogsManagement',
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:DescribeLogGroups',
          'logs:DescribeLogStreams',
          'logs:PutLogEvents',
          'logs:GetLogEvents',
          'logs:FilterLogEvents',
        ],
        resources: [
          `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/*${appResourceSuffix}`,
          `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/*${appResourceSuffix}:*`,
          `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/*${appResourceSuffix}:log-stream:*`,
        ],
      },

      // AWS Lambda manages VPC ENIs on the customer's behalf and requires
      // these actions on '*'. Restrict to this region.
      // https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html
      {
        sid: 'EC2NetworkInterfacePermissions',
        actions: [
          'ec2:CreateNetworkInterface',
          'ec2:DescribeNetworkInterfaces',
          'ec2:DeleteNetworkInterface',
          'ec2:AssignPrivateIpAddresses',
          'ec2:UnassignPrivateIpAddresses',
        ],
        resources: ['*'],
        conditions: {
          StringEquals: { 'aws:RequestedRegion': region },
        },
      },

      // Only the Textract action actually called by this codebase
      // (AnalyzeExpense in textract/analyzeExpense.ts). Textract APIs do not
      // support resource-level permissions, so restrict by region.
      {
        sid: 'TextractDocumentProcessing',
        actions: ['textract:AnalyzeExpense'],
        resources: ['*'],
        conditions: {
          StringEquals: { 'aws:RequestedRegion': region },
        },
      },
    ];

    policies.forEach((policy) => {
      role.addToPolicy(new aws_iam.PolicyStatement(policy));
    });

    this.role = role;
  }
}
