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
  FiMonitor,
  FiMoon,
  FiSettings,
  FiStar,
  FiSun,
  FiUser,
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import type { ThemeMode } from '../../store/themeStore';
import { SITE } from '../../config/site';
import './UserMenu.css';

const CUSTOMER_SERVICE_QR = `${process.env.PUBLIC_URL}/customer-service-qr.png`;
const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof FiSun }[] = [
  { mode: 'auto', label: '跟随系统', icon: FiMonitor },
  { mode: 'light', label: '浅色', icon: FiSun },
  { mode: 'dark', label: '深色', icon: FiMoon },
];

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

  const displayName = user?.nickname || user?.mobile || '用户';
  const initial = displayName.slice(0, 1).toUpperCase();
  const avatarUrl = typeof user?.headImg === 'string' ? user.headImg : '';
  const themeLabel =
    THEME_OPTIONS.find((option) => option.mode === themeMode)?.label || '跟随系统';

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
        aria-label="账号菜单"
        onClick={() => setOpen((value) => !value)}
      >
        <UserMenuAvatar avatarUrl={avatarUrl} initial={initial} />
        <span className="user-menu-name">{displayName}</span>
        <FiChevronDown className="user-menu-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="user-menu-panel" role="menu" aria-label="账号菜单">
          <p className="user-menu-group">个人</p>
          <div className="user-menu-account">
            <UserMenuAvatar avatarUrl={avatarUrl} initial={initial} large />
            <span className="user-menu-account-name" title={displayName}>
              {displayName}
            </span>
            <FiCheck aria-label="当前账号" />
          </div>
          <div className="user-menu-divider" />
          <Link to="/credits" role="menuitem" className="user-menu-item" onClick={closeMenu}>
            <FiGift />
            <span>兑换码</span>
            <small className="user-menu-hint">兑换套餐</small>
          </Link>
          <Link
            to="/achievements"
            role="menuitem"
            className="user-menu-item"
            onClick={closeMenu}
          >
            <FiStar />
            <span>成就计划</span>
            <small className="user-menu-hint">去点亮</small>
          </Link>
          <Link
            to="/profile"
            role="menuitem"
            className="user-menu-item"
            onClick={closeMenu}
          >
            <FiUser />
            <span>个人主页</span>
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
              <span>帮助与反馈</span>
              <FiChevronRight className="user-menu-arrow" />
            </button>
            {helpOpen && (
              <div className="user-menu-help" role="menu" aria-label="帮助与反馈">
                <button
                  type="button"
                  role="menuitem"
                  className="user-menu-item"
                  onClick={copyQqGroup}
                >
                  <FiMessageSquare />
                  <span>QQ 交流群</span>
                  <small className="user-menu-hint">{SITE.qqGroup}</small>
                </button>
                <Link
                  to="/help"
                  role="menuitem"
                  className="user-menu-item"
                  onClick={closeMenu}
                >
                  <FiHelpCircle />
                  <span>帮助中心</span>
                </Link>
                <div className="user-menu-divider" />
                <p className="user-menu-help-title">
                  <FiMessageSquare /> 扫码联系客服
                </p>
                <div className="user-menu-qr">
                  <img src={CUSTOMER_SERVICE_QR} alt="客服微信二维码" />
                </div>
                <p className="user-menu-qr-caption">
                  添加「流风绾月」办理充值或反馈问题
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
              <span>主题</span>
              <span className="user-menu-end">
                <small className="user-menu-hint">{themeLabel}</small>
                <FiChevronRight className="user-menu-arrow" />
              </span>
            </button>
            {themeOpen && (
              <div className="user-menu-theme" role="menu" aria-label="主题">
                {THEME_OPTIONS.map((option) => {
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
            <span>设置</span>
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
            <span>退出登录</span>
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
