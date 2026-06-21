# @universitas/rag-sdk — SDK JS/TS untuk Chatbot RAG UIN Suska Riau

Klien JavaScript/TypeScript untuk [rag-be](../rag-be) (`/v1/chat`,
`/v1/chat/stream`, feedback) + composable Vue 3 & hook React. Library — bukan
service yang di-deploy. ESM + CJS, dengan tipe.

- Paket: `@universitas/rag-sdk` v1.0.0 · subpath: `.`, `./vue`, `./react`

## Instalasi
```bash
npm install @universitas/rag-sdk
```
Di monorepo ini, web-fe memakainya via link lokal: `"@universitas/rag-sdk": "file:../rag-sdk-js"`.

## Build (untuk pengembangan SDK)
```bash
npm install
npm run build        # tsup → dist/ (esm+cjs+dts). Jalankan setelah ubah src/.
```

## Konfigurasi
Tanpa file config. Opsi diberikan ke `RagClient`/composable:
- `ragBaseUrl` — mis. `https://rag.uin-suska.ac.id/v1`
- `appToken` — `X-App-Token`; boleh kosong bila rag-be publik (`APP_TOKENS=[]`), **wajib** bila diproteksi.
- `language` — `'id' | 'en'`.

## Penggunaan

### Vanilla JS/TS
```ts
import { RagClient } from '@universitas/rag-sdk'

const client = new RagClient({ ragBaseUrl: 'https://rag.uin-suska.ac.id/v1', appToken: '' })
const res = await client.chat('Bagaimana cara mendaftar?')
console.log(res.answer)

// streaming
await client.chatStream('Apa itu PPID?', {
  sessionId: res.sessionId,         // lanjut percakapan (multi-turn)
  onChunk: (c) => process.stdout.write(c),
  onSessionId: (id) => { /* simpan id */ },
})
```

### Vue 3 / Nuxt
```ts
import { useRagChat } from '@universitas/rag-sdk/vue'
const { messages, isStreaming, sendMessage, clearChat } = useRagChat({
  ragBaseUrl: 'https://rag.uin-suska.ac.id/v1', appToken: '',
})
```

### React
```tsx
import { useRagChat } from '@universitas/rag-sdk/react'
const { messages, isStreaming, sendMessage } = useRagChat({ ragBaseUrl: '...', appToken: '' })
```

### API
- `new RagClient({ ragBaseUrl, appToken, language? })`
  - `chat(message, opts?) → Promise<ChatResponse>`
  - `chatStream(message, StreamOptions) → Promise<void>` (callback: `onChunk`, `onSources`, `onSessionId`, `onMessageId`, `onFallback`, `onToolsUsed`, `onDone`, `onError`)
  - `feedback(messageId, 'helpful'|'not_helpful', comment?) → Promise<void>`
- Composable/hook `useRagChat(options)` → `{ messages, sessionId, isStreaming, sendMessage, sendFeedback, clearChat }`.

> Multi-turn: teruskan `sessionId` antar pesan (composable/hook menanganinya otomatis). Untuk persistensi lintas halaman, simpan `sessionId` + `messages` (mis. localStorage) — lihat `web-fe/app/composables/useChat.ts`. Rate limit rag-be: chat 30/menit/IP (tangani error 429).
