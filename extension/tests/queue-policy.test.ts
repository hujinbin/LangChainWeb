import assert from 'node:assert/strict';
import test from 'node:test';
import { maySaveDraft, type Attempt } from '../lib/protocol';

const fill: Attempt = {
  draftId: 'draft-1', revision: 2, tabId: 5, platformId: 'zhihu', action: 'fill', time: 1234,
  result: { platformId: 'zhihu', status: 'filled', fields: [], message: '', saved: false },
};

test('仅允许在同一版本、平台和目标标签完整填充后保存草稿', () => {
  assert.equal(maySaveDraft(fill, 2, 5, 'zhihu'), true);
  assert.equal(maySaveDraft(undefined, 2, 5, 'zhihu'), false);
  assert.equal(maySaveDraft(fill, 3, 5, 'zhihu'), false);
  assert.equal(maySaveDraft(fill, 2, 6, 'zhihu'), false);
  assert.equal(maySaveDraft(fill, 2, 5, 'weibo'), false);
  for (const status of ['failed', 'partial', 'wrong-page', 'needs-login'] as const) {
    assert.equal(maySaveDraft({ ...fill, result: { ...fill.result, status } }, 2, 5, 'zhihu'), false);
  }
});

test('上传仍在处理中时可以手动重试保存，收到平台保存确认后禁用再次保存', () => {
  const waiting: Attempt = { ...fill, action: 'save', result: { ...fill.result, status: 'partial' } };
  assert.equal(maySaveDraft(waiting, 2, 5, 'zhihu'), true);
  assert.equal(maySaveDraft({ ...waiting, result: { ...fill.result, saved: true } }, 2, 5, 'zhihu'), false);
});
