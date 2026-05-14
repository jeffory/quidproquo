import { defineApplication, defineEnvironmentSettings, defineModule } from 'quidproquo-core';

export const qpqConfig = [
  defineApplication('minimal-app', 'dev', '/config'),
  defineModule('core'),
  defineEnvironmentSettings('dev', []),
  defineEnvironmentSettings('prod', []),
];
