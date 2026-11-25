export const officialStudio = 'https://langchain.leheavengame.com';

export function studioOrigins(extra?: string) {
  if (extra) {
    const url = new URL(extra);
    if (url.protocol !== 'https:' || url.username || url.password || url.origin !== extra) {
      throw new Error('WXT_STUDIO_ORIGIN must be an HTTPS origin, without a path.');
    }
  }
  return Array.from(new Set([officialStudio, ...(extra ? [extra] : [])]));
}
