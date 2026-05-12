/**
 * `configSettingType` literals emitted by `quidproquo-webserver`. Mirrored
 * from `quidproquo-webserver/src/config/QPQConfig.ts` so the webserver
 * generators in this directory never have to import the source enum — the
 * JSON shape is the only contract (ARCHITECTURE.md §2.1).
 */
export const WEBSERVER_SETTING_TYPE = {
  Api: '@quidproquo-webserver/config/Api',
  ApiKey: '@quidproquo-webserver/config/ApiKey',
  Cache: '@quidproquo-webserver/config/Cache',
  Certificate: '@quidproquo-webserver/config/Certificate',
  DefaultRouteOptions: '@quidproquo-webserver/config/DefaultRouteOptions',
  Dns: '@quidproquo-webserver/config/Dns',
  DomainProxy: '@quidproquo-webserver/config/DomainProxy',
  OpenApi: '@quidproquo-webserver/config/OpenApi',
  Route: '@quidproquo-webserver/config/Route',
  Seo: '@quidproquo-webserver/config/Seo',
  ServiceFunction: '@quidproquo-webserver/config/ServiceFunction',
  SubdomainRedirect: '@quidproquo-webserver/config/SubdomainRedirect',
  WebEntry: '@quidproquo-webserver/config/WebEntry',
  WebSocket: '@quidproquo-webserver/config/WebSocket',
} as const;
