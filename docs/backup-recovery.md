# Backup and Recovery Runbook

This document covers recovery procedures for all persistent data stores in the QuidProQuo AWS infrastructure. It is intended for operators responding to data loss or corruption incidents.

---

## Data Stores and Backup Summary

| Data Store | CDK Construct | Backup Mechanism | Retention |
|---|---|---|---|
| S3 (storage drives) | `QpqCoreStorageDriveConstruct` | Versioning | Indefinite (no expiry by default) |
| S3 (web entry assets) | `WebQpqWebserverWebEntryConstruct` | Versioning | Indefinite |
| DynamoDB | `QpqCoreKeyValueStoreConstruct` | Point-in-time recovery (PITR) | 35 days |
| Neptune | `QpqCoreApiGraphDatabaseConstruct` | Automated snapshots | 7 days |

> **Cross-region replication (CRR):** Not yet implemented. Until CRR is in place, recovery from a full regional failure requires manual steps using the procedures in the [Disaster Recovery Playbook](#disaster-recovery-playbook) section below.

---

## RTO / RPO Targets

| Data Store | RPO (Recovery Point Objective) | RTO (Recovery Time Objective) |
|---|---|---|
| S3 | Near-zero (versioning preserves every object version) | < 15 minutes for object-level restore |
| DynamoDB | ≤ 5 minutes (PITR continuous backup) | < 1 hour for full table restore; < 15 minutes for selective restore |
| Neptune | ≤ 24 hours (daily automated snapshot) | 1–4 hours for cluster restore from snapshot |
| Full region failover | Dependent on CRR implementation (not yet available) | Not yet defined — tracked in HOM-44 |

---

## 1. S3 Bucket Recovery

All buckets created by `QpqCoreStorageDriveConstruct` and `WebQpqWebserverWebEntryConstruct` have versioning enabled. Every `PUT` and `DELETE` creates a new version; no data is permanently lost until a version is explicitly deleted.

### 1a. Restore a deleted object

When an object is deleted, S3 inserts a *delete marker* as the current version. Restoring is as simple as removing that marker.

**AWS Console**
1. Navigate to **S3 → \<bucket-name\> → Objects**.
2. Click **Show versions** toggle.
3. Locate the delete marker (type = *Delete marker*) for the object key.
4. Select it and choose **Delete** → **Permanently delete**.
5. The previous version becomes current immediately.

**AWS CLI**
```bash
# List versions to find the delete marker version ID
aws s3api list-object-versions \
  --bucket <bucket-name> \
  --prefix <object-key>

# Delete the delete marker to restore the object
aws s3api delete-object \
  --bucket <bucket-name> \
  --key <object-key> \
  --version-id <delete-marker-version-id>
```

### 1b. Restore an overwritten object to a previous version

**AWS Console**
1. Navigate to **S3 → \<bucket-name\> → Objects**.
2. Click **Show versions**.
3. Find the desired older version and click its **Version ID**.
4. Click **Download** to retrieve it, then re-upload to overwrite the current version.

**AWS CLI**
```bash
# List all versions of an object
aws s3api list-object-versions \
  --bucket <bucket-name> \
  --prefix <object-key>

# Copy the target version over itself (promotes it to current)
aws s3api copy-object \
  --bucket <bucket-name> \
  --copy-source "<bucket-name>/<object-key>?versionId=<version-id>" \
  --key <object-key>
```

### 1c. Bulk restore (prefix or bucket-level)

For large-scale recovery, use an S3 Batch Operations job:
1. Create a manifest of affected object versions using `s3api list-object-versions`.
2. Submit an S3 Batch Operations job with the **Restore object** operation.
3. Monitor the job in **S3 → Batch Operations**.

---

## 2. DynamoDB Point-in-Time Recovery (PITR)

All DynamoDB tables created by `QpqCoreKeyValueStoreConstruct` have PITR enabled by default. PITR allows restoring a table to any second within the last 35 days.

PITR restores create a **new table**; they do not overwrite the existing table. Once the restore completes, update application configuration (or CDK) to point at the restored table, or copy data back using AWS Glue / Data Pipeline.

### 2a. Restore a table to a specific timestamp

**AWS Console**
1. Navigate to **DynamoDB → Tables → \<table-name\>**.
2. Select the **Backups** tab.
3. Under **Point-in-time recovery**, click **Restore to point in time**.
4. Enter the target date and time (UTC).
5. Provide a new table name (e.g., `<original-name>-restored-<date>`).
6. Click **Restore**.
7. Wait for the restore to complete (status → *Active*). Estimated time: 1–2 minutes per GB.

**AWS CLI**
```bash
# Restore to a specific timestamp (ISO 8601 UTC)
aws dynamodb restore-table-to-point-in-time \
  --source-table-name <original-table-name> \
  --target-table-name <original-table-name>-restored \
  --restore-date-time "2026-05-13T10:30:00Z"

# Monitor restore progress
aws dynamodb describe-table \
  --table-name <original-table-name>-restored \
  --query "Table.TableStatus"
```

### 2b. Swap restored table into production

PITR creates a new table; it does not modify the source. After verifying the restored table, you have two options:

**Option A — Config override (preferred for QPQ)**

Use `getDynamoTableNameOverrride` in `qpqConfigAwsUtils` to point the QPQ config at the restored table without a CDK redeploy.

**Option B — Data migration**

Export items from the restored table and import into the live table using `aws dynamodb export-table-to-point-in-time` or a custom script.

---

## 3. Neptune Automated Snapshot Restore

Neptune clusters created by `QpqCoreApiGraphDatabaseConstruct` have automated backups with a 7-day retention window. Snapshots are taken daily during the configured backup window.

Neptune restores create a **new cluster**. Endpoint changes require updating QPQ config or re-deploying CDK.

### 3a. List available automated snapshots

**AWS Console**
1. Navigate to **Amazon Neptune → Snapshots**.
2. Filter by cluster identifier (matches `QpqCoreApiGraphDatabaseConstruct` resource name).
3. Note the snapshot identifier and creation time for your target restore point.

**AWS CLI**
```bash
aws neptune describe-db-cluster-snapshots \
  --db-cluster-identifier <cluster-id> \
  --snapshot-type automated \
  --query "DBClusterSnapshots[*].{ID:DBClusterSnapshotIdentifier,Time:SnapshotCreateTime,Status:Status}" \
  --output table
```

### 3b. Restore a cluster from an automated snapshot

**AWS Console**
1. In the **Snapshots** list, select the target snapshot.
2. Click **Actions → Restore cluster**.
3. Provide a new cluster identifier (e.g., `<original-id>-restored`).
4. Select the same VPC and subnet group as the original cluster.
5. Click **Restore Neptune cluster**.
6. Wait for the cluster status to reach *Available* (typically 15–45 minutes).
7. Update the QPQ config or CDK stack to use the new cluster endpoint.

**AWS CLI**
```bash
aws neptune restore-db-cluster-from-snapshot \
  --db-cluster-identifier <original-cluster-id>-restored \
  --snapshot-identifier <snapshot-id> \
  --engine neptune \
  --vpc-security-group-ids <sg-id> \
  --db-subnet-group-name <subnet-group-name>

# Add a DB instance to the restored cluster
aws neptune create-db-instance \
  --db-instance-identifier <restored-cluster-id>-instance \
  --db-cluster-identifier <original-cluster-id>-restored \
  --db-instance-class db.serverless \
  --engine neptune

# Monitor cluster status
aws neptune describe-db-clusters \
  --db-cluster-identifier <original-cluster-id>-restored \
  --query "DBClusters[0].Status"
```

### 3c. Point QPQ to the restored Neptune cluster

Update the `graphDatabaseConfig.virualNetworkName` reference in CDK or override the endpoint via environment config, then redeploy the affected stacks:

```bash
npm run build -w quidproquo-deploy-awscdk
cdk deploy <stack-name>
```

---

## 4. Disaster Recovery Playbook

> **Current state:** Cross-region replication (CRR) is not yet implemented (tracked in HOM-44). The steps below describe a **manual cold-region failover** using the backup mechanisms above. Once CRR is in place, this section will be updated with warm-standby procedures.

### Scope

A regional failure (full AWS region outage or severe data corruption across all data stores in a single region) requires standing up infrastructure in a secondary region and restoring data from the most recent backups.

### Prerequisites

- AWS credentials with permissions to create resources in both primary and secondary regions.
- The secondary region must have VPC, subnets, and security groups pre-created (or CDK must be able to deploy them).
- CDK bootstrap must be run in the secondary region.

### Failover Steps

1. **Declare incident and notify stakeholders.** Identify the scope (single data store vs. full region) before starting recovery.

2. **Bootstrap CDK in the secondary region** (if not already done):
   ```bash
   cdk bootstrap aws://<account-id>/<secondary-region>
   ```

3. **Deploy infrastructure to the secondary region:**
   ```bash
   AWS_REGION=<secondary-region> cdk deploy --all
   ```

4. **Restore DynamoDB tables:**
   - For each table, use PITR to restore to the last known good timestamp (see [Section 2](#2-dynamodb-point-in-time-recovery-pitr)).
   - Note that PITR cross-region restore requires manual export/import until native cross-region PITR is configured.

5. **Restore S3 data:**
   - Use `aws s3 sync` with `--source-region` to copy bucket contents to secondary-region buckets:
     ```bash
     aws s3 sync s3://<source-bucket> s3://<dest-bucket> \
       --source-region <primary-region> \
       --region <secondary-region>
     ```

6. **Restore Neptune:**
   - Export the most recent automated snapshot to S3, then restore in the secondary region:
     ```bash
     # Copy snapshot to secondary region
     aws neptune copy-db-cluster-snapshot \
       --source-db-cluster-snapshot-identifier arn:aws:rds:<primary-region>:<account-id>:cluster-snapshot:<snapshot-id> \
       --target-db-cluster-snapshot-identifier <snapshot-id>-<secondary-region> \
       --source-region <primary-region> \
       --region <secondary-region>

     # Then restore using the copied snapshot (see Section 3b)
     ```

7. **Update DNS / routing:**
   - Update Route 53 records or CloudFront origins to point to the secondary-region endpoints.
   - For QPQ webserver stacks, redeploy CDK in the secondary region with the updated domain config.

8. **Validate recovery:**
   - Run smoke tests against the secondary-region endpoints.
   - Confirm data integrity for critical tables and objects.

9. **Communicate status** to stakeholders and update the incident log.

### Failback (returning to primary region)

Once the primary region is restored:
1. Sync any data written to the secondary region back to the primary using the same `aws s3 sync` and DynamoDB export/import approach.
2. Redeploy CDK stacks in the primary region.
3. Update DNS to route traffic back to the primary region.
4. Decommission secondary-region resources to avoid ongoing costs.

---

## 5. Verification and Testing

Backup mechanisms are only as reliable as their last verified restore. Recommended testing cadence:

| Test | Frequency | Owner |
|---|---|---|
| S3 object restore (single object) | Monthly | On-call operator |
| DynamoDB PITR restore to test table | Monthly | On-call operator |
| Neptune snapshot restore to test cluster | Quarterly | On-call operator |
| Full disaster recovery drill | Annually | Engineering lead |

Record test results and any issues in the incident log.

---

## 6. Finding Resource Names

QPQ resource names follow the pattern defined in `QpqConstructBlock.qpqResourceName`. To find the exact AWS resource name for a given QPQ config:

```bash
# DynamoDB table name
aws dynamodb list-tables --query "TableNames[?contains(@, '<environment>')]"

# S3 bucket name
aws s3 ls | grep <environment>

# Neptune cluster identifier
aws neptune describe-db-clusters \
  --query "DBClusters[*].DBClusterIdentifier" --output text | tr '\t' '\n' | grep <environment>
```

Replace `<environment>` with your QPQ application/environment string (e.g., `my-app-prod`).

---

*Last updated: 2026-05-13. Human review and sign-off required before this document is considered production-ready.*
