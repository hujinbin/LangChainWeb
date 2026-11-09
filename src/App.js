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
  FiLogOut,
} from 'react-icons/fi';
import WorkflowList from './pages/WorkflowList/WorkflowList';
import WorkflowEditor from './pages/WorkflowEditor/WorkflowEditor';
import Login from './pages/Login/Login';
import ExecutionResult from './components/ExecutionResult/ExecutionResult';
import useAuthStore from './store/authStore';
import { aiWorkflowAPI } from './services/api';
import localStorageService from './services/localStorage';
import { WORKFLOW_TEMPLATES } from './constants/workflowTemplates';
import './App.css';

export const STATUS_LABELS = {
  success: '已完成',
  failed: '运行失败',
  running: '运行中',
};
const TEMPLATE_ICONS = [FiType, FiImage, FiVideo];

export function TemplateCards() {
  const navigate = useNavigate();
  return (
    <div className="template-grid">
      {WORKFLOW_TEMPLATES.map((template, index) => {
        const Icon = TEMPLATE_ICONS[index];
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
            <strong>{template.name}</strong>
            <p>{template.description}</p>
            <small>03 NODES · FLASH</small>
          </button>
        );
      })}
    </div>
  );
}

function ExecutionRows({ records }) {
  const navigate = useNavigate();
  return records.map((record) => (
    <button
      key={record.id}
      className="execution-row"
      onClick={() => navigate(`/executions/${record.id}`)}
    >
      <div className="execution-row-main">
        <FiGitBranch />
        <div>
          <strong>
            {record.workflowName || record.workflow_type || '未命名工作流'}
          </strong>
          <small>
            {record.execute_time
              ? new Date(record.execute_time).toLocaleString('zh-CN')
              : '时间未知'}
            {record.simulated ? ' · 模拟预览' : ' · 模型运行'}
          </small>
        </div>
      </div>
      <div className="execution-row-end">
        <span>{((record.durationMs || 0) / 1000).toFixed(1)} s</span>
        <b className={`badge ${record.status}`}>
          {STATUS_LABELS[record.status] || record.status}
        </b>
        <FiArrowRight />
      </div>
    </button>
  ));
}

