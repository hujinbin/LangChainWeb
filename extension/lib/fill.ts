import type { EditorCommand, EditorResult, FieldResult, MediaDescriptor, MediaRole } from './protocol';
import { platformForUrl, uploadContinuesAt, type Platform, type TextField } from './platforms';
import { readRemoteFile } from './editor-media';

const titleFields = ['input[placeholder*="标题"]', 'textarea[placeholder*="标题"]', 'input[aria-label*="标题"]',
  'input[name="title"]', 'textarea[name="title"]', '[contenteditable="true"][data-placeholder*="标题"]'];
const bodyFields = ['textarea[placeholder*="正文"]', 'textarea[placeholder*="章节内容"]', 'textarea[name="content"]',
  'textarea[placeholder*="作品描述"]', '[contenteditable="true"][data-placeholder*="正文"]',
  '[contenteditable="true"][data-placeholder*="描述"]', '.ProseMirror[contenteditable="true"]',
  '.ql-editor[contenteditable="true"]', '[data-slate-editor="true"][contenteditable="true"]',
  '.public-DraftEditor-content[contenteditable="true"]', 'iframe[id^="ueditor_"]'];
const tagFields = ['input[name="tags"]', 'textarea[name="tags"]', 'input[placeholder*="逗号"][placeholder*="标签"]', 'input[placeholder*="逗号"][placeholder*="关键词"]'];
const mediaFields: Record<MediaRole, string[]> = {
  cover: ['input[type="file"][aria-label*="封面"]', 'input[type="file"][name*="cover" i]',
    '[class*="cover-upload" i] input[type="file"]', '[class*="coverUpload"] input[type="file"]'],
  image: ['input[type="file"][aria-label*="图片"]', 'input[type="file"][name="images"]', 'input[type="file"][accept*="image" i]', 'input[type="file"][accept*=".jpg" i]', 'input[type="file"][accept*=".png" i]'],
  video: ['input[type="file"][aria-label*="视频"]', 'input[type="file"][name*="video" i]', 'input[type="file"][accept*="video" i]', 'input[type="file"][accept*=".mp4" i]'],
};

const field = (name: string, status: FieldResult['status'], message: string): FieldResult => ({ field: name, status, message });
const failure = (error: unknown) => error instanceof Error ? error.message : '操作未完成。';
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function available(element: Element, upload = false): boolean {
  if (element.closest('[inert],fieldset:disabled,[aria-disabled="true"]') || element.matches(':disabled,[readonly]')) return false;
  // File inputs themselves are commonly hidden behind the visible upload widget.
  for (let node: Element | null = upload ? element.parentElement : element; node; node = node.parentElement) {
    if (node.matches('[hidden],[aria-hidden="true"]')) return false;
    const style = node.ownerDocument.defaultView?.getComputedStyle(node);
    if (style?.display === 'none' || style?.visibility === 'hidden') return false;
  }
  return true;
}

function findControl(doc: Document, selectors: readonly string[], accept: (el: Element) => boolean) {
  for (const selector of selectors) {
    const found = Array.from(doc.querySelectorAll(selector)).filter(accept);
    if (found.length > 1) return { ambiguous: true, element: undefined };
    if (found.length === 1) return { ambiguous: false, element: found[0] };
  }
  return { ambiguous: false, element: undefined };
}

function textTarget(el: Element): boolean {
  return available(el) && el.matches('input:not([type]),input[type="text"],textarea,[contenteditable="true"],[contenteditable="plaintext-only"],iframe');
}

