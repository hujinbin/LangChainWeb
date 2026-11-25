import type { PublishingDraft } from './draft';
import type { AgentProject } from '../types/agent';
import type { Execution } from '../types/workflow';
import { asRecord } from '../types/api';

function publishableText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (
    /\b(?:blob:(?:https?:|null\/)|data:(?:,|;base64,|[\w+.-]+\/[\w+.-]+[;,])|Bearer\s+[\w.-]{12,}|sk-[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]+)|-----BEGIN [\w ]*PRIVATE KEY-----/i.test(
      text,
    )
  )
    return '';
  if (
    /(?:api[_-]?key|client[_-]?secret|access[_-]?token|authorization|password)\s*["']?\s*[:=]\s*["']?[\w.-]{4,}/i.test(
      text,
    )
  )
    return '';
  if (
    /https?:\/\/[^\s/]+:[^\s/@]+@|[?&](?:token|signature|x-amz-signature|api[_-]?key|access[_-]?token|client[_-]?secret)=/i.test(
      text,
    )
  )
    return '';
  return text;
}

function media(value: unknown): string {
  if (typeof value !== 'string' || /[\\\s]/.test(value)) return '';
  const relative =
    /^\/(?:outputs\/|api\/ai(?:Workflow\/assets\/|Agents\/projects\/[\w-]+\/assets\/))/.test(value);
  if (!relative && !/^https?:\/\//i.test(value)) return '';
  try {
    const url = new URL(value, window.location.origin);
    if (
      url.username ||
      url.password ||
      [...url.searchParams.keys()].some((key) =>
        /^(?:authorization|api[_-]?key|token|access[_-]?token|client[_-]?secret|signature|x-amz-signature)$/i.test(
          key,
        ),
      )
    )
      return '';
    if (relative && url.pathname !== value.split(/[?#]/)[0]) return '';
    return relative ? url.pathname + url.search : url.href;
  } catch {
    return '';
  }
}

function contentFrom(value: unknown) {
  let finalValue = value;
  // Some response templates return serialized outputs. Select content fields
  // from those objects just as we would from their non-serialized counterparts.
  if (typeof value === 'string' && /^[{[]/.test(value.trim())) {
    try {
      finalValue = JSON.parse(value);
    } catch {
      /* Ordinary prose can start with a bracket. */
    }
  }
  const row = asRecord(finalValue);
  const singleUrl = media(finalValue);
  const path = singleUrl ? new URL(singleUrl, window.location.origin).pathname : '';
  const image = /\.(?:png|jpe?g|webp|gif|avif)$/i.test(path) ? singleUrl : '';
  const clip = /\.(?:mp4|webm|mov)$/i.test(path) ? singleUrl : '';
  const taskComplete =
    !row.status || ['success', 'completed', 'done', 'succeeded'].includes(String(row.status));
  const body =
    [
      typeof finalValue === 'string' && !image && !clip ? finalValue : undefined,
      row.body,
      row.text,
      row.content,
      row.answer,
      taskComplete ? row.message : undefined,
    ]
      .map(publishableText)
      .find(Boolean) || '';
  const candidates = [
    ...(Array.isArray(row.images) ? row.images : []),
    ...(Array.isArray(row.urls) ? row.urls : []),
    row.imageUrl,
    image,
  ];
  const images = [
    ...new Set(
      candidates
        .map((item) => media(typeof item === 'string' ? item : asRecord(item).url))
        .filter(Boolean),
    ),
  ];
  const video = taskComplete ? media(row.videoUrl || row.video_url || row.video || clip) : '';
  return { body, images, video, row };
}

export function isCompletedLiveRun(record: Execution): boolean {
  return (
    record.simulated === false && !record.isLocal && ['success', 'completed'].includes(record.status)
  );
}

export function workflowResultDraft(record: Execution, fallbackTitle: string): PublishingDraft | null {
  if (!isCompletedLiveRun(record)) return null;
  const result = asRecord(record.output).result ?? record.output;
  const final = contentFrom(result);
  const output = final.row;
  const generated = (record.nodeResults || []).filter((node) =>
    ['success', 'completed'].includes(node.status),
  );
  const text = generated
    .filter((node) => node.nodeType === 'llm')
    .map((node) => contentFrom(node.output).body)
    .filter(Boolean);
  const body = final.body || text[text.length - 1] || '';
  const images = final.images.length
    ? final.images
    : [
        ...new Set(
          generated
            .filter((node) => ['imageGeneration', 'imageEdit'].includes(node.nodeType))
            .flatMap((node) => contentFrom(node.output).images),
        ),
      ];
  const video =
    final.video ||
    generated
      .filter((node) => node.nodeType === 'videoGeneration')
      .map((node) => contentFrom(node.output).video)
      .filter(Boolean)
      .pop();
  if (!body && !images.length && !video) return null;
  return {
    title: publishableText(output.title) || publishableText(record.workflowName) || fallbackTitle,
    body,
    images,
    tags: Array.isArray(output.tags) ? output.tags.map(publishableText).filter(Boolean) : [],
    cover: media(output.cover) || images[0],
    video,
  };
}

export function completedVideoDraft(title: string, url: string): PublishingDraft | null {
  const video = media(url);
  return video ? { title: publishableText(title), body: '', images: [], tags: [], video } : null;
}

export function storyboardResultDraft(project: AgentProject): PublishingDraft | null {
  const { draft, results } = project;
  if (!draft?.scenes?.length || !Array.isArray(results)) return null;
  const sceneResults = draft.scenes.map((scene) =>
    results.find(
      (item) =>
        item.sceneId === scene.id && !item.stale && !item.orphaned && item.status === 'completed',
    ),
  );
  const title = publishableText(draft.title) || publishableText(project.name);
  const summary = publishableText(draft.summary);
  if (project.agentId === 'life-story') {
    const video = media(project.output?.videoUrl);
    if (!video || !sceneResults.every(Boolean)) return null;
    return {
      title,
      body: summary,
      tags: [],
      images: [],
      cover: sceneResults.map((result) => media(result?.imageUrl)).find(Boolean),
      video,
    };
  }
  const images = sceneResults.map((result) => media(result?.imageUrl));
  if (!images.every(Boolean)) return null;
  const captions = draft.scenes.map((scene) => publishableText(scene.caption)).filter(Boolean);
  return {
    title,
    body: [summary, ...captions].filter(Boolean).join('\n\n'),
    tags: [],
    images,
    cover: images[0],
  };
}

export function writingDraft(title: string, body: string, tags: string[] = []): PublishingDraft | null {
  const text = publishableText(body);
  return text
    ? {
        title: publishableText(title),
        body: text,
        tags: tags.map(publishableText).filter(Boolean),
        images: [],
      }
    : null;
}
