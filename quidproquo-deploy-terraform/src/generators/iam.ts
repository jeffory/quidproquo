/**
 * Per-service runtime IAM role + grant policies.
 *
 * QPQ infers permissions today from story dependencies (ARCHITECTURE.md §8 and
 * HOM-23): a `service-function` that yields a `KeyValueStore` action gets read
 * (or write, or both) on that table. The Terraform translator preserves that
 * by emitting a single `service-role` module per (application, module,
 * environment) tuple and passing the inferred grant lists as inputs. The
 * module body owns the IAM policy document so compliance can change it
 * without an app rebuild.
 *
 * For HOM-57 the dependency graph from `qpq.config.json` is not yet wired
 * (that's HOM-58's job for the webserver layer); this generator emits the
 * role module with empty grant arrays so the rest of the synth output is
 * coherent and downstream stacks can reference its outputs.
 */

import { attrs, moduleBlock } from '../hcl';
import { TerraformBlock } from '../hcl/types';
import { ResolvedSynthContext } from '../synth/types';
import { getConfigRuntimeResourceName } from './naming';
import { GeneratorContext } from './types';

const MODULE_LOGICAL_NAME = 'service-role';
const MODULE_LABEL = 'service_role';

/**
 * Map of grant name (input variable on the `service-role` module) to the list
 * of fully-qualified runtime resource names the role should be granted access
 * to. Values are the strings returned by {@link getConfigRuntimeResourceName}
 * (or `getQpqRuntimeResourceName` for KVS / GraphDatabase tables).
 */
export interface RuntimeAccessGrants {
  kvs_read?: string[];
  kvs_write?: string[];
  storage_drive_read?: string[];
  storage_drive_write?: string[];
  queue_send?: string[];
  queue_receive?: string[];
  event_bus_publish?: string[];
  event_bus_subscribe?: string[];
  secret_read?: string[];
  parameter_read?: string[];
  user_directory_admin?: string[];
  graph_database_read?: string[];
  graph_database_write?: string[];
}

const namingContextFromResolved = (resolved: ResolvedSynthContext) => ({
  applicationName: resolved.applicationName,
  moduleName: resolved.moduleName,
  environment: resolved.environment,
});

/**
 * Build the canonical runtime role name — `service-role-<app>-<svc>-<env>` —
 * matching the CDK side (`QpqConstructBlock.getServiceRole` uses
 * `resourceName('service-role')`).
 */
export const buildServiceRoleName = (resolved: ResolvedSynthContext): string =>
  getConfigRuntimeResourceName('service-role', namingContextFromResolved(resolved));

/**
 * Emit a `service-role` module call wired with the supplied grants. The
 * module owns the IAM policy document syntax; we only pass the deduplicated
 * resource-name lists per grant kind.
 */
export const generateServiceRoleModule = (
  ctx: GeneratorContext,
  grants: RuntimeAccessGrants = {},
): TerraformBlock => {
  const dedup = (values?: string[]) => (values ? Array.from(new Set(values)).sort() : []);

  return moduleBlock({
    name: MODULE_LABEL,
    source: ctx.moduleSource(MODULE_LOGICAL_NAME),
    attributes: attrs({
      role_name: buildServiceRoleName(ctx.resolved),
      kvs_read: dedup(grants.kvs_read),
      kvs_write: dedup(grants.kvs_write),
      storage_drive_read: dedup(grants.storage_drive_read),
      storage_drive_write: dedup(grants.storage_drive_write),
      queue_send: dedup(grants.queue_send),
      queue_receive: dedup(grants.queue_receive),
      event_bus_publish: dedup(grants.event_bus_publish),
      event_bus_subscribe: dedup(grants.event_bus_subscribe),
      secret_read: dedup(grants.secret_read),
      parameter_read: dedup(grants.parameter_read),
      user_directory_admin: dedup(grants.user_directory_admin),
      graph_database_read: dedup(grants.graph_database_read),
      graph_database_write: dedup(grants.graph_database_write),
      tags: {
        application: ctx.resolved.applicationName,
        module: ctx.resolved.moduleName,
        environment: ctx.resolved.environment,
        qpq_setting_type: 'serviceRole',
      },
    }),
  });
};
