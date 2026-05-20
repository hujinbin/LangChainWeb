// 内置节点类型数据，当后端不可用时（游客模式）提供默认节点
export const DEFAULT_NODE_TYPES = [
  // 触发器
  {
    type: 'manual_trigger',
    name: '手动触发',
    category: 'trigger',
    icon: '▶️',
    description: '手动点击执行触发工作流',
    inputs: [],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {}
  },
  {
    type: 'cron_trigger',
    name: '定时触发',
    category: 'trigger',
    icon: '⏰',
    description: '按照设定的时间规则自动触发',
    inputs: [],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        cron: { type: 'string', title: 'Cron表达式', description: '例如: 0 9 * * *' },
        timezone: { type: 'string', title: '时区', default: 'Asia/Shanghai' }
      }
    }
  },
  {
    type: 'webhook_trigger',
    name: 'Webhook触发',
    category: 'trigger',
    icon: '🔗',
    description: '通过HTTP请求触发工作流',
    inputs: [],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        method: { type: 'string', title: '请求方法', enum: ['GET', 'POST', 'PUT'], default: 'POST' },
        path: { type: 'string', title: '路径', description: '自定义webhook路径' }
      }
    }
  },

  // 数据源
  {
    type: 'http_request',
    name: 'HTTP请求',
    category: 'data_source',
    icon: '🌐',
    description: '发送HTTP请求获取数据',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        url: { type: 'string', title: 'URL', description: '请求地址' },
        method: { type: 'string', title: '方法', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
        headers: { type: 'string', title: '请求头', format: 'textarea', description: 'JSON格式' },
        body: { type: 'string', title: '请求体', format: 'textarea' }
      },
      required: ['url']
    }
  },
  {
    type: 'rss_reader',
    name: 'RSS读取',
    category: 'data_source',
    icon: '📡',
    description: '读取RSS/Atom订阅源',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        url: { type: 'string', title: 'RSS地址' },
        limit: { type: 'number', title: '获取数量', default: 10 }
      },
      required: ['url']
    }
  },
  {
    type: 'web_scraper',
    name: '网页爬取',
    category: 'data_source',
    icon: '🕷️',
    description: '爬取网页内容',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        url: { type: 'string', title: '网页URL' },
        selector: { type: 'string', title: 'CSS选择器', description: '提取特定元素' },
        wait_for: { type: 'number', title: '等待时间(ms)', default: 0 }
      },
      required: ['url']
    }
  },

  // 处理
  {
    type: 'text_processor',
    name: '文本处理',
    category: 'processing',
    icon: '📝',
    description: '文本拆分、合并、替换等操作',
    inputs: [{ name: 'input', type: 'string' }],
    outputs: [{ name: 'output', type: 'string' }],
    config_schema: {
      properties: {
        operation: { type: 'string', title: '操作', enum: ['split', 'merge', 'replace', 'trim', 'extract'] },
        pattern: { type: 'string', title: '模式/分隔符' },
        replacement: { type: 'string', title: '替换内容' }
      },
      required: ['operation']
    }
  },
  {
    type: 'json_parser',
    name: 'JSON解析',
    category: 'processing',
    icon: '{}',
    description: '解析和转换JSON数据',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        path: { type: 'string', title: 'JSONPath', description: '提取路径，如 $.data.items' },
        operation: { type: 'string', title: '操作', enum: ['extract', 'transform', 'filter'], default: 'extract' }
      }
    }
  },
  {
    type: 'data_transform',
    name: '数据转换',
    category: 'processing',
    icon: '🔄',
    description: '数据类型转换和映射',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        mapping: { type: 'string', title: '字段映射', format: 'textarea', description: 'JSON格式的字段映射规则' }
      }
    }
  },

  // AI创作
  {
    type: 'llm_chat',
    name: 'LLM对话',
    category: 'ai_generation',
    icon: '🤖',
    description: '调用大语言模型进行对话',
    inputs: [{ name: 'input', type: 'string' }],
    outputs: [{ name: 'output', type: 'string' }],
    config_schema: {
      properties: {
        model: { type: 'string', title: '模型', enum: ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'qwen-plus', 'deepseek'], default: 'gpt-3.5-turbo' },
        system_prompt: { type: 'string', title: '系统提示词', format: 'textarea' },
        temperature: { type: 'number', title: '温度', minimum: 0, maximum: 2, default: 0.7 },
        max_tokens: { type: 'number', title: '最大Token数', default: 2000 }
      },
      required: ['model']
    }
  },
  {
    type: 'article_writer',
    name: '文章生成',
    category: 'ai_generation',
    icon: '✍️',
    description: 'AI自动生成文章内容',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [{ name: 'output', type: 'string' }],
    config_schema: {
      properties: {
        topic: { type: 'string', title: '主题' },
        style: { type: 'string', title: '写作风格', enum: ['专业', '通俗', '幽默', '严肃', '学术'] },
        length: { type: 'string', title: '文章长度', enum: ['短(500字)', '中(1000字)', '长(2000字)', '超长(3000字+)'] },
        outline: { type: 'string', title: '大纲', format: 'textarea', description: '可选，提供文章大纲' }
      },
      required: ['topic']
    }
  },
  {
    type: 'summarizer',
    name: '内容摘要',
    category: 'ai_generation',
    icon: '📋',
    description: 'AI自动生成内容摘要',
    inputs: [{ name: 'input', type: 'string' }],
    outputs: [{ name: 'output', type: 'string' }],
    config_schema: {
      properties: {
        max_length: { type: 'number', title: '摘要最大字数', default: 200 },
        style: { type: 'string', title: '摘要风格', enum: ['简洁', '详细', '要点列表'] }
      }
    }
  },
  {
    type: 'image_generator',
    name: '图片生成',
    category: 'ai_generation',
    icon: '🎨',
    description: 'AI生成图片',
    inputs: [{ name: 'input', type: 'string' }],
    outputs: [{ name: 'output', type: 'string' }],
    config_schema: {
      properties: {
        prompt: { type: 'string', title: '图片描述', format: 'textarea' },
        size: { type: 'string', title: '尺寸', enum: ['256x256', '512x512', '1024x1024'], default: '512x512' },
        style: { type: 'string', title: '风格', enum: ['natural', 'vivid'], default: 'natural' }
      },
      required: ['prompt']
    }
  },

  // 逻辑
  {
    type: 'if_condition',
    name: '条件判断',
    category: 'logic',
    icon: '🔀',
    description: '根据条件分流执行',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [{ name: 'true', type: 'any' }, { name: 'false', type: 'any' }],
    config_schema: {
      properties: {
        field: { type: 'string', title: '判断字段' },
        operator: { type: 'string', title: '操作符', enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'] },
        value: { type: 'string', title: '比较值' }
      },
      required: ['field', 'operator']
    }
  },
  {
    type: 'loop',
    name: '循环',
    category: 'logic',
    icon: '🔁',
    description: '遍历数组或重复执行',
    inputs: [{ name: 'input', type: 'array' }],
    outputs: [{ name: 'item', type: 'any' }, { name: 'done', type: 'any' }],
    config_schema: {
      properties: {
        mode: { type: 'string', title: '循环模式', enum: ['foreach', 'while', 'times'], default: 'foreach' },
        max_iterations: { type: 'number', title: '最大迭代次数', default: 100 }
      }
    }
  },
  {
    type: 'delay',
    name: '延时',
    category: 'logic',
    icon: '⏳',
    description: '延迟执行下一步',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        seconds: { type: 'number', title: '延时(秒)', default: 5, minimum: 1, maximum: 3600 }
      },
      required: ['seconds']
    }
  },
  {
    type: 'merge',
    name: '合并',
    category: 'logic',
    icon: '🔗',
    description: '合并多个输入数据',
    inputs: [{ name: 'input1', type: 'any' }, { name: 'input2', type: 'any' }],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        mode: { type: 'string', title: '合并模式', enum: ['append', 'merge_by_key', 'combine'], default: 'append' },
        key: { type: 'string', title: '合并键', description: 'merge_by_key模式时使用' }
      }
    }
  },

  // 存储
  {
    type: 'database',
    name: '数据库',
    category: 'storage',
    icon: '🗄️',
    description: '数据库读写操作',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        operation: { type: 'string', title: '操作', enum: ['find', 'insert', 'update', 'delete'] },
        collection: { type: 'string', title: '集合/表名' },
        query: { type: 'string', title: '查询条件', format: 'textarea', description: 'JSON格式' }
      },
      required: ['operation', 'collection']
    }
  },
  {
    type: 'file_storage',
    name: '文件存储',
    category: 'storage',
    icon: '📁',
    description: '本地文件读写',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        operation: { type: 'string', title: '操作', enum: ['read', 'write', 'append', 'delete'] },
        path: { type: 'string', title: '文件路径' },
        encoding: { type: 'string', title: '编码', default: 'utf-8' }
      },
      required: ['operation', 'path']
    }
  },
  {
    type: 'cache',
    name: '缓存',
    category: 'storage',
    icon: '💾',
    description: '内存缓存读写',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        operation: { type: 'string', title: '操作', enum: ['get', 'set', 'delete'] },
        key: { type: 'string', title: '缓存键' },
        ttl: { type: 'number', title: '过期时间(秒)', default: 3600 }
      },
      required: ['operation', 'key']
    }
  },

  // 发布
  {
    type: 'wechat_publisher',
    name: '微信公众号',
    category: 'publisher',
    icon: '💬',
    description: '发布内容到微信公众号',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        title: { type: 'string', title: '文章标题' },
        content_field: { type: 'string', title: '内容字段', description: '输入数据中的内容字段名' },
        thumb_media_id: { type: 'string', title: '封面图media_id' }
      },
      required: ['title']
    }
  },
  {
    type: 'email_sender',
    name: '邮件发送',
    category: 'publisher',
    icon: '📧',
    description: '发送邮件通知',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        to: { type: 'string', title: '收件人' },
        subject: { type: 'string', title: '邮件主题' },
        body_field: { type: 'string', title: '正文字段' }
      },
      required: ['to', 'subject']
    }
  },
  {
    type: 'webhook_output',
    name: 'Webhook推送',
    category: 'publisher',
    icon: '📤',
    description: '将结果推送到外部Webhook',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [],
    config_schema: {
      properties: {
        url: { type: 'string', title: 'Webhook URL' },
        method: { type: 'string', title: '请求方法', enum: ['POST', 'PUT'], default: 'POST' },
        headers: { type: 'string', title: '自定义请求头', format: 'textarea' }
      },
      required: ['url']
    }
  },
  {
    type: 'notification',
    name: '消息通知',
    category: 'publisher',
    icon: '🔔',
    description: '发送通知（钉钉/飞书/企微）',
    inputs: [{ name: 'input', type: 'any' }],
    outputs: [{ name: 'output', type: 'any' }],
    config_schema: {
      properties: {
        channel: { type: 'string', title: '通知渠道', enum: ['dingtalk', 'feishu', 'wecom'] },
        webhook_url: { type: 'string', title: 'Webhook地址' },
        message_field: { type: 'string', title: '消息字段' }
      },
      required: ['channel', 'webhook_url']
    }
  }
];
