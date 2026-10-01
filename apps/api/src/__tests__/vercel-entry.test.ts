import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const apiDir = fileURLToPath(new URL('../..', import.meta.url))

describe('entrada da Vercel (api/index.js)', () => {
  beforeAll(() => {
    execFileSync('node', ['build.mjs'], { cwd: apiDir, stdio: 'ignore' })
  }, 60_000)

  it('encaminha /api/health para o app empacotado', async () => {
    // @ts-expect-error -- arquivo JS gerado fora do projeto TS
    const entry = await import('../../../../api/index.js')
    const res: Response = await entry.GET(new Request('https://f-desk.vercel.app/api/health'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
