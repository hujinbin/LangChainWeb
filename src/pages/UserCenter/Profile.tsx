import { useLabels } from '../../store/languageStore';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiBookOpen,
  FiCheckCircle,
  FiCreditCard,
  FiEdit3,
  FiGitBranch,
  FiRefreshCw,
  FiSettings,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { aiWorkflowAPI } from '../../services/api';
import useAuthStore from '../../store/authStore';
import { formatPoints } from '../../components/BillingUsage/BillingUsage';
import {
  displayUserName,
  formatUserDate,
  maskMobile,
  safeHomepage,
} from '../../types/user';
import type { Execution } from '../../types/workflow';
import type { WorkflowCredits } from '../../types/credits';
import {
  UserAvatar,
  UserCenterGuest,
  useUserProfile,
} from './UserCenterShared';
import './UserCenter.css';

export default function Profile() {
  const t = useLabels();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const { profile, loading, error, reload } = useUserProfile();
  const [workflowCount, setWorkflowCount] = useState<number | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [credits, setCredits] = useState<WorkflowCredits | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      setWorkflowCount(null);
      setExecutions([]);
      setCredits(null);
      return undefined;
    }
    let active = true;
    setStatsLoading(true);
    Promise.allSettled([
      aiWorkflowAPI.list(),
      aiWorkflowAPI.executions(),
      aiWorkflowAPI.credits(),
    ]).then(([workflowResult, executionResult, creditResult]) => {
      if (!active) return;
      if (workflowResult.status === 'fulfilled') {
        setWorkflowCount(workflowResult.value.data?.length ?? 0);
      }
      if (executionResult.status === 'fulfilled') {
        setExecutions(executionResult.value.data || []);
      }
      if (creditResult.status === 'fulfilled') {
        setCredits(creditResult.value.data);
      }
      setStatsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [isLoggedIn]);

  const successCount = executions.filter(
    (record) => record.status === 'success'
  ).length;
  const stats: [IconType, string, string][] = [
    [FiGitBranch, t("工作流", "Workflows"), workflowCount === null ? '—' : String(workflowCount)],
    [FiZap, t("最近执行", "Recent runs"), statsLoading ? '—' : String(executions.length)],
    [FiCheckCircle, t("成功执行", "Successful runs"), statsLoading ? '—' : String(successCount)],
    [
      FiCreditCard,
      t("可用积分", "Available credits"),
      credits?.account ? formatPoints(credits.account.balance) : '—',
    ],
    [FiBookOpen, t("文章", "Articles"), String(profile?.articleNum ?? 0)],
    [FiUsers, t("粉丝", "Followers"), String(profile?.fans ?? 0)],
  ];
  const homepage = safeHomepage(profile?.homepage);
  const position = [profile?.job, profile?.company].filter(Boolean).join(' · ');

  return (
    <main className="page-wrap uc-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">PROFILE</span>
          <h1>{t("个人主页", "Profile")}</h1>
          <p>{t("查看账号资料、创作数据与积分情况。", "View your account, project activity and credits.")}</p>
        </div>
        <div className="uc-heading-actions">
          <button className="btn btn-default" disabled={loading} onClick={reload}>
            <FiRefreshCw className={loading ? 'spinning' : ''} /> {t("刷新资料", "Refresh profile")}
          </button>
          <Link className="btn btn-primary" to="/settings">
            <FiSettings /> {t("编辑资料", "Edit profile")}
          </Link>
        </div>
      </header>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {!isLoggedIn ? (
        <UserCenterGuest message={t("个人主页需要登录后查看。", "Sign in to view your profile.")} />
      ) : loading && !profile ? (
        <div className="loading-state">
          <FiRefreshCw className="spinning" /> {t("正在读取账号信息", "Loading account")}
        </div>
      ) : (
        <>
          <section className="surface uc-hero">
            <UserAvatar profile={profile} />
            <div className="uc-hero-main">
              <div className="uc-hero-name">
                <h2>{displayUserName(profile)}</h2>
                {profile?.verified && (
                  <span className="badge success">
                    <FiCheckCircle /> {t("已认证", "Verified")}
                  </span>
                )}
              </div>
              <p>
                {profile?.bio ||
                  profile?.introduce ||
                  t("还没有留下简介，可以到设置里补一句自我介绍。", "Add an introduction in Settings.")}
              </p>
              <div className="uc-meta">
                {position && <span>{position}</span>}
                <span>{t("手机号", "Phone number")} {maskMobile(profile?.mobile)}</span>
                <span>{t("注册于", "Registered")} {formatUserDate(profile?.meta?.registTime)}</span>
                {homepage && (
                  <a href={homepage} target="_blank" rel="noreferrer">
                    {t("个人站点", "Website")} <FiArrowRight />
                  </a>
                )}
              </div>
            </div>
            <Link className="btn btn-default" to="/settings">
              <FiEdit3 /> {t("编辑", "Edit")}
            </Link>
          </section>
          <section className="uc-stats" aria-label={t("创作数据", "Creation statistics")}>
            {stats.map(([Icon, label, value]) => (
              <article className="surface uc-stat" key={label}>
                <span>
                  <Icon /> {label}
                </span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>
          <section className="surface uc-section" aria-label={t("账号信息", "Account information")}>
            <div className="section-heading">
              <div>
                <h2>{t("账号信息", "Account information")}</h2>
                <p>{t("来自当前登录账号，编辑请前往设置。", "Open Settings to update your account.")}</p>
              </div>
            </div>
            <dl className="uc-info-grid">
              <div>
                <dt>{t("登录方式", "Sign-in method")}</dt>
                <dd>{profile?.loginType === 'wechat' ? t("微信登录", "WeChat") : t("手机号密码", "Phone and password")}</dd>
              </div>
              <div>
                <dt>{t("最近登录", "Last sign-in")}</dt>
                <dd>{formatUserDate(profile?.meta?.loginTime)}</dd>
              </div>
              <div>
                <dt>{t("手机号", "Phone number")}</dt>
                <dd>{maskMobile(profile?.mobile)}</dd>
              </div>
              <div>
                <dt>{t("登录密码", "Password")}</dt>
                <dd>{profile?.hasPassword ? t("已设置", "Set") : t("未设置", "Not set")}</dd>
              </div>
              <div>
                <dt>{t("获赞", "Likes received")}</dt>
                <dd>{profile?.like ?? 0}</dd>
              </div>
              <div>
                <dt>{t("关注", "Following")}</dt>
                <dd>{profile?.focu ?? 0}</dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </main>
  );
}
