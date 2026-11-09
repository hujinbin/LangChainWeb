export const FLASH_MODEL_CATALOG = {
  text: ['agnes-3.0-flash', 'agnes-2.5-flash'],
  image: [
    'agnes-image-2.5-flash',
    'agnes-image-2.1-flash',
    'agnes-image-2.0-flash',
  ],
  video: ['agnes-video-2.5-flash'],
};

export const MODEL_NODE_KINDS = {
  llm: 'text',
  imageGeneration: 'image',
  videoGeneration: 'video',
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const port = (type = 'any') => [{ name: 'main', type }];
const prompt = {
  type: 'string',
  title: '提示词',
  format: 'textarea',
  description: '可引用 {{input.question}} 或 {{nodes.node-id.output.text}}',
};
const images = {
  type: 'array',
  title: '参考图片',
  format: 'urls',
  items: { type: 'string' },
  maxItems: 5,
  default: [],
  description: '每行一个图片 URL，或整值引用 {{nodes.image-1.output.urls}}',
};
const modelSchema = (kind) => ({
  type: 'string',
  title: 'Flash 模型',
  enum: [...FLASH_MODEL_CATALOG[kind]],
  default: FLASH_MODEL_CATALOG[kind][0],
});

export const DEFAULT_NODE_TYPES = [
  {
    type: 'manualTrigger',
    name: '手动触发',
    category: 'trigger',
    icon: '▶',
    executable: true,
    description: '由用户手动发起一次工作流运行',
    inputs: [],
    outputs: port(),
    config_schema: { properties: {}, required: [] },
  },
  {
    type: 'webhookTrigger',
    name: 'Webhook 触发',
    category: 'trigger',
    icon: '↗',
    executable: true,
    description: '保存外部回调配置，当前由手动运行发起',
    inputs: [],
    outputs: port(),
    config_schema: {
      properties: {
        path: {
          type: 'string',
          title: '回调路径',
          description: '例如 /customer-service',
        },
        method: {
          type: 'string',
          title: '请求方法',
          enum: ['GET', 'POST'],
          default: 'POST',
        },
      },
      required: [],
    },
  },
  {
    type: 'llm',
    name: 'Flash 文本模型',
    category: 'ai',
    icon: 'AI',
    executable: true,
    description: '生成文本，支持联网资料和上游节点上下文',
    inputs: port(),
    outputs: port('object'),
    config_schema: {
      properties: {
        model: modelSchema('text'),
        prompt: {
          ...prompt,
          description: '填写提示词或自定义 messages，支持变量引用',
        },
        messages: {
          type: 'array',
          title: '自定义消息',
          format: 'json',
          minItems: 1,
          description: '可选 JSON 消息数组。留空时使用提示词与上游上下文',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
          },
        },
        systemPrompt: {
          type: 'string',
          title: '系统提示词',
          format: 'textarea',
          description: '指定助手身份、回答范围和语气',
        },
        search: { type: 'boolean', title: '联网搜索', default: true },
        temperature: {
          type: 'number',
          title: '温度',
          minimum: 0,
          maximum: 2,
          default: 0.6,
        },
      },
      required: ['model'],
    },
  },
  {
    type: 'imageGeneration',
    name: 'Flash 图片生成',
    category: 'ai',
    icon: 'IMG',
    executable: true,
    description: '生成图片，支持参考图和多图组合',
    inputs: port(),
    outputs: port('object'),
    config_schema: {
      properties: {
        model: modelSchema('image'),
        prompt: { ...prompt, maxLength: 8000 },
        size: {
          type: 'string',
          title: '图片尺寸',
          enum: ['1K', '2K', '3K', '4K', '1024x1024', '1536x1024', '1024x1536'],
          default: '1K',
        },
        ratio: {
          type: 'string',
          title: '图片比例',
          enum: ['1:1', '3:4', '4:3', '16:9', '9:16', '2:3', '3:2', '21:9'],
          default: '1:1',
        },
        images,
      },
      required: ['model', 'prompt'],
    },
  },
  {
    type: 'videoGeneration',
    name: 'Flash 视频生成',
    category: 'ai',
    icon: 'VID',
    executable: true,
    description: '生成 720P 视频，支持参考图、首尾帧和已有任务查询',
    inputs: port(),
    outputs: port('object'),
    config_schema: {
      properties: {
        model: modelSchema('video'),
        prompt: {
          ...prompt,
          maxLength: 8000,
          description: '新建视频任务时填写，恢复已有 videoId 时可以留空',
        },
        mode: {
          type: 'string',
          title: '生成方式',
          enum: ['', 'text', 'reference', 'keyframe'],
          enumNames: ['自动识别', '文生视频', '参考图', '首尾帧'],
          default: '',
        },
        size: {
          type: 'string',
          title: '视频清晰度',
          enum: ['720P'],
          default: '720P',
        },
        seconds: {
          type: 'integer',
          title: '时长（秒）',
          minimum: 4,
          maximum: 12,
          default: 5,
        },
        aspect_ratio: {
          type: 'string',
          title: '视频比例',
          enum: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          default: '16:9',
        },
        images: {
          ...images,
          description: '公开 HTTPS 图片 URL 列表，或整值引用图片节点的 urls',
        },
        first_frame: {
          type: 'string',
          title: '首帧图片',
          description: '公开可访问的 HTTPS URL',
        },
        last_frame: {
          type: 'string',
          title: '尾帧图片',
          description: '公开可访问的 HTTPS URL',
        },
        waitForCompletion: {
          type: 'boolean',
          title: '等待生成完成',
          default: true,
        },
        videoId: {
          type: 'string',
          title: '恢复已有任务',
          description: '填写已有 videoId 后继续查询该任务',
        },
      },
      required: ['model'],
    },
  },
  {
    type: 'knowledgeRetrieval',
    name: '知识库检索',
    category: 'ai',
    icon: 'KB',
    executable: false,
    description: '模拟预览节点，当前用于保存知识库检索配置',
    inputs: port(),
    outputs: port('array'),
    config_schema: {
      properties: {
        datasetId: { type: 'string', title: '知识库 ID' },
        query: { type: 'string', title: '检索问题', format: 'textarea' },
        topK: { type: 'integer', title: '返回数量', minimum: 1, default: 3 },
      },
      required: [],
    },
  },
  {
    type: 'httpRequest',
    name: 'HTTP 请求',
    category: 'integration',
    icon: 'HTTP',
    executable: false,
    description: '模拟预览节点，当前用于保存外部接口配置',
    inputs: port(),
    outputs: port(),
    config_schema: {
      properties: {
        url: { type: 'string', title: 'URL' },
        method: {
          type: 'string',
          title: '方法',
          enum: ['GET', 'POST', 'PUT', 'DELETE'],
          default: 'GET',
        },
        headers: {
          type: 'object',
          title: '请求头',
          format: 'json',
          default: {},
        },
        body: { type: 'object', title: '请求体', format: 'json', default: {} },
      },
      required: [],
    },
  },
  {
    type: 'condition',
    name: '条件分支',
    category: 'logic',
    icon: '?',
    executable: false,
    description: '模拟预览节点，当前保存条件表达式',
    inputs: port(),
    outputs: [
      { name: 'true', type: 'any' },
      { name: 'false', type: 'any' },
    ],
    config_schema: {
      properties: {
        expression: { type: 'string', title: '条件表达式', format: 'textarea' },
      },
      required: [],
    },
  },
  {
    type: 'response',
    name: '输出响应',
    category: 'output',
    icon: 'OUT',
    executable: true,
    description: '整理工作流最终输出',
    inputs: port(),
    outputs: [],
    config_schema: {
      properties: {
        template: {
          type: 'string',
          title: '输出模板',
          format: 'textarea',
          description: '留空输出上游结果，也可引用 {{previous}}',
        },
      },
      required: [],
    },
  },
];

