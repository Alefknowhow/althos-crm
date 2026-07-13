# Roadmap Meta — Instagram DMs & Comentários (Althos CRM)

Guia executável para colocar as automações de Instagram no ar de forma adequada.
O CRM usa o fluxo **"Instagram API with Instagram Login"** (login direto pela conta
Instagram profissional — **não** exige Página do Facebook nem o fluxo antigo de Pages).

> Tempo estimado: **1–2h de configuração** + **1 a 4 semanas de App Review** da Meta.
> Faça as Fases 1–4 para testar já (modo desenvolvimento) e as Fases 5–6 para ir ao ar público.

---

## Pré-requisitos (você precisa ter)

- [ ] Uma conta **Instagram Profissional** (Comercial ou Criador de Conteúdo).
      Perfil pessoal **não** funciona. Troque em: Instagram → Configurações → Tipo de conta.
- [ ] Conta na **Meta for Developers**: https://developers.facebook.com (login com Facebook).
- [ ] Acesso de administrador ao **Meta Business Suite** (business.facebook.com) — necessário
      para a Verificação de Negócio na Fase 5.
- [ ] O domínio de produção no ar: **https://althoscrm.com.br** (já está).

---

## Fase 1 — Criar o App na Meta

1. Acesse https://developers.facebook.com/apps → **Criar aplicativo**.
2. Caso de uso: escolha **"Outro"** → tipo **"Empresa"** (Business).
3. Dê um nome (ex.: `Althos CRM — Instagram`) e vincule ao seu Portfólio Empresarial
   (Business Portfolio). Se não tiver, crie um.
4. No painel do app, anote o **App ID** e o **App Secret** (Configurações → Básico).
   *(Guarde o App Secret — ele vira variável de ambiente na Fase 4.)*

---

## Fase 2 — Adicionar o produto "Instagram"

1. No painel do app → **Adicionar produto** → **Instagram** → **Configurar**.
2. Abra **"Configuração da API com login do Instagram"**
   (*API setup with Instagram login*).
3. Aqui aparecem o **Instagram App ID** e o **Instagram App Secret** —
   ⚠️ **são estes que o CRM usa**, NÃO os do app do Facebook. Anote os dois.
4. Em **"Permissões de negócios"**, confirme que estas 3 estão listadas
   (o CRM já as solicita no login):
   - `instagram_business_basic`
   - `instagram_business_manage_messages`
   - `instagram_business_manage_comments`

---

## Fase 3 — Registrar o redirect de login e o webhook

### 3.1 OAuth Redirect URI

Em **Instagram → Configuração da API com login do Instagram → Configurações do cliente OAuth**,
adicione exatamente esta URL em **"URIs de redirecionamento OAuth válidos"**:

```
https://althoscrm.com.br/api/social/instagram/callback
```

### 3.2 Webhook (recebe DMs e comentários)

Ainda em Instagram → **Webhooks** (ou Produto Webhooks → Instagram):

- **URL de callback:**
  ```
  https://althoscrm.com.br/api/webhooks/instagram
  ```
- **Token de verificação:** invente uma string segura e **guarde** — ela vira
  `META_WEBHOOK_VERIFY_TOKEN` (Fase 4). Ex.: gere com
  `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
- **Campos a assinar (Subscribe):**
  - [x] `messages` — DMs recebidas
  - [x] `comments` — comentários nos posts
  - [x] `message_reactions` *(opcional)*
  - [x] `mentions` *(opcional — menções em stories/posts)*

> ⚠️ **Não existe** evento de "novo seguidor" na API do Instagram. Por isso o CRM
> usa gatilhos que a API suporta: *comentou no post → DM* e *respondeu story → funil*.

---

## Fase 4 — Variáveis de ambiente na Vercel

Em **Vercel → projeto althos-crm → Settings → Environment Variables**, adicione
(Production + Preview) e depois **Redeploy**:

| Variável | Valor | Onde obter |
|---|---|---|
| `INSTAGRAM_APP_ID` | *(Instagram App ID)* | Fase 2, passo 3 |
| `INSTAGRAM_APP_SECRET` | *(Instagram App Secret)* | Fase 2, passo 3 |
| `META_WEBHOOK_VERIFY_TOKEN` | *(o token que você inventou)* | Fase 3.2 |
| `META_APP_SECRET` | *(App Secret do app Facebook)* | Fase 1, passo 4 *(fallback da assinatura do webhook)* |
| `NEXT_PUBLIC_APP_URL` | `https://althoscrm.com.br` | fixo |

> Depois do redeploy, o botão **"Conectar Instagram"** em
> *Configurações → Social* deixa de mostrar o aviso de "não configurado".

---

## Fase 5 — Verificação de Negócio + App Review (para ir ao ar público)

Enquanto o app está em **modo de desenvolvimento**, só **contas com papel no app**
(você e testers que você adicionar em App Roles → Roles) conseguem conectar e testar.
Para qualquer cliente conectar, precisa passar pelo App Review:

1. **Verificação de Negócio:** Meta Business Suite → Configurações do negócio →
   Segurança → **Verificação de negócios**. Envie CNPJ + documentos da empresa.
   (Pode levar alguns dias.)
2. **App Review:** no painel do app → **Revisão do aplicativo → Permissões e recursos**.
   Solicite (Request advanced access) as 3 permissões da Fase 2. Para cada uma, a Meta
   pede:
   - Descrição do caso de uso (em português/inglês): *"CRM que responde DMs e
     comentários do Instagram do próprio negócio, com automações e atendimento por IA,
     mediante conexão autorizada pelo dono da conta."*
   - **Screencast** mostrando: login/conexão da conta → uma automação respondendo
     uma DM e um comentário reais → onde o usuário gerencia isso no CRM.
   - Instruções de teste passo a passo para o revisor.
3. Aguarde a aprovação (geralmente 1–4 semanas; pode haver idas e voltas).

---

## Fase 6 — Publicar o app (Go Live)

1. Depois das permissões aprovadas, no topo do painel do app troque o modo de
   **Desenvolvimento → Ativo (Live)**.
2. Teste com uma conta que **não** tem papel no app, para confirmar o acesso público.

---

## Checklist de teste (modo desenvolvimento, antes do App Review)

- [ ] `Configurações → Social` → **Conectar Instagram** abre o login do Instagram
      (não o aviso de "não configurado").
- [ ] Após autorizar, a conta aparece conectada (username + foto).
- [ ] Enviar uma DM de teste para a conta → o webhook recebe (ver logs na Vercel:
      `Runtime Logs`, filtrar por `/api/webhooks/instagram`).
- [ ] Uma automação ativa responde a DM/comentário conforme configurado.

---

## Limites da API que moldam o produto (importante)

- **Sem gatilho de novo seguidor** — não existe na API oficial. Automatizar isso por
  fora viola os termos e arrisca banimento. Use *comentou → DM* / *respondeu story → funil*.
- **Janela de 24h** — só é possível enviar DM até 24h após a última mensagem da pessoa.
  Por isso o **funil de conversa** avança a cada resposta dela (cada resposta reabre a
  janela), em vez de disparar mensagens temporizadas sem interação.
- **Tag HUMAN_AGENT** — permite responder até 7 dias depois (para atendimento humano),
  mas exige aprovação específica e não serve para marketing.
- **Rate limits** — respeite os limites de envio da Graph API para não ser bloqueado.

---

## Referências

- Instagram API with Instagram login: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
- Webhooks do Instagram: https://developers.facebook.com/docs/instagram-platform/webhooks
- App Review: https://developers.facebook.com/docs/app-review
