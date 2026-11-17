import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import KnowledgeBase from './KnowledgeBase';
import KnowledgeBaseDetail from './KnowledgeBaseDetail';
import KnowledgeBaseImport from './KnowledgeBaseImport';
import { knowledgeAPI } from '../../services/knowledgeApi';

jest.mock('../../services/knowledgeApi', () => ({
  knowledgeAPI: {
    config: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    detail: jest.fn(),
    documents: jest.fn(),
    document: jest.fn(),
    preview: jest.fn(),
    importDocument: jest.fn(),
    retrieve: jest.fn(),
    updateDocument: jest.fn(),
    deleteDocument: jest.fn(),
    rebuildDocument: jest.fn(),
    rebuild: jest.fn(),
  },
}));
jest.mock(
  '../../store/authStore',
  () => (selector) => selector({ isLoggedIn: true }),
);
const config = {
  configured: true,
  modes: ['bm25'],
  acceptedFileTypes: ['txt', 'md', 'pdf', 'docx'],
  maxFileBytes: 10485760,
};
const base = {
  id: 'base-1',
  name: '产品知识',
  indexMode: 'bm25',
  enabled: true,
  documentCount: 1,
  chunkCount: 2,
  chunkSize: 800,
  chunkOverlap: 100,
  updatedAt: '2026-11-17T01:00:00Z',
};
const document = {
  id: 'doc-1',
  name: '使用说明',
  sourceName: 'guide.md',
  status: 'ready',
  enabled: true,
  chunkCount: 2,
};
const renderDetail = () =>
  render(
    <MemoryRouter
      initialEntries={['/knowledge/base-1']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/knowledge/:id" element={<KnowledgeBaseDetail />} />
      </Routes>
    </MemoryRouter>,
  );
beforeEach(() => {
  Object.values(knowledgeAPI).forEach((mock) => mock.mockReset());
  knowledgeAPI.config.mockResolvedValue({ data: config });
  knowledgeAPI.list.mockResolvedValue({ data: { items: [base], total: 1 } });
  knowledgeAPI.detail.mockResolvedValue({ data: base });
  knowledgeAPI.documents.mockResolvedValue({
    data: { items: [document], total: 1 },
  });
});

test('删除知识库失败保留记录，展示真实失败原因', async () => {
  knowledgeAPI.delete.mockRejectedValue(new Error('当前知识库删除失败'));
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <KnowledgeBase />
    </MemoryRouter>,
  );
  await screen.findByRole('link', { name: '产品知识' });
  fireEvent.click(screen.getByRole('button', { name: '删除 产品知识' }));
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '当前知识库删除失败',
  );
  expect(screen.getByRole('link', { name: '产品知识' })).toBeInTheDocument();
});

test('文本导入先预览服务端分段，修改输入后必须重新预览', async () => {
  knowledgeAPI.preview.mockResolvedValue({
    data: {
      chunks: [{ index: 0, content: '真实预览内容', characters: 6 }],
      totalChunks: 1,
      totalCharacters: 6,
    },
  });
  knowledgeAPI.importDocument.mockResolvedValue({
    data: { ...document, status: 'ready' },
  });
  const onImported = jest.fn();
  render(
    <KnowledgeBaseImport
      base={base}
      config={config}
      onClose={jest.fn()}
      onChanged={jest.fn()}
      onImported={onImported}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '粘贴文本' }));
  fireEvent.change(screen.getByLabelText(/文档名称/), {
    target: { value: '说明' },
  });
  fireEvent.change(screen.getByLabelText('文档内容'), {
    target: { value: '第一段实际文本' },
  });
  fireEvent.click(screen.getByRole('button', { name: '预览分段' }));
  expect(await screen.findByText('真实预览内容')).toBeInTheDocument();
  expect(knowledgeAPI.importDocument).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('文档内容'), {
    target: { value: '修改后的文本' },
  });
  expect(
    screen.queryByRole('button', { name: '确认导入并索引' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '预览分段' }));
  fireEvent.click(
    await screen.findByRole('button', { name: '确认导入并索引' }),
  );
  await waitFor(() =>
    expect(onImported).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready' }),
    ),
  );
  expect(knowledgeAPI.importDocument).toHaveBeenCalledWith(
    'base-1',
    expect.objectContaining({ text: '修改后的文本' }),
  );
});

