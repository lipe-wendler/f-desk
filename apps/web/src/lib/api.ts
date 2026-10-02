/** Resultado de uma chamada à API: os dados ou a mensagem de erro já pronta para a tela. */
export type ApiResult<T> =
  | { data: T; error: null; status: number }
  | { data: null; error: string; status: number; fields?: Record<string, string> }

/** `fetch` para a nossa API (mesmo domínio, cookie de sessão). Nunca lança. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: init.body ? { 'content-type': 'application/json', ...init.headers } : init.headers,
    })
  } catch {
    return { data: null, error: 'Sem conexão. Confira a internet e tente de novo.', status: 0 }
  }
  const body = (await res.json().catch(() => null)) as
    (T & { error?: string; fields?: Record<string, string> }) | null
  if (!res.ok) {
    return {
      data: null,
      error: body?.error ?? 'Algo deu errado. Tente de novo.',
      status: res.status,
      fields: body?.fields,
    }
  }
  return { data: body as T, error: null, status: res.status }
}
