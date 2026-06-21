import { ref, type Ref } from 'vue'
import { RagClient } from './client'
import type { RagClientOptions, ChatMessage, FeedbackRating, ChatSource } from './types'

/**
 * Vue 3 composable untuk integrasi RAG chatbot.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useRagChat } from '@universitas/rag-sdk/vue'
 *
 * const { messages, isStreaming, sendMessage } = useRagChat({
 *   ragBaseUrl: 'https://rag.universitas.ac.id/v1',
 *   appToken: 'your-token-here',
 * })
 * </script>
 * ```
 */
export function useRagChat(options: RagClientOptions) {
  const client = new RagClient(options)

  const messages: Ref<ChatMessage[]> = ref([])
  const sessionId: Ref<string> = ref('')
  const isStreaming = ref(false)

  const sendMessage = async (text: string, unitId?: number) => {
    if (!text.trim() || isStreaming.value) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    messages.value.push(userMsg)

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      sources: [],
    }
    messages.value.push(assistantMsg)

    isStreaming.value = true

    try {
      await client.chatStream(text, {
        sessionId: sessionId.value || undefined,
        unitId,
        onChunk: (chunk: string) => {
          assistantMsg.content += chunk
          messages.value = [...messages.value]
        },
        onSources: (sources: ChatSource[]) => {
          assistantMsg.sources = sources
        },
        onSessionId: (id: string) => {
          sessionId.value = id
        },
        onMessageId: (id: string) => {
          assistantMsg.messageId = id
          messages.value = [...messages.value]
        },
        onDone: () => {},
        onError: () => {
          assistantMsg.content = options.language === 'en'
            ? 'Sorry, an error occurred. Please try again.'
            : 'Maaf, terjadi kesalahan. Silakan coba lagi.'
          assistantMsg.isError = true
          messages.value = [...messages.value]
        },
      })
    } catch {
      if (!assistantMsg.content) {
        assistantMsg.content = 'Maaf, terjadi kesalahan. Silakan coba lagi.'
        assistantMsg.isError = true
        messages.value = [...messages.value]
      }
    } finally {
      isStreaming.value = false
    }
  }

  const sendFeedback = async (messageId: string, rating: FeedbackRating, comment?: string) => {
    try {
      await client.feedback(messageId, rating, comment)
    } catch {
      // Silent fail
    }
  }

  const clearChat = () => {
    messages.value = []
    sessionId.value = ''
  }

  return {
    messages,
    sessionId,
    isStreaming,
    sendMessage,
    sendFeedback,
    clearChat,
  }
}
