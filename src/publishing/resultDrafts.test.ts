import type { Execution } from '../types/workflow';
import type { AgentProject, AgentScene } from '../types/agent';
import {
  completedVideoDraft,
  storyboardResultDraft,
  workflowResultDraft,
  writingDraft,
} from './resultDrafts';

const run: Execution = { simulated: false, status: 'success', workflowName: 'Gallery' };
const first = '/api/aiWorkflow/assets/flowers.png';
const second = 'https://example.test/picture.jpg';
const clip = '/outputs/final.mp4';

test('the final response supplies copy while confirmed generation nodes supply media', () => {
  const record: Execution = {
    ...run,
    input: { prompt: 'Internal instructions' },
    output: {
      result: { title: 'A walk', body: 'Meet the flowers.', tags: ['spring'], cover: first },
      template: 'Internal template',
    },
    nodeResults: [
      { nodeType: 'llm', status: 'success', output: { text: 'Intermediate idea' } },
      {
        nodeType: 'imageGeneration',
        status: 'success',
        output: { images: [{ url: first }, second, second] },
      },
      { nodeType: 'imageEdit', status: 'failed', output: { urls: ['https://example.test/failed.jpg'] } },
      {
        nodeType: 'videoGeneration',
        status: 'success',
        output: { status: 'processing', videoId: 'pending' },
      },
      {
        nodeType: 'videoGeneration',
        status: 'completed',
        output: { status: 'completed', videoUrl: clip },
      },
    ],
  };
  expect(workflowResultDraft(record, 'Untitled')).toEqual({
    title: 'A walk',
    body: 'Meet the flowers.',
    tags: ['spring'],
    images: [first, second],
    cover: first,
    video: clip,
  });
  expect(workflowResultDraft({ ...record, simulated: true }, '')).toBeNull();
  expect(workflowResultDraft({ ...record, isLocal: true }, '')).toBeNull();
  expect(workflowResultDraft({ ...record, status: 'failed' }, '')).toBeNull();
});

test('handles legacy serialized and URL responses without forwarding request or task data', () => {
  const extract = (result: unknown) => workflowResultDraft({ ...run, output: { result } }, 'Untitled');
  expect(
    extract(JSON.stringify({ title: 'Title', text: 'Copy', internal: 'Only for the service' })),
  ).toMatchObject({ title: 'Title', body: 'Copy' });
  expect(extract(second)).toMatchObject({ images: [second], cover: second, body: '' });
  expect(extract(clip)).toMatchObject({ video: clip, body: '' });
  expect(extract(JSON.stringify({ input: 'private context', videoId: 'queued' }))).toBeNull();
  expect(extract({ status: 'running', videoId: 'job', videoUrl: clip })).toBeNull();
  expect(extract({ text: 'blob:null/preview' })).toBeNull();
  expect(extract({ body: 'data:,some-text', urls: ['data:image/png;base64,AA=='] })).toBeNull();
  expect(extract({ text: 'sample access_token=examplevalue' })).toBeNull();
  expect(extract({ text: 'https://example.test/draft?token=examplevalue' })).toBeNull();
  expect(completedVideoDraft('Clip', 'https://demo:example@example.test/clip.mp4')).toBeNull();
  expect(completedVideoDraft('Clip', clip)?.video).toBe(clip);
});

function scene(id: string): AgentScene {
  return {
    id,
    title: id,
    stage: '',
    caption: 'Panel ' + id,
    narration: '',
    imagePrompt: '',
    videoPrompt: '',
    durationSeconds: 3,
  };
}
const comic: AgentProject = {
  id: 'demo',
  revision: 1,
  agentId: 'cloud-comic',
  name: 'Clouds',
  brief: '',
  createdAt: '',
  updatedAt: '',
  settings: {
    sceneCount: 2,
    durationSeconds: 6,
    aspectRatio: '1:1',
    imageSize: '',
    generateSceneImages: true,
    textModel: '',
    imageModel: '',
    videoModel: '',
  },
  draft: {
    title: 'Blue skies',
    summary: 'A change of weather',
    scenes: [scene('a'), scene('b')],
    character: '',
    style: '',
  },
  results: [
    { sceneId: 'b', imageUrl: second, status: 'completed' },
    { sceneId: 'a', imageUrl: first, status: 'completed' },
  ],
  messages: [],
  job: null,
  output: {},
};

test('uses edited captions in storyboard order, and only the assembled video for a life story', () => {
  expect(storyboardResultDraft(comic)).toEqual({
    title: 'Blue skies',
    body: 'A change of weather\n\nPanel a\n\nPanel b',
    cover: first,
    images: [first, second],
    tags: [],
  });
  const film = { ...comic, agentId: 'life-story' as const, output: { videoUrl: clip } };
  expect(storyboardResultDraft(film)).toMatchObject({
    title: 'Blue skies',
    video: clip,
    cover: first,
    images: [],
  });
  expect(storyboardResultDraft({ ...film, output: {} })).toBeNull();
  for (const unusable of [{ stale: true }, { orphaned: true }, { status: 'running' }]) {
    const results = comic.results.map((item, i) => (i === 0 ? { ...item, ...unusable } : item));
    expect(storyboardResultDraft({ ...comic, results })).toBeNull();
    expect(storyboardResultDraft({ ...film, results })).toBeNull();
  }
});

test('preserves author paragraphs, accepts an optional genre and ignores empty or credential content', () => {
  expect(writingDraft('Chapter one', 'First line\n\nSecond line', ['Fantasy'])).toEqual({
    title: 'Chapter one',
    body: 'First line\n\nSecond line',
    tags: ['Fantasy'],
    images: [],
  });
  expect(writingDraft('Draft', ' ')).toBeNull();
  expect(writingDraft('Draft', 'Bearer demonstration-only-value')).toBeNull();
});
