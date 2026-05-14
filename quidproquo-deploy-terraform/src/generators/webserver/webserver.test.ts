import { describe, expect, it } from 'vitest';

import { emitBlock } from '../../hcl';
import { QpqConfigFile, ResolvedSynthContext } from '../../synth/types';
import { createDefaultModuleSource } from '../moduleSource';
import {
  ALL_RESOURCE_GENERATORS,
  buildResourceGeneratorRegistry,
  CORE_RESOURCE_GENERATORS,
} from '../registry';
import { GeneratorContext } from '../types';
import {
  apiGenerator,
  apiKeyGenerator,
  cacheGenerator,
  certificateGenerator,
  dnsGenerator,
  domainProxyGenerator,
  serviceFunctionGenerator,
  subdomainRedirectGenerator,
  webEntryGenerator,
  WEBSERVER_RESOURCE_GENERATORS,
  WEBSERVER_SETTING_TYPE,
  websocketGenerator,
} from './index';

const buildCtx = (config: QpqConfigFile, artifactsDir?: string): GeneratorContext => {
  const resolved: ResolvedSynthContext = {
    options: { configPath: '/c', outDir: '/o', env: 'dev', artifactsDir },
    config,
    applicationName: 'myapp',
    moduleName: 'auth',
    environment: 'dev',
    deployAccountId: '0',
    deployRegion: 'us-east-1',
  };
  return {
    resolved,
    moduleSource: createDefaultModuleSource({ ref: 'vTEST' }),
  };
};

const configWith = (
  ...settings: Array<Record<string, unknown> & { configSettingType: string; uniqueKey: string }>
): QpqConfigFile => ({
  qpqConfigVersion: 1,
  settings,
});

describe('apiGenerator', () => {
  it('emits an api module and folds in Routes, DefaultRouteOptions, OpenApi siblings', () => {
    const apiSetting = {
      configSettingType: WEBSERVER_SETTING_TYPE.Api,
      uniqueKey: 'main',
      apiSubdomain: 'api',
      rootDomain: 'example.com',
      apiName: 'main',
    };
    const route = {
      configSettingType: WEBSERVER_SETTING_TYPE.Route,
      uniqueKey: 'r1',
      method: 'GET',
      path: '/health',
      runtime: '/services/health::handler',
    };
    const defaults = {
      configSettingType: WEBSERVER_SETTING_TYPE.DefaultRouteOptions,
      uniqueKey: 'all',
      routeOptions: { allowedOrigins: ['https://example.com'] },
    };
    const openApi = {
      configSettingType: WEBSERVER_SETTING_TYPE.OpenApi,
      uniqueKey: 'spec',
      openApiSpecPath: '/specs/openapi.yaml',
    };
    const ctx = buildCtx(configWith(apiSetting, route, defaults, openApi));

    const out = apiGenerator.generate(apiSetting, ctx);
    expect(out).toHaveLength(1);
    expect(out[0].stack).toBe('api');
    // 1 module block + 3 variable blocks for the route with a runtime
    expect(out[0].blocks).toHaveLength(4);
    const hcl = emitBlock(out[0].blocks[0]);
    expect(hcl).toContain('module "api_main"');
    expect(hcl).toContain('"git::https://github.com/quidproquo/quidproquo-tf-modules.git//modules/api?ref=vTEST"');
    expect(hcl).toContain('"main-myapp-auth-dev-qpqapi"');
    expect(hcl).toContain('"/health"');
    expect(hcl).toContain('routes');
    expect(hcl).toContain('default_route_options');
    expect(hcl).toContain('openapi_spec_paths');
    expect(hcl).toContain('artifact_s3_bucket');
    expect(hcl).toContain('var.api_main_route_get_health_artifact_s3_bucket');
    // variable declarations are emitted alongside the module
    const varHcl = out[0].blocks.slice(1).map(emitBlock).join('\n');
    expect(varHcl).toContain('variable "api_main_route_get_health_artifact_s3_bucket"');
    expect(varHcl).toContain('variable "api_main_route_get_health_artifact_s3_key"');
    expect(varHcl).toContain('variable "api_main_route_get_health_artifact_source_code_hash"');
  });

  it('does not emit artifact vars for routes without a runtime', () => {
    const apiSetting = {
      configSettingType: WEBSERVER_SETTING_TYPE.Api,
      uniqueKey: 'main',
      apiSubdomain: 'api',
      rootDomain: 'example.com',
      apiName: 'main',
    };
    const routeNoRuntime = {
      configSettingType: WEBSERVER_SETTING_TYPE.Route,
      uniqueKey: 'static',
      method: 'GET',
      path: '/static',
      runtime: null,
    };
    const out = apiGenerator.generate(apiSetting, buildCtx(configWith(apiSetting, routeNoRuntime)));
    // only the module block, no variable declarations
    expect(out[0].blocks).toHaveLength(1);
  });

  it('uses source_code_path when artifactsDir is set', () => {
    const apiSetting = {
      configSettingType: WEBSERVER_SETTING_TYPE.Api,
      uniqueKey: 'main',
      apiSubdomain: 'api',
      rootDomain: 'example.com',
      apiName: 'main',
    };
    const route = {
      configSettingType: WEBSERVER_SETTING_TYPE.Route,
      uniqueKey: 'r1',
      method: 'GET',
      path: '/health',
      runtime: '/services/health::handler',
    };
    const out = apiGenerator.generate(
      apiSetting,
      buildCtx(configWith(apiSetting, route), '/artifacts'),
    );
    expect(out[0].blocks).toHaveLength(1);
    const hcl = emitBlock(out[0].blocks[0]);
    expect(hcl).toContain('source_code_path');
    expect(hcl).not.toContain('var.api_main_route_r1_artifact_s3_bucket');
  });

  it('throws when rootDomain is missing', () => {
    const setting = {
      configSettingType: WEBSERVER_SETTING_TYPE.Api,
      uniqueKey: 'main',
      apiSubdomain: 'api',
      apiName: 'main',
    };
    const ctx = buildCtx(configWith(setting));
    expect(() => apiGenerator.generate(setting, ctx)).toThrow(/rootDomain/);
  });
});

