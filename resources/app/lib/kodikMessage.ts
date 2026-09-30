export function isTrustedPlayerMessage(
  event: Pick<MessageEvent, 'source' | 'origin'>,
  frame: Window | null,
  playerUrl: string | null,
): boolean {
  if (!frame || event.source !== frame || !playerUrl) return false;
  try {
    const url = new URL(playerUrl);
    return ['https:', 'http:'].includes(url.protocol) && event.origin === url.origin;
  } catch {
    return false;
  }
}

