import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkflowResources from './WorkflowResources';
import { workflowResourcesAPI } from '../../services/workflowResourcesApi';

jest.mock('../../services/workflowResourcesApi', () => ({ workflowResourcesAPI: { tools: jest.fn(), tables: jest.fn(), saveTool: jest.fn(), deleteTool: jest.fn(), createTable: jest.fn(), query: jest.fn(), insert: jest.fn() } }));
const api = jest.mocked(workflowResourcesAPI);
beforeEach(() => { jest.resetAllMocks(); api.tools.mockResolvedValue([]); api.tables.mockResolvedValue(['products']); });

test('插件创建验证JSON并保留服务端保存身份以供编辑', async () => {
  api.saveTool.mockResolvedValue({ id: 'tool-1' });
  const changed = jest.fn();
  render(<WorkflowResources open onClose={jest.fn()} onChanged={changed} />);
  await screen.findByRole('heading', { name: '创建插件' });
  fireEvent.change(screen.getByLabelText('插件名称'), { target: { value: '资料查询' } });
  fireEvent.change(screen.getByLabelText('插件接口地址'), { target: { value: 'https://example.com/api' } });
  fireEvent.change(screen.getByLabelText('插件请求头JSON'), { target: { value: '{bad' } });
  fireEvent.click(screen.getByRole('button', { name: '保存插件' }));
  expect(screen.getByRole('alert')).toHaveTextContent('请求头需要有效的 JSON');
  expect(api.saveTool).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('插件请求头JSON'), { target: { value: '{}' } });
  fireEvent.click(screen.getByRole('button', { name: '保存插件' }));
  await screen.findByText('插件已保存');
  expect(changed).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('heading', { name: '编辑插件' })).toBeInTheDocument();
  expect(api.saveTool).toHaveBeenCalledWith(expect.objectContaining({ name: '资料查询', headers: {}, method: 'GET' }));
});

test('数据表可录入真实JSON记录并按条件查询', async () => {
  api.insert.mockResolvedValue({ inserted: 1 }); api.query.mockResolvedValue({ items: [{ name: '新品' }] });
  render(<WorkflowResources open onClose={jest.fn()} onChanged={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '数据表' }));
  await screen.findByRole('option', { name: 'products' });
  fireEvent.change(screen.getByLabelText('录入记录JSON'), { target: { value: '[{"name":"新品"}]' } });
  fireEvent.click(screen.getByRole('button', { name: '录入记录' }));
  await waitFor(() => expect(api.insert).toHaveBeenCalledWith('products', [{ name: '新品' }]));
  await screen.findByText('记录已录入');
  fireEvent.change(screen.getByLabelText('查询条件JSON'), { target: { value: '{"name":"新品"}' } });
  fireEvent.click(screen.getByRole('button', { name: '查询记录' }));
  await screen.findByText('查询已完成');
  expect(api.query).toHaveBeenCalledWith('products', { where: { name: '新品' }, limit: 20 });
  expect(screen.getByRole('region', { name: '数据操作结果' })).toHaveTextContent('新品');
});
