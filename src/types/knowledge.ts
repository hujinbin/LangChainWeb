export interface KnowledgeBaseInput {
  name: string;
  description?: string;
  indexMode?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  scoreThreshold?: number;
  enabled?: boolean;
}

export interface KnowledgeBase extends KnowledgeBaseInput {
  id: string;
  status?: string;
  documentCount?: number;
  chunkCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeConfig {
  configured: boolean;
  modes?: string[];
  acceptedFileTypes?: string[];
  maxFileBytes?: number;
  defaults?: Partial<KnowledgeBaseInput>;
}

export interface KnowledgeChunk {
  id?: string;
  index: number;
  content: string;
  characters?: number;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  sourceName?: string;
  sourceType?: string;
  status: string;
  enabled?: boolean;
  chunkCount?: number;
  updatedAt?: string;
  error?: string;
  errorMessage?: string;
}

export interface DocumentDetail extends KnowledgeDocument {
  totalChunks?: number;
  chunks: KnowledgeChunk[];
}

export interface ImportPreview {
  totalChunks: number;
  totalCharacters?: number;
  chunks: KnowledgeChunk[];
}

export interface Citation {
  id?: string;
  documentId?: string;
  title?: string;
  sourceName?: string;
  chunkIndex?: number;
  score: number;
  content: string;
}

export interface RetrievalResult {
  query: string;
  documents: Citation[];
}

export interface KnowledgeImportInput {
  name: string;
  text: string;
  chunkSize: number;
  chunkOverlap: number;
}

export interface KnowledgePage<T> {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
}
