import { studioOrigins } from './studio-origins';

const origins = studioOrigins(import.meta.env.WXT_STUDIO_ORIGIN);
export function isStudioUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return !u.username && !u.password && (origins.includes(u.origin) ||
      (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)));
  } catch { return false; }
}
