export interface NovelSettings {
  genre: string;
  audience: string;
  perspective: string;
  length: string;
  chapterCount: number;
  targetWords: number;
  textModel: string;
}

export interface NovelCharacter {
  name: string;
  role: string;
  description: string;
}

export interface NovelOutlineChapter {
  id: string;
  index: number;
  title: string;
  summary: string;
  volume?: string;
}

export interface NovelSettingCard {
  synopsis: string;
  worldview: string;
  conflict?: string;
  characters: NovelCharacter[];
}

export interface NovelOutline extends NovelSettingCard {
  chapters: NovelOutlineChapter[];
}

export interface NovelChapter extends NovelOutlineChapter {
  content?: string;
  wordCount: number;
  status: 'pending' | 'running' | 'done' | 'failed' | string;
  error?: string;
  updatedAt?: string | null;
}

export interface NovelJob {
  id: string;
  kind: string;
  status: string;
  stage: string;
  progress: number;
  error?: string;
  errorCode?: string;
  chapterId?: string;
  startedAt?: string;
  finishedAt?: string;
  billing?: { pointsCharged: number; totalTokens: number | null; status: string };
}

export interface NovelProject {
  id: string;
  agentId: string;
  name: string;
  genre: string;
  synopsis: string;
  style: string;
  settings: NovelSettings;
  outline: NovelOutline | null;
  settingCard?: NovelSettingCard | null;
  outlineHistory?: Array<{ outline: NovelOutline; savedAt: string }>;
  chapters: NovelChapter[];
  job: NovelJob | null;
  revision: number;
  totalWords: number;
  doneChapters: number;
  createdAt: string;
  updatedAt: string;
}

export interface NovelCatalog {
  agent: {
    id: string;
    name: string;
    description: string;
    defaults: NovelSettings;
    limits: { minChapters: number; maxChapters: number; minWords: number; maxWords: number };
  };
  genres: string[];
  options?: Record<'audience' | 'perspective' | 'length', string[]>;
  models: { text: string[]; image: string[]; video: string[]; embedding: string[] };
  defaults: NovelSettings;
}

export interface NovelPage {
  items: NovelProject[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NovelCreateInput {
  name: string;
  genre?: string;
  synopsis?: string;
  style?: string;
  settings?: Partial<NovelSettings>;
}

export type NovelExportFormat = 'txt' | 'md' | 'docx' | 'epub';
export type NovelMode = 'generate' | 'continue' | 'expand' | 'polish' | 'rewrite';
