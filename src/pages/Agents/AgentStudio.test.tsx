import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { agentAPI } from '../../services/agentApi';
import useAuthStore from '../../store/authStore';
import type { AgentCatalog, AgentDraft, AgentProject } from '../../types/agent';
import AgentStudio from './AgentStudio';
import { AgentMedia } from './AgentShared';

jest.mock('../../services/agentApi', () => ({
  agentAPI: {
    get: jest.fn(),
    catalog: jest.fn(),
    update: jest.fn(),
    design: jest.fn(),
    run: jest.fn(),
    cancel: jest.fn(),
    status: jest.fn(),
    export: jest.fn(),
    asset: jest.fn(),
  },
  downloadBlob: jest.fn(),
}));

const api = jest.mocked(agentAPI, true);
const originalCreateURL = Object.getOwnPropertyDescriptor(
  URL,
  'createObjectURL',
);
const originalRevokeURL = Object.getOwnPropertyDescriptor(
  URL,
  'revokeObjectURL',
);
const catalog: AgentCatalog = {
  agents: [],
  models: {
    text: ['agnes-3.0-flash'],
    image: ['agnes-image-2.0-flash'],
    video: ['agnes-video-2.5-flash'],
  },
};
const draft: AgentDraft = {
  title: '代码之外的人生',
  summary: '一位程序员重新找到生活重心。',
  character: '戴眼镜的程序员',
  style: '温暖的电影画面',
  scenes: [
    {
      id: 'scene-1',
      title: '第一行代码',
      stage: '青年',
      caption: '',
      narration: '第一行代码，打开新的世界。',
      imagePrompt: '明亮书桌旁的年轻程序员',
      videoPrompt: '镜头缓缓推进',
      durationSeconds: 12,
    },
  ],
};

function makeProject(updates: Partial<AgentProject> = {}): AgentProject {
  return {
    id: 'project-1',
    revision: 4,
    agentId: 'life-story',
    name: '我的人生副本',
    brief: '程序员的一生',
    settings: {
      sceneCount: 1,
      durationSeconds: 12,
      aspectRatio: '16:9',
      imageSize: '1K',
      generateSceneImages: false,
      textModel: catalog.models.text[0],
      imageModel: catalog.models.image[0],
      videoModel: catalog.models.video[0],
    },
    draft: null,
    messages: [],
    results: [],
    job: null,
    output: {},
    createdAt: '2026-11-18T00:00:00Z',
    updatedAt: '2026-11-18T00:00:00Z',
    ...updates,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function renderStudio() {
  return render(
    <MemoryRouter
      initialEntries={['/agents/project-1']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/agents/:id" element={<AgentStudio />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  useAuthStore.setState({
    isLoggedIn: true,
    token: 'test-token',
    user: { nickname: '测试用户' },
  });
  api.get.mockResolvedValue(makeProject());
  api.catalog.mockResolvedValue(catalog);
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  if (originalCreateURL)
    Object.defineProperty(URL, 'createObjectURL', originalCreateURL);
  else Reflect.deleteProperty(URL, 'createObjectURL');
  if (originalRevokeURL)
    Object.defineProperty(URL, 'revokeObjectURL', originalRevokeURL);
  else Reflect.deleteProperty(URL, 'revokeObjectURL');
});

test('设计前保存当前 revision，生成后继续保存逐镜编辑时使用最新 revision', async () => {
  const saving = deferred<AgentProject>();
  const designed = makeProject({
    revision: 6,
    brief: '一个温暖的程序员故事',
    draft,
  });
  const editedDraft = {
    ...draft,
    scenes: [
      { ...draft.scenes[0], narration: '代码之外，也有值得珍惜的生活。' },
    ],
  };
  api.update
    .mockReturnValueOnce(saving.promise)
    .mockResolvedValueOnce({ ...designed, revision: 7, draft: editedDraft });
  api.design.mockResolvedValue(designed);
  renderStudio();
  await screen.findByRole('textbox', { name: '作品名称' });
  fireEvent.change(screen.getByLabelText('创作主题'), {
    target: { value: '一个温暖的程序员故事' },
  });
  fireEvent.change(screen.getByLabelText('对话调整'), {
    target: { value: '结尾温暖一点' },
  });
  fireEvent.click(screen.getByRole('button', { name: '开始设计分镜' }));
  await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
  expect(api.update.mock.calls[0]).toMatchObject([
    'project-1',
    { revision: 4, brief: '一个温暖的程序员故事', draft: null },
  ]);
  expect(api.design).not.toHaveBeenCalled();
  await act(async () => {
    saving.resolve(makeProject({ revision: 5, brief: '一个温暖的程序员故事' }));
  });
  expect(await screen.findByLabelText('分镜作品标题')).toHaveValue(draft.title);
  expect(api.design).toHaveBeenCalledWith(
    'project-1',
    '结尾温暖一点',
    expect.any(AbortSignal),
  );
  fireEvent.change(screen.getByLabelText('scene-1 旁白'), {
    target: { value: editedDraft.scenes[0].narration },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(api.update).toHaveBeenCalledTimes(2));
  expect(api.update.mock.calls[1]).toMatchObject([
    'project-1',
    { revision: 6, draft: editedDraft },
  ]);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled(),
  );
});

test('异步生成期间锁定编辑，停止后继续轮询到已停止并保留任务信息', async () => {
  const initial = makeProject({ draft });
  const queued = {
    ...initial,
    revision: 5,
    job: { id: 'job-1', status: 'queued', stage: 'video', progress: 0 },
  };
  const results = [
    { sceneId: 'scene-1', status: 'running', videoId: 'video-task-1' },
  ];
  const cancelling = {
    ...queued,
    results,
    job: { ...queued.job, status: 'cancelling', progress: 35 },
  };
  const cancelled = {
    ...cancelling,
    revision: 6,
    job: { ...cancelling.job, status: 'cancelled' },
  };
  api.get.mockResolvedValueOnce(initial).mockResolvedValueOnce(cancelled);
  api.run.mockResolvedValue(queued);
  api.cancel.mockResolvedValue(cancelling);
  api.status
    .mockResolvedValueOnce({
      projectId: initial.id,
      job: { ...queued.job, status: 'running', progress: 35 },
      results,
      output: {},
    })
    .mockResolvedValueOnce({
      projectId: initial.id,
      job: cancelled.job,
      results,
      output: {},
    });
  renderStudio();
  await screen.findByLabelText('scene-1 旁白');
  jest.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: '生成分镜视频' }));
  await screen.findByRole('button', { name: '停止生成' });
  expect(api.run).toHaveBeenCalledWith('project-1', {});
  expect(screen.getByLabelText('作品名称')).toBeDisabled();
  expect(screen.getByRole('button', { name: '停止生成' })).toBeEnabled();
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(screen.getByRole('progressbar', { name: '生成进度' })).toHaveAttribute(
    'value',
    '35',
  );
  fireEvent.click(screen.getByRole('button', { name: '停止生成' }));
  await screen.findByText('停止请求已提交，已完成素材会保留');
  expect(api.cancel).toHaveBeenCalledWith('project-1');
  expect(screen.getByRole('button', { name: '停止生成' })).toBeDisabled();
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(screen.getByText('已停止')).toBeInTheDocument();
  expect(screen.getByLabelText('scene-1 旁白')).toBeEnabled();
  expect(screen.getByText('分镜任务已保存，可继续查询')).toBeInTheDocument();
  expect(api.run).toHaveBeenCalledTimes(1);
});

