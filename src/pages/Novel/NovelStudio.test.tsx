import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { novelAPI } from '../../services/novelApi';
import type { NovelProject } from '../../types/novel';
import NovelStudio from './NovelStudio';

jest.mock('../../services/novelApi', () => ({ novelAPI: { get: jest.fn(), updateChapter: jest.fn(), generateChapter: jest.fn() } }));
const api = jest.mocked(novelAPI, true);
const chapter = { id: 'chapter-1', index: 0, title: '雾港', summary: '一封信', content: '原稿', wordCount: 2, status: 'done' };
const project: NovelProject = { id: 'book', agentId: 'novel-writer', name: '雾港来信', genre: '悬疑', synopsis: '雾港', style: '', settings: {
  genre: '悬疑', textModel: 'model', audience: '通用', perspective: '第三人称', length: '短篇', chapterCount: 3, targetWords: 2000,
}, outline: { synopsis: '简介', worldview: '雾港', characters: [], chapters: [chapter] }, chapters: [chapter], job: null,
  revision: 3, totalWords: 2, doneChapters: 1, createdAt: '', updatedAt: '' };

beforeEach(() => { jest.resetAllMocks(); api.get.mockResolvedValue(project); });
function open() {
  return render(<MemoryRouter initialEntries={['/novel/book']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes><Route path="/novel/:id" element={<NovelStudio />} /></Routes>
  </MemoryRouter>);
}

test('润色使用已保存版本，生成后在编辑器中显示新正文', async () => {
  api.generateChapter.mockResolvedValue({ ...project, revision: 4, chapters: [{ ...chapter, content: '新正文' }] });
  open();
  await screen.findByDisplayValue('原稿');
  fireEvent.change(screen.getByLabelText('编辑方式'), { target: { value: 'polish' } });
  fireEvent.click(screen.getByRole('button', { name: '润色本章' }));
  expect(api.generateChapter).toHaveBeenCalledWith('book', chapter.id, expect.objectContaining({ mode: 'polish', revision: 3 }));
  expect(await screen.findByDisplayValue('新正文')).toBeInTheDocument();
});

test('自动保存期间的新编辑仍然保留，并使用最新版本继续保存', async () => {
  let resolveSave!: (value: NovelProject) => void;
  api.updateChapter.mockReturnValueOnce(new Promise(resolve => { resolveSave = resolve; }));
  api.updateChapter.mockResolvedValueOnce({ ...project, revision: 5, chapters: [{ ...chapter, content: '继续写' }] });
  open();
  const field = await screen.findByDisplayValue('原稿');
  fireEvent.change(field, { target: { value: '写' } });
  await waitFor(() => expect(api.updateChapter).toHaveBeenCalledTimes(1), { timeout: 2200 });
  fireEvent.change(field, { target: { value: '继续写' } });
  await act(async () => resolveSave({ ...project, revision: 4, chapters: [{ ...chapter, content: '写' }] }));
  await waitFor(() => expect(api.updateChapter).toHaveBeenCalledTimes(2), { timeout: 2200 });
  expect(api.updateChapter).toHaveBeenLastCalledWith('book', chapter.id, expect.objectContaining({ content: '继续写', revision: 4 }));
  expect(field).toHaveValue('继续写');
});
