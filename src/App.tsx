import { normalizeError } from './types/api';
import type { IconType } from 'react-icons';
import type { Execution, ModelCatalog, ModelKind } from './types/workflow';
import AgentsPage from './pages/Agents/AgentsPage';
import AgentStudio from './pages/Agents/AgentStudio';
import NovelList from './pages/Novel/NovelList';
import NovelStudio from './pages/Novel/NovelStudio';
import CustomAgentEditor from './pages/CustomAgents/CustomAgentEditor';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  FiGrid,
  FiGitBranch,
  FiClock,
  FiArrowRight,
  FiPlus,
  FiZap,
  FiType,
  FiImage,
  FiVideo,
  FiCheckCircle,
  FiActivity,
  FiArrowLeft,
  FiRefreshCw,
  FiDatabase,
  FiCpu,
} from 'react-icons/fi';
import WorkflowList from './pages/WorkflowList/WorkflowList';
import WorkflowEditor from './pages/WorkflowEditor/WorkflowEditor';
import Login from './pages/Login/Login';
import KnowledgeBase from './pages/KnowledgeBase/KnowledgeBase';
import KnowledgeBaseDetail from './pages/KnowledgeBase/KnowledgeBaseDetail';
import ExecutionResult from './components/ExecutionResult/ExecutionResult';
import { BillingUsageInline } from './components/BillingUsage/BillingUsage';
import WorkflowCreditsPage from './pages/WorkflowCredits/WorkflowCredits';
import useAuthStore from './store/authStore';
import { useSiteStore } from './store/siteStore';
import { aiWorkflowAPI } from './services/api';
import localStorageService from './services/localStorage';
import { WORKFLOW_TEMPLATES } from './constants/workflowTemplates';
import { SITE } from './config/site';
import PageMetadata from './components/PageMetadata';
import CreditBalanceLink from './components/CreditBalanceLink';
import UserMenu from './components/UserMenu/UserMenu';
import Profile from './pages/UserCenter/Profile';
import Settings from './pages/UserCenter/Settings';
import Achievements from './pages/UserCenter/Achievements';
import { PARTNER_PATH } from './config/runtime';
import { useLabels } from './store/languageStore';
import { LanguageSelect } from './components/AppearancePreferences';
import ApiDocs from './pages/Developer/ApiDocs';
import UsageOverview from './pages/Developer/UsageOverview';
import { FiBookOpen, FiShield } from 'react-icons/fi';
import HelpCenter from './pages/HelpCenter/HelpCenter';
import './App.css';

export const STATUS_LABELS: Record<string, string> = {
  success: '已完成',
  failed: '运行失败',
  running: '运行中',
};
const TEMPLATE_ICONS = [FiType, FiImage, FiVideo];

const templateLabels: Record<string, [string, string]> = {
  text: ['Text assistant', 'Turn a topic into copy or a response.'],
  image: ['Illustrate an idea', 'Describe an image and preview it on the canvas.'],
  video: ['Create a short video', 'Describe a scene and submit a 720p video job.'],
  branch: ['Conditional routing', 'Use a score to route data into one of two branches.'],
  json: ['Clean JSON data', 'Parse text, extract fields, trim whitespace and name the output.'],
  batch: ['Batch subworkflow', 'Run a selected subworkflow once per list item.'],
};
const capabilityKinds: [ModelKind, IconType, string, string][] = [
  ['text', FiType, '文本生成', 'Text generation'],
  ['image', FiImage, '图片生成', 'Image generation'],
  ['video', FiVideo, '视频生成', 'Video generation'],
];

export function TemplateCards() {
  const t = useLabels();
  const navigate = useNavigate();
  return (
    <div className="template-grid">
      {WORKFLOW_TEMPLATES.map((template, index) => {
        const Icon = TEMPLATE_ICONS[index] || FiGitBranch;
        return (
          <button
            key={template.id}
            className="surface template-card"
            onClick={() =>
              navigate(`/workflows/new/edit?starter=${template.id}`)
            }
          >
            <FiArrowRight />
            <span className="template-icon">
              <Icon />
            </span>
            <strong>{t(template.name, templateLabels[template.id]?.[0] || template.name)}</strong>
            <p>{t(template.description, templateLabels[template.id]?.[1] || template.description)}</p>
            <small>{template.nodes?.length || 0} {t("个节点", "nodes")}</small>
          </button>
        );
      })}
    </div>
  );
}

