import React, { useEffect, useState } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import WorkflowList from './pages/WorkflowList/WorkflowList';
import WorkflowEditor from './pages/WorkflowEditor/WorkflowEditor';
import Login from './pages/Login/Login';
import useAuthStore from './store/authStore';
import { aiWorkflowAPI } from './services/api';

function Dashboard() {
  const [records, setRecords] = useState([]);
  const [features, setFeatures] = useState([]);
  const navigate = useNavigate();

  async function fetchRecords() {
    try {
      const response = await aiWorkflowAPI.executions();
      setRecords(response.data || []);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    fetchRecords();
    aiWorkflowAPI.getFeatures()
      .then((response) => setFeatures(response.data?.features || []))
      .catch(() => setFeatures([]));
    const t = setInterval(fetchRecords, 5000);
    return () => clearInterval(t);
  }, []);

  const successCount = records.filter((record) => record.status === 'success').length;
  const failedCount = records.filter((record) => record.status === 'failed').length;

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">AI Workflow Platform</span>
          <h1>把 AI、接口和流程编排成可运行的自动化工作台</h1>
          <p>创建节点流程，保存画布结构，校验依赖关系，并用执行记录追踪每一次运行结果。</p>
          <div className="home-actions">
            <button className="primary-action" onClick={() => navigate('/workflows/new/edit')}>创建工作流</button>
            <button className="secondary-action" onClick={() => navigate('/workflows')}>查看工作流</button>
          </div>
        </div>
        <div className="hero-preview" aria-hidden="true">
          <div className="preview-toolbar">
            <span />
            <span />
            <span />
          </div>
          <div className="preview-canvas">
            <div className="preview-node trigger">手动触发</div>
            <div className="preview-line" />
            <div className="preview-node ai">AI 大模型</div>
            <div className="preview-line" />
            <div className="preview-node output">输出响应</div>
          </div>
        </div>
      </section>

      <section className="home-stats">
        <div className="stat-card">
          <span>执行记录</span>
          <strong>{records.length}</strong>
        </div>
        <div className="stat-card">
          <span>成功运行</span>
          <strong>{successCount}</strong>
        </div>
        <div className="stat-card">
          <span>失败运行</span>
          <strong>{failedCount}</strong>
        </div>
        <div className="stat-card">
          <span>能力模块</span>
          <strong>{features.length || 6}</strong>
        </div>
      </section>

      <section className="home-grid">
        <div className="panel home-panel">
          <div className="section-heading">
            <div>
              <h2>最近执行</h2>
              <p>快速查看工作流运行结果和耗时。</p>
            </div>
            <button className="text-action" onClick={fetchRecords}>刷新</button>
          </div>
          <div className="execution-list">
            {records.length === 0 ? (
              <div className="empty-copy">暂无执行记录，先创建并运行一个工作流。</div>
            ) : records.slice(0, 6).map((record) => (
              <button key={record.id} className="execution-row" onClick={() => navigate(`/executions/${record.id}`)}>
                <div>
                  <strong>{record.workflow_type || record.workflowName || record.id}</strong>
                  <span>{record.execute_time ? new Date(record.execute_time).toLocaleString() : '-'}</span>
                </div>
                <span className={`badge ${record.status === 'success' ? 'success' : 'failed'}`}>{record.status}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel home-panel">
          <div className="section-heading">
            <div>
              <h2>平台能力</h2>
              <p>当前后端已接入的核心闭环。</p>
            </div>
          </div>
          <div className="feature-list">
            {(features.length ? features : [
              '可视化工作流编排',
              '节点类型登记',
              '工作流资产管理',
              '结构校验',
              '模拟执行',
              '执行历史',
            ]).map((feature) => (
              <div key={feature} className="feature-item">{feature}</div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function RecordDetail() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await aiWorkflowAPI.executions();
        const data = (response.data || []).find((item) => item.id === id);
        if (mounted) setRecord(data || null);
      } catch (e) { console.error(e); }
    }
    load();
    return () => { mounted = false; };
  }, [id]);

  if (!record) return <div className="panel" style={{ padding: 16 }}>未找到执行记录</div>;

  return (
    <div className="panel" style={{ padding: 16 }}>
      <div><strong>状态：</strong><span className={`badge ${record.status === 'success' ? 'success' : 'failed'}`}>{record.status}</span></div>
      <div><strong>执行时间：</strong>{record.execute_time ? new Date(record.execute_time).toLocaleString() : '-'}</div>
      <div><strong>耗时：</strong>{record.durationMs || 0}ms</div>
      <div><strong>错误：</strong>{record.error_msg ? <span className="error">{record.error_msg}</span> : '-'}</div>
      <div style={{ marginTop: 12 }}><strong>输出：</strong></div>
      <div className="panel" style={{ maxHeight: 240, overflow: 'auto', background: '#0b1220', color: '#e6eef8', padding: 8 }}>
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(record.output || {}, null, 2)}</pre>
      </div>
    </div>
  );
}

function Navigation() {
  const { user, isLoggedIn, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="app-nav">
      <Link to="/" className="nav-brand">
        工作流平台
      </Link>
      <Link to="/workflows" className="nav-link">
        工作流管理
      </Link>
      <Link to="/" className="nav-link">
        执行记录
      </Link>
      <div className="nav-user">
        {isLoggedIn ? (
          <>
            <span>
              {user?.nickname || user?.mobile || '用户'}
            </span>
            <button onClick={handleLogout} className="nav-button">
              退出
            </button>
          </>
        ) : (
          <Link to="/login" className="nav-login">
            登录
          </Link>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navigation />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/executions/:id" element={<RecordDetail />} />
            <Route path="/workflows" element={<WorkflowList />} />
            <Route path="/workflows/:id/edit" element={<WorkflowEditor />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
