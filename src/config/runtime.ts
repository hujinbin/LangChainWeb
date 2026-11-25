// 读取页面加载前注入的运行时配置，构建期环境变量只作为兜底。
export interface RuntimeConfig {
  apiBaseUrl?: string;
  siteId?: string;
  partnerPath?: string;
  brandName?: string;
  logoUrl?: string;
  faviconUrl?: string;
  defaultTheme?: 'auto' | 'light' | 'dark';
  helpUrl?: string;
  qqGroup?: string;
}

declare global {
  interface Window {
    __JUE_CONFIG__?: RuntimeConfig;
  }
}

const read = (): RuntimeConfig => {
  const scope = globalThis as typeof globalThis & {
    __JUE_CONFIG__?: RuntimeConfig;
  };
  const value = scope.__JUE_CONFIG__;
  return value && typeof value === 'object' ? value : {};
};

const trimUrl = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';

export const RUNTIME_CONFIG: RuntimeConfig = read();

// 运行时配置优先，构建期 REACT_APP_API_URL 仅用于本地开发兜底。
export const API_BASE_URL =
  trimUrl(RUNTIME_CONFIG.apiBaseUrl) ||
  trimUrl(process.env.REACT_APP_API_URL);

export const SITE_ID =
  typeof RUNTIME_CONFIG.siteId === 'string' ? RUNTIME_CONFIG.siteId.trim() : '';

// Local aliases redirect to the canonical path so the partner cookie stays on /partner/.
const partnerPath = typeof RUNTIME_CONFIG.partnerPath === 'string' ? RUNTIME_CONFIG.partnerPath.trim() : '';
export const PARTNER_PATH =
  /^\/(?!admin(?:\/|$)|api(?:\/|$))[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(partnerPath)
    ? partnerPath.replace(/\/?$/, '/') : '/partner/';

export const DEFAULT_THEME = RUNTIME_CONFIG.defaultTheme || 'auto';
