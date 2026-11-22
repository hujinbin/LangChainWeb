import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCheckCircle,
  FiImage,
  FiLogOut,
  FiMonitor,
  FiMoon,
  FiRefreshCw,
  FiSave,
  FiShield,
  FiSun,
  FiUser,
} from 'react-icons/fi';
import { userAPI } from '../../services/api';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import type { ThemeMode } from '../../store/themeStore';
import { normalizeError } from '../../types/api';
import { formatUserDate, maskMobile } from '../../types/user';
import {
  UserAvatar,
  UserCenterGuest,
  useUserProfile,
} from './UserCenterShared';
import './UserCenter.css';

const THEME_OPTIONS: {
  mode: ThemeMode;
  label: string;
  description: string;
  icon: typeof FiSun;
}[] = [
  { mode: 'auto', label: '跟随系统', description: '随系统深浅色自动切换', icon: FiMonitor },
  { mode: 'light', label: '浅色', description: '始终使用浅色界面', icon: FiSun },
  { mode: 'dark', label: '深色', description: '始终使用深色界面', icon: FiMoon },
];

export default function Settings() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const token = useAuthStore((state) => state.token);
  const authUser = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);
  const { profile, loading, error, reload } = useUserProfile();

  const [nickname, setNickname] = useState('');
  const [headImg, setHeadImg] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [profileError, setProfileError] = useState('');

  const [passwordForm, setPasswordForm] = useState({
    password: '',
    newPassword: '',
    confirm: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!profile) return;
    setNickname(profile.nickname || '');
    setHeadImg(profile.headImg || '');
  }, [profile]);

  const needsOldPassword = !(
    profile?.loginType === 'wechat' && profile?.canResetPassword
  );

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileError('请选择图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('图片大小不能超过 5MB');
      return;
    }
    setUploading(true);
    setProfileError('');
    setProfileNotice('');
    try {
      const response = await userAPI.uploadImage(file);
      if (!response.data) throw new Error('上传结果缺少图片地址');
      setHeadImg(response.data);
      setProfileNotice('头像已上传，点击「保存资料」后生效');
    } catch (caughtError) {
      setProfileError(normalizeError(caughtError).message || '头像上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = nickname.trim();
    setProfileError('');
    setProfileNotice('');
    if (!value) {
      setProfileError('昵称不能为空');
      return;
    }
    setSaving(true);
    try {
      const response = await userAPI.update({
        nickname: value,
        headImg: headImg.trim(),
      });
      login(
        {
          ...(authUser || {}),
          nickname: response.data.nickname || value,
          headImg: response.data.headImg || headImg.trim(),
        },
        token
      );
      setProfileNotice('资料已更新');
      reload();
    } catch (caughtError) {
      setProfileError(normalizeError(caughtError).message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordNotice('');
    const { password, newPassword, confirm } = passwordForm;
    if (needsOldPassword && !password) {
      setPasswordError('请输入当前密码');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('新密码至少需要 6 位');
      return;
    }
    if (newPassword !== confirm) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }
    setPasswordSaving(true);
    try {
      await userAPI.changePassword({
        ...(needsOldPassword ? { password } : {}),
        newPassword,
      });
      setPasswordForm({ password: '', newPassword: '', confirm: '' });
      setPasswordNotice('密码已更新');
    } catch (caughtError) {
      setPasswordError(normalizeError(caughtError).message || '修改密码失败');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <main className="page-wrap uc-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">SETTINGS</span>
          <h1>设置</h1>
          <p>管理个人资料、登录密码与账号信息。</p>
        </div>
        <button className="btn btn-default" disabled={loading} onClick={reload}>
          <FiRefreshCw className={loading ? 'spinning' : ''} /> 刷新
        </button>
      </header>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {!isLoggedIn ? (
        <UserCenterGuest message="设置需要登录后使用。" />
      ) : loading && !profile ? (
        <div className="loading-state">
          <FiRefreshCw className="spinning" /> 正在读取账号信息
        </div>
      ) : (
        <div className="uc-settings">
          <section className="surface uc-section" aria-label="基本资料">
            <div className="section-heading">
              <div>
                <h2>
                  <FiUser /> 基本资料
                </h2>
                <p>昵称与头像会展示在导航栏和个人主页。</p>
              </div>
            </div>
            <form className="uc-form" onSubmit={handleSaveProfile}>
              <div className="uc-avatar-row">
                <UserAvatar profile={profile ? { ...profile, headImg } : { headImg }} />
                <div>
                  <label className="btn btn-default uc-upload" htmlFor="uc-avatar">
                    <FiImage /> {uploading ? '上传中…' : '更换头像'}
                  </label>
                  <input
                    id="uc-avatar"
                    className="uc-file"
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={handleAvatarChange}
                  />
                  <small>支持 JPG / PNG，大小不超过 5MB。</small>
                </div>
              </div>
              <label className="uc-field" htmlFor="uc-nickname">
                <span>昵称</span>
                <input
                  id="uc-nickname"
                  value={nickname}
                  maxLength={32}
                  placeholder="怎么称呼你"
                  onChange={(event) => setNickname(event.target.value)}
                />
              </label>
              <label className="uc-field" htmlFor="uc-headimg">
                <span>头像地址</span>
                <input
                  id="uc-headimg"
                  value={headImg}
                  maxLength={1000}
                  placeholder="上传后自动填入，也可粘贴图片链接"
                  onChange={(event) => setHeadImg(event.target.value)}
                />
              </label>
              {profileError && (
                <div className="notice error" role="alert">
                  {profileError}
                </div>
              )}
              {profileNotice && (
                <div className="notice" role="status">
                  {profileNotice}
                </div>
              )}
              <div className="uc-form-actions">
                <button className="btn btn-primary" disabled={saving || uploading}>
                  <FiSave /> {saving ? '保存中…' : '保存资料'}
                </button>
              </div>
            </form>
          </section>

          <section className="surface uc-section" aria-label="登录密码">
            <div className="section-heading">
              <div>
                <h2>
                  <FiShield /> 登录密码
                </h2>
                <p>
                  {needsOldPassword
                    ? '修改密码需要验证当前密码。'
                    : '当前为微信登录，可直接设置新的登录密码。'}
                </p>
              </div>
            </div>
            <form className="uc-form" onSubmit={handleChangePassword}>
              {needsOldPassword && (
                <label className="uc-field" htmlFor="uc-old-password">
                  <span>当前密码</span>
                  <input
                    id="uc-old-password"
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.password}
                    onChange={(event) =>
                      setPasswordForm({ ...passwordForm, password: event.target.value })
                    }
                    placeholder="请输入当前密码"
                  />
                </label>
              )}
              <label className="uc-field" htmlFor="uc-new-password">
                <span>新密码</span>
                <input
                  id="uc-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm({ ...passwordForm, newPassword: event.target.value })
                  }
                  placeholder="至少 6 位"
                />
              </label>
              <label className="uc-field" htmlFor="uc-confirm-password">
                <span>确认新密码</span>
                <input
                  id="uc-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirm}
                  onChange={(event) =>
                    setPasswordForm({ ...passwordForm, confirm: event.target.value })
                  }
                  placeholder="再次输入新密码"
                />
              </label>
              {passwordError && (
                <div className="notice error" role="alert">
                  {passwordError}
                </div>
              )}
              {passwordNotice && (
                <div className="notice" role="status">
                  <FiCheckCircle /> {passwordNotice}
                </div>
              )}
              <div className="uc-form-actions">
                <button className="btn btn-primary" disabled={passwordSaving}>
                  <FiShield /> {passwordSaving ? '提交中…' : '更新密码'}
                </button>
              </div>
            </form>
          </section>

          <section className="surface uc-section" aria-label="主题">
            <div className="section-heading">
              <div>
                <h2>
                  <FiSun /> 主题
                </h2>
                <p>选择界面配色，偏好会保存在当前浏览器。</p>
              </div>
            </div>
            <div className="uc-theme-options">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    className={`uc-theme-option ${themeMode === option.mode ? 'active' : ''}`}
                    aria-pressed={themeMode === option.mode}
                    onClick={() => setThemeMode(option.mode)}
                  >
                    <Icon />
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="surface uc-section" aria-label="账号信息">
            <div className="section-heading">
              <div>
                <h2>账号信息</h2>
                <p>账号标识与登录方式由后端账号体系维护。</p>
              </div>
            </div>
            <dl className="uc-info-grid">
              <div>
                <dt>手机号</dt>
                <dd>{maskMobile(profile?.mobile)}</dd>
              </div>
              <div>
                <dt>登录方式</dt>
                <dd>{profile?.loginType === 'wechat' ? '微信登录' : '手机号密码'}</dd>
              </div>
              <div>
                <dt>注册时间</dt>
                <dd>{formatUserDate(profile?.meta?.registTime)}</dd>
              </div>
              <div>
                <dt>最近登录</dt>
                <dd>{formatUserDate(profile?.meta?.loginTime)}</dd>
              </div>
            </dl>
            <div className="uc-form-actions">
              <button
                className="btn btn-default uc-logout"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                <FiLogOut /> 退出登录
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
