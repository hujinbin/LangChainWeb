import { create } from 'zustand';

const useAuthStore = create((set, get) => ({
  // 用户信息
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || '',
  isLoggedIn: !!localStorage.getItem('token'),

  // 登录
  login: (user, token) => {
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

  // 获取token
  getToken: () => get().token,
}));

export default useAuthStore;
