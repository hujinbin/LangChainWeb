export const DEFAULT_NODE_TYPES = [
  {
    type: 'manualTrigger',
    name: '手动触发',
    category: 'trigger',
    icon: '▶',
    description: '由用户手动发起一次工作流运行',
    inputs: [],
    outputs: [{ name: 'main', type: 'any' }],
    config_schema: { properties: {} },
  },
  {
    type: 'webhookTrigger',
    name: 'Webhook 触发',
    category: 'trigger',
    icon: '↗',
    description: '预留给外部 HTTP 回调触发',
    inputs: [],
    outputs: [{ name: 'main', type: 'any' }],
    config_schema: {
      properties: {
        path: { type: 'string', title: '路径', description: '例如 /customer-service' },
        method: { type: 'string', title: '请求方法', enum: ['GET', 'POST'], default: 'POST' },
      },
    },
  },
  {
    type: 'llm',
    name: 'AI 大模型',
    category: 'ai',
    icon: 'AI',
    description: '接收上下文并生成文本结果',
    inputs: [{ name: 'main', type: 'any' }],
    outputs: [{ name: 'main', type: 'string' }],
    config_schema: {
      properties: {
        model: { type: 'string', title: '模型', default: 'default' },
        prompt: { type: 'string', title: '提示词', format: 'textarea' },
        temperature: { type: 'number', title: '温度', minimum: 0, maximum: 2, default: 0.7 },
      },
    },
  },
  {
    type: 'knowledgeRetrieval',
    name: '知识库检索',
    category: 'ai',
    icon: 'KB',
    description: '按 query 检索知识库片段',
    inputs: [{ name: 'main', type: 'any' }],
    outputs: [{ name: 'main', type: 'array' }],
    config_schema: {
      properties: {
        datasetId: { type: 'string', title: '知识库 ID' },
        query: { type: 'string', title: '检索问题' },
        topK: { type: 'number', title: '返回数量', default: 3 },
      },
    },
  },
  {
    type: 'httpRequest',
    name: 'HTTP 请求',
    category: 'integration',
    icon: 'HTTP',
    description: '调用外部接口，当前后端模拟响应',
    inputs: [{ name: 'main', type: 'any' }],
    outputs: [{ name: 'main', type: 'any' }],
    config_schema: {
      properties: {
        url: { type: 'string', title: 'URL' },
        method: { type: 'string', title: '方法', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
        headers: { type: 'string', title: '请求头', format: 'textarea' },
        body: { type: 'string', title: '请求体', format: 'textarea' },
      },
    },
  },
  {
    type: 'condition',
    name: '条件分支',
    category: 'logic',
    icon: '?',
    description: '根据表达式选择 true/false 出口',
    inputs: [{ name: 'main', type: 'any' }],
    outputs: [{ name: 'true', type: 'any' }, { name: 'false', type: 'any' }],
    config_schema: {
      properties: {
        expression: { type: 'string', title: '表达式', description: '例如 input.score > 80' },
      },
    },
  },
  {
    type: 'response',
    name: '输出响应',
    category: 'output',
    icon: 'OUT',
    description: '整理工作流最终输出',
    inputs: [{ name: 'main', type: 'any' }],
    outputs: [],
    config_schema: {
      properties: {
        template: { type: 'string', title: '输出模板', format: 'textarea' },
      },
    },
  },
];
