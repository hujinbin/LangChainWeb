import { create } from 'zustand';
import { SITE } from '../config/site';
import { siteAPI } from '../services/siteApi';
import { applySiteTheme } from './themeStore';
import type { SiteConfig } from '../services/siteApi';

interface SiteState {
  config: SiteConfig | null;
  loaded: boolean;
  /** 域名未登记或站点停用时的可读提示，空字符串表示可正常访问。 */
  blocked: string;
  load: () => Promise<void>;
}

const SITE_BLOCK_CODES = ['SITE_NOT_REGISTERED', 'SITE_DISABLED', 'SITE_NOT_FOUND'];

function blockMessage(error: unknown): string {
  const detail = error as { errorCode?: string; status?: number; message?: string };
  const http = (error as {response?: {status?: number; data?: {errorCode?: string}}})?.response;
  const code = detail?.errorCode || http?.data?.errorCode;
  if (code && SITE_BLOCK_CODES.includes(code)) {
    return code === 'SITE_DISABLED'
      ? '该站点已暂停服务，请联系站点管理员。'
      : '当前域名尚未登记到任何站点，请确认部署域名或联系站点管理员。';
  }
  if (detail?.status === 403) return detail.message || '当前域名无权访问该服务。';
  return '';
}

export const useSiteStore = create<SiteState>((set, get) => ({
  config: null,
  loaded: false,
  blocked: '',
  load: async () => {
    if (get().loaded) return;
    try {
      const config = await siteAPI.config();
      applySiteTheme(config.theme);
      if (config.name) SITE.name = config.name;
      if (config.logoUrl) SITE.logoUrl = config.logoUrl;
      if (config.contact?.qq) SITE.qqGroup = config.contact.qq;
      set({ config, loaded: true, blocked: '' });
    } catch (error) {
      // 站点配置接口不可用时继续使用运行时配置兜底，只有明确拒绝才展示维护提示。
      set({ loaded: true, blocked: blockMessage(error) });
    }
  },
}));
