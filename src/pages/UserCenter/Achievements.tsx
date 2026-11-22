import { useEffect, useState } from 'react';
import {
  FiCheckCircle,
  FiEdit3,
  FiGitBranch,
  FiLayers,
  FiPlay,
  FiRefreshCw,
  FiUsers,
  FiUserCheck,
  FiZap,
  FiLock,
  FiAward,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { aiWorkflowAPI } from '../../services/api';
import useAuthStore from '../../store/authStore';
import { formatPoints } from '../../components/BillingUsage/BillingUsage';
import type { Execution } from '../../types/workflow';
import type { WorkflowCredits } from '../../types/credits';
import { UserCenterGuest, useUserProfile } from './UserCenterShared';
import './UserCenter.css';

type Metrics = {
  workflows: number;
  executions: number;
  successes: number;
  consumed: number;
  articles: number;
  fans: number;
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: IconType;
  target: number;
  unit: string;
  value: (metrics: Metrics) => number;
};

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'joined',
    title: '加入织流',
    description: '注册并登录织流 AI。',
    icon: FiUserCheck,
    target: 1,
    unit: '个账号',
    value: () => 1,
  },
  {
    id: 'first-workflow',
    title: '灵感起点',
    description: '创建第一个工作流。',
    icon: FiGitBranch,
    target: 1,
    unit: '个工作流',
    value: (metrics) => metrics.workflows,
  },
  {
    id: 'workflow-master',
    title: '编排达人',
    description: '累计创建 10 个工作流。',
    icon: FiLayers,
    target: 10,
    unit: '个',
    value: (metrics) => metrics.workflows,
  },
  {
    id: 'first-run',
    title: '首战告捷',
    description: '完成第一次工作流执行。',
    icon: FiPlay,
    target: 1,
    unit: '次执行',
    value: (metrics) => metrics.executions,
  },
  {
    id: 'steady-runner',
    title: '稳定输出',
    description: '成功执行 10 次工作流（统计最近 20 条记录）。',
    icon: FiCheckCircle,
    target: 10,
    unit: '次成功',
    value: (metrics) => metrics.successes,
  },
  {
    id: 'credit-explorer',
    title: '积分探索者',
    description: '累计消耗 100 积分。',
    icon: FiZap,
    target: 100,
    unit: '积分',
    value: (metrics) => metrics.consumed,
  },
  {
    id: 'community-voice',
    title: '社区之声',
    description: '发布第一篇文章。',
    icon: FiEdit3,
    target: 1,
    unit: '篇文章',
    value: (metrics) => metrics.articles,
  },
  {
    id: 'popular-author',
    title: '人气作者',
    description: '获得 10 位粉丝。',
    icon: FiUsers,
    target: 10,
    unit: '位粉丝',
    value: (metrics) => metrics.fans,
  },
];

export default function Achievements() {
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

  const metrics: Metrics = {
    workflows: workflowCount ?? 0,
    executions: executions.length,
    successes: executions.filter((record) => record.status === 'success').length,
    consumed: credits?.account.totalConsumed ?? 0,
    articles: profile?.articleNum ?? 0,
    fans: profile?.fans ?? 0,
  };

  const items = ACHIEVEMENTS.map((achievement) => {
    const raw = achievement.value(metrics);
    const current = Math.min(raw, achievement.target);
    return {
      ...achievement,
      current,
      percent: Math.round((current / achievement.target) * 100),
      unlocked: raw >= achievement.target,
    };
  });
  const unlocked = items.filter((item) => item.unlocked).length;
  const overall = Math.round((unlocked / items.length) * 100);

  return (
    <main className="page-wrap uc-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">ACHIEVEMENTS</span>
          <h1>成就计划</h1>
          <p>成就根据真实的账号、工作流、执行与积分数据自动点亮。</p>
        </div>
        <button
          className="btn btn-default"
          disabled={loading || statsLoading}
          onClick={reload}
        >
          <FiRefreshCw className={loading || statsLoading ? 'spinning' : ''} />{' '}
          刷新进度
        </button>
      </header>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {!isLoggedIn ? (
        <UserCenterGuest message="登录后查看你的成就进度。" />
      ) : (
        <>
          <section className="surface uc-achievement-summary">
            <div>
              <span className="eyebrow">YOUR PROGRESS</span>
              <h2>
                已点亮 {unlocked} / {items.length}
              </h2>
              <p>
                {unlocked === items.length
                  ? '全部成就已点亮，继续保持创作。'
                  : statsLoading
                    ? '正在同步创作数据…'
                    : '完成更多创作与运行，逐步点亮全部成就。'}
              </p>
            </div>
            <div className="uc-achievement-score" aria-label={`完成度 ${overall}%`}>
              <strong>{overall}%</strong>
              <span>完成度</span>
            </div>
          </section>
          <section className="uc-achievement-grid" aria-label="成就列表">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  className={`surface uc-achievement ${item.unlocked ? 'is-unlocked' : ''}`}
                  key={item.id}
                >
                  <span className="uc-achievement-icon">
                    <Icon />
                  </span>
                  <div className="uc-achievement-main">
                    <div className="uc-achievement-title">
                      <h3>{item.title}</h3>
                      {item.unlocked ? (
                        <span className="badge success">
                          <FiAward /> 已点亮
                        </span>
                      ) : (
                        <span className="badge">
                          <FiLock /> 未点亮
                        </span>
                      )}
                    </div>
                    <p>{item.description}</p>
                    <div
                      className="uc-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={item.target}
                      aria-valuenow={item.current}
                      aria-label={`${item.title}进度`}
                    >
                      <span style={{ width: `${item.percent}%` }} />
                    </div>
                    <small>
                      {formatPoints(item.current)} / {formatPoints(item.target)}{' '}
                      {item.unit}
                    </small>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}
