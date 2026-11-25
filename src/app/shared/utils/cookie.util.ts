/** 30 days — rolling expiry refreshed on each write */
export const COOKIE_ONE_MONTH_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export function setCookie(name: string, value: string, maxAgeSec = COOKIE_ONE_MONTH_MAX_AGE_SEC): void {
  if (typeof document === 'undefined') {
    return;
  }
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}; Path=/; SameSite=Lax${secure}`;
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const prefix = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split('; ');
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return null;
}

export function deleteCookie(name: string): void {
  setCookie(name, '', 0);
}