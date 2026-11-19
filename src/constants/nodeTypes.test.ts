import {
  DEFAULT_NODE_TYPES,
  getDefaultParameters,
  mergeNodeTypes,
  normalizeModelCatalog,
} from './nodeTypes';

test('模型目录只保留本地 Flash 白名单交集', () => {
  const catalog = normalizeModelCatalog({
    text: ['agnes-3.0-pro', 'agnes-2.5-flash'],
    video: ['agnes-video-2.5'],
    defaults: { text: 'agnes-3.0-pro' },
  });
  expect(catalog.text).toEqual(['agnes-2.5-flash']);
  expect(catalog.defaults.text).toBe('agnes-2.5-flash');
  expect(catalog.video).toEqual([]);
});

test('远程节点元数据合并后保留完整本地类型和安全模型选项', () => {
  const nodes = mergeNodeTypes([
    {
      type: 'llm',
      name: '远程文本名称',
      models: ['agnes-3.0-pro', 'agnes-2.5-flash'],
      config_schema: {
        properties: {
          temperature: { type: 'string' },
          model: { enum: ['agnes-3.0-pro'] },
          attempts: { type: 'integer', enum: [1, 2] },
          enabled: { type: 'boolean', enum: [false, true], default: false },
        },
      },
    },
  ]);
  const llm = nodes.find((node) => node.type === 'llm')!;
  expect(llm.name).toBe('远程文本名称');
  expect(llm.inputs).toEqual([{ name: 'main', type: 'any' }]);
  expect(llm.outputs).toEqual([{ name: 'main', type: 'object' }]);
  expect(llm.config_schema.properties.attempts.enum).toEqual([1, 2]);
  expect(llm.config_schema.properties.enabled.enum).toEqual([false, true]);
  expect(llm.config_schema.properties.temperature.type).toBe('number');
  expect(llm.config_schema.properties.search.type).toBe('boolean');
  expect(llm.config_schema.properties.messages).toMatchObject({
    type: 'array',
    format: 'json',
  });
  expect(llm.config_schema.properties.model.enum).toEqual(['agnes-2.5-flash']);
  expect(llm.defaultModel).toBe('agnes-2.5-flash');
  expect(nodes.find((node) => node.type === 'imageGeneration')).toBeDefined();
});

test('新节点默认值为独立数据，messages 缺省不会覆盖 prompt', () => {
  const first = getDefaultParameters('videoGeneration');
  const second = getDefaultParameters('videoGeneration');
  if (!Array.isArray(first.images)) throw new Error('默认参考图需要为数组');
  first.images.push('https://example.com/image.png');
  expect(second.images).toEqual([]);
  expect(second).toMatchObject({
    mode: '',
    size: '720P',
    seconds: 5,
    waitForCompletion: true,
  });
  const text = getDefaultParameters(
    DEFAULT_NODE_TYPES.find((node) => node.type === 'llm')
  );
  expect(text.messages).toBeUndefined();
  expect(text).toMatchObject({
    search: true,
    temperature: 0.6,
    model: 'agnes-3.0-flash',
  });
});

test('知识库检索登记为真实执行节点且要求知识库与检索问题', () => {
  const node = mergeNodeTypes().find(
    (item) => item.type === 'knowledgeRetrieval'
  )!;
  expect(node.executable).toBe(true);
  expect(node.previewOnly).toBe(false);
  expect(node.outputs).toEqual([{ name: 'main', type: 'object' }]);
  expect(node.config_schema.required).toEqual(['datasetId', 'query']);
  expect(getDefaultParameters(node)).toEqual({
    query: '{{input.question}}',
    topK: 3,
  });
});

test('扩展目录支持数据、循环、会话和媒体节点，并采用服务器能力与具名端口', () => {
  const nodes = mergeNodeTypes([{ type: 'selector', executable: false, inputs: ['main'], outputs: ['sales', 'default'], parameterSchema: { properties: { cases: { type: 'array', maxItems: 4 } }, required: ['cases'] }, outputSchema: { type: 'object', properties: { branch: { type: 'string' } } } }]);
  expect(nodes).toEqual(expect.arrayContaining(['batch', 'code', 'jsonGet', 'memoryWrite', 'conversationCreate', 'imageProcess'].map(type => expect.objectContaining({ type }))));
  const selector = nodes.find(node => node.type === 'selector')!;
  expect(selector.executable).toBe(false);
  expect(selector.outputs?.map(port => port.name)).toEqual(['sales', 'default']);
  expect(selector.config_schema.properties.cases.maxItems).toBe(4);
  expect(selector.outputSchema?.properties?.branch.type).toBe('string');
});