function Dashboard() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [records, setRecords] = useState([]);
  const [workflowCount, setWorkflowCount] = useState(0);
  const requestVersion = useRef(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
    } catch (err) {
      if (version === requestVersion.current)
        setError(err.message || '读取工作台失败');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [isLoggedIn]);
  useEffect(() => {
    const pendingRequests = requestVersion;
    fetchOverview();
    return () => {
      pendingRequests.current++;
    };
  }, [fetchOverview]);
  const stats = [
    {
      label: isLoggedIn ? '工作流 · 最近 20 条' : '本地工作流',
      value: workflowCount,
      icon: FiGitBranch,
    },
    { label: '执行 · 最近 20 条', value: records.length, icon: FiActivity },
    {
      label: '成功执行',
      value: records.filter((record) => record.status === 'success').length,
      icon: FiCheckCircle,
    },
    { label: 'Flash 模型配置', value: '2 / 3 / 1', icon: FiZap },
  ];
  return (
    <main className="page-wrap">
      <header className="page-heading">
        <div>
          <span className="eyebrow">YOUR CREATIVE WORKSPACE</span>
          <h1>工作台</h1>
          <p>把一个想法，连接成一段完整的 AI 工作流。</p>
        </div>
        <span className="section-caption">
          {new Date().toLocaleDateString('zh-CN', {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </span>
      </header>
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button className="text-action" onClick={fetchOverview}>
            重试
          </button>
        </div>
      )}
      <section className="studio-hero">
        <div className="studio-hero-copy">
          <span className="eyebrow">LESS REPETITION. MORE CREATION.</span>
          <h2>
            让想法，<em>流动起来。</em>
          </h2>
          <p>
            从一句提示词到文字、画面与视频。连接 Flash
            模型，让每个节点接住你的下一个灵感。
          </p>
          <button
            className="btn btn-lime"
            onClick={() => navigate('/workflows/new/edit')}
          >
            <FiPlus /> 创建工作流 <FiArrowRight />
          </button>
        </div>
        <div className="hero-workflow" aria-hidden="true">
          <div className="hero-flow-node">
            <FiType />
            <span>文本灵感</span>
            <small>TEXT / FLASH</small>
          </div>
          <FiArrowRight className="hero-flow-arrow" />
          <div className="hero-flow-node featured">
            <FiImage />
            <span>生成画面</span>
            <small>IMAGE / FLASH</small>
          </div>
          <FiArrowRight className="hero-flow-arrow" />
          <div className="hero-flow-node">
            <FiVideo />
            <span>创意短片</span>
            <small>VIDEO / 720P</small>
          </div>
          <span className="hero-floating-note">
            <FiZap /> CONNECT YOUR NEXT IDEA
          </span>
        </div>
      </section>
      <section className="studio-stats" aria-label="工作台概览">
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
            <h2>从一个灵感开始</h2>
            <p>选择已配置的起点，在画布里继续创作。</p>
          </div>
          <span className="section-caption">QUICK START / 03</span>
        </div>
        <TemplateCards />
      </section>
      <div className="studio-grid">
        <section className="surface studio-recent">
          <div className="section-heading">
            <h2>最近执行</h2>
            <Link className="text-action" to="/executions">
              全部记录 <FiArrowRight />
            </Link>
          </div>
          {loading ? (
            <div className="loading-state">
              <FiRefreshCw className="spinning" /> 读取运行记录
            </div>
          ) : records.length ? (
            <ExecutionRows records={records.slice(0, 4)} />
          ) : (
            <div className="empty-state">
              <span className="empty-state-icon">
                <FiActivity />
              </span>
              <h3>{isLoggedIn ? '等待第一次运行' : '登录后记录每一次创作'}</h3>
              <p>
                {isLoggedIn
                  ? '在编辑器中运行工作流，结果会出现在这里。'
                  : '游客可以编排和保存本地草稿，登录后可调用模型。'}
              </p>
              <Link
                to={isLoggedIn ? '/workflows' : '/login'}
                className="text-action"
              >
                {isLoggedIn ? '前往工作流' : '登录工作台'} <FiArrowRight />
              </Link>
            </div>
          )}
        </section>
        <section className="surface studio-models">
          <div className="section-heading">
            <h2>模型能力</h2>
            <span className="badge success">
              <FiZap /> FLASH ONLY
            </span>
          </div>
          {[
            [FiType, '文本生成', 'Agnes 3.0 / 2.5 Flash', '2 个模型'],
            [FiImage, '图片生成', 'Agnes Image 2.0 / 2.1 / 2.5', '3 个模型'],
            [FiVideo, '视频生成', 'Agnes Video 2.5 Flash · 720P', '1 个模型'],
          ].map(([Icon, name, detail, count]) => (
            <div className="model-capability" key={name}>
              <div className="model-capability-icon">
                <Icon />
              </div>
              <div>
                <strong>{name}</strong>
                <small>{detail}</small>
              </div>
              <span>{count}</span>
            </div>
          ))}
        </section>
      </div>
      <footer className="studio-bottom">
        <span>FLOW STUDIO / AI WORKFLOW</span>
        <span>灵感有起点，创作无边界。</span>
      </footer>
    </main>
  );
}

