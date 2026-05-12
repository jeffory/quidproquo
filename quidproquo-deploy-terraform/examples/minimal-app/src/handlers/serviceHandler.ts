export const handler = (event: unknown, context: unknown) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'hello from service function' }),
  };
};
