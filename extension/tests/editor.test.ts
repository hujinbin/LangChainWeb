import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createEditorHandler } from '../lib/fill';
import { readLocalFile, readRemoteFile } from '../lib/editor-media';
import { platformForUrl, platforms } from '../lib/platforms';
import type { EditorCommand } from '../lib/protocol';

const draft = { title: '章节一', body: '第一段\n第二段 <script>仅为文本</script>', tags: [], images: [] };
const request = (id: string, change: Partial<EditorCommand> = {}): EditorCommand => ({
  type: 'publishing:fill', platformId: id, draftId: 'a', revision: 1, transferId: 'local',
  allowOverwrite: false, saveDraft: false, files: [], draft, ...change,
});
const paths: Record<string, string> = {
  wechat: '/cgi-bin/appmsg?t=media/appmsg_edit', baijiahao: '/builder/rc/edit', toutiao: '/profile_v4/graphic/publish',
  dayu: '/dashboard/write', penguin: '/article/articlePublish', netease: '/article/edit', zhihu: '/write',
  sohu: '/profile/editor', qutoutiao: '/article/edit', fanqie: '/main/writer/chapter', jinjiang: '/backend/chapter',
  qimao: '/chapter/editor', qidian: '/chapter/edit', migu: '/wenxuenew/detail/sectionmanagement',
  channels: '/platform/post/create', xiaohongshu: '/publish/publish', douyin: '/creator-micro/content/upload',
};
const markup = '<input placeholder="请输入标题"><div class="ProseMirror" contenteditable="true"></div>';

function fixture(id: string, body = markup, path = paths[id]) {
  const platform = platforms.find(p => p.id === id)!;
  let url = platform.origin + path;
  const dom = new JSDOM(body, { url }), doc = dom.window.document;
  const handler = createEditorHandler(doc, () => url, { local: async () => { throw new Error('Unexpected file read'); } });
  return { doc, handler, dom, move: (to: string) => { url = platform.origin + to; } };
}

test('所有平台在匹配的作家编辑器上填入纯文本并派发页面事件', async () => {
  assert.equal(platforms.length, 17);
  for (const platform of platforms) {
    assert.equal(platformForUrl(platform.editorUrl)?.id, platform.id);
    const { doc, handler, dom } = fixture(platform.id);
    let edits = 0;
    doc.addEventListener('input', () => edits++);
    const result = await handler(request(platform.id));
    assert.equal(result.status, 'filled', platform.name + ': ' + result.message);
    assert.equal(edits, 2);
    assert.equal(doc.querySelector('input')!.value, draft.title);
    assert.equal(doc.querySelector('[contenteditable] script'), null);
    assert.equal(doc.querySelector('br')?.parentElement?.className, 'ProseMirror');
    assert.equal(result.saved, false);
    dom.window.close();
  }
});

test('仅精确 HTTPS 作者域名及编辑路径有效，登录或账户修改页面不写入', async () => {
  for (const value of ['http://mp.weixin.qq.com/', 'https://mp.weixin.qq.com.example.org',
    'https://name@mp.weixin.qq.com/', 'https://mp.weixin.qq.com:1234/', 'about:blank']) assert.equal(platformForUrl(value), undefined);
  for (const [path, expected] of [['/profile/settings?redirect=publish', 'wrong-page'], ['/login', 'needs-login']]) {
    const { handler, doc } = fixture('sohu', markup, path);
    assert.equal((await handler(request('sohu'))).status, expected);
    assert.equal(doc.querySelector('input')!.value, '');
  }
  const { handler } = fixture('sohu');
  assert.equal((await handler(request('dayu'))).status, 'wrong-page');
});