describe('apiKeyGenerator', () => {
  it('emits an api-key module', () => {
    const setting = {
      configSettingType: WEBSERVER_SETTING_TYPE.ApiKey,
      uniqueKey: 'partner',
      apiKey: { name: 'partner', description: 'partner integration' },
    };
    const ctx = buildCtx(configWith(setting));
    const out = apiKeyGenerator.generate(setting, ctx);
    expect(out[0].stack).toBe('api');
    const hcl = emitBlock(out[0].blocks[0]);
    expect(hcl).toContain('module "api_key_partner"');
    expect(hcl).toContain('"partner-myapp-auth-dev-qpqapikey"');
    expect(hcl).toContain('"partner integration"');
    expect(hcl).not.toMatch(/^\s*value\s+=/m);
  });
});

describe('cacheGenerator', () => {
  it('emits a cache module with TTL window', () => {
    const setting = {
      configSettingType: WEBSERVER_SETTING_TYPE.Cache,
      uniqueKey: 'short',
      name: 'short',
      cache: {
        minTTLInSeconds: 0,
        maxTTLInSeconds: 60,
        defaultTTLInSeconds: 30,
        mustRevalidate: true,
      },
    };
    const ctx = buildCtx(configWith(setting));
    const out = cacheGenerator.generate(setting, ctx);
    expect(out[0].stack).toBe('web');
    const hcl = emitBlock(out[0].blocks[0]);
    expect(hcl).toContain('module "cache_short"');
    expect(hcl).toMatch(/min_ttl_seconds\s+= 0/);
    expect(hcl).toMatch(/max_ttl_seconds\s+= 60/);
    expect(hcl).toMatch(/default_ttl_seconds\s+= 30/);
    expect(hcl).toMatch(/must_revalidate\s+= true/);
  });
});

