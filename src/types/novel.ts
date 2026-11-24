export interface NovelSettings {
  genre: string;
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
}

export interface NovelOutline {
  synopsis: string;
  worldview: string;
  characters: NovelCharacter[];
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