test('已有标题和纯图片正文均保留，用户允许覆盖时才替换；找不到字段和标签时逐项报告', async () => {
  const { handler, doc } = fixture('zhihu', '<input name="title" value="现有"><div class="ProseMirror" contenteditable="true"><img src="old.png"></div>');
  const declined = await handler(request('zhihu'));
  assert.deepEqual(declined.fields.map(x => x.status), ['occupied', 'occupied']);
  assert.equal(doc.querySelector('img')!.getAttribute('src'), 'old.png');
  assert.equal((await handler(request('zhihu', { saveDraft: true }))).saved, false);
  const allowed = await handler(request('zhihu', { allowOverwrite: true }));
  assert.equal(allowed.status, 'filled');
  const partial = await handler(request('zhihu', { draft: { ...draft, tags: ['故事'] } }));
  assert.deepEqual(partial.fields.map(x => x.status), ['unchanged', 'unchanged', 'missing']);
  assert.equal((await handler(request('zhihu', { saveDraft: true }))).status, 'partial');
});

test('可编辑同源 iframe 保持纯文本，无法读取的 iframe 返回单独状态', async () => {
  const { handler, doc } = fixture('wechat', '<input id="title"><iframe id="ueditor_0"></iframe>');
  const frame = doc.querySelector('iframe')!;
  frame.contentDocument!.body.setAttribute('contenteditable', 'true');
  assert.equal((await handler(request('wechat'))).status, 'filled');
  assert.match(frame.contentDocument!.body.textContent || '', /第二段/);
  Object.defineProperty(frame, 'contentDocument', { get: () => null });
  const protectedFrame = await handler(request('wechat'));
  assert.equal(protectedFrame.fields.find(f => f.field === 'body')?.status, 'unsupported');
  assert.match(protectedFrame.fields.find(f => f.field === 'body')!.message, /跨域/);
});

test('明确保存需要同一页面、同一版本完整填充；只点击安全草稿按钮，校验成功提示且不重复点击', async () => {
  const { handler, doc, move } = fixture('sohu', markup + '<form><button>保存草稿</button><button type="submit">发布</button></form>' +
    '<button id="review" aria-label="提交审核">存草稿</button><button id="draft" type="button">保存草稿</button>');
  let saves = 0, otherClicks = 0;
  doc.addEventListener('click', event => {
    if ((event.target as Element).id !== 'draft') { otherClicks++; return; }
    saves++;
    const notice = doc.createElement('span');
    notice.setAttribute('role', 'status'); notice.textContent = '草稿已保存'; doc.body.append(notice);
  });
  assert.equal((await handler(request('sohu', { saveDraft: true }))).status, 'partial');
  assert.equal((await handler(request('sohu'))).saved, false);
  assert.equal((await handler(request('sohu', { revision: 2, saveDraft: true }))).saved, false);
  assert.equal(saves, 0);
  assert.equal((await handler(request('sohu', { saveDraft: true }))).saved, true);
  assert.equal((await handler(request('sohu', { saveDraft: true }))).saved, true);
  assert.equal(saves, 1); assert.equal(otherClicks, 0);
  move('/article/edit/new');
  assert.equal((await handler(request('sohu', { saveDraft: true }))).saved, false);
});

test('名称不明确、提交表单或嵌套提交按钮绝不触发，上传进度未完成时不保存', async () => {
  const { doc, handler } = fixture('xiaohongshu', markup + '<form><button><span role="button">保存草稿</span></button></form>' +
    '<button>保存并发布</button><button>保存</button><button>存稿</button><input type="submit" value="存草稿">');
  let clicked = false; doc.addEventListener('click', () => { clicked = true; });
  await handler(request('xiaohongshu'));
  assert.equal((await handler(request('xiaohongshu', { saveDraft: true }))).saved, false);
  assert.equal(clicked, false);
  doc.body.insertAdjacentHTML('beforeend', '<button type="button">保存草稿</button><span role="progressbar" aria-valuenow="50"></span>');
  assert.match((await handler(request('xiaohongshu', { saveDraft: true }))).message, /上传/);
  assert.equal(clicked, false);
});