describe('certificateGenerator', () => {
  it('emits a certificate module for an apex domain', () => {
    const setting = {
      configSettingType: WEBSERVER_SETTING_TYPE.Certificate,
      uniqueKey: 'trueundefined',
      onRootDomain: true,
      rootDomain: 'example.com',
    };
    const ctx = buildCtx(configWith(setting));
    const out = certificateGenerator.generate(setting, ctx);
    expect(out[0].stack).toBe('web');
    const hcl = emitBlock(out[0].blocks[0]);
    expect(hcl).toContain('module "certificate_trueundefined"');
    expect(hcl).toMatch(/root_domain\s+= "example\.com"/);
    expect(hcl).toMatch(/on_root_domain\s+= true/);
  });

  it('throws when rootDomain is missing', () => {
    const setting = {
      configSettingType: WEBSERVER_SETTING_TYPE.Certificate,
      uniqueKey: 'badcert',
      onRootDomain: true,
    };
    const ctx = buildCtx(configWith(setting));
    expect(() => certificateGenerator.generate(setting, ctx)).toThrow(/rootDomain/);
  });
});

describe('dnsGenerator', () => {
  it('emits a dns module with the base domain (no <app>-<module>-<env> suffix)', () => {
    const setting = {
      configSettingType: WEBSERVER_SETTING_TYPE.Dns,
      uniqueKey: 'example.com',
      dnsBase: 'example.com',
    };
    const ctx = buildCtx(configWith(setting));
    const out = dnsGenerator.generate(setting, ctx);
    expect(out[0].stack).toBe('web');
    const hcl = emitBlock(out[0].blocks[0]);
    expect(hcl).toContain('module "dns_example_com"');
    expect(hcl).toMatch(/dns_base\s+= "example\.com"/);
    expect(hcl).not.toMatch(/^\s*name\s+=/m);
  });
});

describe('domainProxyGenerator', () => {
  it('emits a domain-proxy module', () => {
    const setting = {
      configSettingType: WEBSERVER_SETTING_TYPE.DomainProxy,
      uniqueKey: 'docs',
      name: 'docs',
      domainProxyViewerProtocolPolicy: 'redirect-to-https',
      domain: { rootDomain: 'example.com', subDomainNames: ['docs'], onRootDomain: false },
      httpProxyDomain: 'docs.upstream.example',
      ignoreCache: ['/admin'],
    };
    const ctx = buildCtx(configWith(setting));
    const out = domainProxyGenerator.generate(setting, ctx);
    expect(out[0].stack).toBe('web');
    const hcl = emitBlock(out[0].blocks[0]);
    expect(hcl).toContain('module "domain_proxy_docs"');
    expect(hcl).toMatch(/viewer_protocol_policy\s+= "redirect-to-https"/);
    expect(hcl).toMatch(/http_proxy_domain\s+= "docs\.upstream\.example"/);
    expect(hcl).toMatch(/sub_domain_names\s+= \["docs"\]/);
    expect(hcl).toMatch(/ignore_cache\s+= \["\/admin"\]/);
  });

  it('throws when httpProxyDomain or rootDomain is missing', () => {
    const noProxy = {
      configSettingType: WEBSERVER_SETTING_TYPE.DomainProxy,
      uniqueKey: 'bad',
      name: 'bad',
      domain: { rootDomain: 'example.com', onRootDomain: true },
    };
    expect(() => domainProxyGenerator.generate(noProxy, buildCtx(configWith(noProxy)))).toThrow(
      /httpProxyDomain/,
    );
    const noDomain = {
      configSettingType: WEBSERVER_SETTING_TYPE.DomainProxy,
      uniqueKey: 'bad',
      name: 'bad',
      httpProxyDomain: 'docs.upstream.example',
      domain: {},
    };
    expect(() => domainProxyGenerator.generate(noDomain, buildCtx(configWith(noDomain)))).toThrow(
      /rootDomain/,
    );
  });
});

