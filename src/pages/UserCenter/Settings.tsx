import { useLabels } from '../../store/languageStore';
import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCheckCircle,
  FiImage,
  FiLogOut,
  FiRefreshCw,
  FiSave,
  FiShield,
  FiSun,
  FiUser,
} from 'react-icons/fi';
import { userAPI } from '../../services/api';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import { LanguageSelect, useThemeOptions } from '../../components/AppearancePreferences';
import { normalizeError } from '../../types/api';
import { formatUserDate, maskMobile } from '../../types/user';
import {
  UserAvatar,
  UserCenterGuest,
  useUserProfile,
} from './UserCenterShared';
import './UserCenter.css';

export default function Settings() {
  const t = useLabels();
  const themeOptions = useThemeOptions();
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
      setProfileError(t("请选择图片文件", "Choose an image file"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError(t("图片大小不能超过 5MB", "Image size must be 5 MB or less"));
      return;
    }
    setUploading(true);
    setProfileError('');
    setProfileNotice('');
    try {
      const response = await userAPI.uploadImage(file);
      if (!response.data) throw new Error(t("上传结果缺少图片地址", "The upload did not return an image URL"));
      setHeadImg(response.data);
      setProfileNotice(t("头像已上传，点击「保存资料」后生效", "Avatar uploaded. Save your profile to apply it."));
    } catch (caughtError) {
      setProfileError(normalizeError(caughtError).message || t("头像上传失败", "Avatar upload failed"));
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
      setProfileError(t("昵称不能为空", "Enter a display name"));
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
      setProfileNotice(t("资料已更新", "Profile updated"));
      reload();
    } catch (caughtError) {
      setProfileError(normalizeError(caughtError).message || t("保存失败", "Could not save"));
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
      setPasswordError(t("请输入当前密码", "Enter your current password"));
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t("新密码至少需要 6 位", "Use at least 6 characters"));
      return;
    }
    if (newPassword !== confirm) {
      setPasswordError(t("两次输入的新密码不一致", "The new passwords do not match"));
      return;
    }
    setPasswordSaving(true);
    try {
      await userAPI.changePassword({
        ...(needsOldPassword ? { password } : {}),
        newPassword,
      });
      setPasswordForm({ password: '', newPassword: '', confirm: '' });
      setPasswordNotice(t("密码已更新", "Password updated"));
    } catch (caughtError) {
      setPasswordError(normalizeError(caughtError).message || t("修改密码失败", "Could not change password"));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <main className="page-wrap uc-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">SETTINGS</span>
          <h1>{t("设置", "Settings")}</h1>
          <p>{t("管理个人资料、登录密码与账号信息。", "Manage your profile, password and preferences.")}</p>
        </div>
        <button className="btn btn-default" disabled={loading} onClick={reload}>
          <FiRefreshCw className={loading ? 'spinning' : ''} /> {t("刷新", "Refresh")}
        </button>
      </header>
      <section className="surface uc-section" aria-label={t("主题", "Theme")}>
        <div className="section-heading">
          <div>
            <h2>
              <FiSun /> {t("主题", "Theme")}
            </h2>
            <p>{t("选择界面配色，偏好会保存在当前浏览器。", "Your color preference is saved in this browser.")}</p>
          </div>
        </div>
        <label className="uc-language">{t("界面语言", "Language")} <LanguageSelect /></label>
        <div className="uc-theme-options">
          {themeOptions.map((option) => {
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
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {!isLoggedIn ? (
        <UserCenterGuest message={t("设置需要登录后使用。", "Sign in to manage account settings.")} />
      ) : loading && !profile ? (
        <div className="loading-state">
          <FiRefreshCw className="spinning" /> {t("正在读取账号信息", "Loading account information")}
        </div>
      ) : (
        <div className="uc-settings">
          <section className="surface uc-section" aria-label={t("基本资料", "Profile")}>
            <div className="section-heading">
              <div>
                <h2>
                  <FiUser /> {t("基本资料", "Profile")}
                </h2>
                <p>{t("昵称与头像会展示在导航栏和个人主页。", "Your display name and avatar appear in navigation and on your profile.")}</p>
              </div>
            </div>
            <form className="uc-form" onSubmit={handleSaveProfile}>
              <div className="uc-avatar-row">
                <UserAvatar profile={profile ? { ...profile, headImg } : { headImg }} />
                <div>
                  <label className="btn btn-default uc-upload" htmlFor="uc-avatar">
                    <FiImage /> {uploading ? t("上传中…", "Uploading…") : t("更换头像", "Change avatar")}
                  </label>
                  <input
                    id="uc-avatar"
                    className="uc-file"
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={handleAvatarChange}
                  />
                  <small>{t("支持 JPG / PNG，大小不超过 5MB。", "JPG or PNG, up to 5 MB.")}</small>
                </div>
              </div>
              <label className="uc-field" htmlFor="uc-nickname">
                <span>{t("昵称", "Display name")}</span>
                <input
                  id="uc-nickname"
                  value={nickname}
                  maxLength={32}
                  placeholder={t("怎么称呼你", "Your display name")}
                  onChange={(event) => setNickname(event.target.value)}
                />
              </label>
              <label className="uc-field" htmlFor="uc-headimg">
                <span>{t("头像地址", "Avatar URL")}</span>
                <input
                  id="uc-headimg"
                  value={headImg}
                  maxLength={1000}
                  placeholder={t("上传后自动填入，也可粘贴图片链接", "Upload an image or paste a URL")}
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
                  <FiSave /> {saving ? t("保存中…", "Saving…") : t("保存资料", "Save profile")}
                </button>
              </div>
            </form>
          </section>

          <section className="surface uc-section" aria-label={t("登录密码", "Password")}>
            <div className="section-heading">
              <div>
                <h2>
                  <FiShield /> {t("登录密码", "Password")}
                </h2>
                <p>
                  {needsOldPassword
                    ? t("修改密码需要验证当前密码。", "Enter your current password to change it.")
                    : t("当前为微信登录，可直接设置新的登录密码。", "You signed in with WeChat and can set a new password.")}
                </p>
              </div>
            </div>
            <form className="uc-form" onSubmit={handleChangePassword}>
              {needsOldPassword && (
                <label className="uc-field" htmlFor="uc-old-password">
                  <span>{t("当前密码", "Current password")}</span>
                  <input
                    id="uc-old-password"
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.password}
                    onChange={(event) =>
                      setPasswordForm({ ...passwordForm, password: event.target.value })
                    }
                    placeholder={t("请输入当前密码", "Enter your current password")}
                  />
                </label>
              )}
              <label className="uc-field" htmlFor="uc-new-password">
                <span>{t("新密码", "New password")}</span>
                <input
                  id="uc-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm({ ...passwordForm, newPassword: event.target.value })
                  }
                  placeholder={t("至少 6 位", "At least 6 characters")}
                />
              </label>
              <label className="uc-field" htmlFor="uc-confirm-password">
                <span>{t("确认新密码", "Confirm new password")}</span>
                <input
                  id="uc-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirm}
                  onChange={(event) =>
                    setPasswordForm({ ...passwordForm, confirm: event.target.value })
                  }
                  placeholder={t("再次输入新密码", "Re-enter your new password")}
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
                  <FiShield /> {passwordSaving ? t("提交中…", "Submitting…") : t("更新密码", "Update password")}
                </button>
              </div>
            </form>
          </section>


          <section className="surface uc-section" aria-label={t("账号信息", "Account information")}>
            <div className="section-heading">
              <div>
                <h2>{t("账号信息", "Account information")}</h2>
                <p>{t("账号标识与登录方式由后端账号体系维护。", "These details come from your account.")}</p>
              </div>
            </div>
            <dl className="uc-info-grid">
              <div>
                <dt>{t("手机号", "Phone number")}</dt>
                <dd>{maskMobile(profile?.mobile)}</dd>
              </div>
              <div>
                <dt>{t("登录方式", "Sign-in method")}</dt>
                <dd>{profile?.loginType === 'wechat' ? t("微信登录", "WeChat") : t("手机号密码", "Phone and password")}</dd>
              </div>
              <div>
                <dt>{t("注册时间", "Registered")}</dt>
                <dd>{formatUserDate(profile?.meta?.registTime)}</dd>
              </div>
              <div>
                <dt>{t("最近登录", "Last sign-in")}</dt>
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
                <FiLogOut /> {t("退出登录", "Sign out")}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
