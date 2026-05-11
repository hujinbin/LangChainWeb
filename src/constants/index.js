// 节点类型定义（与后端保持一致）
export const NODE_CATEGORIES = {
  TRIGGER: 'trigger',
  DATA_SOURCE: 'data_source',
  PROCESSING: 'processing',
  AI_GENERATION: 'ai_generation',
  LOGIC: 'logic',
  STORAGE: 'storage',
  PUBLISHER: 'publisher'
};

export const CATEGORY_LABELS = {
  [NODE_CATEGORIES.TRIGGER]: '触发器',
  [NODE_CATEGORIES.DATA_SOURCE]: '数据源',
  [NODE_CATEGORIES.PROCESSING]: '处理',
  [NODE_CATEGORIES.AI_GENERATION]: 'AI创作',
  [NODE_CATEGORIES.LOGIC]: '逻辑',
  [NODE_CATEGORIES.STORAGE]: '存储',
  [NODE_CATEGORIES.PUBLISHER]: '发布'
};

export const CATEGORY_COLORS = {
  [NODE_CATEGORIES.TRIGGER]: '#52c41a',
  [NODE_CATEGORIES.DATA_SOURCE]: '#1890ff',
  [NODE_CATEGORIES.PROCESSING]: '#722ed1',
  [NODE_CATEGORIES.AI_GENERATION]: '#eb2f96',
  [NODE_CATEGORIES.LOGIC]: '#faad14',
  [NODE_CATEGORIES.STORAGE]: '#fa8c16',
  [NODE_CATEGORIES.PUBLISHER]: '#13c2c2'
};

// 节点状态
export const NODE_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error'
};

// 工作流状态
export const WORKFLOW_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

// 执行记录状态
export const EXECUTION_STATUS = {
  PENDING: '待执行',
  RUNNING: '执行中',
  SUCCESS: '执行成功',
  FAILED: '执行失败'
};

// 触发类型
export const TRIGGER_TYPES = {
  MANUAL: 'manual',
  CRON: 'cron',
  WEBHOOK: 'webhook'
};

// 默认节点大小
export const DEFAULT_NODE_SIZE = {
  width: 180,
  height: 80
};

// 画布配置
export const CANVAS_CONFIG = {
  minZoom: 0.1,
  maxZoom: 2,
  defaultZoom: 1,
  snapToGrid: true,
  snapGrid: [15, 15]
};
