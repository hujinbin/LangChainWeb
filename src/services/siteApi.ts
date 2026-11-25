import apiClient from './api';
import { asRecord } from '../types/api';

export interface SiteConfig {
  siteId?: string;
  name?: string;
  logoUrl?: string;
  faviconUrl?: string;
  seo?: { title?: string; description?: string; keywords?: string[] };
  theme?: string;
  announcement?: string;
  planName?: string;
  quotaDescription?: string;
  footerText?: string;
  contact?: { qq?: string; email?: string; wechatQrUrl?: string };
  registerEnabled?: boolean;
  status?: string;
}

export interface SiteConfigEnvelope {
  code: number;
  msg?: string;
  errorCode?: string;
  data: SiteConfig;
}

function normalizeSiteConfig(value: unknown): SiteConfig {
  const row = asRecord(value);
  const seo = asRecord(row.seo);
  const contact = asRecord(row.contact);
  return {
    siteId: typeof row.siteId === 'string' ? row.siteId : undefined,
    name: typeof row.name === 'string' ? row.name : undefined,
    logoUrl: typeof row.logoUrl === 'string' ? row.logoUrl : undefined,
    faviconUrl: typeof row.faviconUrl === 'string' ? row.faviconUrl : undefined,
    seo: {
      title: typeof seo.title === 'string' ? seo.title : undefined,
      description: typeof seo.description === 'string' ? seo.description : undefined,
      keywords: Array.isArray(seo.keywords)
        ? seo.keywords.filter((item): item is string => typeof item === 'string')
        : undefined,
    },
    theme: typeof row.theme === 'string' ? row.theme : undefined,
    planName: typeof row.planName === 'string' ? row.planName : undefined,
    quotaDescription: typeof row.quotaDescription === 'string' ? row.quotaDescription : undefined,
    announcement: typeof row.announcement === 'string' ? row.announcement : undefined,
    footerText: typeof row.footerText === 'string' ? row.footerText : undefined,
    contact: {
      qq: typeof contact.qq === 'string' ? contact.qq : undefined,
      email: typeof contact.email === 'string' ? contact.email : undefined,
      wechatQrUrl: typeof contact.wechatQrUrl === 'string' ? contact.wechatQrUrl : undefined,
    },
    registerEnabled: typeof row.registerEnabled === 'boolean' ? row.registerEnabled : undefined,
    status: typeof row.status === 'string' ? row.status : undefined,
  };
}

export const siteAPI = {
  /** 公开接口：按当前域名返回站点品牌与配置。 */
  config: async (): Promise<SiteConfig> => {
    const response = await apiClient.get<SiteConfigEnvelope>('/api/site/config');
    const payload = response.data;
    if (!payload || payload.code !== 200) {
      const error = new Error(payload?.msg || '站点配置读取失败');
      (error as Error & { errorCode?: string; status?: number }).errorCode =
        payload?.errorCode;
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }
    return normalizeSiteConfig(payload.data);
  },
};
