import type { Workflow } from '../types/workflow';

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
];