test('本地文件每块验证边界、长度与结束标志；远程拒绝非 HTTPS', async () => {
  const info = { id: 'img', name: 'pic.png', type: 'image/png', size: 4, role: 'image' } as const;
  const chunks = [btoa('12'), btoa('34')];
  const seenOffsets: number[] = [];
  const file = await readLocalFile(info, async (_, offset) => {
    seenOffsets.push(offset); return { ok: true, base64: chunks.shift()!, done: offset === 2 };
  });
  assert.deepEqual(seenOffsets, [0, 2]); assert.equal(await file.text(), '1234');
  await assert.rejects(readLocalFile(info, async () => ({ ok: true, base64: 'YQ==', done: true })), /完整传输/);
  await assert.rejects(readRemoteFile('http://example.org/pic', 'cover'), /HTTPS/);
});

test('封面和视频只进入各自上传控件，已有预览或不支持的 MIME 会逐项回报', async () => {
  const { doc, dom } = fixture('channels', '<input type="file" name="cover" accept="image/png" hidden>' +
    '<div class="cover-preview"><img src="old.png"></div><input type="file" name="video" accept="video/mp4">');
  class Transfer {
    files: File[] = [];
    items = { add: (file: File) => this.files.push(file) };
  }
  Object.defineProperty(dom.window, 'DataTransfer', { value: Transfer });
  const inputs = Array.from(doc.querySelectorAll<HTMLInputElement>('input'));
  inputs.forEach(input => Object.defineProperty(input, 'files', { writable: true, value: [] }));
  const local = { id: 'clip', name: 'demo.mp4', type: 'video/mp4', role: 'video', size: 1 } as const;
  const handler = createEditorHandler(doc, () => dom.window.location.href, {
    local: async file => new File(['v'], file.name, { type: file.type }),
    remote: async () => new File(['p'], 'cover.png', { type: 'image/png' }),
  });
  const command = request('channels', { files: [local], draft: { title: '', body: '', tags: [], images: [], cover: 'https://cdn.example/cover.png' } });
  const changes: string[] = [];
  doc.addEventListener('change', event => changes.push((event.target as HTMLInputElement).name));
  const partial = await handler(command);
  assert.deepEqual(partial.fields.map(f => [f.field, f.status]), [['cover', 'occupied'], ['video', 'filled']]);
  assert.deepEqual(changes, ['video']);
  const complete = await handler({ ...command, allowOverwrite: true });
  assert.equal(complete.status, 'filled');
  assert.equal(inputs[0]!.files![0]!.name, 'cover.png');
  assert.equal(inputs[1]!.files![0]!.name, 'demo.mp4');
  inputs[1]!.accept = '.mov';
  const differentType = await handler({ ...command, allowOverwrite: true });
  assert.equal(differentType.fields.find(f => f.field === 'video')?.status, 'unsupported');
});

test('触发草稿按钮后若没有新确认提示，保留未确认状态并避免多次点击', async () => {
  const { doc, handler } = fixture('zhihu', markup + '<button type="button">存为草稿</button><span role="status">已存入草稿箱</span>');
  let count = 0; doc.querySelector('button')!.onclick = () => count++;
  await handler(request('zhihu'));
  const save = request('zhihu', { saveDraft: true });
  const first = await handler(save);
  assert.equal(first.saved, false);
  assert.match(first.message, /尚未确认/);
  assert.equal((await handler(save)).saved, false);
  assert.equal(count, 1);
});

