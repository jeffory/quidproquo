export const handler = (event: unknown, context: unknown) => {
  console.log('queue event', event);
  return { batchItemFailures: [] };
};
