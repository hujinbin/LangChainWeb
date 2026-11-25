import { useLabels } from '../../store/languageStore';
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
  const t = useLabels();
  return <div className="custom-resource-choices" aria-label={label}>{items.length ? items.map(item => <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={() => onChange(toggleId(selected, item.id))} /><span><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}</span></label>) : <p>{empty}</p>}{selected.filter(id => !items.some(item => item.id === id)).map(id => <label key={id} className="custom-resource-missing"><input type="checkbox" checked onChange={() => onChange(selected.filter(item => item !== id))} /><span>{t("资源已不可用，取消勾选后移除", "Resource unavailable. Uncheck it to remove it.")}</span></label>)}</div>;
}

export default function CustomAgentEditor() {
  const t = useLabels();
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
    if (!draft.name.trim()) throw new Error(t("请填写智能体名称", "Enter an agent name"));
    if (strict && !draft.systemPrompt.trim()) throw new Error(t("请填写人设与回复逻辑", "Enter a persona and instructions"));
    if (draft.systemPrompt.length > 20000) throw new Error(t("人设与回复逻辑不能超过 20000 字符", "Instructions must be 20,000 characters or fewer"));
    if (!catalog?.models.includes(draft.modelSettings.model)) throw new Error(t("请选择可用的文本模型", "Choose an enabled text model"));
    if (!Number.isFinite(draft.modelSettings.temperature) || draft.modelSettings.temperature < 0 || draft.modelSettings.temperature > 2) throw new Error(t("温度需要在 0 至 2 之间", "Temperature must be between 0 and 2"));
    if (!Number.isInteger(draft.modelSettings.maxTokens) || draft.modelSettings.maxTokens < 128 || draft.modelSettings.maxTokens > 8192) throw new Error(t("输出额度需要在 128 至 8192 之间", "Output limit must be between 128 and 8192"));
    if (draft.backgroundImage && !safeImage(draft.backgroundImage)) throw new Error(t("请填写有效的背景图片链接", "Enter a valid background image URL"));
    const names = new Set<string>();
    draft.variables.forEach(variable => { if (!/^[A-Za-z_][A-Za-z0-9_]{0,49}$/.test(variable.name)) throw new Error(t("变量名最多 50 字符，需以字母或下划线开头，仅包含字母、数字和下划线", "Use up to 50 letters, digits and underscores. Start variable names with a letter or underscore.")); if (names.has(variable.name)) throw new Error(t("变量名称不能重复", "Variable names must be unique")); names.add(variable.name); });
    let tools: unknown;
    try { tools = JSON.parse(toolText); } catch { throw new Error(t("自定义工具需要有效的 JSON 数组", "Enter custom tools as a valid JSON array")); }
    if (!Array.isArray(tools)) throw new Error(t("自定义工具需要为 JSON 数组", "Custom tools must be a JSON array"));
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
    try { await persist(); setNotice(t("草稿已保存", "Draft saved")); } catch (cause) { const failure = normalizeError(cause); setError(failure.code === 409 || failure.response?.status === 409 ? t("这个智能体已在其他页面更新。请重新读取最新版本后再编辑。", "This agent was updated elsewhere. Reload before editing.") : errorMessage(cause)); }
  };
  const publish = async () => {
    setError(''); setNotice(''); setPublishing(true);
    try { const saved = await persist(true); const published = await customAgentAPI.publish(saved.id, saved.revision); accept(published); setNotice(t("智能体已发布，预览可切换到发布版本", "Published. You can now preview the published version.")); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setPublishing(false); }
  };
  const unpublish = async () => {
    if (!agent) return;
    setPublishing(true); setError('');
    try { const result = await customAgentAPI.unpublish(agent.id, agent.revision); savedRef.current = result; setAgent(result); setNotice(t("已取消发布，当前编辑内容继续保留", "Unpublished. Your draft is saved.")); setMode('draft'); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setPublishing(false); }
  };
  const send = async (message = prompt) => {
    if (sendLock.current || busy || !message.trim()) return;
    const combined = attachment ? `${message.trim()}\n\n附件：${attachment.name}\n${attachment.text}` : message.trim();
    if (combined.length > 12000) { setChatError(t("消息与附件合计不能超过 12000 字符", "Message and attachments must total 12,000 characters or fewer")); return; }
    sendLock.current = true; setChatError(''); setSending(true); setLastChat(null);
    speechRef.current?.stop(); setListening(false);
    const controller = new AbortController(); requestRef.current = controller;
    try {
      const variables = { ...Object.fromEntries(draft.variables.map(variable => [variable.name, variable.defaultValue])), ...objectJSON(variablesText, t("调试变量", "Debug variables")) };
      const saved = mode === 'draft' ? await persist(true) : savedRef.current;
      if (!saved || (mode === 'published' && saved.status !== 'published')) throw new Error(t("请先发布智能体再调试发布版本", "Publish this agent before testing its published version"));
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
        return [{ type: item.type as CustomAgentChat['trace'][number]['type'], name: typeof item.name === 'string' ? item.name : t("能力调用", "Tool call"), status: typeof item.status === 'string' ? item.status : 'failed', summary: typeof item.summary === 'string' ? item.summary : undefined, error: typeof item.error === 'string' ? item.error : undefined, executionId: typeof item.executionId === 'string' ? item.executionId : undefined }];
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
      setChatError(controller.signal.aborted ? STOP_MESSAGE : `${errorMessage(cause)}${billing || trace.length ? t(" 已发生的调用已记录；再次发送会开始新一轮调用。", " Previous calls were recorded. Sending again starts a new run.") : ''}`);
    }
    finally { if (requestRef.current === controller) requestRef.current = null; setSending(false); sendLock.current = false; }
  };
  const clearConversation = async () => {
    setChatError('');
    try { if (agent && conversationId) await customAgentAPI.clearConversation(agent.id, conversationId); if (agent) sessionStorage.removeItem(conversationKey(agent.id)); setConversationId(''); setMessages([]); setLastChat(null); }
    catch (cause) { setChatError(errorMessage(cause)); }
  };
  const clearMemory = async () => {
    if (!agent || !window.confirm(t("确认清空此智能体保存的长期记忆？", "Clear this agent’s saved long-term memory?"))) return;
    setMemoryLoading(true); setMemoryError('');
    try { await customAgentAPI.clearMemory(agent.id); setMemory([]); }
    catch (cause) { setMemoryError(errorMessage(cause)); }
    finally { setMemoryLoading(false); }
  };
  const attachFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(txt|md|csv|json)$/i.test(file.name) || file.size > 100000) { setChatError(t("请选择不超过 100 KB 的 txt、md、csv 或 json 文件", "Choose a txt, md, csv or json file up to 100 KB")); return; }
    try { const text = await file.text(); if (text.length > 10000) throw new Error(t("附件正文不能超过 10000 字符", "Attachment content must be 10,000 characters or fewer")); setAttachment({ name: file.name, text }); setChatError(''); }
    catch (cause) { setChatError(errorMessage(cause)); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const startVoice = () => {
    if (listening) { speechRef.current?.stop(); return; }
    const Recognition = speechConstructor(); if (!Recognition) return;
    const recognition = new Recognition(); speechRef.current = recognition; recognition.lang = 'zh-CN'; recognition.interimResults = false;
    recognition.onresult = event => { setPrompt(current => `${current}${event.results[0]?.[0]?.transcript || ''}`); };
    recognition.onend = () => setListening(false); recognition.onerror = () => { setListening(false); setChatError(t("语音识别未完成，请检查麦克风权限或使用文字输入", "Speech recognition stopped. Check microphone permission or enter text.")); };
    try { recognition.start(); setListening(true); } catch { setChatError(t("语音输入暂时无法使用，请使用文字输入", "Speech input unavailable. Enter text instead.")); }
  };
  const addVariable = () => update('variables', [...draft.variables, { name: `variable_${draft.variables.length + 1}`, label: '', description: '', type: 'string', defaultValue: '', required: false }]);
  const changeVariable = (index: number, values: Partial<CustomAgentVariable>) => update('variables', draft.variables.map((variable, position) => position === index ? { ...variable, ...values } : variable));
  const scrollPanel = (panelId: string) => {
    const panel = document.getElementById(panelId);
    const container = document.querySelector('.app-content');
    if (panel && container) container.scrollTo({ top: container.scrollTop + panel.getBoundingClientRect().top - container.getBoundingClientRect().top - 55, behavior: 'smooth' });
  };

  if (!isLoggedIn) return <main className="page-wrap empty-state"><h1>{t("登录后创建自己的智能体", "Sign in to create an agent")}</h1><p>{t("保存人设、连接知识与工作流，并在预览中调试。", "Configure a persona, connect knowledge and workflows, then test it in preview.")}</p><Link to="/login" className="btn btn-primary">{t("前往登录", "Sign in")}</Link></main>;
  return <main className="custom-agent-editor">
    <header className="custom-agent-editor-header"><Link to="/agents" className="btn-icon" aria-label={t("返回智能体工作台", "Back to agents")} onClick={event => { if (dirty && !window.confirm(t("当前修改尚未保存，确认离开？", "Leave without saving these changes?"))) event.preventDefault(); }}><FiArrowLeft /></Link><AgentAvatar value={draft.avatar} name={draft.name} /><div><strong>{draft.name || t("创建智能体", "Create agent")}</strong><small>{agent?.status === 'published' ? agent.hasUnpublishedChanges ? t("草稿有更新，待发布", "Unpublished changes") : t("已发布", "Published") : t("草稿", "Draft")} · {dirty ? t("有未保存修改", "Unsaved changes") : agent ? `已保存 · 版本 ${agent.revision}` : t("配置你的助手", "Configure your assistant")}</small></div><div className="custom-agent-header-actions"><button className="btn btn-default" disabled={busy || loading} onClick={() => void save()}><FiSave />{saving ? t("保存中", "Saving") : t("保存草稿", "Save draft")}</button>{agent?.status === 'published' && <button className="btn btn-default" disabled={busy} onClick={() => void unpublish()}>{t("取消发布", "Unpublish")}</button>}<button className="btn btn-primary" disabled={busy || loading || !catalog} onClick={() => void publish()}><FiCheck />{publishing ? t("发布中", "Publishing") : t("发布", "Publish")}</button></div></header>
    {error && <div className="notice error" role="alert">{error}<button className="text-action" disabled={busy} onClick={() => { if (!dirty || window.confirm(t("重新读取会覆盖未保存内容，确认继续？", "Reload and discard unsaved changes?"))) { loadedRef.current = ''; setRevision(value => value + 1); } }}>{t("重新读取", "Reload")}</button></div>}
    {notice && <div className="custom-agent-notice" role="status">{notice}</div>}
    <nav className="custom-agent-mobile-nav" aria-label={t("智能体编辑区域", "Agent editor")}><button onClick={() => scrollPanel('custom-agent-persona')}>{t("人设", "Persona")}</button><button onClick={() => scrollPanel('custom-agent-capabilities')}>{t("编排", "Capabilities")}</button><button onClick={() => scrollPanel('custom-agent-preview')}>{t("预览", "Preview")}</button></nav>
    {loading ? <div className="loading-state"><FiRefreshCw className="spinning" />{t("正在读取智能体配置…", "Loading configuration…")}</div> : catalog && <div className="custom-agent-editor-grid">
      <fieldset id="custom-agent-persona" className="custom-agent-panel custom-persona-panel" disabled={busy}><legend>{t("人设与回复逻辑", "Persona and instructions")}</legend><div className="custom-panel-heading"><span>01 / PERSONA</span><FiZap /></div><label>{t("名称", "Name")}<input aria-label={t("智能体名称", "Agent name")} value={draft.name} maxLength={80} placeholder={t("为你的助手起个名字", "Name your assistant")} onChange={event => update('name', event.target.value)} /></label><div className="custom-identity-row"><label>{t("头像", "Avatar")}<input aria-label={t("智能体头像", "Agent avatar")} value={draft.avatar} placeholder={t("Emoji 或图片链接", "Emoji or image URL")} onChange={event => update('avatar', event.target.value)} /></label><AgentAvatar value={draft.avatar} name={draft.name} /></div><label>{t("简介", "Description")}<textarea aria-label={t("智能体简介", "Agent description")} rows={2} maxLength={1000} placeholder={t("用一句话介绍它能做什么", "Summarize what this assistant can do")} value={draft.description} onChange={event => update('description', event.target.value)} /></label><label className="custom-persona-prompt">{t("人设与回复逻辑", "Persona and instructions")}<textarea aria-label={t("人设与回复逻辑", "Persona and instructions")} rows={16} maxLength={20000} placeholder={t("你是一位怎样的助手？\n\n描述目标、工作步骤、可用能力与回答要求。", "Describe the assistant’s goals, steps, available tools and response style.")} value={draft.systemPrompt} onChange={event => update('systemPrompt', event.target.value)} /></label><div className="custom-prompt-starters"><span>{t("快速开始", "Quick start")}</span>{[t("通用助手", "General assistant"), t("任务执行", "Task assistant"), t("角色扮演", "Roleplay")].map((name, index) => <button className="btn btn-default" key={name} type="button" onClick={() => { if (!draft.systemPrompt.trim() || window.confirm(t("使用模板将替换当前人设，确认继续？", "Replace your current persona with this template?"))) update('systemPrompt', [t("你是一位耐心、准确的助手。先理解用户的目标，再给出清晰、可执行的回答。不确定时说明限制，并向用户确认必要的信息。", "Be patient and accurate. Understand the user’s goal before giving clear, actionable answers. Explain uncertainty and ask for details when needed."), t("你是一位任务执行助手。先梳理目标与输入，选择合适的工作流、知识库或工具，检查执行结果后回答。遇到失败应说明原因，不把未执行的操作描述为成功。", "Identify the goal and inputs. Select suitable workflows, knowledge bases or tools. Check their results before answering. Explain failures and only report actions that actually completed."), t("请在这里定义角色身份、背景、语气与互动边界。始终保持角色一致，尊重用户的输入，不虚构现实中已经发生的操作。", "Define the character’s identity, background, tone and boundaries. Stay consistent, respect the user’s input and avoid inventing real-world events.")][index]); }}>{name}</button>)}</div></fieldset>
      <fieldset id="custom-agent-capabilities" className="custom-agent-panel custom-capabilities-panel" disabled={busy}><legend>{t("编排", "Capabilities")}</legend><div className="custom-panel-heading"><span>02 / CAPABILITIES</span><FiSettings /></div>
        <details open><summary>{t("模型设置", "Model settings")} <FiChevronDown /></summary><div className="custom-detail-body"><label>{t("文本模型", "Text model")}<select aria-label={t("智能体文本模型", "Agent text model")} value={draft.modelSettings.model} onChange={event => update('modelSettings', { ...draft.modelSettings, model: event.target.value })}>{catalog.models.map(model => <option key={model}>{model}</option>)}</select></label><div className="custom-form-pair"><label>{t("温度", "Temperature")}<input aria-label={t("模型温度", "Model temperature")} type="number" min="0" max="2" step="0.1" value={draft.modelSettings.temperature} onChange={event => update('modelSettings', { ...draft.modelSettings, temperature: Number(event.target.value) })} /></label><label>{t("输出额度", "Output limit")}<input aria-label={t("模型输出额度", "Model output limit")} type="number" min="128" max="8192" value={draft.modelSettings.maxTokens} onChange={event => update('modelSettings', { ...draft.modelSettings, maxTokens: Number(event.target.value) })} /></label></div><label className="custom-check"><input type="checkbox" checked={draft.modelSettings.search} onChange={event => update('modelSettings', { ...draft.modelSettings, search: event.target.checked })} />{t("允许联网搜索", "Allow web search")}</label></div></details>
        <details open><summary>{t("工具", "Tools")} <small>{draft.toolIds.length + draft.tools.length}</small><FiChevronDown /></summary><div className="custom-detail-body"><ResourceChoices label={t("内置工具", "Built-in tools")} items={catalog.tools} selected={draft.toolIds} onChange={value => update('toolIds', value)} empty={t("暂无可用工具", "No tools available")} /><details><summary>{t("自定义 HTTP 工具", "Custom HTTP tools")}</summary><p className="custom-help">{t("配置工具名称、接口、请求方法、headers 与参数 schema。接口将由助手按需调用。", "Configure names, endpoints, HTTP methods, headers and parameter schemas. The assistant can call these tools as needed.")}</p><textarea aria-label={t("自定义HTTP工具JSON", "Custom HTTP tool JSON")} className="custom-json" rows={7} spellCheck={false} value={toolText} onChange={event => setToolText(event.target.value)} /><button className="text-action" type="button" onClick={() => { try { const tools: unknown = JSON.parse(toolText); if (!Array.isArray(tools)) throw new Error(); setToolText(JSON.stringify([...tools, { id: `tool_${tools.length + 1}`, name: t("查询工具", "Search tool"), description: t("填写工具用途", "Describe the tool"), url: '', method: 'GET', headers: {}, parameters: { type: 'object', properties: {} } }], null, 2)); } catch { setError(t("请先修正工具 JSON 数组", "Fix the tools JSON array first")); } }}><FiPlus />{t("添加工具模板", "Add tool template")}</button></details></div></details>
        <details open><summary>{t("工作流", "Workflows")} <small>{draft.workflowIds.length}</small><FiChevronDown /></summary><div className="custom-detail-body"><ResourceChoices label={t("智能体工作流", "Agent workflows")} items={catalog.workflows} selected={draft.workflowIds} onChange={value => update('workflowIds', value)} empty={<>{t("暂无可挂载工作流。", "No workflows available.")}<Link to="/workflows">{t("前往创建", "Create workflow")}</Link></>} /></div></details>
        <details open><summary>{t("知识库", "Knowledge bases")} <small>{draft.knowledgeBaseIds.length}</small><FiChevronDown /></summary><div className="custom-detail-body"><ResourceChoices label={t("智能体知识库", "Agent knowledge bases")} items={catalog.knowledgeBases} selected={draft.knowledgeBaseIds} onChange={value => update('knowledgeBaseIds', value)} empty={<>{t("暂无可用知识库。", "No knowledge bases available.")}<Link to="/knowledge">{t("前往管理", "Manage")}</Link></>} /></div></details>
        <details><summary>{t("变量", "Variables")} <small>{draft.variables.length}</small><FiChevronDown /></summary><div className="custom-detail-body">{draft.variables.map((variable, index) => <div className="custom-variable" key={index}><div className="custom-form-pair"><label>{t("变量名", "Variable name")}<input aria-label={`变量${index + 1}名称`} maxLength={50} value={variable.name} onChange={event => changeVariable(index, { name: event.target.value })} /></label><label>{t("显示名称", "Display name")}<input value={variable.label} onChange={event => changeVariable(index, { label: event.target.value })} /></label></div><div className="custom-form-pair"><label>{t("类型", "Type")}<select aria-label={`变量${index + 1}类型`} value={variable.type} onChange={event => { const type = event.target.value as CustomAgentVariable['type']; changeVariable(index, { type, defaultValue: type === 'number' ? 0 : type === 'boolean' ? false : '' }); }}><option value="string">{t("文本", "Text")}</option><option value="number">{t("数字", "Number")}</option><option value="boolean">{t("布尔值", "Boolean")}</option></select></label><label>{t("默认值", "Default")}{variable.type === 'boolean' ? <select value={String(variable.defaultValue)} onChange={event => changeVariable(index, { defaultValue: event.target.value === 'true' })}><option value="true">{t("是", "Yes")}</option><option value="false">{t("否", "No")}</option></select> : <input type={variable.type === 'number' ? 'number' : 'text'} value={String(variable.defaultValue)} onChange={event => changeVariable(index, { defaultValue: variable.type === 'number' ? Number(event.target.value) : event.target.value })} />}</label></div><label>{t("描述", "Description")}<input value={variable.description} onChange={event => changeVariable(index, { description: event.target.value })} /></label><div className="custom-variable-footer"><label className="custom-check"><input type="checkbox" checked={variable.required} onChange={event => changeVariable(index, { required: event.target.checked })} />{t("必填", "Required")}</label><button className="text-action" aria-label={`删除变量${index + 1}`} onClick={() => update('variables', draft.variables.filter((_, position) => position !== index))}><FiTrash2 />{t("移除", "Remove")}</button></div></div>)}<button className="text-action" onClick={addVariable}><FiPlus />{t("添加变量", "Add variable")}</button></div></details>
        <details><summary>{t("长期记忆", "Long-term memory")} <small>{draft.memory.enabled ? t("开启", "On") : t("关闭", "Off")}</small><FiChevronDown /></summary><div className="custom-detail-body"><label className="custom-check"><input type="checkbox" checked={draft.memory.enabled} onChange={event => update('memory', { enabled: event.target.checked })} />{t("允许保存并检索当前用户的长期记忆", "Save and retrieve long-term memory for the current user")}</label><p className="custom-help">{t("记忆在服务端按用户和智能体保存；清空对话不会删除长期记忆。", "Memory belongs to the user and agent. Clearing a conversation keeps its long-term memory.")}</p>{agent ? <><div className="custom-memory-actions"><button className="text-action" disabled={memoryLoading} onClick={() => void readMemory(agent.id)}><FiRefreshCw />{t("刷新记忆", "Refresh memory")}</button><button className="text-action" disabled={memoryLoading || !memory.length} onClick={() => void clearMemory()}>{t("清空记忆", "Clear memory")}</button></div>{memoryError && <p className="custom-inline-error" role="alert">{memoryError}</p>}{memoryLoading ? <p>{t("正在读取记忆…", "Loading memory…")}</p> : memory.length ? <ul className="custom-memory-list">{memory.map(item => <li key={item.id}><strong>{item.key}</strong><span>{typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}</span></li>)}</ul> : <p className="custom-help">{t("暂无长期记忆", "No long-term memory")}</p>}</> : <p className="custom-help">{t("保存智能体后可管理记忆。", "Save the agent to manage memory.")}</p>}</div></details>
        <details open><summary>{t("对话体验", "Conversation")} <FiChevronDown /></summary><div className="custom-detail-body"><label>{t("开场白", "Greeting")}<textarea aria-label={t("智能体开场白", "Agent greeting")} rows={3} value={draft.openingMessage} onChange={event => update('openingMessage', event.target.value)} /></label><label className="custom-check"><input type="checkbox" checked={draft.suggestionsEnabled} onChange={event => update('suggestionsEnabled', event.target.checked)} />{t("展示快捷问题建议", "Show suggested questions")}</label><label>{t("快捷问题", "Suggested questions")} <small>{t("每行一条", "One per line")}</small><textarea aria-label={t("快捷问题", "Suggested questions")} rows={3} value={draft.suggestedQuestions.join('\n')} onChange={event => update('suggestedQuestions', event.target.value.split('\n'))} /></label><label>{t("背景图片链接", "Background image URL")}<input aria-label={t("对话背景图片", "Chat background image")} value={draft.backgroundImage} placeholder="https://…" onChange={event => update('backgroundImage', event.target.value)} /></label><label>{t("用户输入方式", "Input method")}<select aria-label={t("用户输入方式", "Input method")} value={draft.inputMode} onChange={event => update('inputMode', event.target.value as 'text' | 'voice')}><option value="text">{t("文字输入", "Text")}</option><option value="voice">{t("语音与文字", "Voice and text")}</option></select></label>{draft.inputMode === 'voice' && !speechConstructor() && <p className="custom-help">{t("当前浏览器不支持语音识别，可继续使用文字输入。", "Speech recognition is unavailable in this browser. Text input is available.")}</p>}<label className="custom-check"><input type="checkbox" checked={draft.filesEnabled} onChange={event => update('filesEnabled', event.target.checked)} />{t("允许纯文本附件", "Allow text file attachments")}</label><p className="custom-help">{t("附件支持 txt、md、csv、json 纯文本（100 KB / 10000 字符以内）；CSV 正文作为上下文，不会自动导入数据表。", "Attach txt, md, csv or json files up to 100 KB and 10,000 characters. CSV text is passed as context.")}</p></div></details>
      </fieldset>
      <section id="custom-agent-preview" className="custom-agent-panel custom-preview-panel" aria-label={t("预览与调试", "Preview and testing")}><div className="custom-preview-heading"><div><span>03 / PREVIEW</span><h2>{t("预览与调试", "Preview and testing")}</h2></div><button className="btn-icon" aria-label={t("清空调试对话", "Clear test conversation")} disabled={busy || !messages.length} onClick={() => void clearConversation()}><FiTrash2 /></button></div><div className="custom-preview-mode"><select aria-label={t("调试版本", "Version to test")} value={mode} disabled={busy} onChange={event => { if (agent) sessionStorage.removeItem(conversationKey(agent.id)); setMode(event.target.value as 'draft' | 'published'); setConversationId(''); setMessages([]); setLastChat(null); }}><option value="draft">{t("草稿预览 · 发送前自动保存", "Draft · saves before sending")}</option><option value="published" disabled={agent?.status !== 'published'}>{t("发布版本", "Published version")}</option></select></div><div className="custom-chat-messages" role="log" aria-label={t("智能体调试对话", "Agent test conversation")} ref={transcriptRef} style={safeImage(draft.backgroundImage) ? { backgroundImage: `linear-gradient(#ffffffdf,#ffffffdf),url("${safeImage(draft.backgroundImage)}")` } : undefined}>{!messages.length && <div className="custom-preview-welcome"><AgentAvatar value={draft.avatar} name={draft.name} /><h3>{draft.name || t("你的智能体", "Your agent")}</h3><p>{draft.openingMessage || t("发送消息，开始调试你的助手。", "Send a message to test your assistant.")}</p>{draft.suggestionsEnabled && <div className="custom-quick-questions">{draft.suggestedQuestions.filter(question => question.trim()).map((question, index) => <button key={index} disabled={busy} onClick={() => void send(question)}>{question}</button>)}</div>}</div>}{messages.filter(message => message.role !== 'system').map((message, index) => <article key={message.id || index} className={`custom-chat-message message-${message.role}`}><small>{message.role === 'user' ? t("你", "You") : draft.name || t("助手", "Assistant")}</small><p>{message.content}</p></article>)}{sending && <p className="custom-chat-waiting" role="status"><FiRefreshCw className="spinning" />{t("正在运行智能体…", "Running agent…")}</p>}{chatError && <div className="custom-inline-error" role="alert">{chatError}</div>}</div>{lastChat && <details className="custom-debug-results"><summary>{t("本轮消耗与调用记录", "Usage and calls")} <FiChevronDown /></summary><BillingUsage billing={lastChat.billing} compact />{lastChat.trace?.map((trace, index) => <div className="custom-trace" key={index}><span>{trace.type === 'workflow' ? <FiGitBranch /> : trace.type === 'knowledge' ? <FiDatabase /> : <FiZap />}{trace.name}</span><small>{['success', 'completed', 'settled'].includes(trace.status) ? t("完成", "Completed") : ['failed', 'error'].includes(trace.status) ? t("失败", "Failed") : trace.status}</small>{trace.summary && <p>{trace.summary}</p>}{trace.error && <p className="custom-inline-error">{errorMessage(new Error(trace.error))}</p>}{trace.executionId && <Link to={`/executions/${trace.executionId}`}>{t("查看工作流记录", "View workflow run")}</Link>}</div>)}</details>}<details className="custom-preview-variables"><summary>{t("调试变量", "Debug variables")} <FiChevronDown /></summary><textarea aria-label={t("调试变量JSON", "Debug variable JSON")} className="custom-json" rows={3} disabled={busy} value={variablesText} onChange={event => setVariablesText(event.target.value)} /></details><form className="custom-chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}>{attachment && <div className="custom-attachment"><FiPaperclip />{attachment.name} · {attachment.text.length} {t("字符", "characters")}<button type="button" aria-label={t("移除附件", "Remove attachment")} onClick={() => setAttachment(null)}><FiX /></button></div>}<label className="custom-screenreader" htmlFor="custom-chat-prompt">{t("调试消息", "Test message")}</label><textarea id="custom-chat-prompt" value={prompt} maxLength={12000} rows={3} disabled={busy} placeholder={t("发送消息，看看助手如何回应…", "Send a message to see how the assistant responds…")} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} /><div><span>{draft.filesEnabled && <><input type="file" ref={fileRef} hidden accept=".txt,.md,.csv,.json" onChange={event => void attachFile(event.target.files?.[0])} /><button type="button" className="btn-icon" aria-label={t("添加文本附件", "Attach text file")} disabled={busy} onClick={() => fileRef.current?.click()}><FiPaperclip /></button></>}{draft.inputMode === 'voice' && <button type="button" className={`btn-icon ${listening ? 'custom-listening' : ''}`} disabled={busy || !speechConstructor()} aria-label={listening ? t("停止语音输入", "Stop voice input") : t("语音输入", "Voice input")} onClick={startVoice}><FiMic /></button>}</span>{sending ? <button key="stop-chat" type="button" className="btn btn-default" onClick={() => { setChatError(STOP_MESSAGE); requestRef.current?.abort(); }}><FiSquare />{t("停止", "Stop")}</button> : <button key="send-chat" type="submit" className="btn btn-primary" disabled={busy || !prompt.trim()}><FiArrowUp />{t("发送", "Send")}</button>}</div><p>{t("调试会真实调用模型和已关联能力，并消耗积分。", "Testing uses the selected model and capabilities and consumes credits.")}</p></form></section>
    </div>}
  </main>;
}