function resolveText(doc: Document, platform: Platform, key: TextField) {
  const defaults = key === 'title' ? titleFields : key === 'tags' ? tagFields : bodyFields;
  const found = findControl(doc, [...(platform.selectors[key] || []), ...defaults], textTarget);
  let target = found.element as HTMLElement | undefined;
  if (found.ambiguous) return { issue: field(key, 'unsupported', '存在多个候选编辑框，请手动选择。') };
  if (target && key === 'tags' && (target.closest('[role="combobox"],[aria-autocomplete],.ant-select,.el-select') ||
    /回车|按下.*添加/.test(target.getAttribute('placeholder') || ''))) {
    return { issue: field(key, 'unsupported', '此处需要在平台选取或确认标签，请手动添加。') };
  }
  if (target?.tagName === 'IFRAME') {
    const frame = target as HTMLIFrameElement;
    try {
      const inner = frame.contentDocument;
      if (!inner) return { issue: field(key, 'unsupported', '编辑器在跨域或受保护的框架中，请手动粘贴。') };
      target = inner.body?.matches('[contenteditable="true"],[contenteditable="plaintext-only"]') || inner.designMode === 'on'
        ? inner.body : inner.querySelector<HTMLElement>('[contenteditable="true"]') || undefined;
    } catch { return { issue: field(key, 'unsupported', '无法读取跨域编辑器，请手动粘贴。') }; }
  }
  return target ? { target } : { issue: field(key, 'missing', '未找到可编辑字段，请手动填写。') };
}

function plainInput(el: HTMLElement): el is HTMLInputElement | HTMLTextAreaElement { return /^(INPUT|TEXTAREA)$/.test(el.tagName); }
function content(el: HTMLElement): string {
  if (plainInput(el)) return el.value;
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
  copy.querySelectorAll('p,div,li').forEach(node => node.append('\n'));
  return copy.textContent || '';
}
const clean = (value: string) => value.replace(/\r\n?/g, '\n').replace(/[\u200b\ufeff]/g, '').replace(/\u00a0/g, ' ').trim();

async function writeText(key: string, el: HTMLElement, value: string, overwrite: boolean): Promise<FieldResult> {
  const current = clean(content(el)), desired = clean(value);
  const media = el.querySelector('img,video,audio,iframe,canvas,svg');
  if (current === desired && !media) return field(key, 'unchanged', '现有内容与草稿相同。');
  if (!overwrite && (current || media)) return field(key, 'occupied', '页面已有内容，未覆盖。');
  if (plainInput(el) && el.hasAttribute('maxlength') && el.maxLength >= 0 && value.length > el.maxLength) return field(key, 'unsupported', '内容超过页面的字数限制。');
  const doc = el.ownerDocument, win = doc.defaultView;
  if (!win) return field(key, 'failed', '编辑器已关闭。');
  const before = new win.InputEvent('beforeinput', { inputType: 'insertText', data: value, bubbles: true, cancelable: true });
  if (el.dispatchEvent(before)) {
    if (plainInput(el)) {
      const proto = el.tagName === 'INPUT' ? win.HTMLInputElement.prototype : win.HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    } else {
      el.focus();
      const selection = doc.getSelection();
      const range = doc.createRange();
      range.selectNodeContents(el);
      selection?.removeAllRanges();
      selection?.addRange(range);
      let inserted = false;
      try { inserted = typeof doc.execCommand === 'function' && doc.execCommand('insertText', false, value); } catch { /* Plain-text fallback. */ }
      if (!inserted) {
        const fragment = doc.createDocumentFragment();
        value.replace(/\r\n?/g, '\n').split('\n').forEach((line, i) => {
          if (i) fragment.append(doc.createElement('br'));
          fragment.append(doc.createTextNode(line));
        });
        el.replaceChildren(fragment);
      }
    }
    el.dispatchEvent(new win.InputEvent('input', { inputType: 'insertText', data: value, bubbles: true }));
    el.dispatchEvent(new win.Event('change', { bubbles: true }));
  }
  await pause(0);
  return el.isConnected && clean(content(el)) === desired
    ? field(key, 'filled', '已填入编辑器。') : field(key, 'failed', '编辑器未保留所填内容，请手动核对。');
}

function mediaInput(doc: Document, platform: Platform, role: MediaRole) {
  const selectors = [...(platform.selectors[role] || []), ...mediaFields[role]];
  return findControl(doc, selectors, el => {
    if (!el.matches('input[type="file"]') || !available(el, true)) return false;
    const landmarks = [el, el.parentElement, el.parentElement?.parentElement].filter(Boolean) as Element[];
    const context = landmarks.map(node => ['class', 'name', 'aria-label', 'title'].map(attr => node.getAttribute(attr) || '').join(' ')).join(' ');
    if (/avatar|portrait|profile-photo|头像/i.test(context)) return false;
    return role !== 'image' || !/cover|封面/i.test(context);
  });
}

