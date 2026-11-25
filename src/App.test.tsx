import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from './App';
import useThemeStore, { applySiteTheme } from './store/themeStore';
import ExecutionResult from './components/ExecutionResult/ExecutionResult';
import { mediaAPI as actualMediaAPI } from './services/api';
import { siteAPI } from './services/siteApi';
import { useLanguage } from './store/languageStore';
import { useSiteStore } from './store/siteStore';

const mediaAPI = jest.mocked(actualMediaAPI);

jest.mock('./services/api', () => ({
  aiWorkflowAPI: { executions: jest.fn(), list: jest.fn() },
  mediaAPI: { queryVideo: jest.fn() },
}));

jest.mock('./pages/WorkflowEditor/WorkflowEditor', () => () => {
  const { useLocation } = jest.requireActual<typeof import('react-router-dom')>('react-router-dom');
  const location = useLocation();
  return (
    <div>
      工作流编辑器
      <span data-testid="initial-prompt">{location.state?.initialPrompt}</span>
    </div>
  );
});

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  jest.clearAllMocks();
});

describe('公开文档与站点访问权限', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      const en = String(url) === '/api-reference/en.json';
      return { ok: true, json: async () => [
        { id: 'overview', title: en ? 'Overview' : '概述', html: '<p>API</p>' },
        { id: 'keys', title: en ? 'Create a key' : '创建密钥', html: '<p>Client ID</p>' },
      ] } as Response;
    });
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    act(() => {
      useSiteStore.setState({ blocked: '', loaded: false });
      useLanguage.getState().choose('zh');
    });
  });

  test('站点停用后仍可直接打开文档章节、切换语言并找到代理商入口', async () => {
    jest.spyOn(siteAPI, 'config').mockRejectedValue({ response: { status: 403, data: { errorCode: 'SITE_DISABLED' } } });
    useSiteStore.setState({ loaded: false, blocked: '' });
    window.history.replaceState({}, '', '/docs?section=keys');
    render(<App />);
    await waitFor(() => expect(useSiteStore.getState().blocked).toBeTruthy());
    expect(await screen.findByRole('heading', { name: '创建密钥' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '主导航' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByRole('heading', { name: 'Create a key' })).toBeInTheDocument();
    expect(window.location.search).toBe('?section=keys');
    expect(screen.getByRole('link', { name: 'Partner console' })).toHaveAttribute('href', '/partner/');
    expect(screen.getByRole('link', { name: /OpenAPI/ })).toHaveAttribute('href', '/api-reference/openapi.yaml');
  });

  test('受限业务页面提供中英文公共入口，恢复后可从主导航访问用量和文档', async () => {
    useSiteStore.setState({ loaded: true, blocked: '本站已暂停' });
    window.history.replaceState({}, '', '/usage');
    render(<App />);
    expect(screen.getByRole('heading', { name: '站点暂不可用' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '用量总览' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: '语言 / Language' }), { target: { value: 'en' } });
    expect(screen.getByRole('link', { name: 'Partner console' })).toHaveAttribute('href', '/partner/');
    fireEvent.click(screen.getByRole('link', { name: 'API docs' }));
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    act(() => { useSiteStore.setState({ blocked: '' }); });
    const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
    fireEvent.click(nav.getByRole('link', { name: 'Usage' }));
    expect(screen.getByRole('heading', { name: 'Usage overview' })).toBeInTheDocument();
    fireEvent.change(nav.getByRole('combobox', { name: '语言 / Language' }), { target: { value: 'zh' } });
    expect(screen.getByRole('heading', { name: '用量总览' })).toBeInTheDocument();
    fireEvent.click(nav.getByRole('link', { name: 'API 文档' }));
    expect(await screen.findByRole('heading', { name: '概述' })).toBeInTheDocument();
  });
});

