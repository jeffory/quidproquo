import { ResourceGenerator } from '../types';
import { apiGenerator } from './api';
import { apiKeyGenerator } from './apiKey';
import { cacheGenerator } from './cache';
import { certificateGenerator } from './certificate';
import { dnsGenerator } from './dns';
import { domainProxyGenerator } from './domainProxy';
import { serviceFunctionGenerator } from './serviceFunction';
import { subdomainRedirectGenerator } from './subdomainRedirect';
import { webEntryGenerator } from './webEntry';
import { websocketGenerator } from './websocket';

export * from './api';
export * from './apiKey';
export * from './cache';
export * from './certificate';
export * from './dns';
export * from './domainProxy';
export * from './serviceFunction';
export * from './settingTypes';
export * from './subdomainRedirect';
export * from './webEntry';
export * from './websocket';

/**
 * All webserver-layer generators registered by HOM-58. Setting types that
 * fold into another (Route → Api, Seo → WebEntry, OpenApi → Api,
 * DefaultRouteOptions → Api) are intentionally absent; the host generator
 * reads them off the full settings list inside its `generate` call.
 *
 * The synth pipeline composes this list with `CORE_RESOURCE_GENERATORS`
 * (HOM-57) when building the dispatch registry.
 */
export const WEBSERVER_RESOURCE_GENERATORS: readonly ResourceGenerator[] = [
  apiGenerator,
  apiKeyGenerator,
  cacheGenerator,
  certificateGenerator,
  dnsGenerator,
  domainProxyGenerator,
  serviceFunctionGenerator,
  subdomainRedirectGenerator,
  webEntryGenerator,
  websocketGenerator,
];
