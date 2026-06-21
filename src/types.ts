/** Opsi konfigurasi RAG Client */
export interface RagClientOptions {
  /** URL RAG service (contoh: https://rag.universitas.ac.id/v1) */
  ragBaseUrl: string
  /** Token dari sistem SDM (header X-App-Token) */
  appToken: string
  /** Bahasa default ('id' | 'en'), default: 'id' */
  language?: 'id' | 'en'
}

/** Request chat */
export interface ChatRequest {
  message: string
  sessionId?: string
  unitId?: number
  language?: 'id' | 'en'
}

/** Response chat (non-streaming) — sesuai response flat rag-be */
export interface ChatResponse {
  answer: string
  sessionId: string
  /** id pesan asisten di server, dipakai untuk feedback */
  messageId?: string
  sources: ChatSource[]
  fallback: boolean
  fallbackContacts?: Record<string, unknown> | null
  language: string
}

/** Sumber referensi jawaban */
export interface ChatSource {
  title?: string
  url?: string
  chunkPreview?: string
  documentId?: string
  relevanceScore?: number
}

/** Opsi streaming */
export interface StreamOptions {
  sessionId?: string
  unitId?: number
  onChunk: (text: string) => void
  onSources?: (sources: ChatSource[]) => void
  onSessionId?: (sessionId: string) => void
  /** dipanggil saat event 'done' membawa id pesan server (untuk feedback) */
  onMessageId?: (messageId: string) => void
  /** dipanggil saat jawaban adalah fallback (RAG tak menemukan konteks relevan). Bila tak diset, fallback diperlakukan sebagai chunk biasa. */
  onFallback?: (content: string) => void
  /** dipanggil saat event 'done' membawa daftar tool/sumber data yang dipakai agen. */
  onToolsUsed?: (tools: string[]) => void
  onDone?: () => void
  onError?: (error: Error) => void
}

/** Feedback rating */
export type FeedbackRating = 'helpful' | 'not_helpful'

/** Chat message untuk UI */
export interface ChatMessage {
  id: string
  /** id pesan asisten di server (dari event 'done'); dibutuhkan untuk feedback */
  messageId?: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: ChatSource[]
  isFallback?: boolean
  isError?: boolean
}
