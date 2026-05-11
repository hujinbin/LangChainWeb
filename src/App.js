import React, { useEffect, useState } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import WorkflowList from './pages/WorkflowList/WorkflowList';
import WorkflowEditor from './pages/WorkflowEditor/WorkflowEditor';

function Dashboard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function fetchRecords() {
    try {
      const res = await fetch('/api/workflow/records');
      const data = await res.json();
      setRecords(data);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    fetchRecords();
    const t = setInterval(fetchRecords, 5000);
    return () => clearInterval(t);
  }, []);

  async function triggerWorkflow(type = '全流程') {
    setLoading(true);
    try {
      const res = await fetch('/api/workflow/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_type: type })
      });
      const rec = await res.json();
      await fetchRecords();
      navigate(`/executions/${rec.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="left panel">
        <div className="controls">
          <button onClick={() => triggerWorkflow('全流程')} disabled={loading}>触发全流程</button>
          <button onClick={() => triggerWorkflow('文章创作')} disabled={loading}>文章创作</button>
          <button onClick={() => triggerWorkflow('视频创作')} disabled={loading}>视频创作</button>
          <button onClick={() => triggerWorkflow('对标账号工作流')} disabled={loading} style={{background: '#0f62fe'}}>对标账号工作流</button>
        </div>

        <h3>历史记录</h3>
        <div className="cards">
          {records.map(r => (
            <div key={r.id} className="card" onClick={() => navigate(`/executions/${r.id}`)}>
              <div className="meta">
                <div style={{ fontWeight: 600 }}>#{r.id} {r.workflow_type}</div>
                <div style={{ marginLeft: 'auto' }} className={`badge ${r.status === '待执行' ? 'pending' : r.status === '执行中' ? 'running' : r.status === '执行成功' ? 'success' : 'failed'}`}>
                  {r.status}
                </div>
              </div>
              <div className="small">触发：{r.trigger_type} · {new Date(r.execute_time).toLocaleString()}</div>
              <div style={{ marginTop: 8 }} className="small">文章：{r.article_content ? `${r.article_content.length} 字` : '无'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="right panel">
        <h3>详情</h3>
        <div className="detail">
          <div className="small">请选择左侧卡片查看详情或触发新工作流</div>
        </div>
      </div>
    </div>
  );
}

function RecordDetail() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/workflow/records/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) setRecord(data);
        }
      } catch (e) { console.error(e); }
    }
    load();
    const t = setInterval(load, 4000);

    // 打开 SSE 连接以接收实时日志
    let es;
    try {
      es = new EventSource(`/api/workflow/records/${id}/events`);
      es.onmessage = (ev) => {
        // 有时后端会发送心跳注释，这里只处理有效数据
        if (!ev.data) return;
        const raw = ev.data;
        if (raw === ': keep-alive') return;
        setLogs(prev => [...prev, raw]);
      };
      es.onerror = (err) => {
        // 浏览器会自动重连；记录错误到日志供调试
        console.warn('SSE error', err);
      };
    } catch (e) {
      console.warn('EventSource not supported', e);
    }

    return () => { mounted = false; clearInterval(t); if (es) es.close(); };
  }, [id]);

  if (!record) return <div className="panel" style={{ padding: 16 }}>加载中...</div>;

  return (
    <div className="panel" style={{ padding: 16 }}>
      <div><strong>状态：</strong><span className={`badge ${record.status === '待执行' ? 'pending' : record.status === '执行中' ? 'running' : record.status === '执行成功' ? 'success' : 'failed'}`}>{record.status}</span></div>
      <div><strong>执行时间：</strong>{new Date(record.execute_time).toLocaleString()}</div>
      <div><strong>完成时间：</strong>{record.finish_time ? new Date(record.finish_time).toLocaleString() : '-'}</div>
      <div><strong>错误：</strong>{record.error_msg ? <span className="error">{record.error_msg}</span> : '-'}</div>
      <div style={{ marginTop: 8 }}><strong>文章长度：</strong>{record.article_content ? record.article_content.length : 0}</div>
      <div style={{ marginTop: 12 }}><strong>文章预览：</strong></div>
      {record.preview_path ? (
        <div className="iframe-wrap"><iframe title="preview" src={`/outputs/${record.preview_path}`} width="100%" height="100%" /></div>
      ) : (<div className="small">没有预览</div>)}

      <div style={{ marginTop: 12 }}><strong>实时日志：</strong></div>
      <div className="panel" style={{ maxHeight: 240, overflow: 'auto', background: '#0b1220', color: '#e6eef8', padding: 8 }}>
        {logs.length === 0 ? <div className="small">暂无日志</div> : logs.map((l, i) => <div key={i} style={{ fontFamily: 'monospace', fontSize: 13 }}>{l}</div>)}
      </div>
    </div>
  );
}

function Navigation() {
  return (
    <div style={{ padding: 12, background: '#001529', color: 'white', display: 'flex', alignItems: 'center', gap: 24 }}>
      <Link to="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 600 }}>
        🚀 工作流平台
      </Link>
      <Link to="/workflows" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
        工作流管理
      </Link>
      <Link to="/" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
        执行记录
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navigation />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Routes>
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