describe('serviceFunctionGenerator', () => {
  it('emits a service-function module with artefact variable references and declarations', () => {
    const setting = {
      configSettingType: WEBSERVER_SETTING_TYPE.ServiceFunction,
      uniqueKey: 'login',
      functionName: 'login',
      runtime: '/services/login::handler',
    };
    const ctx = buildCtx(configWith(setting));
    const out = serviceFunctionGenerator.generate(setting, ctx);
    expect(out[0].stack).toBe('api');
    // 4 blocks: module + 3 variable declarations
    expect(out[0].blocks).toHaveLength(4);
    const hcl = emitBlock(out[0].blocks[0]);
    expect(hcl).toContain('module "service_function_login"');
    expect(hcl).toContain('"login-myapp-auth-dev-qpqsfunc"');
    expect(hcl).toContain('var.service_function_login_artifact_s3_bucket');
    expect(hcl).toContain('var.service_function_login_artifact_s3_key');
    expect(hcl).toContain('var.service_function_login_artifact_source_code_hash');
    // variable declarations
    const varHcl = out[0].blocks.slice(1).map(emitBlock).join('\n');
    expect(varHcl).toContain('variable "service_function_login_artifact_s3_bucket"');
    expect(varHcl).toContain('variable "service_function_login_artifact_s3_key"');
    expect(varHcl).toContain('variable "service_function_login_artifact_source_code_hash"');
  });

  it('uses source_code_path when artifactsDir is set (no variable blocks)', () => {
    const setting = {
      configSettingType: WEBSERVER_SETTING_TYPE.ServiceFunction,
      uniqueKey: 'login',
      functionName: 'login',
      runtime: '/services/login::handler',
    };
    const ctx = buildCtx(configWith(setting), '/artifacts');
    const out = serviceFunctionGenerator.generate(setting, ctx);
    expect(out[0].blocks).toHaveLength(1);
    const hcl = emitBlock(out[0].blocks[0]);
    expect(hcl).toContain('source_code_path');
    expect(hcl).toContain('/artifacts/login');
    expect(hcl).not.toContain('var.service_function_login_artifact_s3_bucket');
  });
});

describe('subdomainRedirectGenerator', () => {
  it('emits a redirect module', () => {
    const setting = {
      configSettingType: WEBSERVER_SETTING_TYPE.SubdomainRedirect,
      uniqueKey: 'old',
      subdomain: 'old',
      redirectUrl: 'https://new.example.com',
      apiBuildPath: '/build/redirect',
      onRootDomain: false,
      addEnvironment: true,
      addFeatureEnvironment: true,
    };
    const ctx = buildCtx(configWith(setting));
    const out = subdomainRedirectGenerator.generate(setting, ctx);
    expect(out[0].stack).toBe('web');
    const hcl = emitBlock(out[0].blocks[0]);
    expect(hcl).toContain('module "subdomain_redirect_old"');
    expect(hcl).toMatch(/redirect_url\s+= "https:\/\/new\.example\.com"/);
  });

  it('throws when redirectUrl is missing', () => {
    const setting = {
      configSettingType: WEBSERVER_SETTING_TYPE.SubdomainRedirect,
      uniqueKey: 'bad',
      subdomain: 'bad',
    };
    expect(() => subdomainRedirectGenerator.generate(setting, buildCtx(configWith(setting)))).toThrow(
      /redirectUrl/,
    );
  });
});

describe('webEntryGenerator', () => {
  it('emits a web-entry module folding in matching Seo siblings', () => {
    const setting = {
      configSettingType: WEBSERVER_SETTING_TYPE.WebEntry,
      uniqueKey: 'site',
      name: 'site',
      indexRoot: 'index.html',
      storageDrive: { autoUpload: true },
      domain: { rootDomain: 'example.com', subDomainName: 'www', onRootDomain: false },
      compressFiles: true,
    };
    const targetedSeo = {
      configSettingType: WEBSERVER_SETTING_TYPE.Seo,
      uniqueKey: 'home-hash',
      path: '/',
      runtime: '/seo/home::handler',
      webEntry: 'site',
    };
    const otherSeo = {
      configSettingType: WEBSERVER_SETTING_TYPE.Seo,
      uniqueKey: 'other-hash',
      path: '/about',
      runtime: '/seo/about::handler',
      webEntry: 'other-site',
    };
    const untargetedSeo = {
      configSettingType: WEBSERVER_SETTING_TYPE.Seo,
      uniqueKey: 'untargeted-hash',
      path: '/sitemap.xml',
      runtime: '/seo/sitemap::handler',
    };

    const ctx = buildCtx(configWith(setting, targetedSeo, otherSeo, untargetedSeo));
    const out = webEntryGenerator.generate(setting, ctx);
    expect(out[0].stack).toBe('web');
    const hcl = emitBlock(out[0].blocks[0]);
    expect(hcl).toContain('module "web_entry_site"');
    expect(hcl).toContain('"/"');
    expect(hcl).toContain('"/sitemap.xml"');
    expect(hcl).not.toContain('"/about"');
  });

  it('throws when domain.rootDomain is missing', () => {
    const setting = {
      configSettingType: WEBSERVER_SETTING_TYPE.WebEntry,
      uniqueKey: 'site',
      name: 'site',
      storageDrive: { autoUpload: true },
      domain: { onRootDomain: true },
    };
    expect(() => webEntryGenerator.generate(setting, buildCtx(configWith(setting)))).toThrow(
      /rootDomain/,
    );
  });
});