function ExecutionList() {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [records, setRecords] = useState([]);
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
    } catch (err) {
      if (version === requestVersion.current)
        setError(err.message || '加载执行记录失败');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [isLoggedIn, page, status]);
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
          <h1>执行记录</h1>
          <p>回看节点输出、生成内容和每一步的运行状态。</p>
        </div>
        <button
          className="btn btn-default"
          disabled={loading || !isLoggedIn}
          onClick={load}
        >
          <FiRefreshCw className={loading ? 'spinning' : ''} /> 刷新记录
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
            {value === 'all' ? '全部记录' : STATUS_LABELS[value]}
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
            <FiRefreshCw className="spinning" /> 加载中
          </div>
        ) : records.length ? (
          <ExecutionRows records={records} />
        ) : (
          <div className="empty-state">
            <span className="empty-state-icon">
              <FiClock />
            </span>
            <h3>{isLoggedIn ? '暂无执行记录' : '登录后查看执行记录'}</h3>
            <p>
              {isLoggedIn
                ? '运行一个工作流，开始积累你的创作记录。'
                : '执行历史与当前登录账号关联。'}
            </p>
            <Link
              className="btn btn-primary"
              to={isLoggedIn ? '/workflows' : '/login'}
            >
              {isLoggedIn ? '前往工作流' : '去登录'}
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
          上一页
        </button>
        <span>第 {page} 页</span>
        <button
          className="btn btn-default"
          disabled={records.length < 20 || loading}
          onClick={() => setPage(page + 1)}
        >
          下一页
        </button>
      </div>
    </main>
  );
}

function RecordDetail() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let timer;
    setRecord(null);
    setError('');
    setLoading(true);
    const load = async () => {
      try {
        const response = await aiWorkflowAPI.execution(id);
        if (!active) return;
        setRecord(response.data);
        if (response.data?.status === 'running') timer = setTimeout(load, 3000);
      } catch (err) {
        if (active) setError(err.message || '读取执行详情失败');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, revision]);
  return (
    <main className="page-wrap">
      <Link to="/executions" className="record-back">
        <FiArrowLeft /> 返回执行记录
      </Link>
      <header className="page-heading">
        <div>
          <span className="eyebrow">EXECUTION INSPECTOR</span>
          <h1>{record?.workflowName || '执行详情'}</h1>
          <p>查看模型输出与逐节点运行信息。</p>
        </div>
        <button
          className="btn btn-default"
          disabled={loading}
          onClick={() => setRevision(revision + 1)}
        >
          <FiRefreshCw /> 刷新
        </button>
      </header>
      {loading && (
        <div className="loading-state">
          <FiRefreshCw className="spinning" /> 正在读取执行详情
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
  const { user, isLoggedIn, logout } = useAuthStore();
  const navigate = useNavigate();
  return (
    <nav className="app-nav" aria-label="主导航">
      <Link to="/" className="nav-brand">
        <span className="brand-mark">
          <FiGitBranch />
        </span>
        <strong>Flow</strong>
        <small>AI 工作流</small>
      </Link>
      <div className="nav-links">
        <NavLink to="/" end className="nav-link">
          <FiGrid /> 工作台
        </NavLink>
        <NavLink to="/workflows" className="nav-link">
          <FiGitBranch /> 工作流
        </NavLink>
        <NavLink to="/executions" className="nav-link">
          <FiClock /> 执行记录
        </NavLink>
      </div>
      <div className="nav-user">
        {isLoggedIn ? (
          <>
            <span className="nav-avatar">
              {(user?.nickname || 'U').slice(0, 1)}
            </span>
            <span className="nav-user-name">
              {user?.nickname || user?.mobile || '用户'}
            </span>
            <button
              className="btn-icon"
              aria-label="退出登录"
              title="退出登录"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <FiLogOut />
            </button>
          </>
        ) : (
          <>
            <span className="nav-guest">访客空间</span>
            <Link to="/login" className="btn btn-default">
              登录
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <div className="app-shell">
        <Navigation />
        <div className="app-content">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/executions" element={<ExecutionList />} />
            <Route path="/executions/:id" element={<RecordDetail />} />
            <Route path="/workflows" element={<WorkflowList />} />
            <Route path="/workflows/:id/edit" element={<WorkflowEditor />} />
            <Route
              path="*"
              element={
                <main className="page-wrap empty-state">
                  <h1>这里还没有内容</h1>
                  <Link to="/" className="btn btn-primary">
                    返回工作台
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
