import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const url = process.env.DATABASE_URL ?? 'postgresql://f_desk:f_desk@localhost:5432/f_desk'

/**
 * Cliente Drizzle sobre o driver HTTP do Neon: sem pool TCP, indicado para Vercel Functions.
 * A conexão só acontece na primeira query.
 */
export const db = drizzle({ client: neon(url), schema, casing: 'snake_case' })
export type Database = typeof db
