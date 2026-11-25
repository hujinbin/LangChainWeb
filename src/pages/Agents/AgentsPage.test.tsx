import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { agentAPI } from '../../services/agentApi';
import useAuthStore from '../../store/authStore';
import { useLanguage } from '../../store/languageStore';
import type { AgentCatalog, AgentProject } from '../../types/agent';
import AgentsPage from './AgentsPage';

jest.mock('../../services/agentApi', () => ({
  agentAPI: {
    catalog: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.mock('../CustomAgents/CustomAgentList', () => () => <section>我的智能体</section>);

const api = jest.mocked(agentAPI, true);
const catalog: AgentCatalog = {
  agents: [],
  models: { text: [], image: [], video: [] },
};
const project: AgentProject = {
  id: 'project-1',
  revision: 1,
  agentId: 'cloud-comic',
  name: '周一的小云朵',
  brief: '小云朵的上班故事',
  settings: {
    sceneCount: 4,
    durationSeconds: 12,
    aspectRatio: '3:4',
    imageSize: '1K',
    generateSceneImages: true,
    textModel: 'agnes-3.0-flash',
    imageModel: 'agnes-image-2.0-flash',
    videoModel: 'agnes-video-2.5-flash',
  },
  draft: null,
  messages: [],
  results: [],
  job: null,
  output: {},
  createdAt: '2026-11-18T00:00:00Z',
  updatedAt: '2026-11-18T00:00:00Z',
};

function LocationProbe() {
  return <span data-testid="current-path">{useLocation().pathname}</span>;
}

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={['/agents']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <LocationProbe />
      <Routes>
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/agents/:id" element={<p>创作工作室</p>} />
        <Route path="/novel/:id" element={<p>小说工作室</p>} />
        <Route path="/login" element={<p>登录页面</p>} />
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
  api.catalog.mockResolvedValue(catalog);
  api.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
});

afterEach(cleanup);

test('output filters apply to presets and server-paginated projects in both languages', async () => {
  renderPage();
  await screen.findByRole('heading', { name: '云朵漫画' });
  fireEvent.click(screen.getByRole('button', { name: '文生图' }));
  expect(screen.getByRole('heading', { name: '云朵漫画' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '人生副本' })).not.toBeInTheDocument();
  expect(api.list).toHaveBeenLastCalledWith(1, expect.anything(), 'cloud-comic');
  act(() => useLanguage.getState().choose('en'));
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Video generation' }));
    expect(screen.getByRole('heading', { name: 'Life Story' })).toBeInTheDocument();
    expect(api.list).toHaveBeenLastCalledWith(1, expect.anything(), 'life-story');
    fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(screen.getByRole('button', { name: 'Text' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'View my novels' })).toHaveAttribute('href', '/novel');
    await screen.findByText(/Connected to/);
  } finally { act(() => useLanguage.getState().choose('zh')); }
});

test('访客可选择智能体并进入登录，不发送创建请求', () => {
  useAuthStore.setState({ isLoggedIn: false, token: '', user: null });
  renderPage();
  expect(screen.getByRole('heading', { name: '云朵漫画' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '人生副本' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '开始画一个故事' }));
  expect(screen.getByTestId('current-path')).toHaveTextContent('/login');
  expect(api.create).not.toHaveBeenCalled();
  expect(api.list).not.toHaveBeenCalled();
});

test('创建时防止重复提交，成功后进入新作品工作室', async () => {
  let finish!: (value: AgentProject) => void;
  api.create.mockReturnValue(
    new Promise<AgentProject>((resolve) => {
      finish = resolve;
    }),
  );
  renderPage();
  await screen.findByText('这里等着你的第一个故事');
  fireEvent.click(screen.getByRole('button', { name: '开始画一个故事' }));
  expect(screen.getByRole('button', { name: '正在创建…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '开启一段人生' })).toBeDisabled();
  await act(async () => {
    finish(project);
  });
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.create).toHaveBeenCalledWith('cloud-comic');
  expect(screen.getByText('创作工作室')).toBeInTheDocument();
  expect(screen.getByTestId('current-path')).toHaveTextContent(
    '/agents/project-1',
  );
});

test('列表失败提示经过清理，重试后显示真实作品', async () => {
  api.list
    .mockRejectedValueOnce(
      new Error(
        'Network Error https://private.example.com/upstream Authorization=secret',
      ),
    )
    .mockResolvedValueOnce({
      items: [project],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '操作暂时未完成，请稍后重试',
  );
  expect(screen.queryByText(/private.example.com/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(
    await screen.findByRole('link', { name: /周一的小云朵/ }),
  ).toHaveAttribute('href', '/agents/project-1');
  expect(screen.getByText('1 个创作项目，随时回来继续。')).toBeInTheDocument();
  expect(api.list).toHaveBeenCalledTimes(2);
});

test('运行中的作品禁止删除，删除失败保留作品并允许重试', async () => {
  const running: AgentProject = {
    ...project,
    id: 'running-1',
    name: '正在生成的人生',
    agentId: 'life-story',
    job: { id: 'job-1', status: 'running', stage: 'video', progress: 20 },
  };
  api.list.mockResolvedValue({
    items: [project, running],
    total: 2,
    page: 1,
    pageSize: 20,
  });
  api.delete
    .mockRejectedValueOnce(new Error('删除失败，请稍后重试'))
    .mockResolvedValueOnce(undefined);
  renderPage();
  await screen.findByRole('link', { name: /周一的小云朵/ });
  expect(
    screen.getByRole('button', { name: '删除正在生成的人生' }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '删除周一的小云朵' }));
  expect(screen.getByRole('dialog')).toHaveAccessibleName('删除这个创作项目？');
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '删除失败，请稍后重试',
  );
  expect(
    screen.getByRole('link', { name: /周一的小云朵/ }),
  ).toBeInTheDocument();
  api.list.mockResolvedValue({
    items: [running],
    total: 1,
    page: 1,
    pageSize: 20,
  });
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(api.delete).toHaveBeenNthCalledWith(2, 'project-1');
  expect(
    screen.queryByRole('link', { name: /周一的小云朵/ }),
  ).not.toBeInTheDocument();
});

test('删除弹窗支持 Escape、取消和焦点恢复', async () => {
  api.list.mockResolvedValue({
    items: [project],
    total: 1,
    page: 1,
    pageSize: 20,
  });
  renderPage();
  const trigger = await screen.findByRole('button', {
    name: '删除周一的小云朵',
  });
  trigger.focus();
  fireEvent.click(trigger);
  const close = screen.getByRole('button', { name: '关闭弹窗' });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: '确认删除' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('button', { name: '确认删除' }), {
    key: 'Tab',
  });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: '保留作品' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(api.delete).not.toHaveBeenCalled();
});
