const requests = new Map<string, number[]>();

const LIMIT = 10;
const WINDOW = 60 * 1000;

export function rateLimit(userId: string) {
  const now = Date.now();

  const timestamps = requests.get(userId) ?? [];

  const recentRequests = timestamps.filter(
    (timestamp) => now - timestamp < WINDOW
  );

  if (recentRequests.length >= LIMIT) {
    requests.set(userId, recentRequests);

    return false;
  }

  recentRequests.push(now);
  requests.set(userId, recentRequests);

  return true;
}