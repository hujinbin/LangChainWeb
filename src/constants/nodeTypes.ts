import type {
  ConfigSchema,
  ModelCatalog,
  ModelKind,
  NodeTypeMetadata,
  Parameters,
  SchemaField,
} from '../types/workflow';
import { asRecord } from '../types/api';

export const FLASH_MODEL_CATALOG: Record<ModelKind, string[]> = {
  text: ['agnes-3.0-flash', 'agnes-2.5-flash'],
  image: [
    'agnes-image-2.5-flash',
    'agnes-image-2.1-flash',
    'agnes-image-2.0-flash',
  ],
  video: ['agnes-video-2.5-flash'],
};

export const MODEL_NODE_KINDS: Record<string, ModelKind | undefined> = {
  llm: 'text',
  imageGeneration: 'image',
  videoGeneration: 'video',
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const port = (type = 'any') => [{ name: 'main', type }];
const prompt: SchemaField = {
  type: 'string',
  title: '提示词',
  format: 'textarea',
  description: '可引用 {{input.question}} 或 {{nodes.node-id.output.text}}',
};
const images: SchemaField = {
  type: 'array',
  title: '参考图片',
  format: 'urls',
  items: { type: 'string' },
  maxItems: 5,
  default: [],
  description: '每行一个图片 URL，或整值引用 {{nodes.image-1.output.urls}}',
};
const modelSchema = (kind: ModelKind): SchemaField => ({
  type: 'string',
  title: 'Flash 模型',
  enum: [...FLASH_MODEL_CATALOG[kind]],
  default: FLASH_MODEL_CATALOG[kind][0],
});

export const DEFAULT_NODE_TYPES: NodeTypeMetadata[] = [
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
    executable: true,
    description: '检索自己的知识库，将命中文档供下游模型回答参考',
    inputs: port(),
    outputs: port('object'),
    config_schema: {
      properties: {
        datasetId: {
          type: 'string',
          title: '知识库',
          description: '选择当前账号已启用的知识库。',
        },
        query: {
          type: 'string',
          title: '检索问题',
          format: 'textarea',
          default: '{{input.question}}',
          maxLength: 2000,
          description: '支持 {{input.question}}，命中片段会传给下游文本模型。',
        },
        topK: {
          type: 'integer',
          title: '返回片段数',
          minimum: 1,
          maximum: 20,
          default: 3,
        },
      },
      required: ['datasetId', 'query'],
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

export const normalizeModelCatalog = (value: unknown = {}): ModelCatalog => {
  const catalog = asRecord(value);
  const defaults = asRecord(catalog.defaults);
  const result: ModelCatalog = {
    provider: typeof catalog.provider === 'string' ? catalog.provider : 'agnes',
    flashOnly: true,
    text: [],
    image: [],
    video: [],
    defaults: { text: undefined, image: undefined, video: undefined },
  };
  (Object.keys(FLASH_MODEL_CATALOG) as ModelKind[]).forEach((kind) => {
    const remote = catalog[kind];
    result[kind] = Array.isArray(remote)
      ? FLASH_MODEL_CATALOG[kind].filter((model) => remote.includes(model))
      : [...FLASH_MODEL_CATALOG[kind]];
    const preferred = defaults[kind];
    result.defaults[kind] =
      typeof preferred === 'string' && result[kind].includes(preferred)
        ? preferred
        : result[kind][0];
  });
  return result;
};

export const getDefaultParameters = (
  typeOrMeta?: string | Partial<NodeTypeMetadata>
): Parameters => {
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

function normalizeSchemaField(value: unknown): SchemaField {
  const field = asRecord(value);
  const text = (value: unknown) =>
    typeof value === 'string' ? value : undefined;
  const number = (value: unknown) =>
    typeof value === 'number' ? value : undefined;
  const strings = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : undefined;
  return {
    type: text(field.type),
    title: text(field.title),
    description: text(field.description),
    format: text(field.format),
    enum: Array.isArray(field.enum)
      ? field.enum.filter(
          (item): item is string | number | boolean =>
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean'
        )
      : undefined,
    enumNames: strings(field.enumNames),
    default: field.default,
    minimum: number(field.minimum),
    maximum: number(field.maximum),
    minItems: number(field.minItems),
    maxItems: number(field.maxItems),
    maxLength: number(field.maxLength),
    items: field.items ? normalizeSchemaField(field.items) : undefined,
    properties: field.properties
      ? normalizeSchemaProperties(field.properties)
      : undefined,
    required: strings(field.required),
  };
}

function normalizeSchemaProperties(
  value: unknown
): Record<string, SchemaField> {
  return Object.fromEntries(
    Object.entries(asRecord(value)).map(([name, field]) => [
      name,
      normalizeSchemaField(field),
    ])
  );
}

function normalizeRemoteNode(
  value: unknown
): Partial<NodeTypeMetadata> & { type: string } {
  const node = asRecord(value);
  const schema = asRecord(node.config_schema);
  return {
    ...node,
    type: typeof node.type === 'string' ? node.type : '',
    name: typeof node.name === 'string' ? node.name : undefined,
    category: typeof node.category === 'string' ? node.category : undefined,
    group: typeof node.group === 'string' ? node.group : undefined,
    icon: typeof node.icon === 'string' ? node.icon : undefined,
    description:
      typeof node.description === 'string' ? node.description : undefined,
    inputs: Array.isArray(node.inputs)
      ? node.inputs.map((value: unknown) => {
          const port = asRecord(value);
          return {
            name: typeof port.name === 'string' ? port.name : 'main',
            type: typeof port.type === 'string' ? port.type : 'any',
          };
        })
      : undefined,
    outputs: Array.isArray(node.outputs)
      ? node.outputs.map((value: unknown) => {
          const port = asRecord(value);
          return {
            name: typeof port.name === 'string' ? port.name : 'main',
            type: typeof port.type === 'string' ? port.type : 'any',
          };
        })
      : undefined,
    models: Array.isArray(node.models)
      ? node.models.filter(
          (model): model is string => typeof model === 'string'
        )
      : undefined,
    defaultModel:
      typeof node.defaultModel === 'string' ? node.defaultModel : undefined,
    config_schema: {
      properties: normalizeSchemaProperties(schema.properties),
      required: Array.isArray(schema.required)
        ? schema.required.filter(
            (item): item is string => typeof item === 'string'
          )
        : [],
    },
  };
}

export const mergeNodeTypes = (
  remoteNodes: unknown = [],
  catalog?: ModelCatalog
): NodeTypeMetadata[] => {
  const remote = Array.isArray(remoteNodes)
    ? remoteNodes.map(normalizeRemoteNode).filter((node) => node.type)
    : [];
  const types = [
    ...new Set([
      ...DEFAULT_NODE_TYPES.map((node) => node.type),
      ...remote.map((node) => node.type),
    ]),
  ];
  return types.map((type) => {
    const local = DEFAULT_NODE_TYPES.find((node) => node.type === type);
    const server = remote.find((node) => node.type === type);
    const localSchema = clone(
      local?.config_schema || { properties: {}, required: [] }
    );
    const schema: ConfigSchema = {
      ...server?.config_schema,
      ...localSchema,
      properties: {
        ...server?.config_schema?.properties,
        ...localSchema.properties,
      },
    };
    const merged: NodeTypeMetadata = {
      ...local,
      ...server,
      type,
      name: server?.name || local?.name || type,
      description: server?.description ?? local?.description,
      inputs: server?.inputs ?? local?.inputs,
      outputs: server?.outputs ?? local?.outputs,
      category: server?.category || server?.group || local?.category || 'other',
      icon: server?.icon || local?.icon || '',
      config_schema: schema,
      executable: local?.executable === true,
      previewOnly: local?.executable !== true,
    };
    const kind = MODEL_NODE_KINDS[type];
    if (kind) {
      let choices = [...FLASH_MODEL_CATALOG[kind]];
      const models = server?.models;
      if (models) choices = choices.filter((model) => models.includes(model));
      if (catalog)
        choices = choices.filter((model) => catalog[kind].includes(model));
      const preferred = catalog?.defaults[kind] || server?.defaultModel;
      merged.models = choices;
      merged.defaultModel =
        preferred && choices.includes(preferred) ? preferred : choices[0];
      merged.config_schema.properties.model = {
        ...schema.properties.model,
        enum: choices,
        default: merged.defaultModel,
      };
    }
    return merged;
  });
};
