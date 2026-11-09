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
        },
      },
    },
  ]);
  const llm = nodes.find((node) => node.type === 'llm');
  expect(llm.name).toBe('远程文本名称');
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
