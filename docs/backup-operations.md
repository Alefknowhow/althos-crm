# Backup — Runbook Operacional

Ver `docs/backup-disaster-recovery.md` pra arquitetura completa. Este
documento é só o "o que fazer quando" do dia a dia.

## Checar status

`/super-admin/backups` (precisa de conta super-admin) mostra o último
backup de banco e de storage, tamanho, duração, e o histórico das
últimas 30 execuções.

Via SQL (Supabase MCP ou painel), pra checar rapidamente:

```sql
select type, status, started_at, completed_at, duration_ms, error_message
from backup_runs
order by started_at desc
limit 10;
```

## Configuração inicial (uma vez)

1. **Bucket R2 de backup**: Cloudflare dashboard → R2 → Create bucket →
   `althos-backups` (mesma conta do `althos-production`).
2. **Token de API escopado**: Cloudflare dashboard → R2 → Manage API
   Tokens → Create API Token → "Object Read & Write", restrito ao
   bucket `althos-backups` (NÃO usar um token com acesso a todos os
   buckets). Guarda `Access Key ID` e `Secret Access Key`.
3. **Connection string do Postgres**: Supabase dashboard → botão
   "Connect" (topo da página do projeto) → aba "Session pooler" → copia
   a connection string, substitui `[YOUR-PASSWORD]` pela senha do
   banco.
4. **Chave de criptografia**: gerar uma vez com
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   — guardar uma cópia fora da Vercel (gerenciador de senhas).
5. Adicionar todas as env vars na Vercel (`R2_BACKUP_ACCESS_KEY_ID`,
   `R2_BACKUP_SECRET_ACCESS_KEY`, `R2_BACKUP_BUCKET_NAME`,
   `SUPABASE_DB_URL`, `BACKUP_ENCRYPTION_KEY`, `BACKUP_ALERT_EMAIL`) —
   ver `.env.example` pro nome exato de cada uma.
6. Deploy — os crons (`0 3 * * *`, `30 3 * * *`, `0 4 * * *`, todos UTC)
   começam a rodar automaticamente no próximo horário agendado.

## Disparar um backup manualmente

Ainda não existe um botão no dashboard (Fase 1 é read-only). Pra testar
sem esperar o cron:

1. Local: subir o Inngest Dev Server (`npx inngest-cli@latest dev`) com
   o app rodando, e disparar a function `backup-database` ou
   `backup-storage` pela UI do Inngest Dev Server (localhost:8288).
2. Produção: pelo painel do Inngest Cloud (se configurado), invocar a
   function manualmente — mesmo mecanismo já usado pras outras crons
   do projeto.

## Quando um alerta de falha chega

O e-mail (`BACKUP_ALERT_EMAIL`) chega com `run_id` e a mensagem de
erro. Passos:

1. Ver a linha em `backup_runs` (`select * from backup_runs where id = '<run_id>'`)
   — `error_message` tem o detalhe.
2. Causas mais prováveis:
   - **`SUPABASE_DB_URL não configurado`** — env var ausente/errada.
   - **Erro de conexão SSL** — connection string errada (confirmar que
     é a de "Session pooler", não "Direct connection" — a Vercel não
     lida bem com IPv6).
   - **`Bucket de backup R2 não configurado`** — alguma env var
     `R2_BACKUP_*` faltando.
   - **Verificação falhou (`status='invalid'`)** — o dump subiu, mas o
     round-trip (baixar + descriptografar + descomprimir) não bateu com
     o esperado. Investigar antes de confiar no próximo backup — pode
     ser sintoma de `BACKUP_ENCRYPTION_KEY` errada ou corrupção em
     trânsito.
3. Depois de corrigir a causa raiz, o próximo cron (ou disparo manual)
   resolve sozinho — não precisa de nenhuma limpeza manual pro backup
   de banco (upload é idempotente, mesma key do dia sobrescreve).

## Rotação de credenciais

Se a credencial `R2_BACKUP_*` vazar ou precisar trocar:

1. Cloudflare → revogar o token antigo, criar um novo (mesmo escopo:
   só o bucket `althos-backups`).
2. Atualizar `R2_BACKUP_ACCESS_KEY_ID`/`R2_BACKUP_SECRET_ACCESS_KEY` na
   Vercel.
3. Redeploy.

Trocar `BACKUP_ENCRYPTION_KEY` é mais delicado: dumps já feitos com a
chave antiga só descriptografam com ela — troque só se tiver certeza
de que não vai precisar restaurar um backup anterior à troca, ou
mantenha a chave antiga guardada separadamente "pro caso".

## Limitações conhecidas desta fase

- Sem restore automatizado — ver `docs/backup-disaster-recovery.md`
  seção final.
- Sem staging pra testar restore com segurança.
- Backup do banco carrega o dump inteiro em memória antes de subir —
  ok pro volume atual (~23MB), reavaliar se passar de alguns GB (ver
  seção "Como escalar" no doc de arquitetura).