function ExecutionRows({ records }: { records: Execution[] }) {
  const t = useLabels();
  const navigate = useNavigate();
  return <>{records.map((record) => (
    <button
      key={record.id}
      className="execution-row"
      onClick={() => navigate(`/executions/${record.id}`)}
    >
      <div className="execution-row-main">
        <FiGitBranch />
        <div>
          <strong>
            {record.workflowName || record.workflow_type || t("未命名工作流", "Untitled workflow")}
          </strong>
          <small>
            {record.execute_time
              ? new Date(record.execute_time).toLocaleString(t('zh-CN', 'en-US'))
              : t("时间未知", "Unknown time")}
            {record.simulated ? t(" · 模拟预览", " · Preview") : t(" · 模型运行", " · Model run")}
          </small>
          <BillingUsageInline billing={record.billing} simulated={record.simulated} />
        </div>
      </div>
      <div className="execution-row-end">
        <span>{((record.durationMs || 0) / 1000).toFixed(1)} s</span>
        <b className={`badge ${record.status}`}>
          {t(STATUS_LABELS[record.status] || record.status, record.status)}
        </b>
        <FiArrowRight />
      </div>
    </button>
  ))}</>;
}

function Dashboard() {
  const t = useLabels();
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [records, setRecords] = useState<Execution[]>([]);
  const config = useSiteStore(state => state.config);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  useEffect(() => {
    let active = true;
    let revision = 0;
    const refresh = async () => {
      const request = ++revision;
      try {
        const response = await aiWorkflowAPI.getModels();
        if (active && request === revision) setCatalog(response.data);
      } catch {
        if (active && request === revision) setCatalog(null);
      }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); };
  }, []);
  const [workflowCount, setWorkflowCount] = useState(0);
  const requestVersion = useRef(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [workflowPrompt, setWorkflowPrompt] = useState('');
  const startFromConversation = (event: React.SyntheticEvent) => {
    event.preventDefault();
    const initialPrompt = workflowPrompt.trim();
    if (!initialPrompt) return;
    navigate('/workflows/new/edit', {
      state: { initialPrompt, requestKey: String(Date.now()) },
    });
  };
  const fetchOverview = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    if (!isLoggedIn) {
      setRecords([]);
      setWorkflowCount(localStorageService.getWorkflows().length);
      setLoading(false);
      return;
    }
    try {
      const [executionResponse, workflowResponse] = await Promise.all([
        aiWorkflowAPI.executions(),
        aiWorkflowAPI.list(),
      ]);
      if (version !== requestVersion.current) return;
      setRecords(executionResponse.data || []);
      setWorkflowCount(workflowResponse.data?.length || 0);
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      if (version === requestVersion.current)
        setError(err.message || t("读取工作台失败", "Could not load workspace"));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [isLoggedIn, t]);
  useEffect(() => {
    const pendingRequests = requestVersion;
    fetchOverview();
    return () => {
      pendingRequests.current++;
    };
  }, [fetchOverview]);
  const stats = [
    {
      label: isLoggedIn ? t("工作流 · 最近 20 条", "Workflows · latest 20") : t("本地工作流", "Local workflows"),
      value: workflowCount,
      icon: FiGitBranch,
    },
    { label: t("执行 · 最近 20 条", "Runs · latest 20"), value: records.length, icon: FiActivity },
    {
      label: t("成功执行", "Successful runs"),
      value: records.filter((record) => record.status === 'success').length,
      icon: FiCheckCircle,
    },
    { label: t("已启用模型", "Enabled models"), value: catalog ? capabilityKinds.reduce((sum, [kind]) => sum + catalog[kind].length, 0) : '—', icon: FiZap },
  ];
  return (
    <main className="page-wrap">
      <header className="page-heading">
        <div>
          <h1>{t("工作台", "Workspace")}</h1>
          <p>{SITE.name} {t("· AI 工作流可视化编排工具", "· Visual AI workflow editor")}</p>
        </div>
        <span className="section-caption">
          {new Date().toLocaleDateString(t('zh-CN', 'en-US'), {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </span>
      </header>
      {config?.announcement && <aside className="notice" aria-label={t("站点公告", "Site announcement")}>{config.announcement}</aside>}
      {(config?.planName || config?.quotaDescription) && <p className="section-caption">{[config.planName, config.quotaDescription].filter(Boolean).join(' · ')}</p>}
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button className="text-action" onClick={fetchOverview}>
            {t("重试", "Retry")}
          </button>
        </div>
      )}
      <section className="studio-hero">
        <div className="studio-hero-copy">
          <h2>
            {t("描述需求，", "Describe a task, ")}<em>{t("生成工作流。", "build a workflow.")}</em>
          </h2>
          <p>{t("通过对话创建文本、图片和视频流程，拖拽连接节点、配置模型并保存，查看每一步的执行结果。", "Create text, image and video workflows in chat. Connect nodes on the canvas, choose models and inspect each result.")}</p>
          <form
            className="workflow-prompt-form"
            onSubmit={startFromConversation}
          >
            <label htmlFor="home-workflow-prompt">{t("你希望完成什么任务？", "What would you like to do?")}</label>
            <textarea
              id="home-workflow-prompt"
              value={workflowPrompt}
              onChange={(event) => setWorkflowPrompt(event.target.value)}
              placeholder={t("例如，输入产品主题，自动生成宣传文案、配图和一段短视频…", "For example, turn a product idea into marketing copy, an illustration and a short video…")}
              maxLength={6000}
              rows={3}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  startFromConversation(event);
                }
              }}
            />
            <div>
              <button
                type="button"
                className="workflow-blank-link"
                onClick={() => navigate('/workflows/new/edit')}
              >
                <FiPlus /> {t("从空白画布开始", "Start with a blank canvas")}
              </button>
              <button
                className="btn btn-lime"
                type="submit"
                disabled={!workflowPrompt.trim()}
              >
                {t("对话生成", "Generate from prompt")} <FiArrowRight />
              </button>
            </div>
          </form>
        </div>
        <div className="hero-workflow" aria-hidden="true">
          <div className="hero-flow-node">
            <FiType />
            <span>{t("文本灵感", "Text prompt")}</span>
            <small>TEXT / FLASH</small>
          </div>
          <FiArrowRight className="hero-flow-arrow" />
          <div className="hero-flow-node featured">
            <FiImage />
            <span>{t("生成画面", "Generate an image")}</span>
            <small>IMAGE / FLASH</small>
          </div>
          <FiArrowRight className="hero-flow-arrow" />
          <div className="hero-flow-node">
            <FiVideo />
            <span>{t("创意短片", "Short video")}</span>
            <small>VIDEO / 720P</small>
          </div>
        </div>
      </section>
      <section className="studio-stats" aria-label={t("工作台概览", "Workspace overview")}>
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="surface studio-stat">
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
            <Icon />
          </div>
        ))}
      </section>
      <section className="template-section">
        <div className="section-heading">
          <div>
            <h2>{t("从一个灵感开始", "Start with a template")}</h2>
            <p>{t("选择已配置的起点，在画布里继续创作。", "Choose a starting point and continue on the canvas.")}</p>
          </div>
        </div>
        <TemplateCards />
      </section>
      <div className="studio-grid">
        <section className="surface studio-recent">
          <div className="section-heading">
            <h2>{t("最近执行", "Recent runs")}</h2>
            <Link className="text-action" to="/executions">
              {t("全部记录", "All runs")} <FiArrowRight />
            </Link>
          </div>
          {loading ? (
            <div className="loading-state">
              <FiRefreshCw className="spinning" /> {t("读取运行记录", "Loading runs")}
            </div>
          ) : records.length ? (
            <ExecutionRows records={records.slice(0, 4)} />
          ) : (
            <div className="empty-state">
              <span className="empty-state-icon">
                <FiActivity />
              </span>
              <h3>{isLoggedIn ? t("等待第一次运行", "Ready for your first run") : t("登录后记录每一次创作", "Sign in to save your runs")}</h3>
              <p>
                {isLoggedIn
                  ? t("在编辑器中运行工作流，结果会出现在这里。", "Run a workflow in the editor to see its results here.")
                  : t("游客可以编排和保存本地草稿，登录后可调用模型。", "Guests can edit local drafts. Sign in to run models.")}
              </p>
              <Link
                to={isLoggedIn ? '/workflows' : '/login'}
                className="text-action"
              >
                {isLoggedIn ? t("前往工作流", "Go to workflows") : t("登录工作台", "Sign in")} <FiArrowRight />
              </Link>
            </div>
          )}
        </section>
        <section className="surface studio-models">
          <div className="section-heading">
            <h2>{t("模型能力", "Model capabilities")}</h2>
          </div>
          {capabilityKinds.map(([kind, Icon, zh, en]) => (
            <div className="model-capability" key={kind}>
              <div className="model-capability-icon">
                <Icon />
              </div>
              <div>
                <strong>{t(zh, en)}</strong>
                <small>{catalog ? catalog[kind].join(' · ') || t('暂无启用模型', 'No enabled models') : t('目录暂不可用', 'Catalog unavailable')}</small>
              </div>
              <span>{catalog ? catalog[kind].length : '—'}</span>
            </div>
          ))}
        </section>
      </div>
      <footer className="studio-bottom">
        <span>{SITE.englishName.toUpperCase()} / AI WORKFLOW</span>
        <span>{t("灵感有起点，创作无边界。", "Create from an idea.")}</span>
      </footer>
    </main>
  );
}