test('生成失败展示原因并保留分镜和任务，继续生成沿用已有素材', async () => {
  const failed = makeProject({
    draft,
    results: [
      {
        sceneId: 'scene-1',
        status: 'failed',
        videoId: 'video-task-1',
        error: '这段视频还需要继续等待',
      },
    ],
    job: {
      id: 'job-1',
      status: 'failed',
      stage: 'assembling',
      progress: 80,
      error: '成片合成失败，请稍后重试',
    },
  });
  api.get.mockResolvedValue(failed);
  api.run.mockRejectedValue(new Error('暂时无法继续生成，请稍后重试'));
  renderStudio();
  expect(await screen.findByText('成片合成失败，请稍后重试')).toHaveAttribute(
    'role',
    'alert',
  );
  expect(screen.getByText('这段视频还需要继续等待')).toHaveAttribute(
    'role',
    'alert',
  );
  fireEvent.click(screen.getByRole('button', { name: '继续生成 / 合成' }));
  expect(
    await screen.findByText('暂时无法继续生成，请稍后重试'),
  ).toBeInTheDocument();
  expect(api.run).toHaveBeenCalledWith('project-1', {});
  expect(screen.getByLabelText('scene-1 旁白')).toHaveValue(
    draft.scenes[0].narration,
  );
  expect(screen.getByText('分镜任务已保存，可继续查询')).toBeInTheDocument();
});

test('停止请求失败时保留运行状态和编辑锁，可以再次停止', async () => {
  const running = makeProject({
    draft,
    job: { id: 'job-1', status: 'running', stage: 'video', progress: 30 },
  });
  api.get.mockResolvedValue(running);
  api.cancel
    .mockRejectedValueOnce(new Error('停止生成失败，请重试'))
    .mockResolvedValueOnce({
      ...running,
      job: { ...running.job!, status: 'cancelled' },
    });
  renderStudio();
  await screen.findByRole('button', { name: '停止生成' });
  fireEvent.click(screen.getByRole('button', { name: '停止生成' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '停止生成失败，请重试',
  );
  expect(screen.getByLabelText('scene-1 旁白')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '停止生成' }));
  await waitFor(() =>
    expect(screen.getByLabelText('scene-1 旁白')).toBeEnabled(),
  );
  expect(api.cancel).toHaveBeenCalledTimes(2);
});

