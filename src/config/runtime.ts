// 读取页面加载前注入的运行时配置，构建期环境变量只作为兜底。
export interface RuntimeConfig {
  apiBaseUrl?: string;
  siteId?: string;
  adminPath?: string;
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

export const ADMIN_PATH =
  (typeof RUNTIME_CONFIG.adminPath === 'string' && RUNTIME_CONFIG.adminPath.trim()) ||
  '/admin';

export const DEFAULT_THEME = RUNTIME_CONFIG.defaultTheme || 'auto';
