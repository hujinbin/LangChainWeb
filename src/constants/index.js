export const NODE_CATEGORIES = {
  TRIGGER: 'trigger',
  AI: 'ai',
  INTEGRATION: 'integration',
  LOGIC: 'logic',
  OUTPUT: 'output',
  OTHER: 'other',
};

export const CATEGORY_LABELS = {
  [NODE_CATEGORIES.TRIGGER]: '触发器',
  [NODE_CATEGORIES.AI]: 'AI 能力',
  [NODE_CATEGORIES.INTEGRATION]: '外部集成',
  [NODE_CATEGORIES.LOGIC]: '流程控制',
  [NODE_CATEGORIES.OUTPUT]: '输出',
  [NODE_CATEGORIES.OTHER]: '其他',
};

export const CATEGORY_COLORS = {
  [NODE_CATEGORIES.TRIGGER]: '#16a34a',
  [NODE_CATEGORIES.AI]: '#2563eb',
  [NODE_CATEGORIES.INTEGRATION]: '#0891b2',
  [NODE_CATEGORIES.LOGIC]: '#d97706',
  [NODE_CATEGORIES.OUTPUT]: '#7c3aed',
  [NODE_CATEGORIES.OTHER]: '#64748b',
};

export const NODE_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error',
};

export const WORKFLOW_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
};

export const EXECUTION_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
};

export const TRIGGER_TYPES = {
  MANUAL: 'manual',
  WEBHOOK: 'webhook',
};

export const DEFAULT_NODE_SIZE = {
  width: 180,
  height: 80,
};

export const CANVAS_CONFIG = {
  minZoom: 0.1,
  maxZoom: 2,
  defaultZoom: 1,
  snapToGrid: true,
  snapGrid: [15, 15],
};
