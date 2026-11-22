import { asRecord } from './api';

export interface UserProfile {
  id?: string;
  nickname?: string;
  headImg?: string;
  mobile?: string;
  bio?: string;
  introduce?: string;
  job?: string;
  company?: string;
  homepage?: string;
  verified?: boolean;
  articleNum?: number;
  fans?: number;
  focu?: number;
  like?: number;
  tag?: number;
  role?: number;
  loginType?: string;
  hasPassword?: boolean;
  canResetPassword?: boolean;
  meta?: { registTime?: string; loginTime?: string };
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;
const count = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export function normalizeUserProfile(value: unknown): UserProfile {
  const raw = asRecord(value);
  const meta = asRecord(raw.meta);
  return {
    id: text(raw._id) || text(raw.id),
    nickname: text(raw.nickname),
    headImg: text(raw.headImg),
    mobile: text(raw.mobile),
    bio: text(raw.bio),
    introduce: text(raw.introduce),
    job: text(raw.job),
    company: text(raw.company),
    homepage: text(raw.homepage),
    verified: raw.verified === true,
    articleNum: count(raw.articleNum),
    fans: count(raw.fans),
    focu: count(raw.focu),
    like: count(raw.like),
    tag: count(raw.tag),
    role: count(raw.role),
    loginType: text(raw.loginType),
    hasPassword: raw.hasPassword === true,
    canResetPassword: raw.canResetPassword === true,
    meta: {
      registTime: text(meta.registTime),
      loginTime: text(meta.loginTime),
    },
  };
}

export const displayUserName = (profile: UserProfile | null, fallback = '用户') =>
  profile?.nickname || profile?.mobile || fallback;

export const maskMobile = (mobile?: string) =>
  mobile && /^\d{11}$/.test(mobile)
    ? `${mobile.slice(0, 3)}****${mobile.slice(7)}`
    : mobile || '未绑定';

export const formatUserDate = (value?: string) => {
  if (!value) return '未记录';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '未记录'
    : date.toLocaleString('zh-CN', { hour12: false });
};

export const safeHomepage = (homepage?: string) =>
  homepage && /^https?:\/\//i.test(homepage) ? homepage : '';
