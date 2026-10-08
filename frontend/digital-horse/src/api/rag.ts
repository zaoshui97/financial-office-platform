import { http } from '@/utils/request';

export interface KnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  created_at: string;
}

export interface RagDocument {
  id: number;
  knowledge_base_id: number;
  original_filename: string;
  file_type: string;
  file_size: number;
  status: 'processing' | 'parsed' | 'failed';
  page_count: number | null;
  parsed_char_count: number;
  error_message: string | null;
  index_status: 'pending' | 'building' | 'indexed' | 'failed';
  index_error: string | null;
  indexed_at: string | null;
  index_collection: string | null;
  created_at: string;
}

export interface DocumentNormalization {
  document_id: number;
  status: 'normalized' | 'legacy_or_unavailable';
  normalization_version: string | null;
  content_hash: string | null;
  normalized_char_count: number;
  chunk_count: number;
}

export interface RagDocumentContent extends RagDocument {
  parsed_text: string;
}

type ApiPromise<T> = Promise<T>;

export const ragApi = {
  listKnowledgeBases: () =>
    http.get<KnowledgeBase[]>('/rag/knowledge-bases') as unknown as ApiPromise<KnowledgeBase[]>,

  createKnowledgeBase: (data: { name: string; description?: string }) =>
    http.post<KnowledgeBase>('/rag/knowledge-bases', data) as unknown as ApiPromise<KnowledgeBase>,

  listDocuments: (knowledgeBaseId: number) =>
    http.get<RagDocument[]>(`/rag/knowledge-bases/${knowledgeBaseId}/documents`) as unknown as ApiPromise<RagDocument[]>,

  uploadDocument: (knowledgeBaseId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<RagDocument>(`/rag/knowledge-bases/${knowledgeBaseId}/documents`, form) as unknown as ApiPromise<RagDocument>;
  },

  getDocument: (documentId: number) =>
    http.get<RagDocument>(`/rag/documents/${documentId}`) as unknown as ApiPromise<RagDocument>,

  getDocumentContent: (documentId: number) =>
    http.get<RagDocumentContent>(`/rag/documents/${documentId}/content`) as unknown as ApiPromise<RagDocumentContent>,

  getNormalization: (documentId: number) =>
    http.get<DocumentNormalization>(`/rag/documents/${documentId}/normalization`) as unknown as ApiPromise<DocumentNormalization>,

  indexDocument: (documentId: number, rebuild = false) =>
    http.post<RagDocument>(`/rag/documents/${documentId}/${rebuild ? 'reindex' : 'index'}`) as unknown as ApiPromise<RagDocument>,

  deleteDocument: (documentId: number) =>
    http.delete<void>(`/rag/documents/${documentId}`) as unknown as ApiPromise<void>,
};

export default ragApi;
