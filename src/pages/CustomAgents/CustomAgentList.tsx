import { useLabels } from '../../store/languageStore';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowUpRight, FiPlus, FiRefreshCw, FiSearch, FiTrash2 } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { customAgentAPI } from '../../services/customAgentApi';
import type { CustomAgent } from '../../types/customAgent';
import { errorMessage } from '../Agents/AgentShared';
import { AgentAvatar } from './CustomAgentShared';
import './CustomAgents.css';
import { categorizedCustomAgents, type CategoryFilter, type OutputCategory } from '../Agents/agentCategories';

export default function CustomAgentList({ category = 'all' }: { category?: CategoryFilter }) {
  const t = useLabels();
  const { isLoggedIn, token } = useAuthStore();
  const [items, setItems] = useState<CustomAgent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState('');
  const [categorized, setCategorized] = useState<Array<{ agent: CustomAgent; categories: Set<OutputCategory> }>>([]);
  const filtering = category !== 'all';
  const remotePage = filtering ? 1 : page;
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => { setPage(1); }, [category]);
  useEffect(() => {
    const controller = new AbortController();
    setItems([]); setCategorized([]); setError(''); setTotal(0); setLoading(isLoggedIn);
    if (!isLoggedIn) return;
    const timer = setTimeout(() => {
      const read = filtering
        ? categorizedCustomAgents(keyword.trim(), controller.signal).then(result => {
          if (!controller.signal.aborted) setCategorized(result);
        })
        : customAgentAPI.list({ page: remotePage, pageSize: 12, keyword: keyword.trim() }, controller.signal).then(result => {
          if (!controller.signal.aborted) { setItems(result.items); setTotal(result.total); }
        });
      read.catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [isLoggedIn, token, remotePage, keyword, revision, filtering]);
  const matches = category === 'all' ? items : categorized.filter(row => row.categories.has(category)).map(row => row.agent);
  const visible = filtering ? matches.slice((page - 1) * 12, page * 12) : items;
  const count = filtering ? matches.length : total;
  const remove = async (agent: CustomAgent) => {
    if (!window.confirm(`确认删除智能体“${agent.name}”？此操作无法撤销。`)) return;
    setDeleting(agent.id); setError('');
    try { await customAgentAPI.delete(agent.id); if (visible.length === 1 && page > 1) setPage(value => value - 1); reload(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setDeleting(''); }
  };
  return <section className="custom-agent-list" aria-label={t("我的智能体", "My agents")}>
    <div className="agent-section-heading"><div><h2>{t("我的智能体", "My agents")}</h2><p>{t("定义人设，连接知识与工作流，创建属于你的助手。", "Define a persona and connect your workflows and knowledge bases.")}</p></div><Link className="btn btn-primary" to={isLoggedIn ? '/agents/custom/new' : '/login'}><FiPlus /> {t("创建智能体", "Create agent")}</Link></div>
    {isLoggedIn ? <>
      <div className="custom-agent-list-toolbar"><label><FiSearch /><input aria-label={t("搜索我的智能体", "Search my agents")} placeholder={t("搜索智能体", "Search agents")} value={keyword} onChange={event => { setKeyword(event.target.value); setPage(1); }} /></label><button className="btn-icon" aria-label={t("刷新我的智能体", "Refresh my agents")} disabled={loading} onClick={reload}><FiRefreshCw /></button></div>
      {error && <div className="agent-error" role="alert">{error}<button onClick={reload}>{t("重试", "Retry")}</button></div>}
      {loading ? <p className="custom-agent-empty" role="status">{t("正在读取智能体…", "Loading agents…")}</p> : visible.length ? <div className="custom-agent-card-grid">{visible.map(agent => <article className="custom-agent-card" key={agent.id}><Link to={`/agents/custom/${agent.id}`}><AgentAvatar value={agent.avatar} name={agent.name} /><span className={`badge ${agent.status === 'published' ? 'success' : 'draft'}`}>{agent.hasUnpublishedChanges ? t("草稿有更新，待发布", "Unpublished changes") : agent.status === 'published' ? t("已发布", "Published") : t("草稿", "Draft")}</span><h3>{agent.name}</h3><p>{agent.description || t("从人设开始，赋予助手自己的能力。", "Define a persona and give your assistant tools.")}</p><footer><span>{agent.workflowIds?.length || 0} {t("个工作流 ·", "workflows ·")} {agent.knowledgeBaseIds?.length || 0} {t("个知识库", "knowledge bases")}</span><FiArrowUpRight /></footer></Link><button className="custom-agent-delete" aria-label={`删除智能体${agent.name}`} disabled={Boolean(deleting)} onClick={() => void remove(agent)}><FiTrash2 /></button></article>)}</div> : !error && <p className="custom-agent-empty">{filtering || keyword ? t("没有符合筛选条件的智能体。", "No agents match your filters.") : t("还没有自己的智能体。点击“创建智能体”，开始配置你的第一个助手。", "Create an agent to configure your first assistant.")}</p>}
      {count > 12 && <div className="pagination"><button className="btn btn-default" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>{t("上一页", "Previous")}</button><span>{t("第", "Page")} {page} {t("页", "")}</span><button className="btn btn-default" disabled={loading || page * 12 >= count} onClick={() => setPage(value => value + 1)}>{t("下一页", "Next")}</button></div>}
    </> : <div className="custom-agent-empty"><p>{t("登录后可以创建、保存和调试自己的智能体。", "Sign in to create, save and test your own agents.")}</p><Link to="/login">{t("前往登录", "Sign in")} <FiArrowUpRight /></Link></div>}
  </section>;
}
