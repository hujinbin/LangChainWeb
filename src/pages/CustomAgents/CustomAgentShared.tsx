import type { CustomAgent, CustomAgentConfig } from '../../types/customAgent';

export const emptyAgent = (): CustomAgentConfig => ({
  name: '', avatar: '✦', description: '', systemPrompt: '',
  modelSettings: { model: '', temperature: 0.6, maxTokens: 2048, search: false },
  workflowIds: [], knowledgeBaseIds: [], toolIds: [], tools: [], variables: [], memory: { enabled: false },
  openingMessage: '你好！有什么可以帮你？', suggestedQuestions: [], backgroundImage: '', inputMode: 'text', suggestionsEnabled: true, filesEnabled: false,
});
export function agentConfig(agent: CustomAgent): CustomAgentConfig {
  const defaults = emptyAgent();
  return Object.fromEntries(Object.keys(defaults).map(key => [key, agent[key as keyof CustomAgent] ?? defaults[key as keyof CustomAgentConfig]])) as unknown as CustomAgentConfig;
}
export function safeImage(value: string) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function AgentAvatar({ value, name }: { value: string; name: string }) {
  const image = safeImage(value);
  return <span className="custom-agent-avatar">{image ? <img src={image} alt={name} /> : value.slice(0, 8) || '✦'}</span>;
}
