import { browser, type Browser } from 'wxt/browser';
import { platformForUrl } from './platforms';
import { markAttempt, readDraft, readFile } from './store';
import { maySaveDraft, type Attempt, type EditorCommand, type EditorResult } from './protocol';

export interface DeliveryRequest {
  type: 'publishing:deliver';
  draftId: string;
  revision: number;
  tabId: number;
  platformId: string;
  allowOverwrite: boolean;
  saveDraft: boolean;
  autoSaveDraft?: boolean;
}
interface Transfer {
  tabId: number;
  documentId: string;
  platformId: string;
  files: Map<string, Blob | undefined>;
}
const transfers = new Map<string, Transfer>();
const working = new Set<number>();
const chunkSize = 192 * 1024;

export async function sendChunk(
  sender: Browser.runtime.MessageSender,
  transferId: string,
  fileId: string,
  offset: number
) {
  const transfer = transfers.get(transferId);
  if (
    !transfer ||
    !transfer.files.has(fileId) ||
    sender.frameId !== 0 ||
    sender.tab?.id !== transfer.tabId ||
    sender.documentId !== transfer.documentId ||
    platformForUrl(sender.url || '')?.id !== transfer.platformId
  ) {
    throw new Error('素材传输已结束，请重新点击填充。');
  }
  const file = transfer.files.get(fileId) ?? (await readFile(fileId));
  if (
    !file ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset >= file.size ||
    offset % chunkSize !== 0
  ) {
    throw new Error('无法读取本地素材。');
  }
  transfer.files.set(fileId, file);
  const end = Math.min(offset + chunkSize, file.size);
  const bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());
  let text = '';
  for (let start = 0; start < bytes.length; start += 8192)
    text += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return { ok: true, base64: btoa(text), done: end === file.size };
}

export async function deliver(request: DeliveryRequest) {
  const { draftId, revision, tabId, platformId, saveDraft } = request;
  if (working.has(tabId)) throw new Error('该标签页正在处理上一项操作。');
  working.add(tabId);
  const transferId = crypto.randomUUID();
  try {
    const record = await readDraft(draftId);
    if (record.revision !== revision) throw new Error('草稿已更新，请刷新后重试。');
    if (saveDraft && !maySaveDraft(record.lastAttempt, revision, tabId, platformId)) {
      throw new Error('请先将同一版本的草稿完整填入该标签页。');
    }
    const tab = await browser.tabs.get(tabId);
    if (platformForUrl(tab.url || '')?.id !== platformId)
      throw new Error('目标标签页已关闭、已跳转或未授权，请重新选择。');
    const [frame] = await browser.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: () => window.location.href,
    });
    if (!frame?.documentId || platformForUrl(String(frame.result))?.id !== platformId) {
      throw new Error('目标页面已经变化，请刷新标签列表。');
    }
    const target = { documentId: frame.documentId };
    let listening = false;
    try {
      listening =
        (await browser.tabs.sendMessage(tabId, { type: 'publishing:ping' }, target))?.ready === true;
    } catch {
      /* First use on this document. */
    }
    if (!listening)
      await browser.scripting.executeScript({
        target: { tabId, documentIds: [frame.documentId] },
        files: ['/content-scripts/editor.js'],
      });
    transfers.set(transferId, {
      tabId,
      documentId: frame.documentId,
      platformId,
      files: new Map(record.files.map((file) => [file.id, undefined])),
    });
    const command: EditorCommand = {
      type: 'publishing:fill',
      draftId,
      revision,
      platformId,
      draft: record.draft,
      saveDraft,
      allowOverwrite: request.allowOverwrite === true,
      files: record.files,
      transferId,
    };
    async function operate(message: EditorCommand, fields: EditorResult['fields'] = []): Promise<Attempt> {
      let result: EditorResult;
      try {
        const reply: EditorResult | undefined = await browser.tabs.sendMessage(tabId, message, target);
        if (!reply || reply.platformId !== platformId || !Array.isArray(reply.fields)) throw new Error();
        result = reply;
      } catch {
        result = {
          platformId,
          status: 'failed',
          fields,
          saved: false,
          message: message.saveDraft
            ? '未收到草稿保存结果，请到目标页核对草稿箱。'
            : '目标编辑页可能已跳转或刷新，请检查页面并重新选择标签后继续。',
        };
      }
      const attempt: Attempt = {
        draftId,
        revision,
        tabId,
        platformId,
        time: Date.now(),
        action: message.saveDraft ? 'save' : 'fill',
        result,
      };
      await markAttempt(attempt);
      return attempt;
    }
    const attempt = await operate(command);
    if (
      !saveDraft &&
      request.autoSaveDraft === true &&
      attempt.result.status === 'filled' &&
      (await readDraft(draftId)).revision === revision
    ) {
      return await operate({ ...command, saveDraft: true }, attempt.result.fields);
    }
    return attempt;
  } finally {
    transfers.delete(transferId);
    working.delete(tabId);
  }
}
