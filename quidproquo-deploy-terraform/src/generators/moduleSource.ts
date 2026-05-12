/**
 * Resolver for the `source = "..."` argument on every emitted `module {}`.
 *
 * Per ARCHITECTURE.md §5, the production form is a pinned git ref:
 *
 *   git::https://<host>/<org>/quidproquo-tf-modules.git//modules/<name>?ref=<tag>
 *
 * The default factory below matches that shape. Tests and local dev can
 * inject a different resolver (e.g. a `../../tf-modules/<name>` path).
 */

import { ModuleSourceResolver } from './types';

export const DEFAULT_MODULE_LIBRARY_BASE_URL =
  'git::https://github.com/quidproquo/quidproquo-tf-modules.git';

export const DEFAULT_MODULE_LIBRARY_REF = 'v0.1.0';

export interface DefaultModuleSourceOptions {
  /** Base git URL of the module library. */
  baseUrl?: string;
  /** Tag/branch/sha to pin (`?ref=`). */
  ref?: string;
  /** Subdirectory inside the module library that holds the modules. */
  modulesPath?: string;
}

/**
 * Build a {@link ModuleSourceResolver} for the default git-pinned scheme.
 */
export const createDefaultModuleSource = (
  options: DefaultModuleSourceOptions = {},
): ModuleSourceResolver => {
  const baseUrl = options.baseUrl ?? DEFAULT_MODULE_LIBRARY_BASE_URL;
  const ref = options.ref ?? DEFAULT_MODULE_LIBRARY_REF;
  const modulesPath = options.modulesPath ?? 'modules';
  return (logicalName) => `${baseUrl}//${modulesPath}/${logicalName}?ref=${ref}`;
};

/**
 * Local-path resolver — handy for parity tests and during development when
 * the module library lives alongside this repo at `tf-modules/<name>`.
 */
export const createLocalModuleSource = (basePath = '../tf-modules'): ModuleSourceResolver =>
  (logicalName) => `${basePath}/${logicalName}`;