test('索引失败不显示导入成功，保留重试与错误反馈', async () => {
  knowledgeAPI.preview.mockResolvedValue({
    data: {
      chunks: [{ index: 0, content: '文档', characters: 2 }],
      totalChunks: 1,
    },
  });
  knowledgeAPI.importDocument.mockRejectedValue(
    Object.assign(new Error('文档已保存，索引建立失败'), {
      response: {
        data: { data: { document: { id: 'doc-1', status: 'failed' } } },
      },
    }),
  );
  const onImported = jest.fn();
  const onChanged = jest.fn();
  render(
    <KnowledgeBaseImport
      base={base}
      config={config}
      onClose={jest.fn()}
      onChanged={onChanged}
      onImported={onImported}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '粘贴文本' }));
  fireEvent.change(screen.getByLabelText(/文档名称/), {
    target: { value: '说明' },
  });
  fireEvent.change(screen.getByLabelText('文档内容'), {
    target: { value: '文档' },
  });
  fireEvent.click(screen.getByRole('button', { name: '预览分段' }));
  fireEvent.click(
    await screen.findByRole('button', { name: '确认导入并索引' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('索引建立失败');
  expect(onImported).not.toHaveBeenCalled();
  expect(onChanged).toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: '返回文档列表' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: '确认导入并索引' }),
  ).not.toBeInTheDocument();
});

test('BM25测试显示原始得分并可查看命中分段引用', async () => {
  knowledgeAPI.retrieve.mockResolvedValue({
    data: {
      query: '文件格式',
      documents: [
        {
          id: 'hit-1',
          documentId: 'doc-1',
          title: '使用说明',
          sourceName: 'guide.md',
          chunkIndex: 0,
          score: 3.75,
          content: '支持文本文档。',
        },
      ],
    },
  });
  knowledgeAPI.document.mockResolvedValue({
    data: {
      ...document,
      totalChunks: 2,
      chunks: [
        { id: 'chunk-1', index: 0, content: '支持文本文档。', characters: 8 },
      ],
    },
  });
  renderDetail();
  await screen.findByRole('button', { name: '使用说明' });
  fireEvent.click(screen.getByRole('tab', { name: '检索测试' }));
  fireEvent.change(screen.getByLabelText('检索问题'), {
    target: { value: '文件格式' },
  });
  fireEvent.change(screen.getByLabelText('最低检索得分'), {
    target: { value: '2.5' },
  });
  fireEvent.click(screen.getByRole('button', { name: '开始检索' }));
  expect(await screen.findByText('得分 3.7500')).toBeInTheDocument();
  expect(knowledgeAPI.retrieve).toHaveBeenCalledWith(
    'base-1',
    { query: '文件格式', topK: 5, scoreThreshold: 2.5 },
    expect.any(Object),
  );
  fireEvent.click(screen.getByRole('button', { name: '查看引用' }));
  expect(
    await screen.findByRole('dialog', { name: '使用说明' }),
  ).toHaveTextContent('支持文本文档。');
});

test('全库重新索引部分失败时提示失败数量，不宣称全部成功', async () => {
  knowledgeAPI.rebuild.mockResolvedValue({
    data: { total: 2, succeeded: 1, failed: 1, results: [] },
  });
  renderDetail();
  await screen.findByRole('button', { name: '使用说明' });
  fireEvent.click(screen.getByRole('tab', { name: '设置' }));
  expect(screen.getByLabelText('检索方式')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '重新索引全部文档' }));
  fireEvent.click(screen.getByRole('button', { name: '确认重新索引' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('1 份索引失败');
  expect(screen.queryByText('知识库索引已更新。')).not.toBeInTheDocument();
});

test('服务未配置时提供真实状态并禁用导入与新建', async () => {
  knowledgeAPI.config.mockResolvedValue({
    data: { ...config, configured: false },
  });
  knowledgeAPI.list.mockResolvedValue({ data: { items: [], total: 0 } });
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <KnowledgeBase />
    </MemoryRouter>,
  );
  await screen.findByText(/知识库服务尚未配置/);
  expect(
    screen
      .getAllByRole('button', { name: '新建知识库' })
      .every((button) => button.disabled),
  ).toBe(true);
});

test('知识库统计缺失时展示未知数量，不将已启用知识库误判为空库', async () => {
  knowledgeAPI.list.mockResolvedValue({
    data: {
      items: [
        {
          id: 'base-1',
          name: '统计待返回的库',
          enabled: true,
          indexMode: 'bm25',
        },
      ],
      total: 1,
    },
  });
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <KnowledgeBase />
    </MemoryRouter>,
  );
  await screen.findByRole('link', { name: '统计待返回的库' });
  expect(screen.getByText('已启用')).toBeInTheDocument();
  expect(screen.getAllByText('—')).toHaveLength(2);
  expect(screen.queryByText('等待文档')).not.toBeInTheDocument();
});
