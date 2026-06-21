import { useState, useCallback, useRef } from 'react'
import { RagClient } from './client'
import type { RagClientOptions, ChatMessage, FeedbackRating, ChatSource } from './types'

/**
 * React hook untuk integrasi RAG chatbot.
 *
 * @example
 * ```tsx
 * import { useRagChat } from '@universitas/rag-sdk/react'
 *
 * function ChatWidget() {
 *   const { messages, isStreaming, sendMessage } = useRagChat({
 *     ragBaseUrl: 'https://rag.universitas.ac.id/v1',
 *     appToken: 'your-token-here',
 *   })
 *
 *   return <div>{messages.map(m => <p key={m.id}>{m.content}</p>)}</div>
 * }
 * ```
 */
export function useRagChat(options: RagClientOptions) {
  const clientRef = useRef(new RagClient(options))
  const sessionIdRef = useRef('')
  const streamingRef = useRef(false)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const sendMessage = useCallback(async (text: string, unitId?: number) => {
    if (!text.trim() || streamingRef.current) return

    streamingRef.current = true
    setIsStreaming(true)

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    const assistantId = crypto.randomUUID()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      sources: [],
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])

    const contentRef = { current: '' }

    try {
      await clientRef.current.chatStream(text, {
        sessionId: sessionIdRef.current || undefined,
        unitId,
        onChunk: (chunk: string) => {
          contentRef.current += chunk
          const snapshot = contentRef.current
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: snapshot } : m,
          ))
        },
        onSources: (sources: ChatSource[]) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, sources } : m,
          ))
        },
        onSessionId: (id: string) => {
          sessionIdRef.current = id
          setSessionId(id)
        },
        onMessageId: (id: string) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, messageId: id } : m,
          ))
        },
        onDone: () => {},
        onError: () => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, content: 'Maaf, terjadi kesalahan. Silakan coba lagi.', isError: true }
              : m,
          ))
        },
      })
    } catch {
      if (!contentRef.current) {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Maaf, terjadi kesalahan.', isError: true }
            : m,
        ))
      }
    } finally {
      streamingRef.current = false
      setIsStreaming(false)
    }
  }, [])

  const sendFeedback = useCallback(async (messageId: string, rating: FeedbackRating, comment?: string) => {
    try {
      await clientRef.current.feedback(messageId, rating, comment)
    } catch {
      // Silent fail
    }
  }, [])

  const clearChat = useCallback(() => {
    setMessages([])
    setSessionId('')
    sessionIdRef.current = ''
  }, [])

  return {
    messages,
    sessionId,
    isStreaming,
    sendMessage,
    sendFeedback,
    clearChat,
  }
}
