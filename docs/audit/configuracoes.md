# Auditoria — Módulo Configurações

> Gerado em 2026-07-29. Faz parte da auditoria completa do app. Ver também os demais docs em `docs/audit/`.

## 1. Rotas (todas sob `app/app/[orgSlug]/configuracoes/`)

| Rota | Notas |
|---|---|
| `/configuracoes` (raiz) | Aba "Geral": nicho, dados da empresa, branding, import/export. |
| `/configuracoes/agente-ia` | Config do atendente de IA (8 sub-abas), gateado por feature de plano `ai_attendant`. |
| `/configuracoes/assinatura` | Billing/plano. |
| `/configuracoes/atendente-ia` (+`/faq`) | Redirects legados → `agente-ia`. |
| `/configuracoes/equipe` | Owner/admin apenas (checagem de papel hardcoded). |
| `/configuracoes/google-business` | Conexão OAuth Google Business. |
| `/configuracoes/ia` | "IA Qualificadora" (scoring de leads) — **sem `SettingsTabsNav`**. |
| `/configuracoes/integracoes` | Hub de integrações. |
| `/configuracoes/integracoes/saude` | Dashboard de saúde de integrações (WhatsApp/Email/Inngest/Supabase). |
| `/configuracoes/meta` | Config Meta Pixel/CAPI — **sem `SettingsTabsNav`**. |
| `/configuracoes/notificacoes` | Preferências de notificação. |
| `/configuracoes/organizacoes` | Multi-org/perfil de empresa, owner/admin apenas. |
| `/configuracoes/pipelines` | CRUD de pipelines — **sem `SettingsTabsNav`**. |
| `/configuracoes/seguranca` | Gestão de MFA. |
| `/configuracoes/social` | Conexão Instagram + solicitações de exclusão de dados. |
| `/configuracoes/whatsapp` | Conexão WhatsApp Cloud API. |

**Sem `layout.tsx` compartilhado** — cada página re-renderiza o header "Configurações" + `SettingsTabsNav` de forma independente, ou omite completamente.

## 2. Componentes principais

| Componente | Papel | Problemas encontrados |
|---|---|---|
| `SettingsTabsNav.tsx` | Tira de 7 abas no topo. | `flex overflow-x-auto` sem indicador de scroll/chevron/dropdown — em celular estreito é fácil não perceber que há mais abas fora da tela. Sem auto-scroll pra aba ativa. |
| `OrganizationsClient.tsx` | Perfil da empresa (CNPJ, Cadastur, telefone, etc.) + renomear multi-org. | **Renderizado duas vezes** — na aba Geral e em `/organizacoes` — cada um buscando os mesmos dados independentemente. |
| `CompanyBrandingCard.tsx` | Upload de logo + meta de receita mensal + cor de destaque. | **Mistura 3 preocupações não relacionadas** num só card — o próprio comentário no topo do arquivo diz "o que sobrou de Aparência" após um redesign, ou seja, resíduo acumulado. |
| `PipelinesManager.tsx` | CRUD de pipelines. | Página que a envolve **não inclui `SettingsTabsNav`** — órfã da barra de abas, só alcançável via link em Integrações ou URL direta. |
| `AgenteIaTabs.tsx` (409 linhas) | 8 sub-abas do atendente de IA. | Componente client enorme e único; 3 sub-abas (`fluxos`, `ferramentas`, `memória`) são **placeholders "Em breve" já em produção** — superfície de UI morta sem feature real por trás. Editor de horário de funcionamento por dia da semana é provável ponto de aperto no mobile. |
| `MetaConfigForm.tsx` | Pixel ID + Access Token. | Página sem `SettingsTabsNav`; largura `max-w-2xl` diferente das páginas-hub (`max-w-5xl`) — "salto" visual ao navegar entre abas. |
| `SocialConnectClient.tsx` / `WhatsappEmbeddedSignup`/`WhatsappConfigForm` / `GoogleBusinessConnectClient` | Conexões OAuth/manuais de integrações. | Mesmo padrão: sem `SettingsTabsNav`, larguras inconsistentes. `WhatsappConfigForm` tem um bom padrão de disclosure progressivo (`<details>` pra config manual avançada). |

**Padrão geral**: só 8 das ~15 sub-páginas incluem `SettingsTabsNav` (raiz, agente-ia, assinatura, equipe, notificações, segurança, organizações, hub de integrações). As páginas "folha" de integração (meta, ia, pipelines, social, whatsapp, google-business, integracoes/saude) renderizam **sem barra de abas nenhuma** — ao entrar numa delas, o usuário perde a navegação de configurações por completo.

## 3. Server Actions (`actions/organization.ts`, 732 linhas)

Principais: `getOrgGeneral`/`updateOrgNiche` (nicho, espelhado em `accounts` e `organizations`), `updateOrgAppearance`/`updateOrgBrandAccent` (branding), `getOrgCompany`/`updateOrgCompany` (perfil da empresa — CNPJ, Cadastur, contatos, endereço), `getMonthlyRevenueGoal`/`setMonthlyRevenueGoal`, `getAccountOrganizations`/`renameOrganization`/`updateOrgCompanyById` (multi-org, gateado por `isAccountManager()`), `getOrgMetaConfig`/`saveOrgMetaConfig` (Pixel/CAPI — token nunca exposto ao client, só um booleano), `deleteOrganization` (owner/admin apenas, recusa excluir o último org).