function accepts(input: HTMLInputElement, file: Pick<File, 'type' | 'name'>, kind: MediaRole) {
  const mime = file.type.toLowerCase();
  if (!mime.startsWith(kind === 'video' ? 'video/' : 'image/') || mime === 'image/svg+xml') return false;
  const types = input.accept.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  return !types.length || types.some(type => type === '*/*' || type === mime ||
    (type.endsWith('/*') && mime.startsWith(type.slice(0, -1))) || (type.startsWith('.') && file.name.toLowerCase().endsWith(type)));
}

function hasPreview(doc: Document, role: MediaRole, input?: HTMLInputElement) {
  const region = input?.closest('[class*="upload" i],[data-upload],[class*="cover" i]') || input?.parentElement;
  const previews = role === 'cover' ? '[class*="cover" i] img[src],[data-cover] img[src]' :
    role === 'video' ? 'video[src],video source[src],video[poster]' :
    '[class*="image-list" i] img[src],[class*="upload-list" i] img[src],[data-image-list] img[src]';
  const nearby = region && region !== doc.body ? region.querySelectorAll('img[src],video[src],video source[src],[data-file-name]') : [];
  const assets = [...Array.from(nearby),
    ...Array.from(doc.querySelectorAll(previews))];
  return assets.some(el => {
    if (el.matches('img') && role === 'video') return false;
    return available(el) && !/icon|placeholder|upload-tip|upload-btn/i.test([el.className, el.getAttribute('src')].join(' '));
  });
}

interface MediaReaders {
  local: (info: MediaDescriptor, command: EditorCommand) => Promise<File>;
  remote?: typeof readRemoteFile;
}

function sourcesFor(command: EditorCommand, role: MediaRole): (MediaDescriptor | string)[] {
  const local = command.files.filter(f => f.role === role);
  const { draft } = command;
  const urls = role === 'image' ? draft.images : !local.length && draft[role] ? [draft[role]!] : [];
  return [...local, ...urls];
}

type FileInfo = Pick<File, 'name' | 'size' | 'type' | 'lastModified'>;
interface HandedMedia { signature: string; files: FileInfo[] }
type HandedFiles = Map<MediaRole, HandedMedia>;

