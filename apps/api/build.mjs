// Empacota o app Hono (com @f-desk/* e dependências) num único ESM para a Vercel Function.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/app.ts'],
  outfile: 'dist/app.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  // Pacotes CJS dentro do bundle ESM ainda chamam `require`.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
})
