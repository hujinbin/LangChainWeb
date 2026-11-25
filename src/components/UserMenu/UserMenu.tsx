import { useLabels } from '../../store/languageStore';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiGift,
  FiHelpCircle,
  FiLogOut,
  FiMail,
  FiMessageSquare,
  FiSettings,
  FiStar,
  FiSun,
  FiUser,
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import { useThemeOptions } from '../AppearancePreferences';
import { SITE } from '../../config/site';
import './UserMenu.css';

const CUSTOMER_SERVICE_QR = `${process.env.PUBLIC_URL}/customer-service-qr.png`;
function UserMenuAvatar({
  avatarUrl,
  initial,
  large = false,
}: {
  avatarUrl: string;
  initial: string;
  large?: boolean;
}) {
  if (avatarUrl) {
    return (
      <img
        className={`user-menu-avatar ${large ? 'large' : ''}`}
        src={avatarUrl}
        alt=""
      />
    );
  }
  return (
    <span className={`user-menu-avatar ${large ? 'large' : ''}`}>{initial}</span>
  );
}

export default function UserMenu() {
  const t = useLabels();
  const themeOptions = useThemeOptions();
  const { user, logout } = useAuthStore();
  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const displayName = user?.nickname || user?.mobile || t("用户", "User");
  const initial = displayName.slice(0, 1).toUpperCase();
  const avatarUrl = typeof user?.headImg === 'string' ? user.headImg : '';
  const themeLabel =
    themeOptions.find((option) => option.mode === themeMode)?.label || t("跟随系统", "System");

  const closeMenu = () => {
    setOpen(false);
    setHelpOpen(false);
    setThemeOpen(false);
  };

  const showNotice = (message: string) => {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2400);
  };

  const copyQqGroup = async () => {
    try {
      await navigator.clipboard.writeText(SITE.qqGroup);
      showNotice(`已复制 QQ 群号 ${SITE.qqGroup}`);
    } catch {
      showNotice(`QQ 交流群：${SITE.qqGroup}`);
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const closeAll = () => {
      setOpen(false);
      setHelpOpen(false);
      setThemeOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeAll();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAll();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("账号菜单", "Account menu")}
        onClick={() => setOpen((value) => !value)}
      >
        <UserMenuAvatar avatarUrl={avatarUrl} initial={initial} />
        <span className="user-menu-name">{displayName}</span>
        <FiChevronDown className="user-menu-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="user-menu-panel" role="menu" aria-label={t("账号菜单", "Account menu")}>
          <p className="user-menu-group">{t("个人", "Account")}</p>
          <div className="user-menu-account">
            <UserMenuAvatar avatarUrl={avatarUrl} initial={initial} large />
            <span className="user-menu-account-name" title={displayName}>
              {displayName}
            </span>
            <FiCheck aria-label={t("当前账号", "Current account")} />
          </div>
          <div className="user-menu-divider" />
          <Link to="/credits" role="menuitem" className="user-menu-item" onClick={closeMenu}>
            <FiGift />
            <span>{t("兑换码", "Redemption code")}</span>
            <small className="user-menu-hint">{t("兑换套餐", "Redeem credits")}</small>
          </Link>
          <Link
            to="/achievements"
            role="menuitem"
            className="user-menu-item"
            onClick={closeMenu}
          >
            <FiStar />
            <span>{t("成就计划", "Achievements")}</span>
            <small className="user-menu-hint">{t("去点亮", "View progress")}</small>
          </Link>
          <Link
            to="/profile"
            role="menuitem"
            className="user-menu-item"
            onClick={closeMenu}
          >
            <FiUser />
            <span>{t("个人主页", "Profile")}</span>
          </Link>
          <div
            className="user-menu-sub"
            onMouseEnter={() => setHelpOpen(true)}
            onMouseLeave={() => setHelpOpen(false)}
          >
            <button
              type="button"
              role="menuitem"
              className="user-menu-item"
              aria-haspopup="true"
              aria-expanded={helpOpen}
              onClick={() => setHelpOpen((value) => !value)}
            >
              <FiMail />
              <span>{t("帮助与反馈", "Help and feedback")}</span>
              <FiChevronRight className="user-menu-arrow" />
            </button>
            {helpOpen && (
              <div className="user-menu-help" role="menu" aria-label={t("帮助与反馈", "Help and feedback")}>
                <button
                  type="button"
                  role="menuitem"
                  className="user-menu-item"
                  onClick={copyQqGroup}
                >
                  <FiMessageSquare />
                  <span>{t("QQ 交流群", "QQ group")}</span>
                  <small className="user-menu-hint">{SITE.qqGroup}</small>
                </button>
                <Link
                  to="/help"
                  role="menuitem"
                  className="user-menu-item"
                  onClick={closeMenu}
                >
                  <FiHelpCircle />
                  <span>{t("帮助中心", "Help center")}</span>
                </Link>
                <div className="user-menu-divider" />
                <p className="user-menu-help-title">
                  <FiMessageSquare /> {t("扫码联系客服", "Scan to contact support")}
                </p>
                <div className="user-menu-qr">
                  <img src={CUSTOMER_SERVICE_QR} alt={t("客服微信二维码", "WeChat support QR code")} />
                </div>
                <p className="user-menu-qr-caption">
                  {t("添加「流风绾月」办理充值或反馈问题", "Contact 流风绾月 for credit top-ups or feedback.")}
                </p>
              </div>
            )}
          </div>
          <div
            className="user-menu-sub"
            onMouseEnter={() => setThemeOpen(true)}
            onMouseLeave={() => setThemeOpen(false)}
          >
            <button
              type="button"
              role="menuitem"
              className="user-menu-item"
              aria-haspopup="true"
              aria-expanded={themeOpen}
              onClick={() => setThemeOpen((value) => !value)}
            >
              <FiSun />
              <span>{t("主题", "Theme")}</span>
              <span className="user-menu-end">
                <small className="user-menu-hint">{themeLabel}</small>
                <FiChevronRight className="user-menu-arrow" />
              </span>
            </button>
            {themeOpen && (
              <div className="user-menu-theme" role="menu" aria-label={t("主题", "Theme")}>
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.mode}
                      type="button"
                      role="menuitemradio"
                      aria-checked={themeMode === option.mode}
                      className="user-menu-item"
                      onClick={() => {
                        setThemeMode(option.mode);
                        showNotice(`主题已切换为${option.label}`);
                      }}
                    >
                      <Icon />
                      <span>{option.label}</span>
                      {themeMode === option.mode && <FiCheck />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Link
            to="/settings"
            role="menuitem"
            className="user-menu-item"
            onClick={closeMenu}
          >
            <FiSettings />
            <span>{t("设置", "Settings")}</span>
          </Link>
          <div className="user-menu-divider" />
          <button
            type="button"
            role="menuitem"
            className="user-menu-item danger"
            onClick={() => {
              closeMenu();
              logout();
              navigate('/login');
            }}
          >
            <FiLogOut />
            <span>{t("退出登录", "Sign out")}</span>
          </button>
        </div>
      )}
      {notice && (
        <div className="user-menu-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
