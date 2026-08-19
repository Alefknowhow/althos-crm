# Backup & Disaster Recovery — Fase 1 (Backup)

> Fase 1 cobre **só backup** (banco + storage), não restore. Restore
> (completo/por-tenant/por-arquivo) e validação em staging ficam pra
> uma Fase 2 separada — ver seção "O que não existe ainda" no final.

## Arquitetura

```
Supabase Postgres (SUPABASE_DB_URL)
        │  dump lógico (JSON por tabela, gzip, AES-256-GCM)
        ▼
althos-backups (R2)  ←──────────────┐
        ▲                            │  download+upload (sem egress no R2)
        │  cópia incremental         │
Cloudflare R2 (althos-production)    │
        +                            │
12 buckets legados do Supabase Storage
```

Dois buckets Cloudflare R2, **mesma conta, credenciais separadas**:

| | `althos-production` | `althos-backups` |
|---|---|---|
| Uso | Storage operacional (avatares, anexos, mídia) | Só backup |
| Credenciais | `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` | `R2_BACKUP_ACCESS_KEY_ID`/`R2_BACKUP_SECRET_ACCESS_KEY` |
| Quem acessa | Toda a aplicação (Server Actions, webhooks) | Só `lib/backup/*` e o dashboard read-only |

Não há reaproveitamento de credencial entre os dois — a credencial de
backup nem tem permissão de leitura no bucket de produção (por isso o
backup de storage faz download+upload em vez de `CopyObject`
server-side, que exigiria uma credencial com acesso aos dois buckets).

## Estrutura do bucket `althos-backups`

```
database/
  daily/{YYYY-MM-DD}.enc      — dump completo do banco, criptografado
  weekly/{YYYY-MM-DD}.enc     — cópia extra aos domingos
  monthly/{YYYY-MM-DD}.enc    — cópia extra no dia 1
tenants/{orgId}/storage/...   — espelho dos objetos R2 (storage_objects, provider='r2')
legacy-supabase/{bucket}/...  — espelho dos 12 buckets legados do Supabase Storage
manifests/
  daily/{type}-{YYYY-MM-DD}.json
  weekly/...
  monthly/...
```

## Backup do banco

`lib/backup/db-dump.ts` conecta via `pg` (driver Postgres nativo,
`SUPABASE_DB_URL`) — não invoca o binário `pg_dump` (indisponível numa
function serverless da Vercel). Enumera as tabelas de `public`
dinamicamente via `information_schema.tables` (nunca hardcoda nome de
tabela — a lista muda a cada migration), lê cada uma com `SELECT *`,
serializa como JSON (`{ tabela: [rows...] }`), comprime com gzip,
calcula SHA-256, criptografa com AES-256-GCM (`lib/backup/crypto.ts`,
chave em `BACKUP_ENCRYPTION_KEY`) e sobe pro bucket de backup.

**Verificação obrigatória**: depois do upload, o job baixa o objeto de
volta, descriptografa, descomprime e confere que o JSON é válido e tem
o número esperado de tabelas — só marca `backup_runs.status = 'success'`
se isso passar. Se a verificação falhar, o status vira `'invalid'`
(nunca `'success'` — regra do plano original).

**Limitação conhecida**: não é um dump SQL binário restaurável direto
com `pg_restore`. É uma cópia lógica completa (toda linha, toda coluna,
tipos preservados via JSON) — suficiente pra reconstruir os dados, mas
o restore (Fase 2) precisa de um script próprio que faça `INSERT`
tabela-a-tabela a partir desse JSON, não um `pg_restore` de linha de
comando.

## Backup do storage

`lib/backup/storage-backup.ts`, dois caminhos:

1. **`storage_objects` (R2 novo)** — incremental: só processa linhas com
   `updated_at` mais recente que o último `backup_runs` de storage
   bem-sucedido. Baixa via `StorageService.download` (produção, leitura)
   e sobe pro bucket de backup em `tenants/{orgId}/storage/{key}`.
2. **12 buckets legados do Supabase Storage** (`whatsapp-media`,
   `contato-avatars`, etc. — lista completa em
   `LEGACY_SUPABASE_BUCKETS`, `lib/backup/storage-backup.ts`) — arquivos
   enviados antes da Storage Service existir nunca ganharam linha em
   `storage_objects`, então são listados direto do bucket (recursivo,
   até 4 níveis) e copiados se ainda não existirem no destino (bucket
   legado é efetivamente imutável — uploads antigos usavam `upsert:false`).

Objeto com `status='deleted'` em `storage_objects`: já foi removido do
R2 de produção, mas a cópia no bucket de backup permanece até expirar
pela retenção — é assim que a "retenção de arquivo excluído" (seção 10
do plano original) funciona, sem mecanismo extra.