test('停止构思后丢弃迟到的设计结果，保留当前主题和调整要求', async () => {
  const designing = deferred<AgentProject>();
  api.design.mockReturnValue(designing.promise);
  renderStudio();
  await screen.findByLabelText('对话调整');
  expect(
    screen.getByRole('button', { name: '创作设置与对话' }),
  ).toHaveAttribute('aria-expanded', 'true');
  fireEvent.change(screen.getByLabelText('对话调整'), {
    target: { value: '结尾温暖一点' },
  });
  fireEvent.click(screen.getByRole('button', { name: '开始设计分镜' }));
  await waitFor(() => expect(api.design).toHaveBeenCalledTimes(1));
  const signal = api.design.mock.calls[0][2];
  fireEvent.click(screen.getByRole('button', { name: '停止本次构思' }));
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    designing.resolve(makeProject({ revision: 5, draft }));
  });
  expect(
    screen.getByText('已停止本次构思，当前分镜已保留'),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('分镜作品标题')).not.toBeInTheDocument();
  expect(screen.getByLabelText('对话调整')).toHaveValue('结尾温暖一点');
});

test('已有分镜默认收起手机设置，设计完成状态和视图切换保持可理解', async () => {
  api.get.mockResolvedValue(
    makeProject({
      draft,
      job: {
        id: 'design-1',
        kind: 'design',
        status: 'completed',
        stage: 'designing',
        progress: 100,
      },
    }),
  );
  renderStudio();
  await screen.findByLabelText('分镜作品标题');
  expect(screen.getByText('分镜设计已完成')).toBeInTheDocument();
  expect(screen.getByText('1 个分镜')).toBeInTheDocument();
  expect(screen.queryByText('0 / 1 镜完成')).not.toBeInTheDocument();
  const settingsToggle = screen.getByRole('button', { name: '创作设置与对话' });
  expect(settingsToggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(settingsToggle);
  expect(settingsToggle).toHaveAttribute('aria-expanded', 'true');
  expect(
    screen.getByRole('complementary', { name: '创作设置与对话' }),
  ).toHaveClass('is-open');
  const storyboard = screen.getByRole('tab', { name: '分镜编辑' });
  fireEvent.keyDown(storyboard, { key: 'End' });
  const preview = screen.getByRole('tab', { name: '作品预览' });
  expect(preview).toHaveFocus();
  expect(preview).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel')).toHaveAccessibleName('作品预览');
});

test('损坏的图片和视频显示读取失败，切换素材后可以恢复', async () => {
  const { rerender } = render(
    <AgentMedia url="https://example.com/first.png" alt="当前画面" />,
  );
  fireEvent.error(await screen.findByRole('img', { name: '当前画面' }));
  expect(screen.getByText('素材暂时无法读取')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  rerender(<AgentMedia url="https://example.com/next.png" alt="当前画面" />);
  expect(await screen.findByRole('img', { name: '当前画面' })).toHaveAttribute(
    'src',
    'https://example.com/next.png',
  );
  rerender(
    <AgentMedia url="https://example.com/next.mp4" video alt="当前视频" />,
  );
  fireEvent.error(await screen.findByLabelText('当前视频'));
  expect(screen.getByText('素材暂时无法读取')).toBeInTheDocument();
  expect(api.asset).not.toHaveBeenCalled();
});

test('本站素材通过鉴权读取，切换地址时释放 blob 并取消旧请求', async () => {
  const pendingAsset = deferred<Blob>();
  const createURL = jest.fn(() => 'blob:scene-image');
  const revokeURL = jest.fn();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createURL,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeURL,
  });
  api.asset.mockReturnValueOnce(pendingAsset.promise);
  const path =
    '/api/aiAgents/projects/project-1/assets/00000000000000000000000000000000.png';
  const { rerender, unmount } = render(
    <AgentMedia url={path} alt="当前画面" />,
  );
  expect(api.asset).toHaveBeenCalledWith(path, expect.any(AbortSignal));
  const signal = api.asset.mock.calls[0][1];
  await act(async () => {
    pendingAsset.resolve(new Blob(['image'], { type: 'image/png' }));
  });
  expect(screen.getByRole('img', { name: '当前画面' })).toHaveAttribute(
    'src',
    'blob:scene-image',
  );
  rerender(<AgentMedia url="https://example.com/remote.png" alt="当前画面" />);
  expect(signal?.aborted).toBe(true);
  expect(revokeURL).toHaveBeenCalledWith('blob:scene-image');
  expect(screen.getByRole('img', { name: '当前画面' })).toHaveAttribute(
    'src',
    'https://example.com/remote.png',
  );
  unmount();
  expect(revokeURL).toHaveBeenCalledTimes(1);
});
