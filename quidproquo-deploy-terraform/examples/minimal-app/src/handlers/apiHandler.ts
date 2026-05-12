import { QpqFunctionRuntime } from 'quidproquo-core';

export const apiHandler = (event: unknown, context: unknown) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'hello from api' }),
  };
};