async function fillMedia(doc: Document, platform: Platform, role: MediaRole, command: EditorCommand, readers: MediaReaders,
  stillHere: () => boolean, handed: HandedFiles, claimed: Map<Element, MediaRole>): Promise<FieldResult | undefined> {
  const sources = sourcesFor(command, role);
  const count = sources.length;
  if (!count) return;
  const signature = JSON.stringify(sources.map(source => typeof source === 'string' ? source : source.id));
  const previous = handed.get(role);
  const { element, ambiguous } = mediaInput(doc, platform, role);
  if (element && claimed.has(element) && claimed.get(element) !== role) {
    return field(role, 'unsupported', '平台只提供一个媒体控件，已保留本次先选的素材，请手动核对素材类型。');
  }
  if (previous?.signature === signature) {
    const input = element as HTMLInputElement | undefined;
    if (input && previous.files.some(file => !accepts(input, file, role))) return field(role, 'unsupported', '素材类型与当前控件不匹配。');
    const selected = Array.from(input?.files || []);
    const matches = selected.length === count && selected.every((file, i) => {
      const earlier = previous.files[i];
      return earlier && file.name === earlier.name && file.size === earlier.size && file.type === earlier.type && file.lastModified === earlier.lastModified;
    });
    if (matches || (!selected.length && hasPreview(doc, role, input))) {
      if (element) claimed.set(element, role);
      return field(role, 'unchanged', '这份素材已在当前编辑页选取。');
    }
    return field(role, 'occupied', '上次已将这份素材交给平台，当前页面无法核实原文件，请核对预览或手动重新选择。');
  }
  if (!element) return field(role, ambiguous ? 'unsupported' : 'missing', ambiguous ? '有多个上传控件，请手动选择。' : '未找到对应的上传控件，请在平台选择上传。');
  const input = element as HTMLInputElement;
  if (!input.multiple && count > 1) return field(role, 'unsupported', '此上传控件仅接受单个文件，请逐个选择。');
  const selected = Array.from(input.files || []);
  if (selected.length === count && sources.every((source, i) => {
    const file = selected[i];
    return typeof source !== 'string' && file && file.name === source.name && file.size === source.size &&
      file.type === source.type && accepts(input, file, role);
  })) {
    claimed.set(input, role);
    return field(role, 'unchanged', '页面已选有相同名称、大小和类型的本地文件，请核对预览。');
  }
  const existing = () => Boolean(input.files?.length || hasPreview(doc, role, input));
  if (existing() && !command.allowOverwrite) return field(role, 'occupied', '页面已有素材，未替换。');
  const win = doc.defaultView;
  if (!win?.DataTransfer) return field(role, 'unsupported', '浏览器不支持在此控件填入文件，请手动上传。');
  try {
    const transfer = new win.DataTransfer();
    for (const source of sources) {
      if (!stillHere() || !input.isConnected) return field(role, 'failed', '编辑页面已切换，请重新填充。');
      const file = typeof source === 'string' ? await (readers.remote || readRemoteFile)(source, role) : await readers.local(source, command);
      if (!accepts(input, file, role)) return field(role, 'unsupported', '素材类型与平台上传控件不匹配。');
      transfer.items.add(file);
    }
    if (!stillHere() || !input.isConnected || !available(input, true)) return field(role, 'failed', '上传控件已发生变化，请重试。');
    if (existing() && !command.allowOverwrite) return field(role, 'occupied', '页面已添加素材，未替换。');
    input.files = transfer.files;
    if (input.files?.length !== count) return field(role, 'failed', '平台未接收所选文件。');
    handed.set(role, { signature, files: Array.from(input.files, ({ name, type, size, lastModified }) => ({ name, type, size, lastModified })) });
    claimed.set(input, role);
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
    input.dispatchEvent(new win.Event('change', { bubbles: true }));
    return field(role, 'filled', '文件已交给平台，请在页面确认上传和处理结果。');
  } catch (error) { return field(role, 'failed', failure(error)); }
}

const saveLabels = new Set(['保存草稿', '存为草稿', '存入草稿箱', '保存至草稿箱', '保存到草稿箱', '存草稿', '保存为草稿']);
const savedLabels = /^(?:草稿保存成功|草稿已保存|已保存到草稿箱|已存入草稿箱|已保存草稿|保存草稿成功|已保存至草稿箱)[！!。]?$/;
const visibleNotices = (doc: Document) => Array.from(doc.querySelectorAll('[role="status"],[role="alert"],[aria-live],.ant-message-notice,.el-message__content,.toast,[class*="toast" i]'))
  .filter(el => available(el) && savedLabels.test((el.textContent || '').trim()));

async function saveOnPage(doc: Document): Promise<{ saved: boolean; clicked: boolean; message: string }> {
  const pending = Array.from(doc.querySelectorAll('[aria-busy="true"],[role="progressbar"],.ant-upload-list-item-uploading')).some(el =>
    available(el) && !(el.getAttribute('aria-valuenow') === '100'));
  if (pending) return { saved: false, clicked: false, message: '页面仍在上传或处理中，请完成后再保存。' };
  const buttons = Array.from(doc.querySelectorAll<HTMLElement>('button,input[type="button"],[role="button"]')).filter(el => {
    const label = (el.tagName === 'INPUT' ? (el as HTMLInputElement).value : el.textContent || '').trim();
    const traits = ['aria-label', 'title', 'name', 'id', 'formaction'].map(k => el.getAttribute(k) || '').join(' ');
    if (!available(el) || !saveLabels.has(label) || /发布|发表|送审|提交|审核|publish|submit|review/i.test(traits)) return false;
    if (el.matches('a[href],[formaction],[type="submit"]') || el.closest('a[href]') ||
      el.parentElement?.closest('button,[role="button"],[formaction]')) return false;
    if (el.tagName === 'BUTTON' && (el as HTMLButtonElement).form && (el as HTMLButtonElement).type !== 'button') return false;
    return true;
  });
  const button = buttons[0];
  if (buttons.length !== 1 || !button) return { saved: false, clicked: false, message: '未找到唯一且可用的草稿保存按钮，请在页面手动保存。' };
  const before = new Set(visibleNotices(doc));
  button.click();
  for (let i = 0; i < 15; i++) {
    if (visibleNotices(doc).some(node => !before.has(node))) return { saved: true, clicked: true, message: '平台已确认草稿保存成功。' };
    await pause(100);
  }
  return { saved: false, clicked: true, message: '已点击保存草稿，平台尚未确认结果，请在草稿箱核对。' };
}

