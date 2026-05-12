import {
  ActionProcessorList,
  ActionProcessorListResolver,
  actionResult,
  actionResultError,
  ErrorTypeEnum,
  EventActionType,
  EventMatchStoryActionProcessor,
  QPQConfig,
} from 'quidproquo-core';
import { qpqWebServerUtils, RouteQPQWebServerConfigSetting } from 'quidproquo-webserver';

import { matchUrl } from '../../../../../awsLambdaUtils';
import { EventInput, InternalEventRecord, MatchResult } from './types';

const getProcessMatchStory = (qpqConfig: QPQConfig): EventMatchStoryActionProcessor<InternalEventRecord, MatchResult, EventInput> => {
  const apiName = process.env.QPQ_API_NAME || '';
  const routes: RouteQPQWebServerConfigSetting[] = qpqWebServerUtils.getAllRoutesForApi(apiName, qpqConfig);

  return async ({ qpqEventRecord }) => {
    // Sort the routes by string length
    // Note: We may need to filter variable routes out {} as the variables are length independent
    const routesWithNoOptions = routes.filter(
      (r: any) =>
        r.method === qpqEventRecord.method || qpqEventRecord.method === 'OPTIONS' || (qpqEventRecord.method === 'HEAD' && r.method === 'GET'),
    );

    // Find the most relevant match
    const sortedRoutes = qpqWebServerUtils.sortPathMatchConfigs(routesWithNoOptions);
    const matchedRoute = sortedRoutes
      .map((r) => ({
        match: matchUrl(r.path, qpqEventRecord.path),
        route: r,
      }))
      .find((m) => m.match.didMatch);

    if (!matchedRoute) {
      return actionResultError(
        ErrorTypeEnum.NotFound,
        `route not found [${qpqEventRecord.path}] - [${qpqWebServerUtils.getHeaderValue('user-agent', qpqEventRecord.headers)}]`,
      );
    }

    const matchResult: MatchResult = {
      runtime: matchedRoute.route.runtime,
      runtimeOptions: matchedRoute.match.params || {},

      config: qpqWebServerUtils.mergeAllRouteOptions(apiName, matchedRoute.route, qpqConfig),
    };

    return actionResult(matchResult);
  };
};

export const getEventMatchStoryActionProcessor: ActionProcessorListResolver = async (qpqConfig: QPQConfig): Promise<ActionProcessorList> => ({
  [EventActionType.MatchStory]: getProcessMatchStory(qpqConfig),
});
