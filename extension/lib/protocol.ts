import type { PublishingDraft } from '../../src/publishing/draft';

export type MediaRole = 'image' | 'cover' | 'video';
export interface MediaDescriptor {
  id: string;
  name: string;
  type: string;
  role: MediaRole;
  size: number;
}
export interface EditorCommand {
  type: 'publishing:fill';
  draft: PublishingDraft;
  draftId: string;
  revision: number;
  platformId: string;
  allowOverwrite: boolean;
  saveDraft: boolean;
  files: MediaDescriptor[];
  transferId: string;
}
export interface FieldResult {
  field: string;
  status: 'filled' | 'unchanged' | 'missing' | 'occupied' | 'unsupported' | 'failed';
  message: string;
}
export interface EditorResult {
  platformId: string;
  status: 'filled' | 'partial' | 'needs-login' | 'wrong-page' | 'failed';
  fields: FieldResult[];
  saved: boolean;
  message: string;
}
export type Reply<T> = { ok: true; data: T } | { ok: false; error: string };
export interface Attempt {
  draftId: string;
  revision: number;
  tabId: number;
  platformId: string;
  time: number;
  action: 'fill' | 'save';
  result: EditorResult;
}

export function maySaveDraft(last: Attempt | undefined, revision: number, tabId: number | undefined, platformId: string) {
  if (!last || last.revision !== revision || last.tabId !== tabId || last.platformId !== platformId || last.result.saved) return false;
  return last.action === 'fill' ? last.result.status === 'filled' : last.result.status === 'partial';
}
