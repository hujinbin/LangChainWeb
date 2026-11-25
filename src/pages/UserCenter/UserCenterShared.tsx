import { useLabels } from '../../store/languageStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUser } from 'react-icons/fi';
import { userAPI } from '../../services/api';
import useAuthStore from '../../store/authStore';
import { normalizeError } from '../../types/api';
import type { UserProfile } from '../../types/user';

export function useUserProfile() {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const token = useAuthStore((state) => state.token);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);

  const load = useCallback(async () => {
    const current = ++version.current;
    if (!isLoggedIn || !token) {
      setProfile(null);
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await userAPI.info();
      if (current === version.current) setProfile(response.data);
    } catch (caughtError) {
      if (current === version.current) {
        setError(normalizeError(caughtError).message || '读取账号信息失败');
      }
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [isLoggedIn, token]);

  useEffect(() => {
    load();
    return () => {
      version.current += 1;
    };
  }, [load]);

  return { profile, loading, error, reload: load };
}

export function UserAvatar({
  profile,
  className = '',
}: {
  profile: UserProfile | null;
  className?: string;
}) {
  const name = profile?.nickname || 'U';
  if (profile?.headImg) {
    return (
      <img
        className={`uc-avatar ${className}`}
        src={profile.headImg}
        alt={name}
      />
    );
  }
  return (
    <span className={`uc-avatar uc-avatar-fallback ${className}`} aria-label={name}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function UserCenterGuest({ message }: { message?: string }) {
  const t = useLabels();
  return (
    <section className="surface empty-state">
      <span className="empty-state-icon">
        <FiUser />
      </span>
      <h3>{t("登录后查看", "Sign in to view")}</h3>
      <p>{message || t("账号信息与当前登录用户关联。", "This information belongs to your account.")}</p>
      <Link to="/login" className="btn btn-primary">
        {t("去登录", "Sign in")}
      </Link>
    </section>
  );
}
