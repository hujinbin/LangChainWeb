import { useEffect, useState } from 'react';
import { FiDatabase, FiPlus, FiRefreshCw, FiTrash2, FiZap } from 'react-icons/fi';
import { workflowResourcesAPI } from '../../services/workflowResourcesApi';
import type { WorkflowHttpTool } from '../../services/workflowResourcesApi';
import { KnowledgeModal } from '../../pages/KnowledgeBase/KnowledgeBaseShared';
import { errorMessage } from '../../pages/Agents/AgentShared';
import { asRecord } from '../../types/api';
import './WorkflowResources.css';

const emptyTool = () => ({ id: '', name: '', description: '', url: '', method: 'GET' as 'GET' | 'POST', headers: '{}', parameters: '{\n  "type": "object",\n  "properties": {}\n}' });
function parseObject(source: string, label: string) {
  let value: unknown; try { value = JSON.parse(source); } catch { throw new Error(`${label}需要有效的 JSON`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}需要为 JSON 对象`);
  return value as Record<string, unknown>;
}
export default function WorkflowResources({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<'tools' | 'data'>('tools');
  const [tools, setTools] = useState<WorkflowHttpTool[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [tool, setTool] = useState(emptyTool);
  const [table, setTable] = useState('');
  const [tableName, setTableName] = useState('');
  const [recordsText, setRecordsText] = useState('[\n  { "name": "示例" }\n]');
  const [whereText, setWhereText] = useState('{}');
  const [limit, setLimit] = useState(20);
  const [result, setResult] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setLoading(true); setError('');
    Promise.all([workflowResourcesAPI.tools(controller.signal), workflowResourcesAPI.tables(controller.signal)]).then(([availableTools, availableTables]) => { if (!controller.signal.aborted) { setTools(availableTools); setTables(availableTables); setTable(current => availableTables.includes(current) ? current : availableTables[0] || ''); } }).catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, revision]);
  const perform = async (action: () => Promise<unknown>, success: string, changed = false) => {
    setBusy(true); setError(''); setNotice('');
    try { const response = await action(); if (changed) { onChanged(); setRevision(value => value + 1); } setNotice(success); return { value: response }; }
    catch (cause) { setError(errorMessage(cause)); return undefined; }
    finally { setBusy(false); }
  };
  const saveTool = async () => {
    try {
      if (!tool.name.trim()) throw new Error('请填写插件名称');
      let url: URL; try { url = new URL(tool.url); } catch { throw new Error('请填写有效的插件接口地址'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('插件接口需要有效的 HTTP 或 HTTPS 地址');
      const headers = parseObject(tool.headers, '请求头'); if (Object.values(headers).some(value => typeof value !== 'string')) throw new Error('请求头的值需要为字符串');
      const parameters = parseObject(tool.parameters, '参数 schema');
      const response = await perform(() => workflowResourcesAPI.saveTool({ ...(tool.id ? { id: tool.id } : {}), name: tool.name.trim(), description: tool.description, url: tool.url.trim(), method: tool.method, headers: headers as Record<string, string>, parameters }), '插件已保存', true);
      if (response) { const saved = asRecord(response.value); const savedId = saved.id || saved._id; if (typeof savedId === 'string') setTool(current => ({ ...current, id: savedId })); }
    } catch (cause) { setError(errorMessage(cause)); }
  };
  const editTool = (item: WorkflowHttpTool) => { setTool({ id: item.id, name: item.name, description: item.description || '', url: item.url, method: item.method, headers: JSON.stringify(item.headers || {}, null, 2), parameters: JSON.stringify(item.parameters || {}, null, 2) }); setError(''); setNotice(''); };
  const insert = async () => {
    try { if (!table) throw new Error('请先创建或选择数据表'); const records: unknown = JSON.parse(recordsText); if (!Array.isArray(records) || !records.length || records.length > 100 || records.some(value => !value || typeof value !== 'object' || Array.isArray(value))) throw new Error('请填写 1 至 100 条 JSON 对象组成的数组'); const response = await perform(() => workflowResourcesAPI.insert(table, records), '记录已录入', true); if (response) setResult(response.value); }
    catch (cause) { setError(cause instanceof SyntaxError ? '记录需要有效的 JSON 数组' : errorMessage(cause)); }
  };
  const query = async () => {
    try { if (!table) throw new Error('请选择数据表'); if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('查询数量需要在 1 至 100 之间'); const where = parseObject(whereText, '查询条件'); const response = await perform(() => workflowResourcesAPI.query(table, { where, limit }), '查询已完成'); if (response) setResult(response.value); }
    catch (cause) { setError(errorMessage(cause)); }
  };
  if (!open) return null;
  return <KnowledgeModal title="工作流资源" onClose={onClose} busy={busy}>
    <div className="workflow-resources"><div className="workflow-resource-tabs"><button className={tab === 'tools' ? 'active' : ''} disabled={busy} onClick={() => setTab('tools')}><FiZap />HTTP 插件</button><button className={tab === 'data' ? 'active' : ''} disabled={busy} onClick={() => setTab('data')}><FiDatabase />数据表</button><button className="text-action" aria-label="刷新工作流资源" disabled={busy || loading} onClick={() => setRevision(value => value + 1)}><FiRefreshCw /></button></div>
      {error && <p className="workflow-resource-error" role="alert">{error}</p>}{notice && <p className="workflow-resource-notice" role="status">{notice}</p>}{loading && <p className="workflow-resource-help" role="status">正在读取资源…</p>}
      {tab === 'tools' ? <div className="workflow-resource-layout"><aside className="workflow-resource-list"><button className="btn btn-default" disabled={busy} onClick={() => setTool(emptyTool())}><FiPlus />新建插件</button>{tools.map(item => <div className={tool.id === item.id ? 'active' : ''} key={item.id}><button disabled={busy} onClick={() => editTool(item)}><strong>{item.name}</strong><small>{item.method} · {item.description || 'HTTP 插件'}</small></button><button className="workflow-resource-remove" aria-label={`删除插件${item.name}`} disabled={busy} onClick={() => { if (window.confirm(`确认删除插件“${item.name}”？`)) void perform(() => workflowResourcesAPI.deleteTool(item.id), '插件已删除', true).then(response => { if (response && tool.id === item.id) setTool(emptyTool()); }); }}><FiTrash2 /></button></div>)}{!tools.length && !loading && <p className="workflow-resource-help">暂无插件。保存后可在 HTTP 插件节点中选择。</p>}</aside><fieldset disabled={busy} className="workflow-resource-form"><h3>{tool.id ? '编辑插件' : '创建插件'}</h3><label>插件名称<input aria-label="插件名称" value={tool.name} maxLength={80} onChange={event => setTool({ ...tool, name: event.target.value })} /></label><label>用途描述<textarea aria-label="插件用途" rows={2} value={tool.description} onChange={event => setTool({ ...tool, description: event.target.value })} /></label><div className="workflow-resource-pair"><label>请求方法<select aria-label="插件请求方法" value={tool.method} onChange={event => setTool({ ...tool, method: event.target.value as 'GET' | 'POST' })}><option>GET</option><option>POST</option></select></label><label>接口地址<input aria-label="插件接口地址" value={tool.url} placeholder="https://…" onChange={event => setTool({ ...tool, url: event.target.value })} /></label></div><label>请求头 JSON<textarea aria-label="插件请求头JSON" className="workflow-resource-json" rows={3} value={tool.headers} onChange={event => setTool({ ...tool, headers: event.target.value })} /></label><label>参数 schema JSON<textarea aria-label="插件参数schemaJSON" className="workflow-resource-json" rows={5} value={tool.parameters} onChange={event => setTool({ ...tool, parameters: event.target.value })} /></label><p className="workflow-resource-help">插件接口和请求头会由服务端校验，保存成功后才可用于执行。</p><button className="btn btn-primary" onClick={() => void saveTool()}>{busy ? '保存中…' : '保存插件'}</button></fieldset></div> : <fieldset disabled={busy} className="workflow-resource-data"><div className="workflow-resource-create-table"><label>创建数据表<input aria-label="新数据表名称" value={tableName} placeholder="填写数据表名称" onChange={event => setTableName(event.target.value)} /></label><button className="btn btn-primary" onClick={() => { if (!tableName.trim()) { setError('请填写数据表名称'); return; } const name = tableName.trim(); void perform(() => workflowResourcesAPI.createTable(name), '数据表已创建', true).then(response => { if (response !== undefined) { setTable(name); setTableName(''); } }); }}><FiPlus />创建</button></div><label>选择数据表<select aria-label="选择数据表" value={table} onChange={event => { setTable(event.target.value); setResult(undefined); }}><option value="" disabled>请选择数据表</option>{tables.map(name => <option key={name} value={name}>{name}</option>)}</select></label><div className="workflow-resource-data-grid"><section><h3>录入记录</h3><label>JSON 对象数组<textarea aria-label="录入记录JSON" className="workflow-resource-json" rows={9} value={recordsText} onChange={event => setRecordsText(event.target.value)} /></label><p className="workflow-resource-help">每次支持 1–100 条记录，成功后可按条件查询。</p><button className="btn btn-primary" disabled={!table} onClick={() => void insert()}>录入记录</button></section><section><h3>查询记录</h3><label>查询条件 JSON<textarea aria-label="查询条件JSON" className="workflow-resource-json" rows={5} value={whereText} onChange={event => setWhereText(event.target.value)} /></label><label>返回数量<input aria-label="查询返回数量" type="number" min="1" max="100" value={limit} onChange={event => setLimit(Number(event.target.value))} /></label><button className="btn btn-default" disabled={!table} onClick={() => void query()}>查询记录</button></section></div>{result !== undefined && <section className="workflow-resource-result" aria-label="数据操作结果"><h3>返回结果</h3><pre>{JSON.stringify(result, null, 2)}</pre></section>}</fieldset>}
    </div>
  </KnowledgeModal>;
}