Outras: `actions/team.ts`, `actions/pipeline.ts`, `actions/ai_attendant.ts`, `actions/notifications.ts`, `actions/mfa.ts`, `actions/social-automations.ts`, `actions/data-deletion.ts`, `actions/google-business.ts`, `actions/health.ts`, `actions/referrals.ts`.

## 4. Permissões

**Gating inconsistente e majoritariamente baseado em papel, não em chave de permissão**, apesar de existir uma chave `settings` declarada. **Achado central**: essa chave só é checada em `components/features/Sidebar.tsx` (visibilidade do link) — **nenhuma página em `configuracoes/**` chama `checkMemberPermission(..., 'settings')`**. `equipe`/`organizacoes` fazem uma checagem hardcoded de papel (`owner`/`admin`), bypassando o sistema de permissões granular por completo. Todas as outras sub-páginas (agente-ia, assinatura, notificações, segurança, meta, ia, pipelines, social, whatsapp, google-business, integracoes/saude) **não têm verificação nenhuma** além de ser membro da org — um membro com `settings: false` (padrão) ainda acessa qualquer URL de configurações diretamente, mesmo com o link escondido no menu. `updateOrgCompanyById` e `deleteOrganization` são as únicas duas actions corretamente gateadas no nível de action.

## 5. Conexões com outros módulos

| Campo de configuração | Alimenta | Onde |
|---|---|---|
| `logo_url` | Todo print/view pública | Voucher, contrato, cotação, orçamento, documento gerado, vitrine — praticamente toda superfície de impressão do app |
| `cnpj`/dados da empresa | Mesmo conjunto de views + templates de documento | idem |
| `brand_accent` (`org_settings`) | Estilo do link público de cotação/vitrine | `updateOrgBrandAccent` revalida `/cotacoes` |
| `meta_pixel_id`/`meta_access_token` | Eventos CAPI server-side | `moveLeadToStage` (Pipeline), `submitPublicForm` (Forms) |
| Chave de IA da plataforma | Toda feature de IA do app | extração de documento, insights, qualificador, sandbox do agente-ia |
| `niche` (nível conta, espelhado na org) | Visibilidade de módulo no menu (viagem vs não-viagem), gate de toda a seção "Viagens" das permissões | `updateOrgNiche` revalida o layout |

## 6. Notas de mobile

- Sem hamburger/dropdown pra sub-navegação — único mecanismo adaptativo é o `overflow-x-auto` da `SettingsTabsNav`, sem indicação visual de mais conteúdo fora da tela.
- Essa nav só existe em 7 das ~15 rotas — as demais não têm sub-navegação nenhuma, mobile ou desktop.
- Formulários individuais usam Tailwind empilhado padrão (razoavelmente seguro pra mobile), mas `max-w` inconsistente entre páginas-hub (`max-w-5xl`) e páginas-folha (`max-w-2xl`/`max-w-3xl`) causa "salto" de largura visível ao navegar.
- `AgenteIaTabs` — editor de horário por dia da semana e o chat de sandbox são as áreas de maior risco mobile (não confirmado ao vivo, só revisão estática de código).

## Lista de problemas concretos

1. **[Segurança]** Chave de permissão `settings` efetivamente não aplicada — só visibilidade de menu; `equipe`/`organizacoes` usam checagem de papel hardcoded, bypassando o sistema granular.
2. **Navegação inconsistente**: 7 de ~15 sub-páginas sem `SettingsTabsNav` — ao entrar em Meta/Pipelines/IA/Social/WhatsApp/Google Business/Saúde, o usuário perde a navegação de configurações completamente.
3. **Sem `layout.tsx` compartilhado** — bloco de header "Configurações" + tabs copiado e colado em ~7 arquivos `page.tsx` — risco de dessincronia.
4. **Duplicação de mount**: `OrganizationsClient` renderizado duas vezes (Geral + `/organizacoes`), cada um buscando os mesmos dados independentemente.
5. `CompanyBrandingCard` mistura 3 preocupações não relacionadas (logo, meta de receita, cor de marca) — resíduo de redesign anterior, admitido no próprio comentário do arquivo.
6. **Largura de página inconsistente** — hub usa `max-w-5xl`, várias páginas-folha usam `max-w-2xl`/`max-w-3xl` — "salto" de layout ao navegar entre abas.
7. `AgenteIaTabs` — componente client de 409 linhas com 3 sub-abas "Em breve" já em produção sem feature real.
8. `SettingsTabsNav` sem indicador de overflow/scroll no mobile pra 7 abas.
9. Rotas de redirect legadas (`atendente-ia`, `atendente-ia/faq`) mantidas só por compatibilidade — ok, mas engordam a lista de rotas do módulo.
