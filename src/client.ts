import type { RagClientOptions, ChatRequest, ChatResponse, StreamOptions, FeedbackRating, ChatSource } from './types'

/** Map a raw rag-be source object (snake_case) to the SDK ChatSource shape. */
function mapSource(s: Record<string, unknown>): ChatSource {
  return {
    title: s.title as string | undefined,
    url: s.url as string | undefined,
    chunkPreview: s.chunk_preview as string | undefined,
    documentId: s.document_id as string | undefined,
    relevanceScore: s.relevance_score as number | undefined,
  }
}

/** rag-be expects an integer rating 1..5. */
function ratingToInt(rating: FeedbackRating): number {
  return rating === 'helpful' ? 5 : 1
}

export class RagClient {
  private baseUrl: string
  private appToken: string
  private language: string

  constructor(options: RagClientOptions) {
    this.baseUrl = options.ragBaseUrl.replace(/\/$/, '')
    this.appToken = options.appToken
    this.language = options.language || 'id'
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept-Language': this.language,
      'X-App-Token': this.appToken,
    }
  }

  /**
   * Kirim pesan dan terima jawaban lengkap (non-streaming).
   * rag-be membalas response flat: { answer, session_id, message_id, sources, fallback, ... }
   */
  async chat(message: string, options?: Partial<ChatRequest>): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        message,
        session_id: options?.sessionId,
        unit_id: options?.unitId,
        language: options?.language || this.language,
      }),
    })

    if (!res.ok) {
      throw new Error(`RAG API error: ${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    return {
      answer: data.answer,
      sessionId: data.session_id,
      messageId: data.message_id,
      sources: Array.isArray(data.sources) ? data.sources.map(mapSource) : [],
      fallback: Boolean(data.fallback),
      fallbackContacts: data.fallback_contacts ?? null,
      language: data.language ?? this.language,
    }
  }

  /**
   * Kirim pesan dengan streaming SSE (Server-Sent Events).
   */
  async chatStream(message: string, options: StreamOptions): Promise<void> {
    const res = await fetch(`${this.baseUrl}/chat/stream`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        message,
        session_id: options.sessionId,
        unit_id: options.unitId,
        language: this.language,
      }),
    })

    if (!res.ok || !res.body) {
      const err = new Error(`RAG API error: ${res.status}`)
      options.onError?.(err)
      throw err
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          buffer += decoder.decode() // Flush decoder
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            options.onDone?.()
            return
          }

          try {
            const parsed = JSON.parse(data)
            if (parsed.session_id) options.onSessionId?.(parsed.session_id)
            if (parsed.type === 'chunk') options.onChunk?.(parsed.content)
            if (parsed.type === 'sources') {
              options.onSources?.(Array.isArray(parsed.sources) ? parsed.sources.map(mapSource) : [])
            }
            if (parsed.type === 'done') {
              if (parsed.message_id) options.onMessageId?.(parsed.message_id)
              if (Array.isArray(parsed.tools_used) && parsed.tools_used.length) {
                options.onToolsUsed?.(parsed.tools_used)
              }
            }
            if (parsed.type === 'fallback') {
              // rag-be still emits a 'done' (with message_id) + [DONE] after this,
              // so surface the fallback text and keep reading to the end.
              if (options.onFallback) options.onFallback(parsed.content)
              else options.onChunk?.(parsed.content)
            }
            if (parsed.type === 'error') {
              options.onError?.(new Error(parsed.message || 'stream error'))
              return
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    options.onDone?.()
  }

  /**
   * Kirim feedback untuk jawaban. rag-be: { rating: int 1..5, feedback_text }.
   * @param messageId id pesan asisten dari server (lihat onMessageId / ChatResponse.messageId)
   */
  async feedback(messageId: string, rating: FeedbackRating, comment?: string): Promise<void> {
    await fetch(`${this.baseUrl}/chat/${messageId}/feedback`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ rating: ratingToInt(rating), feedback_text: comment }),
    })
  }
}