## Manifests

Cada run grava um JSON em `manifests/{tier}/{type}-{data}.json`
(`lib/backup/manifest.ts`) com `backup_id`, `timestamp`, `tenant_count`,
`object_count`, tamanhos, `checksum`, `status`, `duration_ms`. Responde
"o que exatamente está protegido neste backup?" sem precisar abrir o
dump.

## Criptografia e credenciais

- Dumps do banco: AES-256-GCM (`lib/backup/crypto.ts`), chave em
  `BACKUP_ENCRYPTION_KEY` (32 bytes, base64). **Nunca commitada, nunca
  logada.** Perder essa chave torna os dumps já feitos irrecuperáveis —
  guarde uma cópia fora da Vercel.
- Objetos de storage: não são recriptografados no backup (já não eram
  criptografados na produção — são servidos via signed URL, não bucket
  público). Avaliar criptografia adicional se o requisito mudar.
- `SUPABASE_DB_URL` e as credenciais `R2_BACKUP_*` só são lidas dentro
  de `lib/backup/*` e `lib/inngest/backup-cron.ts` — nunca em Server
  Action de fluxo de usuário.

## Jobs (Inngest)

Registrados em `app/api/inngest/route.ts`, arquivo
`lib/inngest/backup-cron.ts`:

| Function | Cron (UTC) | O que faz |
|---|---|---|
| `backup-database` | `0 3 * * *` | dump + criptografia + upload + verificação |
| `backup-storage` | `30 3 * * *` | cópia incremental do storage (R2 + legado) |
| `backup-retention` | `0 4 * * *` | apaga dump/manifest expirado pela política |

## Retenção

`lib/backup/retention.ts` — política atual (constantes, trocar ali até
existir configuração dedicada):

- Diário: 30 dias
- Semanal: 12 semanas (84 dias)
- Mensal: 12 meses (360 dias)

Um backup vira "semanal" aos domingos e "mensal" no dia 1 (além do
diário de sempre) — grava cópia extra nesses tiers. A retenção só
apaga objetos cuja key tem data reconhecível (`database/{tier}/{data}.enc`,
`manifests/{tier}/{type}-{data}.json`) — nunca apaga algo sem conseguir
extrair a data, por segurança.

## RPO / RTO

- **RPO atual**: até 24h (backup diário) — perda máxima de dados em um
  desastre é o que mudou desde o último backup bem-sucedido.
- **RTO**: não medido ainda — não existe procedimento de restore
  automatizado (Fase 2). Um restore manual hoje envolveria baixar o
  dump, descriptografar, e escrever um script pontual de `INSERT` — não
  é um processo de poucos cliques.

## Custo estimado

Volume atual (checado em produção): banco ~23MB, `storage_objects` com
poucas dezenas de linhas + os 12 buckets legados (volume não medido
precisamente, mas pequeno — estágio inicial do produto). R2 não cobra
egress; custo é só armazenamento (Storage Standard, ~$0,015/GB/mês) +
requests (Class A/B, volume desprezível neste estágio). Com retenção de
30/84/360 dias e volume atual, custo mensal estimado: **menos de
$1/mês**. Vale reavaliar quando o volume passar de alguns GB.

## Como escalar

**Pra 100 GB**: o dump do banco em memória (JSON completo antes de
gzip) passa a ser um ponto de atenção — trocar por streaming
tabela-a-tabela direto pro upload (não montar o JSON inteiro em
memória) antes de chegar nesse volume. O backup de storage já é
incremental por natureza, escala linear com o que muda por dia, não com
o total.

**Pra 1 TB**: considerar mover o backup de storage pra rodar como job
separado por tenant (paralelizar), e o dump do banco pra usar streaming
`COPY` via `pg-copy-streams` em vez de `SELECT *` em memória. A
abstração de bucket/provider já existe (`lib/backup/r2-backup-client.ts`
isolado) — trocar de storage não exige reescrever o resto.

## O que não existe ainda (Fase 2)

- `restoreTenant(tenantId, backupId)`, `restoreObject(...)`, restore
  completo.
- Teste de restore em staging (não existe staging hoje).
- Ações destrutivas no dashboard (`/super-admin/backups` é read-only).
- `BackupProvider` formal pra outro storage (S3/Backblaze B2) — hoje só
  R2, credenciais isoladas mas sem abstração de multi-provider.
- Suíte de testes que dependa de um restore real.

Ver `docs/backup-operations.md` pro runbook operacional (como checar
status, disparar manualmente, o que fazer quando um alerta chega).
