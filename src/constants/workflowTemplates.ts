import type { Workflow } from '../types/workflow';

export const createBlankWorkflow = (): Workflow => ({
  name: '未命名工作流', input: {},
  nodes: [
    { id: 'workflow-start', type: 'manualTrigger', name: '开始', position: { x: 100, y: 180 }, parameters: { inputSchema: { type: 'object', properties: {}, required: [] } } },
    { id: 'workflow-end', type: 'response', name: '结束', position: { x: 600, y: 180 }, parameters: { template: '{{input}}' } },
  ],
  edges: [{ id: 'start-end', source: 'workflow-start', target: 'workflow-end', sourceHandle: 'main', targetHandle: 'main' }],
});

const trigger = {
  id: 'start',
  type: 'manualTrigger',
  name: '开始',
  position: { x: 70, y: 160 },
  parameters: {},
};
const output = {
  id: 'output',
  type: 'response',
  name: '输出结果',
  position: { x: 670, y: 160 },
  parameters: {},
};
const edges = [
  { id: 'start-model', source: 'start', target: 'model' },
  { id: 'model-output', source: 'model', target: 'output' },
];

export const WORKFLOW_TEMPLATES: Array<
  Workflow & { id: string; name: string; description: string }
> = [
  {
    id: 'text',
    name: '文本创作助手',
    description: '输入主题，使用 Flash 模型生成文案与回答。',
    input: { question: '为一家独立咖啡店写一段简短的开业文案' },
    nodes: [
      trigger,
      {
        id: 'model',
        type: 'llm',
        name: '生成文本',
        position: { x: 365, y: 160 },
        parameters: {
          model: 'agnes-3.0-flash',
          prompt: '{{input.question}}',
          temperature: 0.6,
          search: false,
        },
      },
      output,
    ],
    edges,
  },
  {
    id: 'image',
    name: '灵感生成画面',
    description: '描述创意，生成图片并直接预览结果。',
    input: { question: '窗边的一杯拿铁，柔和晨光，简洁的产品摄影' },
    nodes: [
      trigger,
      {
        id: 'model',
        type: 'imageGeneration',
        name: '生成图片',
        position: { x: 365, y: 160 },
        parameters: {
          model: 'agnes-image-2.5-flash',
          prompt: '{{input.question}}',
          size: '1K',
          ratio: '1:1',
        },
      },
      output,
    ],
    edges,
  },
  {
    id: 'video',
    name: '制作一段短片',
    description: '输入视频描述，提交 720P Flash 视频任务。',
    input: { question: '晨光照进咖啡店，镜头缓慢推进到冒着热气的咖啡杯' },
    nodes: [
      trigger,
      {
        id: 'model',
        type: 'videoGeneration',
        name: '生成视频',
        position: { x: 365, y: 160 },
        parameters: {
          model: 'agnes-video-2.5-flash',
          prompt: '{{input.question}}',
          mode: 'text',
          size: '720P',
          seconds: 5,
          aspect_ratio: '16:9',
          waitForCompletion: false,
        },
      },
      output,
    ],
    edges,
  },
  {
    id: 'branch', name: '按条件分流', description: '依据分数走不同分支，直观看到满足与不满足的执行路径。', input: { score: 85 },
    nodes: [trigger,
      { id: 'check', type: 'condition', name: '判断分数', position: { x: 365, y: 160 }, parameters: { left: '{{input.score}}', operator: 'gte', right: 60 } },
      { id: 'pass', type: 'textProcess', name: '通过提示', position: { x: 670, y: 60 }, parameters: { operation: 'template', text: '已通过，继续下一阶段。' } },
      { id: 'retry', type: 'textProcess', name: '复习提示', position: { x: 670, y: 300 }, parameters: { operation: 'template', text: '建议复习后再试。' } },
      { ...output, position: { x: 975, y: 160 }, parameters: { template: '{{previous}}' } }],
    edges: [{ id: 'a', source: 'start', target: 'check' }, { id: 'b', source: 'check', target: 'pass', sourceHandle: 'true', label: '满足' }, { id: 'c', source: 'check', target: 'retry', sourceHandle: 'false', label: '不满足' }, { id: 'd', source: 'pass', target: 'output' }, { id: 'e', source: 'retry', target: 'output' }],
  },
  {
    id: 'json', name: 'JSON 数据清洗', description: '解析文本、提取字段、清理空格，再映射成命名输出。', input: { payload: '{"message":"  工作流已就绪  "}' },
    nodes: [trigger,
      { id: 'parse', type: 'jsonParse', name: '解析输入', position: { x: 365, y: 160 }, parameters: { text: '{{input.payload}}' } },
      { id: 'field', type: 'jsonGet', name: '提取消息', position: { x: 660, y: 160 }, parameters: { value: '{{nodes.parse.output.value}}', path: 'message' } },
      { id: 'clean', type: 'textProcess', name: '清理空格', position: { x: 955, y: 160 }, parameters: { operation: 'trim', text: '{{nodes.field.output.value}}' } },
      { ...output, position: { x: 1250, y: 160 }, parameters: { outputs: { message: '{{nodes.clean.output.text}}' } } }],
    edges: [{ id: 'a', source: 'start', target: 'parse' }, { id: 'b', source: 'parse', target: 'field' }, { id: 'c', source: 'field', target: 'clean' }, { id: 'd', source: 'clean', target: 'output' }],
  },
  {
    id: 'batch', name: '批量运行子流程', description: '对列表逐项执行本人子工作流。使用前在批处理节点选择执行体。', input: { items: ['第一项', '第二项'] },
    nodes: [trigger,
      { id: 'batch', type: 'batch', name: '逐项处理', position: { x: 365, y: 160 }, parameters: { items: '{{input.items}}', maxIterations: 50, input: {} } },
      { ...output, parameters: { outputs: { items: '{{nodes.batch.output.items}}' } } }],
    edges: [{ id: 'a', source: 'start', target: 'batch' }, { id: 'b', source: 'batch', target: 'output' }],
  },
];
