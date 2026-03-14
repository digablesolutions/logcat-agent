import pLimit from 'p-limit';

/**
 * Creates a simple concurrency limiter for asynchronous tasks.  AI calls
 * can be expensive, so this helper ensures only `concurrency` tasks
 * are running at once.
 */
export function makeLimiter(concurrency = 2) {
  const limit = pLimit(concurrency);
  return <T>(task: () => Promise<T>): Promise<T> => limit(task);
}
