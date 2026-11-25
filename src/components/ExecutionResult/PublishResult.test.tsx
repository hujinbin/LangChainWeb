import { fireEvent, render, screen } from '@testing-library/react';
import type { Execution } from '../../types/workflow';
import { sendDraft } from '../../publishing/bridge';
import { mediaAPI } from '../../services/api';
import ExecutionResult from './ExecutionResult';

jest.mock('../../publishing/bridge', () => ({ sendDraft: jest.fn() }));
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test('sends the final output of a live run and hides publishing for a simulation', async () => {
  const publish = jest.mocked(sendDraft).mockResolvedValue(0);
  const record: Execution = {
    simulated: false,
    status: 'success',
    workflowName: '海边散文',
    output: { result: '潮水退去。' },
  };
  const { rerender } = render(<ExecutionResult record={{ ...record, simulated: true }} />);
  expect(screen.queryByRole('button', { name: '发送到发布助手' })).not.toBeInTheDocument();
  rerender(<ExecutionResult record={record} />);
  fireEvent.click(screen.getByRole('button', { name: '发送到发布助手' }));
  expect(publish).toHaveBeenCalledWith(
    expect.objectContaining({ title: '海边散文', body: '潮水退去。', images: [] }),
    expect.anything(),
  );
  await screen.findByText(/草稿已传入/);
});

test('an asynchronous clip becomes available only after its job returns completed media', async () => {
  const video = 'https://example.test/finished.mp4';
  const publish = jest.mocked(sendDraft).mockResolvedValue(0);
  const query = jest
    .spyOn(mediaAPI, 'queryVideo')
    .mockResolvedValue({ status: 'succeeded', video_url: video });
  render(
    <ExecutionResult
      record={{
        simulated: false,
        status: 'success',
        workflowName: '雨中江南',
        nodeResults: [
          {
            nodeType: 'videoGeneration',
            status: 'success',
            output: { videoId: 'clip-job', status: 'queued' },
          },
        ],
      }}
    />,
  );
  expect(screen.queryByRole('button', { name: '发送到发布助手' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '查询任务' }));
  fireEvent.click(await screen.findByRole('button', { name: '发送到发布助手' }));
  expect(query).toHaveBeenCalledWith('clip-job');
  expect(publish).toHaveBeenCalledWith(
    { title: '雨中江南', body: '', video, tags: [], images: [] },
    expect.anything(),
  );
  await screen.findByText(/草稿已传入/);
});