export const normalizeModelCatalog = (catalog = {}) => {
  const result = {
    provider: catalog.provider || 'agnes',
    flashOnly: true,
    defaults: {},
  };
  Object.entries(FLASH_MODEL_CATALOG).forEach(([kind, allowed]) => {
    result[kind] = Array.isArray(catalog[kind])
      ? allowed.filter((model) => catalog[kind].includes(model))
      : [...allowed];
    result.defaults[kind] = result[kind].includes(catalog.defaults?.[kind])
      ? catalog.defaults[kind]
      : result[kind][0];
  });
  return result;
};

export const getDefaultParameters = (typeOrMeta) => {
  const meta =
    typeof typeOrMeta === 'string'
      ? DEFAULT_NODE_TYPES.find((node) => node.type === typeOrMeta)
      : typeOrMeta;
  return Object.fromEntries(
    Object.entries(meta?.config_schema?.properties || {})
      .filter(([, field]) => field.default !== undefined)
      .map(([key, field]) => [key, clone(field.default)])
  );
};

export const mergeNodeTypes = (remoteNodes = [], catalog) => {
  const remote = Array.isArray(remoteNodes) ? remoteNodes : [];
  const types = [
    ...new Set([
      ...DEFAULT_NODE_TYPES.map((node) => node.type),
      ...remote.map((node) => node.type),
    ]),
  ];
  return types.map((type) => {
    const local = DEFAULT_NODE_TYPES.find((node) => node.type === type);
    const server = remote.find((node) => node.type === type) || {};
    const localSchema = clone(
      local?.config_schema || { properties: {}, required: [] }
    );
    const schema = {
      ...server.config_schema,
      ...localSchema,
      properties: {
        ...server.config_schema?.properties,
        ...localSchema.properties,
      },
    };
    const merged = {
      ...local,
      ...server,
      category: server.category || server.group || local?.category || 'other',
      icon: server.icon || local?.icon || '',
      config_schema: schema,
    };
    merged.executable = local?.executable === true;
    merged.previewOnly = !merged.executable;
    const kind = MODEL_NODE_KINDS[type];
    if (kind) {
      let choices = [...FLASH_MODEL_CATALOG[kind]];
      if (Array.isArray(server.models))
        choices = choices.filter((model) => server.models.includes(model));
      if (catalog && Array.isArray(catalog[kind]))
        choices = choices.filter((model) => catalog[kind].includes(model));
      const preferred = catalog?.defaults?.[kind] || server.defaultModel;
      merged.models = choices;
      merged.defaultModel = choices.includes(preferred)
        ? preferred
        : choices[0];
      merged.config_schema.properties.model = {
        ...schema.properties.model,
        enum: choices,
        default: merged.defaultModel,
      };
    }
    return merged;
  });
};
