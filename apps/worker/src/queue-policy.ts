/** A slow annual source request must leave a slot for routine TV updates.
 * Job starts remain spaced to respect the existing reporting rate limit.
 */
export const dashboardQueuePolicy = {
  concurrency: 2,
  limiter: { max: 1, duration: 65_000 },
} as const;
