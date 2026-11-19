import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowUpRight, FiPlus, FiRefreshCw, FiSearch, FiTrash2 } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { customAgentAPI } from '../../services/customAgentApi';
import type { CustomAgent } from '../../types/customAgent';
import { errorMessage } from '../Agents/AgentShared';
import { AgentAvatar } from './CustomAgentShared';
import './CustomAgents.css';

export default function CustomAgentList() {
  const { isLoggedIn, token } = useAuthStore();
  const [items, setItems] = useState<CustomAgent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState('');
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setItems([]); setError(''); setTotal(0);
    if (!isLoggedIn) return;
    const timer = setTimeout(() => {
      setLoading(true);
      customAgentAPI.list({ page, pageSize: 12, keyword: keyword.trim() }, controller.signal).then(result => {
        if (!controller.signal.aborted) { setItems(result.items); setTotal(result.total); }
      }).catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [isLoggedIn, token, page, keyword, revision]);
  const remove = async (agent: CustomAgent) => {
    if (!window.confirm(`确认删除智能体“${agent.name}”？此操作无法撤销。`)) return;
    setDeleting(agent.id); setError('');
    try { await customAgentAPI.delete(agent.id); if (items.length === 1 && page > 1) setPage(value => value - 1); else reload(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setDeleting(''); }
  };
  return <section className="custom-agent-list" aria-label="我的智能体">
    <div className="agent-section-heading"><div><h2>我的智能体</h2><p>定义人设，连接知识与工作流，创建属于你的助手。</p></div><Link className="btn btn-primary" to={isLoggedIn ? '/agents/custom/new' : '/login'}><FiPlus /> 创建智能体</Link></div>
    {isLoggedIn ? <>
      <div className="custom-agent-list-toolbar"><label><FiSearch /><input aria-label="搜索我的智能体" placeholder="搜索智能体" value={keyword} onChange={event => { setKeyword(event.target.value); setPage(1); }} /></label><button className="btn-icon" aria-label="刷新我的智能体" disabled={loading} onClick={reload}><FiRefreshCw /></button></div>
      {error && <div className="agent-error" role="alert">{error}<button onClick={reload}>重试</button></div>}
      {loading ? <p className="custom-agent-empty" role="status">正在读取智能体…</p> : items.length ? <div className="custom-agent-card-grid">{items.map(agent => <article className="custom-agent-card" key={agent.id}><Link to={`/agents/custom/${agent.id}`}><AgentAvatar value={agent.avatar} name={agent.name} /><span className={`badge ${agent.status === 'published' ? 'success' : 'draft'}`}>{agent.hasUnpublishedChanges ? '草稿有更新，待发布' : agent.status === 'published' ? '已发布' : '草稿'}</span><h3>{agent.name}</h3><p>{agent.description || '从人设开始，赋予助手自己的能力。'}</p><footer><span>{agent.workflowIds?.length || 0} 个工作流 · {agent.knowledgeBaseIds?.length || 0} 个知识库</span><FiArrowUpRight /></footer></Link><button className="custom-agent-delete" aria-label={`删除智能体${agent.name}`} disabled={Boolean(deleting)} onClick={() => void remove(agent)}><FiTrash2 /></button></article>)}</div> : !error && <p className="custom-agent-empty">还没有自己的智能体。点击“创建智能体”，开始配置你的第一个助手。</p>}
      {total > 12 && <div className="pagination"><button className="btn btn-default" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>上一页</button><span>第 {page} 页</span><button className="btn btn-default" disabled={loading || page * 12 >= total} onClick={() => setPage(value => value + 1)}>下一页</button></div>}
    </> : <div className="custom-agent-empty"><p>登录后可以创建、保存和调试自己的智能体。</p><Link to="/login">前往登录 <FiArrowUpRight /></Link></div>}
  </section>;
}
