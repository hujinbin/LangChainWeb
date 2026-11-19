import type { WorkflowBilling } from './credits';

export interface CustomAgentVariable {
  name: string;
  label: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
  defaultValue: string | number | boolean;
  required: boolean;
}
export interface CustomAgentTool {
  id: string;
  name: string;
  description: string;
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  parameters: Record<string, unknown>;
}
export interface CustomAgentConfig {
  name: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  modelSettings: { model: string; temperature: number; maxTokens: number; search: boolean };
  workflowIds: string[];
  knowledgeBaseIds: string[];
  toolIds: string[];
  tools: CustomAgentTool[];
  variables: CustomAgentVariable[];
  memory: { enabled: boolean };
  openingMessage: string;
  suggestedQuestions: string[];
  backgroundImage: string;
  inputMode: 'text' | 'voice';
  suggestionsEnabled: boolean;
  filesEnabled: boolean;
}
export interface CustomAgent extends CustomAgentConfig {
  id: string;
  revision: number;
  status: 'draft' | 'published';
  publishedAt?: string | null;
  publishedRevision?: number | null;
  hasUnpublishedChanges?: boolean;
  updatedAt?: string;
}
export interface CustomAgentCatalog {
  models: string[];
  tools: Array<{ id: string; name: string; description: string; parameters?: Record<string, unknown> }>;
  workflows: Array<{ id: string; name: string }>;
  knowledgeBases: Array<{ id: string; name: string }>;
  limits?: Record<string, unknown>;
}
export interface CustomAgentMessage { id?: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt?: string }
export interface CustomAgentMemory { id: string; key: string; value: unknown; updatedAt?: string }
export interface CustomAgentTrace { type: 'knowledge' | 'workflow' | 'tool'; name: string; status: string; executionId?: string; summary?: string; error?: string }
export interface CustomAgentChat {
  conversationId: string;
  reply: string;
  messages: CustomAgentMessage[];
  billing?: WorkflowBilling;
  trace: CustomAgentTrace[];
  memory?: unknown;
}
