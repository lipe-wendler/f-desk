import type { ChatEvent, ChatRequest } from '@f-desk/shared'

export type ChatSendResult =
  { ok: true } | { ok: false; status: number; error: string; retryAfter?: number }

/** Lê um corpo NDJSON e entrega cada linha completa como evento. */
export async function readNdjson(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatEvent) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    let newline = buffer.indexOf('\n')
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line) onEvent(JSON.parse(line) as ChatEvent)
      newline = buffer.indexOf('\n')
    }
    if (done) break
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as ChatEvent)
}

/** Envia a mensagem para `POST /api/chat` e repassa a resposta conforme ela chega. */
export async function streamChat(
  request: ChatRequest,
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<ChatSendResult> {
  let res: Response
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      credentials: 'same-origin',
      signal,
    })
  } catch {
    return { ok: false, status: 0, error: 'Sem conexão. Confira a internet e tente de novo.' }
  }

  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    const retryAfter = Number(res.headers.get('retry-after')) || undefined
    return {
      ok: false,
      status: res.status,
      error: data?.error ?? 'Não consegui enviar a mensagem. Tente de novo.',
      retryAfter,
    }
  }

  await readNdjson(res.body, onEvent)
  return { ok: true }
}
