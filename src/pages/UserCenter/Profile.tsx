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
    [FiGitBranch, '工作流', workflowCount === null ? '—' : String(workflowCount)],
    [FiZap, '最近执行', statsLoading ? '—' : String(executions.length)],
    [FiCheckCircle, '成功执行', statsLoading ? '—' : String(successCount)],
    [
      FiCreditCard,
      '可用积分',
      credits?.account ? formatPoints(credits.account.balance) : '—',
    ],
    [FiBookOpen, '文章', String(profile?.articleNum ?? 0)],
    [FiUsers, '粉丝', String(profile?.fans ?? 0)],
  ];
  const homepage = safeHomepage(profile?.homepage);
  const position = [profile?.job, profile?.company].filter(Boolean).join(' · ');

  return (
    <main className="page-wrap uc-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">PROFILE</span>
          <h1>个人主页</h1>
          <p>查看账号资料、创作数据与积分情况。</p>
        </div>
        <div className="uc-heading-actions">
          <button className="btn btn-default" disabled={loading} onClick={reload}>
            <FiRefreshCw className={loading ? 'spinning' : ''} /> 刷新资料
          </button>
          <Link className="btn btn-primary" to="/settings">
            <FiSettings /> 编辑资料
          </Link>
        </div>
      </header>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {!isLoggedIn ? (
        <UserCenterGuest message="个人主页需要登录后查看。" />
      ) : loading && !profile ? (
        <div className="loading-state">
          <FiRefreshCw className="spinning" /> 正在读取账号信息
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
                    <FiCheckCircle /> 已认证
                  </span>
                )}
              </div>
              <p>
                {profile?.bio ||
                  profile?.introduce ||
                  '还没有留下简介，可以到设置里补一句自我介绍。'}
              </p>
              <div className="uc-meta">
                {position && <span>{position}</span>}
                <span>手机号 {maskMobile(profile?.mobile)}</span>
                <span>注册于 {formatUserDate(profile?.meta?.registTime)}</span>
                {homepage && (
                  <a href={homepage} target="_blank" rel="noreferrer">
                    个人站点 <FiArrowRight />
                  </a>
                )}
              </div>
            </div>
            <Link className="btn btn-default" to="/settings">
              <FiEdit3 /> 编辑
            </Link>
          </section>
          <section className="uc-stats" aria-label="创作数据">
            {stats.map(([Icon, label, value]) => (
              <article className="surface uc-stat" key={label}>
                <span>
                  <Icon /> {label}
                </span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>
          <section className="surface uc-section" aria-label="账号信息">
            <div className="section-heading">
              <div>
                <h2>账号信息</h2>
                <p>来自当前登录账号，编辑请前往设置。</p>
              </div>
            </div>
            <dl className="uc-info-grid">
              <div>
                <dt>登录方式</dt>
                <dd>{profile?.loginType === 'wechat' ? '微信登录' : '手机号密码'}</dd>
              </div>
              <div>
                <dt>最近登录</dt>
                <dd>{formatUserDate(profile?.meta?.loginTime)}</dd>
              </div>
              <div>
                <dt>手机号</dt>
                <dd>{maskMobile(profile?.mobile)}</dd>
              </div>
              <div>
                <dt>登录密码</dt>
                <dd>{profile?.hasPassword ? '已设置' : '未设置'}</dd>
              </div>
              <div>
                <dt>获赞</dt>
                <dd>{profile?.like ?? 0}</dd>
              </div>
              <div>
                <dt>关注</dt>
                <dd>{profile?.focu ?? 0}</dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </main>
  );
}