export function createEditorHandler(doc: Document, getUrl: () => string, readers: MediaReaders) {
  let busy = false;
  let last: { key: string; fields: FieldResult[]; controls: HTMLElement[]; save?: { saved: boolean; message: string } } | undefined;
  let selection = { url: '', draftId: '', handed: new Map<MediaRole, HandedMedia>() };
  return async function handle(command: EditorCommand): Promise<EditorResult> {
    const url = getUrl(), platform = platformForUrl(url), platformId = command.platformId;
    const result = (status: EditorResult['status'], message: string, fields: FieldResult[] = [], saved = false): EditorResult =>
      ({ platformId, status, fields, saved, message });
    if (!platform || platform.id !== platformId) return result('wrong-page', '当前标签页与所选平台不符。');
    if (busy) return result('failed', '上一项操作正在处理，请稍候。');
    const address = new URL(url);
    const route = address.pathname + address.hash;
    const loginGate = /(?:^|\/)(?:login|signin|userAuth|passport|register)(?:\.php|\.html)?(?:\/|[?#]|$)/i.test(address.pathname) ||
      Array.from(doc.querySelectorAll('input[type="password"],[class*="login-qrcode"],[class*="login_qrcode"],[aria-label="登录二维码"]')).some(el => available(el));
    if (loginGate) return result('needs-login', '请在官方平台完成登录，再进入编辑页。');
    if (!platform.editorPath.test(route) || /\/(?:settings?|account|profile\/edit)(?:\/|\?|#|$)/i.test(route) || !doc.body) {
      return result('wrong-page', '请打开该平台的文章、章节或作品编辑页，再执行填充。');
    }
    if (platform.kind === 'novel' && resolveText(doc, platform, 'body').issue?.status === 'missing' &&
      !findControl(doc, platform.selectors.title || [], textTarget).element) {
      return result('wrong-page', '请从作品管理进入具体章节的编辑页。');
    }
    const documentKey = (at: string) => JSON.stringify([at, command.draftId, command.revision]);
    const root = doc.documentElement;
    let pageHidden = false;
    const leaving = () => { pageHidden = true; };
    doc.defaultView?.addEventListener('pagehide', leaving);
    busy = true;
    try {
      if (command.saveDraft) {
        if (last?.key !== documentKey(url) || last.controls.some(el => !el.isConnected)) {
          return result('partial', '请先将此版本完整填入当前编辑页，再保存草稿。');
        }
        const previous = last.save;
        if (previous) return result(previous.saved ? 'filled' : 'partial', previous.message, last.fields, previous.saved);
        const saved = await saveOnPage(doc);
        if (saved.clicked) last.save = saved;
        return result(saved.saved ? 'filled' : 'partial', saved.message, last.fields, saved.saved);
      }
      last = undefined;
      if (selection.url !== url || selection.draftId !== command.draftId) {
        selection = { url, draftId: command.draftId, handed: new Map() };
      }
      const outcomes = new Map<string, FieldResult>();
      const fieldOrder = ['title', 'body', 'tags', 'cover', 'image', 'video'];
      const fields = () => fieldOrder.flatMap(name => outcomes.has(name) ? [outcomes.get(name)!] : []);
      const moved = () => result('wrong-page', '编辑页面已切换或刷新，请核对素材，重新选择当前标签页。', fields());
      const controls = new Map<TextField, HTMLElement>();
      const claimed = new Map<Element, MediaRole>();
      let trustedUrl = url, canAdvance = false;
      const stillHere = () => {
        if (pageHidden || doc.documentElement !== root || !doc.body) return false;
        const current = getUrl();
        if (trustedUrl === current) return true;
        if (!canAdvance || !uploadContinuesAt(platform, trustedUrl, current)) return false;
        trustedUrl = current;
        selection.url = current;
        canAdvance = false;
        return true;
      };
      const upload = async (role: MediaRole) => {
        const outcome = await fillMedia(doc, platform, role, command, readers, stillHere, selection.handed, claimed);
        if (outcome) outcomes.set(role, outcome);
        return outcome;
      };
      const values = { title: command.draft.title, body: command.draft.body, tags: command.draft.tags.join('，') };
      const social = platform.kind === 'social';
      let waitForFields = false;
      if (social) {
        for (const role of ['video', 'image'] as const) {
          if (!stillHere()) return moved();
          const outcome = await upload(role);
          if (outcome?.status === 'filled' || outcome?.status === 'unchanged') {
            waitForFields = true;
            // Only a file hand-off in this request can initiate an upload-to-editor transition.
            if (outcome.status === 'filled') canAdvance = true;
          }
        }
      }
      const deadline = Date.now() + (waitForFields ? 12000 : 0);
      const pending = new Set<TextField>(Object.keys(values).filter(k => values[k as TextField].trim()) as TextField[]);
      let coverPending = social && sourcesFor(command, 'cover').length > 0;
      // The title, description and cover may mount independently. Fill each as it
      // becomes available, with one shared deadline and no repeated upload events.
      do {
        if (!stillHere()) return moved();
        const timedOut = Date.now() >= deadline;
        for (const [name, target] of controls) {
          if (!target.isConnected) {
            controls.delete(name);
            pending.add(name);
          }
        }
        for (const name of pending) {
          if (!stillHere()) return moved();
          const { target, issue } = resolveText(doc, platform, name);
          if (!target && issue?.status === 'missing' && !timedOut) continue;
          if (target) controls.set(name, target);
          outcomes.set(name, target ? await writeText(name, target, values[name], command.allowOverwrite) : issue!);
          pending.delete(name);
        }
        if (coverPending) {
          const ready = mediaInput(doc, platform, 'cover');
          if (ready.element || ready.ambiguous || timedOut || selection.handed.has('cover')) {
            if (!stillHere()) return moved();
            await upload('cover');
            coverPending = false;
          }
        }
        if (pending.size || coverPending) await pause(160);
      } while (pending.size || coverPending);
      if (!social) {
        for (const role of ['cover', 'image', 'video'] as const) {
          if (!stillHere()) return moved();
          await upload(role);
        }
      }
      if (!outcomes.size) return result('failed', '草稿中没有可填入的内容。');
      if (!stillHere()) return moved();
      for (const [name, target] of controls) {
        const status = outcomes.get(name)?.status;
        if ((status === 'filled' || status === 'unchanged') && (!target.isConnected || clean(content(target)) !== clean(values[name]))) {
          outcomes.set(name, field(name, 'failed', '页面已重新渲染或修改此字段，请核对后重试。'));
        }
      }
      const completedFields = fields();
      const complete = completedFields.every(item => item.status === 'filled' || item.status === 'unchanged');
      if (complete) last = { key: documentKey(trustedUrl), fields: completedFields, controls: [...controls.values()] };
      return result(complete ? 'filled' : 'partial', complete ? '草稿内容已填入，请在页面核对。' : '部分字段未填入，请逐项核对并补充。', completedFields);
    } catch (error) {
      return result('failed', failure(error));
    } finally {
      doc.defaultView?.removeEventListener('pagehide', leaving);
      busy = false;
    }
  };
}
