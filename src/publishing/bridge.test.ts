import { normalizePublishingDraft } from './draft';
import { privateAssetPath, readStudioMedia } from './bridge';
import apiClient from '../services/api';

const path = '/api/aiWorkflow/assets/00000000000000000000000000000000.png';
const studio = 'https://studio.example.com';
const backend = 'https://api.example.com';

test('only explicitly allowed draft fields cross the handoff; relative media retain their source', () => {
  expect(normalizePublishingDraft({ title: ' t ', tags: ['a', 'a'], images: [path, path],
    Authorization: 'secret', rawExecution: { debug: true } }, studio)).toEqual({
    title: 't', body: '', tags: ['a'], images: [studio + path],
  });
  for (const url of ['data:image/png;base64,ABC', 'javascript:void(0)', 'https://user:pw@studio.example.com/a.jpg']) {
    expect(() => normalizePublishingDraft({ images: [url] }, studio)).toThrow();
  }
  expect(() => normalizePublishingDraft({ body: 'x'.repeat(120001) })).toThrow();
  expect(() => normalizePublishingDraft({ body: ' ' })).toThrow();
});

test('only studio and API asset paths qualify for an authenticated request', () => {
  expect(privateAssetPath(studio + path, studio, backend)).toBe(path);
  expect(privateAssetPath(backend + path, studio, backend)).toBe(path);
  const agent = path.replace('aiWorkflow/assets', 'aiAgents/projects/abc-1/assets');
  expect(privateAssetPath(agent, studio, backend)).toBe(agent);
  for (const url of ['https://other.example' + path, studio + path + '?token=x', backend + '/api/user',
    'https://api.example.com.other.example' + path, 'https://user@studio.example.com' + path]) {
    expect(privateAssetPath(url, studio, backend)).toBeUndefined();
  }
});

test('the workbench reads only its own media and returns the binary with the expected type', async () => {
  const blob = new Blob(['local fixture'], { type: 'image/png' });
  const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ data: blob });
  try {
    const signal = new AbortController().signal;
    expect(await readStudioMedia('https://unrelated.example' + path, false, signal)).toBeUndefined();
    expect(get).not.toHaveBeenCalled();
    expect(await readStudioMedia(window.location.origin + path, false, signal)).toBe(blob);
    expect(get).toHaveBeenCalledWith(path, expect.objectContaining({ responseType: 'blob' }));
    await expect(readStudioMedia(window.location.origin + path, true, signal)).rejects.toThrow();
  } finally { get.mockRestore(); }
});
