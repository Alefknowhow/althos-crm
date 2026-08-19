/**
 * Dump lógico do Postgres via conexão direta (SUPABASE_DB_URL) — não
 * invoca o binário `pg_dump` (não disponível numa function serverless
 * da Vercel); em vez disso, lê cada tabela via SQL e serializa como
 * JSON, o que preserva tipos ricos do schema (jsonb, array, timestamp)
 * com mais fidelidade que CSV. Não é um dump binário do Postgres, mas é
 * uma cópia lógica completa e restaurável de cada linha de cada tabela.
 *
 * Tabelas são enumeradas DINAMICAMENTE via information_schema — nunca
 * hardcoda nome de tabela, porque a lista muda a cada migration nova.
 */

import { Client } from 'pg'
import { gzipSync, gunzipSync } from 'zlib'

function sslConfig() {
  // Supabase (pooler ou direct) exige TLS; certificado não é validável
  // contra a cadeia padrão do Node em alguns modos de pooler — mesmo
  // trade-off aceito por outras ferramentas que conectam no Supabase via
  // connection string direta (a conexão em si já é autenticada por
  // usuário/senha; isso só relaxa a validação do certificado do lado do
  // transporte).
  return { rejectUnauthorized: false }
}

export type TableDump = Record<string, any[]>

/** Lista as tabelas base do schema `public` — exclui views e tabelas de
 *  sistema. Chamado a cada dump, nunca cacheado, pra sempre refletir o
 *  schema real no momento do backup. */
async function listTables(client: Client): Promise<string[]> {
  const res = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  )
  return res.rows.map(r => r.table_name)
}

/** Executa o dump completo — conecta, lê todas as tabelas, desconecta.
 *  Retorna o buffer já comprimido (gzip) e a lista de tabelas incluídas. */
export async function dumpDatabase(): Promise<{ compressed: Buffer; tables: string[]; rowCounts: Record<string, number> }> {
  const connectionString = process.env.SUPABASE_DB_URL
  if (!connectionString) throw new Error('SUPABASE_DB_URL não configurado.')

  const client = new Client({ connectionString, ssl: sslConfig() })
  await client.connect()

  try {
    const tables = await listTables(client)
    const dump: TableDump = {}
    const rowCounts: Record<string, number> = {}

    for (const table of tables) {
      // Identificador vem de information_schema (não é input externo),
      // mas mesmo assim usa identificador entre aspas duplas — nunca
      // interpola direto em SQL sem isso.
      const res = await client.query(`SELECT * FROM "${table}"`)
      dump[table] = res.rows
      rowCounts[table] = res.rowCount ?? res.rows.length
    }

    const json = JSON.stringify({ version: 1, dumpedAt: new Date().toISOString(), tables: dump })
    const compressed = gzipSync(Buffer.from(json, 'utf-8'))
    return { compressed, tables, rowCounts }
  } finally {
    await client.end()
  }
}

/** Descomprime e reidrata um dump — usado pela verificação pós-upload
 *  (baixa, descriptografa, descomprime, confere que ainda é JSON válido
 *  com as tabelas esperadas) e, futuramente, pelo restore (Fase 2). */
export function decodeDump(compressed: Buffer): { version: number; dumpedAt: string; tables: TableDump } {
  const json = gunzipSync(compressed).toString('utf-8')
  return JSON.parse(json)
}
