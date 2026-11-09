import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import ExecutionResult from './components/ExecutionResult/ExecutionResult';
import { mediaAPI } from './services/api';

jest.mock('./services/api', () => ({
  aiWorkflowAPI: { executions: jest.fn(), list: jest.fn() },
  mediaAPI: { queryVideo: jest.fn() },
}));

jest.mock('./pages/WorkflowEditor/WorkflowEditor', () => () => (
  <div>工作流编辑器</div>
));

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  jest.clearAllMocks();
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
