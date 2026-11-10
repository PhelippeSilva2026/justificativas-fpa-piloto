export const CHAT_SESSION_TTL_MS = 60 * 60 * 1000;

export function isChatSessionFresh(updatedAt: unknown, now = Date.now()): boolean {
  return (
    typeof updatedAt === 'number' &&
    Number.isFinite(updatedAt) &&
    updatedAt <= now &&
    now - updatedAt <= CHAT_SESSION_TTL_MS
  );
}
