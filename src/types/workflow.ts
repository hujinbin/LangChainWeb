import type { Edge, Node } from 'reactflow';

export type Parameters = Record<string, unknown>;
export type WorkflowInput = Record<string, unknown>;
export type WorkflowSource = 'new' | 'local' | 'server';
export type ModelKind = 'text' | 'image' | 'video';

export interface SchemaField {
  type?: string;
  title?: string;
  description?: string;
  format?: string;
  enum?: Array<string | number | boolean>;
  enumNames?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  maxLength?: number;
  items?: SchemaField;
  properties?: Record<string, SchemaField>;
  required?: string[];
}

export interface ConfigSchema {
  properties: Record<string, SchemaField>;
  required: string[];
}

export interface NodeTypeMetadata {
  type: string;
  name: string;
  category: string;
  group?: string;
  icon: string;
  description?: string;
  executable?: boolean;
  previewOnly?: boolean;
  inputs?: Array<{ name: string; type: string }>;
  outputs?: Array<{ name: string; type: string }>;
  config_schema: ConfigSchema;
  models?: string[];
  defaultModel?: string;
}

export interface ModelCatalog extends Record<ModelKind, string[]> {
  provider: string;
  flashOnly: boolean;
  defaults: Record<ModelKind, string | undefined>;
}

export interface WorkflowNodeData {
  label?: string;
  name?: string;
  type: string;
  category?: string;
  icon?: string;
  description?: string;
  config: Parameters;
  parameters?: Parameters;
  status?: string;
  hasInput?: boolean;
  hasOutput?: boolean;
  executable?: boolean;
  previewOnly?: boolean;
}

export type WorkflowNode = Node<WorkflowNodeData> & {
  type: string;
  name?: string;
  parameters?: Parameters;
  category?: string;
  icon?: string;
  measured?: { width?: number; height?: number };
  resizing?: boolean;
};
export type WorkflowEdge = Edge<Record<string, unknown>> & {
  from?: string;
  to?: string;
};

export interface WorkflowDefinitionNode {
  id: string;
  type: string;
  name?: string;
  position: { x: number; y: number };
  parameters?: Parameters;
  config?: Parameters;
  data?: WorkflowNodeData;
  category?: string;
  icon?: string;
}

export interface WorkflowValidation {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface Workflow {
  id?: string | null;
  _id?: string;
  name?: string;
  description?: string;
  status?: string;
  nodes?: WorkflowDefinitionNode[];
  edges?: WorkflowEdge[];
  input?: WorkflowInput;
  variables?: Parameters;
  settings?: { timeoutMs?: number };
  latestValidation?: WorkflowValidation | null;
  validation?: WorkflowValidation;
  tags?: string[];
  runStats?: { totalRuns?: number };
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
  meta?: { createdAt?: string; updatedAt?: string };
  _source?: WorkflowSource;
  isLocal?: boolean;
}

export interface GraphSnapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface NodeOutput {
  [key: string]: unknown;
  text?: string;
  urls?: string[];
  images?: Array<string | { url: string }>;
  videoId?: string;
  videoUrl?: string;
  status?: string;
  error?: string;
  searchResults?: Array<{ url: string; title?: string }>;
}

export interface NodeExecution {
  nodeId?: string;
  nodeType: string;
  nodeName?: string;
  status: string;
  output?: NodeOutput;
  error?: string;
}

export interface Execution {
  id?: string;
  _id?: string;
  executionId?: string;
  workflowId?: string;
  workflowName?: string;
  workflow_type?: string;
  execute_time?: string;
  createdAt?: string;
  durationMs?: number;
  status: string;
  error?: string;
  error_msg?: string;
  simulated: boolean;
  nodeResults?: NodeExecution[];
  output?: unknown;
  input?: WorkflowInput;
  isLocal?: boolean;
  _source?: WorkflowSource;
}

export interface RunOptions {
  simulate?: boolean;
  timeoutMs?: number;
  triggerType?: string;
  signal?: AbortSignal;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GenerateWorkflowRequest {
  message: string;
  messages?: ChatMessage[];
  workflow?: Workflow;
  model?: string;
  search?: boolean;
}

export interface GenerateWorkflowResult {
  reply: string;
  workflow: Workflow | null;
  warnings?: string[];
  input?: WorkflowInput;
}
