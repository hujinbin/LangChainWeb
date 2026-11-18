import { create } from 'zustand';
import { asRecord } from '../types/api';

export interface AuthUser {
  id?: string;
  nickname?: string;
  mobile?: string;
  [key: string]: unknown;
}
interface AuthStore {
  user: AuthUser | null;
  token: string;
  isLoggedIn: boolean;
  login: (user: unknown, token: string) => void;
  logout: () => void;
  getToken: () => string;
}
const normalizeUser = (value: unknown): AuthUser => {
  const user = asRecord(value);
  return {
    ...user,
    id: typeof user.id === 'string' ? user.id : undefined,
    nickname: typeof user.nickname === 'string' ? user.nickname : undefined,
    mobile: typeof user.mobile === 'string' ? user.mobile : undefined,
  };
};
function storedUser(): AuthUser | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem('user') || 'null');
    return raw ? normalizeUser(raw) : null;
  } catch {
    return null;
  }
}
const useAuthStore = create<AuthStore>((set, get) => ({
  // 用户信息
  user: storedUser(),
  token: localStorage.getItem('token') || '',
  isLoggedIn: !!localStorage.getItem('token'),
  // 登录
  login: (value, token) => {
    const user = normalizeUser(value);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    set({ user, token, isLoggedIn: true });
  },
  // 登出
  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ user: null, token: '', isLoggedIn: false });
  },
  // 获取 token
  getToken: () => get().token,
}));
export default useAuthStore;