describe('websocketGenerator', () => {
  it('emits a websocket module with the three event-processor runtimes', () => {
    const setting = {
      configSettingType: WEBSERVER_SETTING_TYPE.WebSocket,
      uniqueKey: 'ws.example.com',
      apiSubdomain: 'ws',
      rootDomain: 'example.com',
      onRootDomain: false,
      apiName: 'ws',
      eventProcessors: {
        onConnect: '/services/ws::onConnect',
        onDisconnect: '/services/ws::onDisconnect',
        onMessage: '/services/ws::onMessage',
      },
    };
    const ctx = buildCtx(configWith(setting));
    const out = websocketGenerator.generate(setting, ctx);
    expect(out[0].stack).toBe('api');
    const hcl = emitBlock(out[0].blocks[0]);
    expect(hcl).toContain('module "web_socket_ws_example_com"');
    expect(hcl).toMatch(/on_connect\s+= "\/services\/ws::onConnect"/);
    expect(hcl).toMatch(/on_disconnect\s+= "\/services\/ws::onDisconnect"/);
    expect(hcl).toMatch(/on_message\s+= "\/services\/ws::onMessage"/);
  });
});

describe('webserver registry composition', () => {
  it('WEBSERVER_RESOURCE_GENERATORS has one entry per non-folded setting type', () => {
    const types = WEBSERVER_RESOURCE_GENERATORS.map((g) => g.configSettingType).sort();
    expect(types).toEqual(
      [
        WEBSERVER_SETTING_TYPE.Api,
        WEBSERVER_SETTING_TYPE.ApiKey,
        WEBSERVER_SETTING_TYPE.Cache,
        WEBSERVER_SETTING_TYPE.Certificate,
        WEBSERVER_SETTING_TYPE.Dns,
        WEBSERVER_SETTING_TYPE.DomainProxy,
        WEBSERVER_SETTING_TYPE.ServiceFunction,
        WEBSERVER_SETTING_TYPE.SubdomainRedirect,
        WEBSERVER_SETTING_TYPE.WebEntry,
        WEBSERVER_SETTING_TYPE.WebSocket,
      ].sort(),
    );
  });

  it('Route, OpenApi, DefaultRouteOptions, Seo intentionally have no generator', () => {
    const types = new Set(WEBSERVER_RESOURCE_GENERATORS.map((g) => g.configSettingType));
    expect(types.has(WEBSERVER_SETTING_TYPE.Route)).toBe(false);
    expect(types.has(WEBSERVER_SETTING_TYPE.OpenApi)).toBe(false);
    expect(types.has(WEBSERVER_SETTING_TYPE.DefaultRouteOptions)).toBe(false);
    expect(types.has(WEBSERVER_SETTING_TYPE.Seo)).toBe(false);
  });

  it('ALL_RESOURCE_GENERATORS is core + webserver and produces a duplicate-free registry', () => {
    expect(ALL_RESOURCE_GENERATORS.length).toBe(
      CORE_RESOURCE_GENERATORS.length + WEBSERVER_RESOURCE_GENERATORS.length,
    );
    const registry = buildResourceGeneratorRegistry(ALL_RESOURCE_GENERATORS);
    expect(registry.size).toBe(ALL_RESOURCE_GENERATORS.length);
    for (const setting of WEBSERVER_RESOURCE_GENERATORS) {
      expect(registry.has(setting.configSettingType)).toBe(true);
    }
  });
});