test('社交平台一次填充先选视频或图集，再填入同一文档后续挂载的正文、标题和封面；重试不重复上传', async () => {
  const cases = [
    { id: 'douyin', role: 'video', from: '/creator-micro/content/upload', to: '/creator-micro/content/publish' },
    { id: 'channels', role: 'video', from: '/platform/post/upload', to: '/platform/post/create' },
    { id: 'xiaohongshu', role: 'image', from: '/publish/publish?step=upload', to: '/publish/publish?step=edit' },
  ] as const;
  for (const { id, role, from, to } of cases) {
    const video = role === 'video', mime = video ? 'video/mp4' : 'image/png';
    const { doc, dom } = fixture(id, '<input class="media" type="file" accept="' + mime + '">', from);
    class Transfer {
      files: File[] = [];
      items = { add: (file: File) => this.files.push(file) };
    }
    Object.defineProperty(dom.window, 'DataTransfer', { value: Transfer });
    const fileSlot = (input: HTMLInputElement) => Object.defineProperty(input, 'files', { value: [], writable: true });
    const first = doc.querySelector<HTMLInputElement>('.media')!;
    fileSlot(first);
    let uploads = 0, covers = 0, textEdits = 0;
    first.addEventListener('change', () => {
      uploads++;
      setTimeout(() => {
        dom.window.history.pushState({}, '', to);
        first.remove();
        doc.body.insertAdjacentHTML('beforeend', video ? '<video src="blob:uploaded"></video>' :
          '<div class="image-list"><img src="blob:uploaded"></div>');
        doc.body.insertAdjacentHTML('beforeend', '<input name="title" disabled><textarea name="content"></textarea>');
        doc.addEventListener('input', e => { if ((e.target as HTMLElement).matches('textarea,[name="title"]')) textEdits++; });
      }, 20);
      setTimeout(() => {
        doc.querySelector<HTMLInputElement>('[name="title"]')!.disabled = false;
        doc.body.insertAdjacentHTML('beforeend', '<input type="file" name="cover" accept="image/png">');
        const cover = doc.querySelector<HTMLInputElement>('[name=cover]')!;
        fileSlot(cover); cover.addEventListener('change', () => covers++);
      }, 75);
    });
    const reads: string[] = [];
    const handler = createEditorHandler(doc, () => dom.window.location.href, {
      local: async info => { reads.push(info.id); return new File(['x'], info.name, { type: info.type }); },
    });
    const command = request(id, {
      files: [{ id: 'primary', name: video ? 'a.mp4' : 'a.png', size: 1, role, type: mime },
        { id: 'cover', name: 'cover.png', size: 1, role: 'cover', type: 'image/png' }],
    });
    const firstPass = await handler(command);
    assert.equal(firstPass.status, 'filled', id + JSON.stringify(firstPass.fields));
    assert.equal(doc.querySelector<HTMLInputElement>('input[name=title]')!.value, draft.title);
    assert.equal(doc.querySelector('textarea')!.value, draft.body);
    assert.deepEqual(reads, ['primary', 'cover']);
    const retry = await handler({ ...command, allowOverwrite: true });
    assert.equal(retry.status, 'filled', id + JSON.stringify(retry.fields));
    assert.ok(retry.fields.every(f => f.status === 'unchanged'));
    assert.equal(uploads, 1); assert.equal(covers, 1); assert.equal(textEdits, 2);
    assert.deepEqual(reads, ['primary', 'cover']);
    dom.window.close();
  }
});

test('上传后的目标不是本站已知创作步骤或旧文档已卸载时，不写入目标字段', async () => {
  for (const next of ['https://creator.douyin.com/creator-micro/content/edit?item_id=old',
    'https://creator.douyin.com/creator-micro/content/publish?item_id=another-work',
    'https://other.example/creator-micro/content/publish', 'pagehide']) {
    const { doc, dom } = fixture('douyin', '<input type="file" accept="video/mp4">');
    let url = dom.window.location.href;
    class Transfer { files: File[] = []; items = { add: (f: File) => this.files.push(f) }; }
    Object.defineProperty(dom.window, 'DataTransfer', { value: Transfer });
    const input = doc.querySelector('input')!;
    Object.defineProperty(input, 'files', { value: [], writable: true });
    input.onchange = () => {
      if (next === 'pagehide') dom.window.dispatchEvent(new dom.window.Event('pagehide'));
      else url = next;
      doc.body.insertAdjacentHTML('beforeend', '<input name="title"><textarea name="content"></textarea>');
    };
    const handler = createEditorHandler(doc, () => url, { local: async () => new File(['v'], 'a.mp4', { type: 'video/mp4' }) });
    const result = await handler(request('douyin', { files: [{ name: 'a.mp4', type: 'video/mp4', role: 'video', size: 1, id: '1' }] }));
    assert.equal(result.status, 'wrong-page');
    assert.equal(doc.querySelector<HTMLInputElement>('[name="title"]')!.value, '');
    assert.equal(result.fields[0]?.field, 'video');
    dom.window.close();
  }
});
