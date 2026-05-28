# Guia de Deploy — Althos CRM

Passo a passo completo para colocar o CRM no ar: GitHub → Vercel → Supabase produção → domínio → Asaas.  
Tempo estimado: **1–2 horas** na primeira vez.

---

## Índice

1. [Criar repositório no GitHub](#1-criar-repositório-no-github)
2. [Deploy na Vercel](#2-deploy-na-vercel)
3. [Variáveis de ambiente na Vercel](#3-variáveis-de-ambiente-na-vercel)
4. [Conectar domínio personalizado](#4-conectar-domínio-personalizado)
5. [Aplicar migrations no Supabase produção](#5-aplicar-migrations-no-supabase-produção)
6. [Criar bucket de storage](#6-criar-bucket-de-storage)
7. [Definir conta super-admin](#7-definir-conta-super-admin)
8. [Configurar webhook Asaas](#8-configurar-webhook-asaas)
9. [Registrar endpoint do Inngest](#9-registrar-endpoint-do-inngest)
10. [Checklist final](#10-checklist-final)

---

## 1. Criar repositório no GitHub

> Faça isso **antes** de vincular à Vercel — ela importa direto do repo.

```bash
# No terminal, dentro da pasta do projeto
cd C:\projetos\Althos-crm

# Inicializa git (se ainda não tiver)
git init
git add .
git commit -m "chore: initial commit"

# Cria o repo no GitHub (requer gh CLI instalado)
gh repo create althos-crm --private --source=. --push
```

**Se preferir pela interface:**
1. Acesse github.com → **New repository** → nome `althos-crm` → **Private** → Create
2. Copie os comandos exibidos ("…or push an existing repository") e rode no terminal

> ✅ Confirme que o push funcionou visitando `github.com/seu-usuario/althos-crm`

---

## 2. Deploy na Vercel

1. Acesse **vercel.com** → **Add New… → Project**
2. Clique em **Import Git Repository** e selecione `althos-crm`
3. Na tela de configuração:
   - **Framework Preset**: Next.js (detectado automaticamente)
   - **Root Directory**: `.` (deixar padrão)
   - **Build Command**: `next build` (padrão)
   - **Output Directory**: `.next` (padrão)
4. **NÃO clique em Deploy ainda** — primeiro configure as env vars (passo 3)

---

## 3. Variáveis de ambiente na Vercel

Na mesma tela de configuração → seção **Environment Variables**, adicione cada variável abaixo.  
Alternativa: **Settings → Environment Variables** após o projeto estar criado.

### Supabase
| Variável | Onde obter |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → Project API Keys → `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → Project API Keys → `service_role` ⚠️ secreto |

### Asaas
| Variável | Onde obter |
|---|---|
| `ASAAS_API_KEY` | Asaas → Configurações → Integrações → Chave de API |
| `ASAAS_API_URL` | `https://api.asaas.com/v3` (produção) |
| `ASAAS_WEBHOOK_TOKEN` | Você define — qualquer string aleatória segura (ex: `openssl rand -hex 32`) |

### Resend (e-mail transacional)
| Variável | Onde obter |
|---|---|
| `RESEND_API_KEY` | resend.com → API Keys → Create API Key |
| `RESEND_WEBHOOK_SECRET` | Resend → Webhooks → endpoint → Signing Secret (formato `whsec_...`) |

### Inngest (filas e crons)
| Variável | Onde obter |
|---|---|
| `INNGEST_EVENT_KEY` | app.inngest.com → Manage → Event Keys |
| `INNGEST_SIGNING_KEY` | app.inngest.com → Manage → Signing Key |

### Meta / WhatsApp
| Variável | Onde obter |
|---|---|
| `META_WHATSAPP_TOKEN` | Meta for Developers → seu App → WhatsApp → API Setup |
| `META_WEBHOOK_VERIFY_TOKEN` | Você define — qualquer string (ex: `althos_verify_2024`) |
| `META_APP_SECRET` | Meta → App → Settings → Basic → App Secret |

### Web Push (PWA)
| Variável | Onde obter / fazer |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Já está no `.env.example` — use os valores gerados |
| `VAPID_PRIVATE_KEY` | Idem |
| `VAPID_SUBJECT` | `mailto:seu@email.com` |

> **Dica:** copie os valores do seu `.env.local` para a Vercel. O VAPID já foi gerado — não regenere ou as assinaturas push existentes quebram.

### Cloudflare Turnstile (opcional)
Se quiser proteção anti-bot nos formulários públicos:
| Variável | Onde obter |
|---|---|
| `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY` | dash.cloudflare.com → Turnstile → Add site |
| `CLOUDFLARE_TURNSTILE_SECRET` | Idem |

> Pode deixar em branco inicialmente — o honeypot e rate limit já protegem.

---

### Depois de preencher todas as variáveis

Clique em **Deploy**. O build leva ~2 minutos.  
URL temporária: `althos-crm-xxx.vercel.app`

---

## 4. Conectar domínio personalizado

1. Vercel → seu projeto → **Settings → Domains**
2. Clique em **Add** → digite `althos.io` (ou o seu domínio)
3. A Vercel mostrará os registros DNS que você precisa criar:
   - Registro **A** apontando para `76.76.21.21`  
   - **OU** registro **CNAME** apontando para `cname.vercel-dns.com`
4. Vá ao painel do seu provedor de domínio (Registro.br, GoDaddy, Cloudflare…) e crie os registros
5. Aguarde a propagação (em geral 5–30 minutos)
6. Vercel confirma com ✅ verde quando validado

> **Se usar Cloudflare:** desative o proxy (nuvem laranja → cinza) para o registro do domínio principal; a Vercel precisa validar o TLS.

---

## 5. Aplicar migrations no Supabase produção

Você tem **44 migration files** em `supabase/migrations/`. Existem duas formas:

### Opção A — Supabase CLI (recomendado)

```bash
# Instale o CLI se ainda não tiver
npm install -g supabase

# Login
supabase login

# Linke ao projeto de produção
# O project-ref está na URL do dashboard: https://app.supabase.com/project/<project-ref>
supabase link --project-ref SEU_PROJECT_REF

# Aplique todas as migrations pendentes
supabase db push
```

O CLI compara o histórico local com o banco e aplica apenas o que falta.

### Opção B — SQL Editor manual (sem CLI)

Se não quiser instalar o CLI, cole e execute cada arquivo `.sql` na ordem:  
**Supabase Dashboard → SQL Editor → New Query**

Ordem obrigatória (execute um por vez):
```
0001_initial_schema.sql
0002_seed_dev.sql        ← PULE em produção (dados de teste)
0003_create_org_function.sql
0004_automations.sql
0005_super_admin.sql
0010_billing.sql
0011_update_create_org_function.sql
0012_create_org_manual_function.sql
0015_onboarding_and_polish.sql
0020_catalog.sql
0021_dashboard_aggregations.sql
0022_sales.sql
0023_automations_repair.sql
0024_performance_indexes.sql
0025_saved_filters.sql
0026_ai_qualifier.sql
0027_email_templates_pro.sql
0028_appointments.sql
0029_dashboard_pipeline_filter.sql
0030_appointments_extend.sql
0031_automations_updated_at_repair.sql
0032_marketing.sql
0033_ai_attendant.sql
0034_ai_insights.sql
0035_customers.sql
0036_anti_spam.sql
0037_push_subscriptions.sql
0038_tasks_push_notified.sql
0039_leads_last_activity.sql
0040_insights_safeguard.sql
0041_meta_integration.sql
0042_pipeline_stage_won.sql
0043_form_assets_bucket.sql   ← cria o bucket form-assets
0044_invite_links.sql
```

> ⚠️ **Pule o `0002_seed_dev.sql`** — ele insere dados fictícios de desenvolvimento.

---

## 6. Criar bucket de storage

A migration `0043` cria a **política RLS** do bucket, mas o bucket em si precisa ser criado manualmente:

1. Supabase Dashboard → **Storage → New bucket**
2. Nome: `form-assets`
3. Marque **Public bucket** ✅
4. File size limit: `5242880` (5 MB)
5. Allowed MIME types: `image/jpeg,image/png,image/webp,image/gif,image/svg+xml`
6. Clique em **Save**

> Se já rodou a migration 0043 antes de criar o bucket, o bucket já existe — ignore o erro "bucket already exists".

---

## 7. Definir conta super-admin

Execute no **SQL Editor** do Supabase (substitua pelo seu e-mail):

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"is_super_admin": true}'::jsonb
WHERE email = 'aleftrentin@gmail.com';
```

Depois:
1. Crie sua conta normalmente em `althos.io/signup`
2. Acesse `althos.io/super-admin` — você será redirecionado corretamente

> O middleware verifica `user_metadata.is_super_admin === true` — esse SQL é o que faz funcionar.

---

## 8. Configurar webhook Asaas

O Asaas precisa de uma URL pública para notificar pagamentos. Faça isso **depois** de ter o domínio configurado.

### 8.1 Definir o ASAAS_WEBHOOK_TOKEN

Gere um token seguro:
```bash
# No terminal
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copie o resultado e adicione como `ASAAS_WEBHOOK_TOKEN` na Vercel (Settings → Environment Variables).  
**Redeploy** o projeto para a variável entrar em vigor.

### 8.2 Registrar a URL no Asaas

1. Acesse **app.asaas.com** (conta de produção)
2. Vá em **Configurações → Integrações → Webhooks**
3. Clique em **Adicionar webhook**
4. URL: `https://althos.io/api/webhooks/asaas`
5. Token de autenticação: o mesmo valor que você colocou em `ASAAS_WEBHOOK_TOKEN`
6. Selecione os eventos:
   - ✅ `PAYMENT_RECEIVED`
   - ✅ `PAYMENT_CONFIRMED`
   - ✅ `PAYMENT_OVERDUE`
   - ✅ `SUBSCRIPTION_CREATED`
   - ✅ `SUBSCRIPTION_UPDATED`
   - ✅ `SUBSCRIPTION_DELETED`
7. Salve e clique em **Testar** — deve retornar `200 OK`

### 8.3 Trocar para API de produção

Confirme que a variável `ASAAS_API_URL` na Vercel está como:
```
https://api.asaas.com/v3
```
(e **não** `sandbox.asaas.com`)

---

## 9. Registrar endpoint do Inngest

O Inngest precisa descobrir as suas funções background (qualificação IA, automações, crons).

1. Acesse **app.inngest.com** → seu app → **Manage → Apps**
2. Clique em **Sync App**
3. URL: `https://althos.io/api/inngest`
4. Clique em **Sync** — o Inngest listará todas as funções registradas

> Isso precisa ser refeito toda vez que você **adicionar novas funções Inngest**. Mudanças em funções existentes são detectadas automaticamente no próximo deploy.

---

## 10. Checklist final

Execute estes testes manuais depois do deploy completo:

### Autenticação e planos
- [ ] Acessar `althos.io` — landing page carrega
- [ ] `althos.io/signup` sem convite → cria conta no plano trial (7 dias)
- [ ] `althos.io/login` → redireciona para `/onboarding` após login
- [ ] Conta trial bloqueada após 7 dias → redireciona para `/upgrade`
- [ ] `althos.io/super-admin` com conta super-admin → painel abre
- [ ] Super-admin cria convite → link `/invite/[token]` funciona
- [ ] Cadastro via link de convite → org vai para plano correto sem Asaas

### Formulários e storage
- [ ] Criar formulário, fazer upload de imagem → imagem aparece na preview
- [ ] Formulário público (sem login) → upload não é permitido (só admin)
- [ ] Submissão de formulário público → lead criado

### Billing (Asaas)
- [ ] Clicar em "Assinar Starter" na página de upgrade → redireciona para boleto Asaas
- [ ] Simular pagamento no sandbox primeiro, confirmar que webhook chega (logs Vercel)
- [ ] Após webhook `PAYMENT_CONFIRMED` → org.plan = 'starter', status = 'active'

### WhatsApp / Meta
- [ ] Configurar número no painel → verificar token
- [ ] Enviar mensagem teste → aparece no feed do lead

### E-mail
- [ ] Enviar e-mail de teste via Resend → chega na caixa
- [ ] Webhook de bounce → status atualizado

### Inngest
- [ ] app.inngest.com → Functions → ver funções listadas
- [ ] Acionar qualificação IA em um lead → função dispara, logs aparecem

---

## Variáveis obrigatórias — resumo rápido

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=

INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

META_WHATSAPP_TOKEN=
META_WEBHOOK_VERIFY_TOKEN=
META_APP_SECRET=

ASAAS_API_KEY=
ASAAS_API_URL=https://api.asaas.com/v3
ASAAS_WEBHOOK_TOKEN=

NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

---

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Build falha com "Module not found" | Dependência não instalada | `npm install` local + commit do `package-lock.json` |
| `/super-admin` retorna 404 | Conta sem `is_super_admin: true` | Rodar o UPDATE no SQL Editor |
| Webhook Asaas retorna 401 | Token errado ou env var não aplicada | Confirmar `ASAAS_WEBHOOK_TOKEN` + redeploy |
| Storage upload falha | Bucket não criado ou RLS bloqueando | Criar bucket manualmente no Dashboard |
| Inngest sem funções | Endpoint não sincronizado | Sync App no painel do Inngest |
| E-mail não chega | Domínio não verificado no Resend | Resend → Domains → Add + configurar DNS |
| Redirecionamento infinito no `/upgrade` | Header `x-pathname` não configurado | Confirmar que `middleware.ts` está no projeto e deployed |
