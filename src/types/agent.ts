export type AgentKind = 'cloud-comic' | 'life-story';

export interface AgentSettings {
  sceneCount: number;
  durationSeconds: number;
  aspectRatio: string;
  imageSize: string;
  generateSceneImages: boolean;
  textModel: string;
  imageModel: string;
  videoModel: string;
}

export interface AgentScene {
  id: string;
  title: string;
  stage: string;
  caption: string;
  narration: string;
  imagePrompt: string;
  videoPrompt: string;
  durationSeconds: number;
}

export interface AgentDraft {
  title: string;
  summary: string;
  character: string;
  style: string;
  scenes: AgentScene[];
}

export interface AgentSceneResult {
  sceneId: string;
  status: string;
  stage?: string;
  imageUrl?: string;
  assetId?: string;
  sourceUrl?: string;
  videoId?: string;
  videoUrl?: string;
  error?: string;
  submitState?: string;
  stale?: boolean;
  orphaned?: boolean;
}

export interface AgentJob {
  id: string;
  kind?: 'design' | 'run';
  status: string;
  stage: string;
  currentSceneId?: string;
  progress: number;
  error?: string;
  errorCode?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface AgentOutput {
  videoUrl?: string;
  assetId?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export interface AgentProject {
  id: string;
  revision: number;
  agentId: AgentKind;
  name: string;
  brief: string;
  settings: AgentSettings;
  draft: AgentDraft | null;
  messages: AgentMessage[];
  results: AgentSceneResult[];
  job: AgentJob | null;
  output: AgentOutput;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPreset {
  id: AgentKind;
  name: string;
  description: string;
  defaults: Pick<AgentSettings, 'sceneCount' | 'durationSeconds' | 'aspectRatio'>;
  limits?: { minScenes?: number; maxScenes?: number };
}

export interface AgentCatalog {
  agents: AgentPreset[];
  models: { text: string[]; image: string[]; video: string[] };
}

export interface AgentPage {
  items: AgentProject[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AgentStatus {
  projectId: string;
  job: AgentJob | null;
  results: AgentSceneResult[];
  output: AgentOutput;
}

export type AgentExportFormat = 'json' | 'markdown' | 'html' | 'zip';
export type AgentUpdate = Pick<AgentProject, 'name' | 'brief' | 'settings'> & { draft?: AgentDraft | null; revision?: number };