function ExecutionList() {
  const t = useLabels();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [records, setRecords] = useState<Execution[]>([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!isLoggedIn) return;
    setLoading(true);
    setError('');
    try {
      const response = await aiWorkflowAPI.executions({
        page,
        ...(status === 'all' ? {} : { status }),
      });
      if (version !== requestVersion.current) return;
      setRecords(response.data || []);
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      if (version === requestVersion.current)
        setError(err.message || t("加载执行记录失败", "Could not load run history"));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [isLoggedIn, page, status, t]);
  useEffect(() => {
    const pendingRequests = requestVersion;
    load();
    return () => {
      pendingRequests.current++;
    };
  }, [load]);
  return (
    <main className="page-wrap">
      <header className="page-heading">
        <div>
          <span className="eyebrow">OBSERVE & ITERATE</span>
          <h1>{t("执行记录", "Runs")}</h1>
          <p>{t("回看节点输出、生成内容和每一步的运行状态。", "Review generated content, node outputs and run status.")}</p>
        </div>
        <button
          className="btn btn-default"
          disabled={loading || !isLoggedIn}
          onClick={load}
        >
          <FiRefreshCw className={loading ? 'spinning' : ''} /> {t("刷新记录", "Refresh runs")}
        </button>
      </header>
      <div className="execution-toolbar">
        {['all', 'success', 'failed', 'running'].map((value) => (
          <button
            key={value}
            className={`btn ${status === value ? 'btn-primary' : 'btn-default'}`}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {value === 'all' ? t("全部记录", "All runs") : t(STATUS_LABELS[value], value)}
          </button>
        ))}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <section className="surface execution-page-list">
        {loading ? (
          <div className="loading-state">
            <FiRefreshCw className="spinning" /> {t("加载中", "Loading")}
          </div>
        ) : records.length ? (
          <ExecutionRows records={records} />
        ) : (
          <div className="empty-state">
            <span className="empty-state-icon">
              <FiClock />
            </span>
            <h3>{isLoggedIn ? t("暂无执行记录", "No runs yet") : t("登录后查看执行记录", "Sign in to view runs")}</h3>
            <p>
              {isLoggedIn
                ? t("运行一个工作流，开始积累你的创作记录。", "Run a workflow to start your run history.")
                : t("执行历史与当前登录账号关联。", "Run history is linked to your account.")}
            </p>
            <Link
              className="btn btn-primary"
              to={isLoggedIn ? '/workflows' : '/login'}
            >
              {isLoggedIn ? t("前往工作流", "Go to workflows") : t("去登录", "Sign in")}
            </Link>
          </div>
        )}
      </section>
      <div className="pagination">
        <button
          className="btn btn-default"
          disabled={page === 1 || loading}
          onClick={() => setPage(page - 1)}
        >
          {t("上一页", "Previous")}
        </button>
        <span>{t("第", "Page")} {page} {t("页", "")}</span>
        <button
          className="btn btn-default"
          disabled={records.length < 20 || loading}
          onClick={() => setPage(page + 1)}
        >
          {t("下一页", "Next")}
        </button>
      </div>
    </main>
  );
}

function RecordDetail() {
  const t = useLabels();
  const { id } = useParams();
  const [record, setRecord] = useState<Execution | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setRecord(null);
    setError('');
    setLoading(true);
    const load = async () => {
      try {
        const response = await aiWorkflowAPI.execution(id || '');
        if (!active) return;
        setRecord(response.data);
        if (response.data?.status === 'running') timer = setTimeout(load, 3000);
      } catch (caughtError) {
      const err = normalizeError(caughtError);
        if (active) setError(err.message || t("读取执行详情失败", "Could not load run details"));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, revision, t]);
  return (
    <main className="page-wrap">
      <Link to="/executions" className="record-back">
        <FiArrowLeft /> {t("返回执行记录", "Back to runs")}
      </Link>
      <header className="page-heading">
        <div>
          <span className="eyebrow">EXECUTION INSPECTOR</span>
          <h1>{record?.workflowName || t("执行详情", "Run details")}</h1>
          <p>{t("查看模型输出与逐节点运行信息。", "Review model output and individual nodes.")}</p>
        </div>
        <button
          className="btn btn-default"
          disabled={loading}
          onClick={() => setRevision(revision + 1)}
        >
          <FiRefreshCw /> {t("刷新", "Refresh")}
        </button>
      </header>
      {loading && (
        <div className="loading-state">
          <FiRefreshCw className="spinning" /> {t("正在读取执行详情", "Loading run details")}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {record && <ExecutionResult record={record} />}
    </main>
  );
}

function Navigation() {
  const t = useLabels();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const siteName = useSiteStore((state) => state.config?.name) || SITE.name;
  const logoUrl = useSiteStore((state) => state.config?.logoUrl) || SITE.logoUrl;
  return (
    <nav className="app-nav" aria-label={t("主导航", "Main navigation")}>
      <Link to="/" className="nav-brand" aria-label={siteName}>
        <span className="brand-mark">
          {logoUrl ? (
            <img src={logoUrl} alt="" width="35" height="35" />
          ) : (
            <img src={`${process.env.PUBLIC_URL}/brand-mark.svg`} alt="" width="35" height="35" />
          )}
        </span>
        <strong>{siteName}</strong>
        <small>{t("AI 工作流", "AI Workflows")}</small>
      </Link>
      <div className="nav-links">
        <NavLink to="/" end className="nav-link">
          <FiGrid /> {t('工作台', 'Workspace')}
        </NavLink>
        <NavLink to="/workflows" className="nav-link">
          <FiGitBranch /> {t('工作流', 'Workflows')}
        </NavLink>
        <NavLink to="/agents" className="nav-link">
          <FiCpu /> {t('智能体', 'Agents')}
        </NavLink>
        <NavLink to="/knowledge" className="nav-link">
          <FiDatabase /> {t('知识库', 'Knowledge')}
        </NavLink>
        <NavLink to="/executions" className="nav-link">
          <FiClock /> {t('执行记录', 'Executions')}
        </NavLink>
        <NavLink to="/usage" className="nav-link"><FiActivity /> {t('用量总览','Usage')}</NavLink>
        <NavLink to="/docs" className="nav-link"><FiBookOpen /> {t('API 文档','API docs')}</NavLink>
        <a href={PARTNER_PATH} className="nav-link"><FiShield /> {t('代理商后台','Partner console')}</a>
      </div>
      <div className="nav-user">
        <LanguageSelect />
        <CreditBalanceLink className="nav-credit-link" />
        {isLoggedIn ? (
          <UserMenu />
        ) : (
          <>
            <span className="nav-guest">{t("访客空间", "Guest workspace")}</span>
            <Link to="/login" className="btn btn-default">
              {t("登录", "Sign in")}
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  const t = useLabels();
  const blocked = useSiteStore((state) => state.blocked);
  const loadSite = useSiteStore((state) => state.load);
  useEffect(() => {
    loadSite();
  }, [loadSite]);
  if (blocked) {
    return (
      <Router>
        <PageMetadata />
        <Routes>
          <Route path="/docs" element={<ApiDocs standalone />} />
          <Route path="*" element={
            <main className="page-wrap empty-state">
              <h1>{t('站点暂不可用', 'Site unavailable')}</h1>
              <p>{blocked}</p>
              <LanguageSelect />
              <Link to="/docs">{t('API 文档', 'API docs')}</Link>
              <a href={PARTNER_PATH}>{t('代理商后台', 'Partner console')}</a>
            </main>
          } />
        </Routes>
      </Router>
    );
  }
  return (
    <Router>
      <PageMetadata />
      <div className="app-shell">
        <Navigation />
        <div className="app-content">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/executions" element={<ExecutionList />} />
            <Route path="/executions/:id" element={<RecordDetail />} />
            <Route path="/credits" element={<WorkflowCreditsPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/docs" element={<ApiDocs />} />
            <Route path="/usage" element={<UsageOverview />} />
            <Route path="/help" element={<HelpCenter />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/agents/custom/new" element={<CustomAgentEditor />} />
            <Route path="/agents/custom/:id" element={<CustomAgentEditor />} />
            <Route path="/novel" element={<NovelList />} />
            <Route path="/novel/:id" element={<NovelStudio />} />
            <Route path="/agents/:id" element={<AgentStudio />} />
            <Route path="/workflows" element={<WorkflowList />} />
            <Route path="/workflows/:id/edit" element={<WorkflowEditor />} />
            {/* 知识库管理与文档检索测试沿用当前账号空间。 */}
            <Route path="/knowledge" element={<KnowledgeBase />} />
            <Route path="/knowledge/:id" element={<KnowledgeBaseDetail />} />
            <Route
              path="*"
              element={
                <main className="page-wrap empty-state">
                  <h1>{t("这里还没有内容", "Page not found")}</h1>
                  <Link to="/" className="btn btn-primary">
                    {t("返回工作台", "Back to workspace")}
                  </Link>
                </main>
              }
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
