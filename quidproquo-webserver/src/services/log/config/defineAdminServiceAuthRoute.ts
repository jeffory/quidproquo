import { HTTPMethod, QpqFunctionRuntime } from 'quidproquo-core';

import { ApiKeyReference } from '../../../config/settings/apiKey';
import { defineRoute, GenericRouteOptions } from '../../../config/settings/route';
import { getServiceEntryQpqFunctionRuntime } from '../../getServiceEntryQpqFunctionRuntime';

export const defineAdminServiceAuthRoute = (
  apiName: string,
  method: HTTPMethod,
  urlPath: string,
  methodName: string,
  options: GenericRouteOptions<ApiKeyReference | string> = {},
) => {
  const qpqRuntime: QpqFunctionRuntime = getServiceEntryQpqFunctionRuntime('log', 'controller', `loginController::${methodName}`);

  return defineRoute(apiName, method, urlPath, qpqRuntime, options);
};
