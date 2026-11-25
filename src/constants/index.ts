export const NODE_CATEGORIES = {
  TRIGGER: 'trigger',
  AI: 'ai',
  INTEGRATION: 'integration',
  LOGIC: 'logic',
  DATA: 'data',
  MEDIA: 'media',
  CONVERSATION: 'conversation',
  OUTPUT: 'output',
  OTHER: 'other',
};

export const CATEGORY_LABELS: Record<string, string> = {
  [NODE_CATEGORIES.TRIGGER]: '触发器',
  [NODE_CATEGORIES.AI]: 'AI 能力',
  [NODE_CATEGORIES.INTEGRATION]: '外部集成',
  [NODE_CATEGORIES.LOGIC]: '流程控制',
  [NODE_CATEGORIES.DATA]: '数据与变量',
  [NODE_CATEGORIES.MEDIA]: '图像与视频',
  [NODE_CATEGORIES.CONVERSATION]: '会话与消息',
  [NODE_CATEGORIES.OUTPUT]: '输出',
  [NODE_CATEGORIES.OTHER]: '其他',
};

export const WORKFLOW_TIMEOUT = { DEFAULT: 180000, MIN: 1000, MAX: 600000 };
