import { useEffect, useRef, useState } from 'react';
import { FiSend } from 'react-icons/fi';
import { useLabels } from '../store/languageStore';
import type { PublishingDraft } from '../publishing/draft';
import { PublisherUnavailable, sendDraft } from '../publishing/bridge';

export default function SendToPublisher({ draft }: { draft: PublishingDraft }) {
  const t = useLabels();
  const active = useRef<AbortController | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'install' | 'done' | 'partial' | 'error'>('idle');
  const [details, setDetails] = useState('');
  useEffect(() => () => active.current?.abort(), []);
  async function send() {
    if (active.current) return;
    const request = new AbortController();
    active.current = request;
    setState('sending');
    try {
      const missing = await sendDraft(draft, request.signal);
      if (!request.signal.aborted) setState(missing ? 'partial' : 'done');
    } catch (e) {
      if (request.signal.aborted) return;
      setState(e instanceof PublisherUnavailable ? 'install' : 'error');
      setDetails(e instanceof Error ? e.message : '');
    } finally { active.current = null; }
  }
  return <div className="publisher-handoff">
    <button type="button" className="text-action" data-zhiflow-publish="" onClick={send} disabled={state === 'sending'}><FiSend aria-hidden="true" /> {state === 'sending' ? t('正在传送…', 'Sending…') : t('发送到发布助手', 'Send to publisher')}</button>
    <span role="status">
      {state === 'done' && t('草稿已传入。请打开浏览器工具栏的织流发布助手，选择平台。', 'Draft imported. Open the publisher in the browser toolbar and select a platform.')}
      {state === 'partial' && t('草稿已传入。请在插件中核对素材，缺失的可从本地补选。', 'Draft imported. Check the attachments in the extension and choose local files for any that are missing.')}
      {state === 'error' && (details || t('导入失败，请重试。', 'Import failed. Try again.'))}
      {state === 'install' && <><a href="/downloads/zhiflow-publisher.zip" download>{t('下载 Chrome 插件', 'Download Chrome extension')}</a>{t('，解压后在 chrome://extensions 开启开发者模式，加载解压目录，再刷新此页。自建站点请使用包含本站域名的插件。', '. Unzip it, enable Developer mode in chrome://extensions, load the unpacked folder, then refresh this page. For self-hosting, use a build for this domain.')}</>}
    </span>
  </div>;
}
