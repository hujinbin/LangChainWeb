import { render, screen } from '@testing-library/react';
import apiClient from '../../services/api';
import WorkflowAsset from './WorkflowAsset';

jest.mock('../../services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
const get = apiClient.get as jest.Mock;
const asset = '/api/aiWorkflow/assets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png';
beforeEach(() => {
  get.mockReset();
  URL.createObjectURL = jest.fn(() => 'blob:private-workflow-asset');
  URL.revokeObjectURL = jest.fn();
});
test('私有图片以受鉴权Blob读取并在卸载时回收地址', async () => {
  get.mockResolvedValue({ data: new Blob(['image'], { type: 'image/png' }) });
  const { unmount } = render(<WorkflowAsset url={asset} kind="image" alt="处理后的图片" />);
  expect(await screen.findByRole('img', { name: '处理后的图片' })).toHaveAttribute('src', 'blob:private-workflow-asset');
  expect(get).toHaveBeenCalledWith(asset, expect.objectContaining({ responseType: 'blob', signal: expect.any(AbortSignal) }));
  expect(screen.getByRole('link')).toHaveAttribute('href', 'blob:private-workflow-asset');
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-workflow-asset');
});
test('素材请求失败显示真实失败状态', async () => {
  get.mockRejectedValue(new Error('拒绝访问'));
  render(<WorkflowAsset url={asset} kind="image" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('素材读取失败');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