test('访客切换语言可继续浏览，站点主题尊重手动选择', () => {
  render(<App />);
  const language = screen.getByRole('combobox', { name: '语言 / Language' });
  fireEvent.change(language, { target: { value: 'en' } });
  expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument();
  expect(document.documentElement.lang).toBe('en');
  expect(localStorage.getItem('zhiFlow-language')).toBe('en');
  fireEvent.click(screen.getByRole('link', { name: 'Workflows' }));
  expect(screen.getByRole('heading', { name: 'My workflows' })).toBeInTheDocument();
  fireEvent.change(language, { target: { value: 'zh' } });
  applySiteTheme('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
  useThemeStore.getState().setMode('light');
  applySiteTheme('dark');
  expect(document.documentElement.dataset.theme).toBe('light');
  useThemeStore.getState().setMode('site');
  expect(document.documentElement.dataset.theme).toBe('dark');
  applySiteTheme('auto');
  localStorage.removeItem('zhiFlow-theme');
});

test('工作台展示文本图片视频起点，点击起点进入编辑器', () => {
  render(<App />);
  expect(
    screen.getByRole('navigation', { name: '主导航' })
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '工作台' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /制作一段短片/ }));
  expect(screen.getByText('工作流编辑器')).toBeInTheDocument();
  expect(window.location.search).toBe('?starter=video');
});

test('首页自然语言需求进入编辑器并保留首次生成内容', () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('你希望完成什么任务？'), {
    target: { value: '生成文案，然后为文案生成配图' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: '对话生成' })
  );
  expect(window.location.pathname).toBe('/workflows/new/edit');
  expect(screen.getByTestId('initial-prompt')).toHaveTextContent(
    '生成文案，然后为文案生成配图'
  );
});

test('失败视频日志保留原因和任务ID，并可查询生成后的成片', async () => {
  mediaAPI.queryVideo.mockResolvedValue({
    status: 'completed',
    video_url: 'https://example.com/output.mp4',
  });
  render(
    <ExecutionResult
      record={{
        id: 'execution-1',
        status: 'failed',
        simulated: false,
        error: '等待视频超时',
        nodeResults: [
          {
            nodeId: 'video-1',
            nodeType: 'videoGeneration',
            nodeName: '产品短片',
            status: 'failed',
            error: '等待视频超时',
            output: { videoId: 'task-123', status: 'queued' },
          },
        ],
      }}
    />
  );
  expect(screen.getAllByText('等待视频超时').length).toBeGreaterThan(0);
  expect(screen.getByText('task-123')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '查询任务' }));
  await waitFor(() =>
    expect(screen.getByRole('link', { name: /打开视频/ })).toHaveAttribute(
      'href',
      'https://example.com/output.mp4'
    )
  );
  expect(mediaAPI.queryVideo).toHaveBeenCalledWith('task-123');
});

test('图片结果只展示合法资源链接，模拟记录不查询真实任务', () => {
  render(
    <ExecutionResult
      record={{
        status: 'success',
        simulated: true,
        nodeResults: [
          {
            nodeId: 'image',
            nodeType: 'imageGeneration',
            status: 'success',
            output: {
              urls: [
                'data:text/html,invalid-image',
                'https://example.com/image.png',
              ],
              videoId: 'simulated-task',
            },
          },
        ],
      }}
    />
  );
  expect(screen.getAllByRole('img')).toHaveLength(1);
  expect(screen.getByRole('img')).toHaveAttribute(
    'src',
    'https://example.com/image.png'
  );
  expect(
    screen.queryByRole('button', { name: '查询任务' })
  ).not.toBeInTheDocument();
});

test('视频查询不能将嵌套业务错误或缺少成片地址当作成功', async () => {
  mediaAPI.queryVideo
    .mockResolvedValueOnce({ code: 0, msg: '任务不可用', data: {} })
    .mockResolvedValueOnce({ status: 'completed', progress: 100 });
  render(
    <ExecutionResult
      record={{
        status: 'success',
        simulated: false,
        nodeResults: [
          {
            nodeId: 'video',
            nodeType: 'videoGeneration',
            status: 'success',
            output: { videoId: 'task-123', status: 'queued' },
          },
        ],
      }}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: '查询任务' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('任务不可用');
  fireEvent.click(screen.getByRole('button', { name: '查询任务' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '尚未取得有效的视频地址'
  );
  expect(
    screen.queryByRole('link', { name: /打开视频/ })
  ).not.toBeInTheDocument();
});
