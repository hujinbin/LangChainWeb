import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiArrowUp, FiCheck, FiChevronDown, FiDatabase, FiGitBranch, FiMic, FiPaperclip, FiPlus, FiRefreshCw, FiSave, FiSettings, FiSquare, FiTrash2, FiX, FiZap } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { customAgentAPI } from '../../services/customAgentApi';
import type { CustomAgent, CustomAgentCatalog, CustomAgentChat, CustomAgentConfig, CustomAgentMemory, CustomAgentMessage, CustomAgentVariable } from '../../types/customAgent';
import { asRecord, normalizeError } from '../../types/api';
import { normalizeBilling } from '../../services/api';
import { errorMessage } from '../Agents/AgentShared';
import { AgentAvatar, agentConfig, emptyAgent, safeImage } from './CustomAgentShared';
import BillingUsage from '../../components/BillingUsage/BillingUsage';
import './CustomAgents.css';

interface SpeechHandle { lang: string; interimResults: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void }
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechHandle; webkitSpeechRecognition?: new () => SpeechHandle };
const speechConstructor = () => (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
const STOP_MESSAGE = '已停止等待回复，已发生的模型调用仍按实际用量结算。';
const toggleId = (items: string[], id: string) => items.includes(id) ? items.filter(item => item !== id) : [...items, id];
const objectJSON = (text: string, label: string) => {
  let result: unknown;
  try { result = JSON.parse(text); } catch { throw new Error(`${label}需要有效的 JSON`); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(`${label}需要为 JSON 对象`);
  return result as Record<string, unknown>;
};

function ResourceChoices({ label, items, selected, onChange, empty }: { label: string; items: Array<{ id: string; name: string; description?: string }>; selected: string[]; onChange: (value: string[]) => void; empty: React.ReactNode }) {
  return <div className="custom-resource-choices" aria-label={label}>{items.length ? items.map(item => <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={() => onChange(toggleId(selected, item.id))} /><span><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}</span></label>) : <p>{empty}</p>}{selected.filter(id => !items.some(item => item.id === id)).map(id => <label key={id} className="custom-resource-missing"><input type="checkbox" checked onChange={() => onChange(selected.filter(item => item !== id))} /><span>资源已不可用，取消勾选后移除</span></label>)}</div>;
}

export default function CustomAgentEditor() {
  const { id = 'new' } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn, token, user } = useAuthStore();
  const [catalog, setCatalog] = useState<CustomAgentCatalog | null>(null);
  const [draft, setDraft] = useState<CustomAgentConfig>(emptyAgent);
  const [agent, setAgent] = useState<CustomAgent | null>(null);
  const [fingerprint, setFingerprint] = useState(JSON.stringify(emptyAgent()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [toolText, setToolText] = useState('[]');
  const [variablesText, setVariablesText] = useState('{}');
  const [prompt, setPrompt] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<CustomAgentMessage[]>([]);
  const [lastChat, setLastChat] = useState<CustomAgentChat | null>(null);
  const [chatError, setChatError] = useState('');
  const [mode, setMode] = useState<'draft' | 'published'>('draft');
  const [memory, setMemory] = useState<CustomAgentMemory[]>([]);
  const [memoryError, setMemoryError] = useState('');
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; text: string } | null>(null);
  const [listening, setListening] = useState(false);
  const savedRef = useRef<CustomAgent | null>(null);
  const loadedRef = useRef('');
  const requestRef = useRef<AbortController | null>(null);
  const speechRef = useRef<SpeechHandle | null>(null);
  const sendLock = useRef(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = fingerprint !== JSON.stringify(draft) || toolText !== JSON.stringify(draft.tools, null, 2);
  const busy = saving || publishing || sending;
  const ownerKey = String(user?.id || user?._id || user?.mobile || 'current');
  const conversationKey = useCallback((agentId: string) => `custom-agent-conversation:${ownerKey}:${agentId}`, [ownerKey]);
  const update = <K extends keyof CustomAgentConfig>(key: K, value: CustomAgentConfig[K]) => setDraft(current => ({ ...current, [key]: value }));
  const accept = useCallback((value: CustomAgent) => {
    const config = agentConfig(value);
    savedRef.current = value; setAgent(value); setDraft(config); setFingerprint(JSON.stringify(config)); setToolText(JSON.stringify(config.tools, null, 2));
  }, []);
  const readMemory = useCallback(async (agentId: string, signal?: AbortSignal) => {
    setMemoryLoading(true); setMemoryError('');
    try { const result = await customAgentAPI.memory(agentId, signal); if (!signal?.aborted) setMemory(result.items); }
    catch (cause) { if (!signal?.aborted) setMemoryError(errorMessage(cause)); }
    finally { if (!signal?.aborted) setMemoryLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!isLoggedIn) { setLoading(false); return; }
    if (loadedRef.current === `${token}:${id}` && revision === 0) return;
    requestRef.current?.abort();
    setLoading(true); setError(''); setNotice(''); setMessages([]); setConversationId(''); setLastChat(null); setMemory([]);
    Promise.all([customAgentAPI.catalog(controller.signal), id === 'new' ? Promise.resolve(null) : customAgentAPI.detail(id, controller.signal)]).then(async ([available, existing]) => {
      if (controller.signal.aborted) return;
      setCatalog(available);
      if (existing) {
        accept(existing);
        void readMemory(existing.id, controller.signal);
        const previousConversation = sessionStorage.getItem(conversationKey(existing.id));
        if (previousConversation) {
          try {
            const conversation = await customAgentAPI.conversation(existing.id, previousConversation, controller.signal);
            if (!controller.signal.aborted) { setConversationId(conversation.conversationId); setMessages(conversation.messages); if (conversation.variables) setVariablesText(JSON.stringify(conversation.variables, null, 2)); }
          } catch { if (!controller.signal.aborted) sessionStorage.removeItem(conversationKey(existing.id)); }
        }
      } else {
        const config = emptyAgent(); config.modelSettings.model = available.models[0] || '';
        setDraft(config); setFingerprint(JSON.stringify(config)); setToolText('[]'); setAgent(null); savedRef.current = null;
      }
      loadedRef.current = `${token}:${id}`;
    }).catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, token, isLoggedIn, revision, accept, readMemory, conversationKey]);
  useEffect(() => () => { requestRef.current?.abort(); speechRef.current?.stop(); }, []);
  useEffect(() => { transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, sending, chatError]);
  useEffect(() => {
    const preventLeave = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', preventLeave); return () => window.removeEventListener('beforeunload', preventLeave);
  }, [dirty]);

  const validatedConfig = (strict = false): CustomAgentConfig => {
    if (!draft.name.trim()) throw new Error('请填写智能体名称');
    if (strict && !draft.systemPrompt.trim()) throw new Error('请填写人设与回复逻辑');
    if (draft.systemPrompt.length > 20000) throw new Error('人设与回复逻辑不能超过 20000 字符');
    if (!catalog?.models.includes(draft.modelSettings.model)) throw new Error('请选择可用的文本模型');
    if (!Number.isFinite(draft.modelSettings.temperature) || draft.modelSettings.temperature < 0 || draft.modelSettings.temperature > 2) throw new Error('温度需要在 0 至 2 之间');
    if (!Number.isInteger(draft.modelSettings.maxTokens) || draft.modelSettings.maxTokens < 128 || draft.modelSettings.maxTokens > 8192) throw new Error('输出额度需要在 128 至 8192 之间');
    if (draft.backgroundImage && !safeImage(draft.backgroundImage)) throw new Error('请填写有效的背景图片链接');
    const names = new Set<string>();
    draft.variables.forEach(variable => { if (!/^[A-Za-z_][A-Za-z0-9_]{0,49}$/.test(variable.name)) throw new Error('变量名最多 50 字符，需以字母或下划线开头，仅包含字母、数字和下划线'); if (names.has(variable.name)) throw new Error('变量名称不能重复'); names.add(variable.name); });
    let tools: unknown;
    try { tools = JSON.parse(toolText); } catch { throw new Error('自定义工具需要有效的 JSON 数组'); }
    if (!Array.isArray(tools)) throw new Error('自定义工具需要为 JSON 数组');
    return { ...draft, name: draft.name.trim(), tools, suggestedQuestions: draft.suggestedQuestions.map(value => value.trim()).filter(Boolean) };
  };
  const persist = async (strict = false) => {
    const config = validatedConfig(strict);
    setSaving(true);
    try {
      const current = savedRef.current;
      const saved = current ? await customAgentAPI.update(current.id, { ...config, revision: current.revision }) : await customAgentAPI.create(config);
      accept(saved);
      if (id === 'new') { loadedRef.current = `${token}:${saved.id}`; navigate(`/agents/custom/${saved.id}`, { replace: true }); }
      return saved;
    } finally { setSaving(false); }
  };
  const save = async () => {
    setError(''); setNotice('');
    try { await persist(); setNotice('草稿已保存'); } catch (cause) { const failure = normalizeError(cause); setError(failure.code === 409 || failure.response?.status === 409 ? '这个智能体已在其他页面更新。请重新读取最新版本后再编辑。' : errorMessage(cause)); }
  };
  const publish = async () => {
    setError(''); setNotice(''); setPublishing(true);
    try { const saved = await persist(true); const published = await customAgentAPI.publish(saved.id, saved.revision); accept(published); setNotice('智能体已发布，预览可切换到发布版本'); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setPublishing(false); }
  };
  const unpublish = async () => {
    if (!agent) return;
    setPublishing(true); setError('');
    try { const result = await customAgentAPI.unpublish(agent.id, agent.revision); savedRef.current = result; setAgent(result); setNotice('已取消发布，当前编辑内容继续保留'); setMode('draft'); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setPublishing(false); }
  };
  const send = async (message = prompt) => {
    if (sendLock.current || busy || !message.trim()) return;
    const combined = attachment ? `${message.trim()}\n\n附件：${attachment.name}\n${attachment.text}` : message.trim();
    if (combined.length > 12000) { setChatError('消息与附件合计不能超过 12000 字符'); return; }
    sendLock.current = true; setChatError(''); setSending(true); setLastChat(null);
    speechRef.current?.stop(); setListening(false);
    const controller = new AbortController(); requestRef.current = controller;
    try {
      const variables = { ...Object.fromEntries(draft.variables.map(variable => [variable.name, variable.defaultValue])), ...objectJSON(variablesText, '调试变量') };
      const saved = mode === 'draft' ? await persist(true) : savedRef.current;
      if (!saved || (mode === 'published' && saved.status !== 'published')) throw new Error('请先发布智能体再调试发布版本');
      if (controller.signal.aborted) { setChatError(STOP_MESSAGE); return; }
      const result = await customAgentAPI.chat(saved.id, { message: combined, conversationId: conversationId || undefined, variables, revision: saved.revision, mode }, controller.signal);
      if (controller.signal.aborted) { setChatError(STOP_MESSAGE); return; }
      setMessages(result.messages); setConversationId(result.conversationId); setLastChat(result); setPrompt(''); setAttachment(null);
      sessionStorage.setItem(conversationKey(saved.id), result.conversationId);
      if (draft.memory.enabled) void readMemory(saved.id, controller.signal);
    } catch (cause) {
      const failure = normalizeError(cause);
      const partial = { ...asRecord(failure.response?.data?.data), ...asRecord(failure.data) };
      const recoveredId = typeof partial.conversationId === 'string' ? partial.conversationId : '';
      const billing = normalizeBilling(partial.billing);
      const trace: CustomAgentChat['trace'] = Array.isArray(partial.trace) ? partial.trace.flatMap(value => {
        const item = asRecord(value);
        if (!['knowledge', 'workflow', 'tool'].includes(String(item.type))) return [];
        return [{ type: item.type as CustomAgentChat['trace'][number]['type'], name: typeof item.name === 'string' ? item.name : '能力调用', status: typeof item.status === 'string' ? item.status : 'failed', summary: typeof item.summary === 'string' ? item.summary : undefined, error: typeof item.error === 'string' ? item.error : undefined, executionId: typeof item.executionId === 'string' ? item.executionId : undefined }];
      }) : [];
      if (recoveredId || billing || trace.length) {
        setLastChat({ conversationId: recoveredId || conversationId, reply: '', messages: [], billing, trace });
        const current = savedRef.current;
        if (recoveredId && current) {
          setConversationId(recoveredId);
          sessionStorage.setItem(conversationKey(current.id), recoveredId);
          if (!controller.signal.aborted) {
            try {
              const history = await customAgentAPI.conversation(current.id, recoveredId, controller.signal);
              if (!controller.signal.aborted) setMessages(history.messages);
            } catch { /* 会话恢复失败时仍保留已返回的会话编号、调用记录和费用。 */ }
          }
        }
      }
      setChatError(controller.signal.aborted ? STOP_MESSAGE : `${errorMessage(cause)}${billing || trace.length ? ' 已发生的调用已记录；再次发送会开始新一轮调用。' : ''}`);
    }
    finally { if (requestRef.current === controller) requestRef.current = null; setSending(false); sendLock.current = false; }
  };
  const clearConversation = async () => {
    setChatError('');
    try { if (agent && conversationId) await customAgentAPI.clearConversation(agent.id, conversationId); if (agent) sessionStorage.removeItem(conversationKey(agent.id)); setConversationId(''); setMessages([]); setLastChat(null); }
    catch (cause) { setChatError(errorMessage(cause)); }
  };
  const clearMemory = async () => {
    if (!agent || !window.confirm('确认清空此智能体保存的长期记忆？')) return;
    setMemoryLoading(true); setMemoryError('');
    try { await customAgentAPI.clearMemory(agent.id); setMemory([]); }
    catch (cause) { setMemoryError(errorMessage(cause)); }
    finally { setMemoryLoading(false); }
  };
  const attachFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(txt|md|csv|json)$/i.test(file.name) || file.size > 100000) { setChatError('请选择不超过 100 KB 的 txt、md、csv 或 json 文件'); return; }
    try { const text = await file.text(); if (text.length > 10000) throw new Error('附件正文不能超过 10000 字符'); setAttachment({ name: file.name, text }); setChatError(''); }
    catch (cause) { setChatError(errorMessage(cause)); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const startVoice = () => {
    if (listening) { speechRef.current?.stop(); return; }
    const Recognition = speechConstructor(); if (!Recognition) return;
    const recognition = new Recognition(); speechRef.current = recognition; recognition.lang = 'zh-CN'; recognition.interimResults = false;
    recognition.onresult = event => { setPrompt(current => `${current}${event.results[0]?.[0]?.transcript || ''}`); };
    recognition.onend = () => setListening(false); recognition.onerror = () => { setListening(false); setChatError('语音识别未完成，请检查麦克风权限或使用文字输入'); };
    try { recognition.start(); setListening(true); } catch { setChatError('语音输入暂时无法使用，请使用文字输入'); }
  };
  const addVariable = () => update('variables', [...draft.variables, { name: `variable_${draft.variables.length + 1}`, label: '', description: '', type: 'string', defaultValue: '', required: false }]);
  const changeVariable = (index: number, values: Partial<CustomAgentVariable>) => update('variables', draft.variables.map((variable, position) => position === index ? { ...variable, ...values } : variable));
  const scrollPanel = (panelId: string) => {
    const panel = document.getElementById(panelId);
    const container = document.querySelector('.app-content');
    if (panel && container) container.scrollTo({ top: container.scrollTop + panel.getBoundingClientRect().top - container.getBoundingClientRect().top - 55, behavior: 'smooth' });
  };

  if (!isLoggedIn) return <main className="page-wrap empty-state"><h1>登录后创建自己的智能体</h1><p>保存人设、连接知识与工作流，并在预览中调试。</p><Link to="/login" className="btn btn-primary">前往登录</Link></main>;
  return <main className="custom-agent-editor">
    <header className="custom-agent-editor-header"><Link to="/agents" className="btn-icon" aria-label="返回智能体工作台" onClick={event => { if (dirty && !window.confirm('当前修改尚未保存，确认离开？')) event.preventDefault(); }}><FiArrowLeft /></Link><AgentAvatar value={draft.avatar} name={draft.name} /><div><strong>{draft.name || '创建智能体'}</strong><small>{agent?.status === 'published' ? agent.hasUnpublishedChanges ? '草稿有更新，待发布' : '已发布' : '草稿'} · {dirty ? '有未保存修改' : agent ? `已保存 · 版本 ${agent.revision}` : '配置你的助手'}</small></div><div className="custom-agent-header-actions"><button className="btn btn-default" disabled={busy || loading} onClick={() => void save()}><FiSave />{saving ? '保存中' : '保存草稿'}</button>{agent?.status === 'published' && <button className="btn btn-default" disabled={busy} onClick={() => void unpublish()}>取消发布</button>}<button className="btn btn-primary" disabled={busy || loading || !catalog} onClick={() => void publish()}><FiCheck />{publishing ? '发布中' : '发布'}</button></div></header>
    {error && <div className="notice error" role="alert">{error}<button className="text-action" disabled={busy} onClick={() => { if (!dirty || window.confirm('重新读取会覆盖未保存内容，确认继续？')) { loadedRef.current = ''; setRevision(value => value + 1); } }}>重新读取</button></div>}
    {notice && <div className="custom-agent-notice" role="status">{notice}</div>}
    <nav className="custom-agent-mobile-nav" aria-label="智能体编辑区域"><button onClick={() => scrollPanel('custom-agent-persona')}>人设</button><button onClick={() => scrollPanel('custom-agent-capabilities')}>编排</button><button onClick={() => scrollPanel('custom-agent-preview')}>预览</button></nav>
    {loading ? <div className="loading-state"><FiRefreshCw className="spinning" />正在读取智能体配置…</div> : catalog && <div className="custom-agent-editor-grid">
      <fieldset id="custom-agent-persona" className="custom-agent-panel custom-persona-panel" disabled={busy}><legend>人设与回复逻辑</legend><div className="custom-panel-heading"><span>01 / PERSONA</span><FiZap /></div><label>名称<input aria-label="智能体名称" value={draft.name} maxLength={80} placeholder="为你的助手起个名字" onChange={event => update('name', event.target.value)} /></label><div className="custom-identity-row"><label>头像<input aria-label="智能体头像" value={draft.avatar} placeholder="Emoji 或图片链接" onChange={event => update('avatar', event.target.value)} /></label><AgentAvatar value={draft.avatar} name={draft.name} /></div><label>简介<textarea aria-label="智能体简介" rows={2} maxLength={1000} placeholder="用一句话介绍它能做什么" value={draft.description} onChange={event => update('description', event.target.value)} /></label><label className="custom-persona-prompt">人设与回复逻辑<textarea aria-label="人设与回复逻辑" rows={16} maxLength={20000} placeholder={'你是一位怎样的助手？\n\n描述目标、工作步骤、可用能力与回答要求。'} value={draft.systemPrompt} onChange={event => update('systemPrompt', event.target.value)} /></label><div className="custom-prompt-starters"><span>快速开始</span>{['通用助手', '任务执行', '角色扮演'].map((name, index) => <button className="btn btn-default" key={name} type="button" onClick={() => { if (!draft.systemPrompt.trim() || window.confirm('使用模板将替换当前人设，确认继续？')) update('systemPrompt', ['你是一位耐心、准确的助手。先理解用户的目标，再给出清晰、可执行的回答。不确定时说明限制，并向用户确认必要的信息。', '你是一位任务执行助手。先梳理目标与输入，选择合适的工作流、知识库或工具，检查执行结果后回答。遇到失败应说明原因，不把未执行的操作描述为成功。', '请在这里定义角色身份、背景、语气与互动边界。始终保持角色一致，尊重用户的输入，不虚构现实中已经发生的操作。'][index]); }}>{name}</button>)}</div></fieldset>
      <fieldset id="custom-agent-capabilities" className="custom-agent-panel custom-capabilities-panel" disabled={busy}><legend>编排</legend><div className="custom-panel-heading"><span>02 / CAPABILITIES</span><FiSettings /></div>
        <details open><summary>模型设置 <FiChevronDown /></summary><div className="custom-detail-body"><label>文本模型<select aria-label="智能体文本模型" value={draft.modelSettings.model} onChange={event => update('modelSettings', { ...draft.modelSettings, model: event.target.value })}>{catalog.models.map(model => <option key={model}>{model}</option>)}</select></label><div className="custom-form-pair"><label>温度<input aria-label="模型温度" type="number" min="0" max="2" step="0.1" value={draft.modelSettings.temperature} onChange={event => update('modelSettings', { ...draft.modelSettings, temperature: Number(event.target.value) })} /></label><label>输出额度<input aria-label="模型输出额度" type="number" min="128" max="8192" value={draft.modelSettings.maxTokens} onChange={event => update('modelSettings', { ...draft.modelSettings, maxTokens: Number(event.target.value) })} /></label></div><label className="custom-check"><input type="checkbox" checked={draft.modelSettings.search} onChange={event => update('modelSettings', { ...draft.modelSettings, search: event.target.checked })} />允许联网搜索</label></div></details>
        <details open><summary>工具 <small>{draft.toolIds.length + draft.tools.length}</small><FiChevronDown /></summary><div className="custom-detail-body"><ResourceChoices label="内置工具" items={catalog.tools} selected={draft.toolIds} onChange={value => update('toolIds', value)} empty="暂无可用工具" /><details><summary>自定义 HTTP 工具</summary><p className="custom-help">配置工具名称、接口、请求方法、headers 与参数 schema。接口将由助手按需调用。</p><textarea aria-label="自定义HTTP工具JSON" className="custom-json" rows={7} spellCheck={false} value={toolText} onChange={event => setToolText(event.target.value)} /><button className="text-action" type="button" onClick={() => { try { const tools: unknown = JSON.parse(toolText); if (!Array.isArray(tools)) throw new Error(); setToolText(JSON.stringify([...tools, { id: `tool_${tools.length + 1}`, name: '查询工具', description: '填写工具用途', url: '', method: 'GET', headers: {}, parameters: { type: 'object', properties: {} } }], null, 2)); } catch { setError('请先修正工具 JSON 数组'); } }}><FiPlus />添加工具模板</button></details></div></details>
        <details open><summary>工作流 <small>{draft.workflowIds.length}</small><FiChevronDown /></summary><div className="custom-detail-body"><ResourceChoices label="智能体工作流" items={catalog.workflows} selected={draft.workflowIds} onChange={value => update('workflowIds', value)} empty={<>暂无可挂载工作流。<Link to="/workflows">前往创建</Link></>} /></div></details>
        <details open><summary>知识库 <small>{draft.knowledgeBaseIds.length}</small><FiChevronDown /></summary><div className="custom-detail-body"><ResourceChoices label="智能体知识库" items={catalog.knowledgeBases} selected={draft.knowledgeBaseIds} onChange={value => update('knowledgeBaseIds', value)} empty={<>暂无可用知识库。<Link to="/knowledge">前往管理</Link></>} /></div></details>
        <details><summary>变量 <small>{draft.variables.length}</small><FiChevronDown /></summary><div className="custom-detail-body">{draft.variables.map((variable, index) => <div className="custom-variable" key={index}><div className="custom-form-pair"><label>变量名<input aria-label={`变量${index + 1}名称`} maxLength={50} value={variable.name} onChange={event => changeVariable(index, { name: event.target.value })} /></label><label>显示名称<input value={variable.label} onChange={event => changeVariable(index, { label: event.target.value })} /></label></div><div className="custom-form-pair"><label>类型<select aria-label={`变量${index + 1}类型`} value={variable.type} onChange={event => { const type = event.target.value as CustomAgentVariable['type']; changeVariable(index, { type, defaultValue: type === 'number' ? 0 : type === 'boolean' ? false : '' }); }}><option value="string">文本</option><option value="number">数字</option><option value="boolean">布尔值</option></select></label><label>默认值{variable.type === 'boolean' ? <select value={String(variable.defaultValue)} onChange={event => changeVariable(index, { defaultValue: event.target.value === 'true' })}><option value="true">是</option><option value="false">否</option></select> : <input type={variable.type === 'number' ? 'number' : 'text'} value={String(variable.defaultValue)} onChange={event => changeVariable(index, { defaultValue: variable.type === 'number' ? Number(event.target.value) : event.target.value })} />}</label></div><label>描述<input value={variable.description} onChange={event => changeVariable(index, { description: event.target.value })} /></label><div className="custom-variable-footer"><label className="custom-check"><input type="checkbox" checked={variable.required} onChange={event => changeVariable(index, { required: event.target.checked })} />必填</label><button className="text-action" aria-label={`删除变量${index + 1}`} onClick={() => update('variables', draft.variables.filter((_, position) => position !== index))}><FiTrash2 />移除</button></div></div>)}<button className="text-action" onClick={addVariable}><FiPlus />添加变量</button></div></details>
        <details><summary>长期记忆 <small>{draft.memory.enabled ? '开启' : '关闭'}</small><FiChevronDown /></summary><div className="custom-detail-body"><label className="custom-check"><input type="checkbox" checked={draft.memory.enabled} onChange={event => update('memory', { enabled: event.target.checked })} />允许保存并检索当前用户的长期记忆</label><p className="custom-help">记忆在服务端按用户和智能体保存；清空对话不会删除长期记忆。</p>{agent ? <><div className="custom-memory-actions"><button className="text-action" disabled={memoryLoading} onClick={() => void readMemory(agent.id)}><FiRefreshCw />刷新记忆</button><button className="text-action" disabled={memoryLoading || !memory.length} onClick={() => void clearMemory()}>清空记忆</button></div>{memoryError && <p className="custom-inline-error" role="alert">{memoryError}</p>}{memoryLoading ? <p>正在读取记忆…</p> : memory.length ? <ul className="custom-memory-list">{memory.map(item => <li key={item.id}><strong>{item.key}</strong><span>{typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}</span></li>)}</ul> : <p className="custom-help">暂无长期记忆</p>}</> : <p className="custom-help">保存智能体后可管理记忆。</p>}</div></details>
        <details open><summary>对话体验 <FiChevronDown /></summary><div className="custom-detail-body"><label>开场白<textarea aria-label="智能体开场白" rows={3} value={draft.openingMessage} onChange={event => update('openingMessage', event.target.value)} /></label><label className="custom-check"><input type="checkbox" checked={draft.suggestionsEnabled} onChange={event => update('suggestionsEnabled', event.target.checked)} />展示快捷问题建议</label><label>快捷问题 <small>每行一条</small><textarea aria-label="快捷问题" rows={3} value={draft.suggestedQuestions.join('\n')} onChange={event => update('suggestedQuestions', event.target.value.split('\n'))} /></label><label>背景图片链接<input aria-label="对话背景图片" value={draft.backgroundImage} placeholder="https://…" onChange={event => update('backgroundImage', event.target.value)} /></label><label>用户输入方式<select aria-label="用户输入方式" value={draft.inputMode} onChange={event => update('inputMode', event.target.value as 'text' | 'voice')}><option value="text">文字输入</option><option value="voice">语音与文字</option></select></label>{draft.inputMode === 'voice' && !speechConstructor() && <p className="custom-help">当前浏览器不支持语音识别，可继续使用文字输入。</p>}<label className="custom-check"><input type="checkbox" checked={draft.filesEnabled} onChange={event => update('filesEnabled', event.target.checked)} />允许纯文本附件</label><p className="custom-help">附件支持 txt、md、csv、json 纯文本（100 KB / 10000 字符以内）；CSV 正文作为上下文，不会自动导入数据表。</p></div></details>
      </fieldset>
      <section id="custom-agent-preview" className="custom-agent-panel custom-preview-panel" aria-label="预览与调试"><div className="custom-preview-heading"><div><span>03 / PREVIEW</span><h2>预览与调试</h2></div><button className="btn-icon" aria-label="清空调试对话" disabled={busy || !messages.length} onClick={() => void clearConversation()}><FiTrash2 /></button></div><div className="custom-preview-mode"><select aria-label="调试版本" value={mode} disabled={busy} onChange={event => { if (agent) sessionStorage.removeItem(conversationKey(agent.id)); setMode(event.target.value as 'draft' | 'published'); setConversationId(''); setMessages([]); setLastChat(null); }}><option value="draft">草稿预览 · 发送前自动保存</option><option value="published" disabled={agent?.status !== 'published'}>发布版本</option></select></div><div className="custom-chat-messages" role="log" aria-label="智能体调试对话" ref={transcriptRef} style={safeImage(draft.backgroundImage) ? { backgroundImage: `linear-gradient(#ffffffdf,#ffffffdf),url("${safeImage(draft.backgroundImage)}")` } : undefined}>{!messages.length && <div className="custom-preview-welcome"><AgentAvatar value={draft.avatar} name={draft.name} /><h3>{draft.name || '你的智能体'}</h3><p>{draft.openingMessage || '发送消息，开始调试你的助手。'}</p>{draft.suggestionsEnabled && <div className="custom-quick-questions">{draft.suggestedQuestions.filter(question => question.trim()).map((question, index) => <button key={index} disabled={busy} onClick={() => void send(question)}>{question}</button>)}</div>}</div>}{messages.filter(message => message.role !== 'system').map((message, index) => <article key={message.id || index} className={`custom-chat-message message-${message.role}`}><small>{message.role === 'user' ? '你' : draft.name || '助手'}</small><p>{message.content}</p></article>)}{sending && <p className="custom-chat-waiting" role="status"><FiRefreshCw className="spinning" />正在运行智能体…</p>}{chatError && <div className="custom-inline-error" role="alert">{chatError}</div>}</div>{lastChat && <details className="custom-debug-results"><summary>本轮消耗与调用记录 <FiChevronDown /></summary><BillingUsage billing={lastChat.billing} compact />{lastChat.trace?.map((trace, index) => <div className="custom-trace" key={index}><span>{trace.type === 'workflow' ? <FiGitBranch /> : trace.type === 'knowledge' ? <FiDatabase /> : <FiZap />}{trace.name}</span><small>{['success', 'completed', 'settled'].includes(trace.status) ? '完成' : ['failed', 'error'].includes(trace.status) ? '失败' : trace.status}</small>{trace.summary && <p>{trace.summary}</p>}{trace.error && <p className="custom-inline-error">{errorMessage(new Error(trace.error))}</p>}{trace.executionId && <Link to={`/executions/${trace.executionId}`}>查看工作流记录</Link>}</div>)}</details>}<details className="custom-preview-variables"><summary>调试变量 <FiChevronDown /></summary><textarea aria-label="调试变量JSON" className="custom-json" rows={3} disabled={busy} value={variablesText} onChange={event => setVariablesText(event.target.value)} /></details><form className="custom-chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}>{attachment && <div className="custom-attachment"><FiPaperclip />{attachment.name} · {attachment.text.length} 字符<button type="button" aria-label="移除附件" onClick={() => setAttachment(null)}><FiX /></button></div>}<label className="custom-screenreader" htmlFor="custom-chat-prompt">调试消息</label><textarea id="custom-chat-prompt" value={prompt} maxLength={12000} rows={3} disabled={busy} placeholder="发送消息，看看助手如何回应…" onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} /><div><span>{draft.filesEnabled && <><input type="file" ref={fileRef} hidden accept=".txt,.md,.csv,.json" onChange={event => void attachFile(event.target.files?.[0])} /><button type="button" className="btn-icon" aria-label="添加文本附件" disabled={busy} onClick={() => fileRef.current?.click()}><FiPaperclip /></button></>}{draft.inputMode === 'voice' && <button type="button" className={`btn-icon ${listening ? 'custom-listening' : ''}`} disabled={busy || !speechConstructor()} aria-label={listening ? '停止语音输入' : '语音输入'} onClick={startVoice}><FiMic /></button>}</span>{sending ? <button key="stop-chat" type="button" className="btn btn-default" onClick={() => { setChatError(STOP_MESSAGE); requestRef.current?.abort(); }}><FiSquare />停止</button> : <button key="send-chat" type="submit" className="btn btn-primary" disabled={busy || !prompt.trim()}><FiArrowUp />发送</button>}</div><p>调试会真实调用模型和已关联能力，并消耗积分。</p></form></section>
    </div>}
  </main>;
}
