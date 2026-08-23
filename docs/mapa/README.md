# Mapa Completo do Althos CRM

> Gerado em 2026-08-22, baseado no código em HEAD (`22a4c2a`). Mapeamento técnico do sistema inteiro — Core + cada vertical — servindo de base para (1) atualizar a central de ajuda e (2) gerar documentação por módulo. Reflete o código real, não a intenção de produto; confira contra `docs/audit/*.md` (auditorias pontuais anteriores, algumas usadas como insumo aqui) quando precisar de mais profundidade num módulo específico.

## Como este mapa está organizado

Cada vertical roda **em cima** do Core (nunca substituindo suas telas — Pipeline, Contatos, Tarefas, Financeiro etc. são sempre os mesmos, por trás de toda organização). O que muda de vertical pra vertical é:
1. **Módulos exclusivos** que só aparecem pra aquele nicho (ex.: Cotações em Viagens, Apólices em Seguros).
2. **Pontos de extensão no Core** — telas/actions genéricas que ganham um `if` condicional pra se comportar diferente naquele nicho (ex.: Contatos ganha bloco de "Créditos de Viagem"; Vendas vira "assinatura de plano com contrato" em Tráfego).

Por isso, **todo documento de vertical tem uma seção "Onde esta vertical modifica o Core"** — é o detalhamento pedido explicitamente: sempre que uma vertical mexe num módulo compartilhado em vez de viver isolada na própria pasta, está listado ali com arquivo:linha.

## Documentos

| Documento | Conteúdo | Módulos/seções |
|---|---|---|
| [00-core.md](00-core.md) | CRM genérico — todo nicho tem acesso | Dashboard, Pipeline, Contatos, Tarefas, Conversas (WhatsApp), Social (Instagram), Agente de IA, Automações, Financeiro, Formulários públicos, Marketing/Anúncios, Campanhas de Envio, Configurações, Permissões, Billing/Planos, Super-admin, Relatórios, Saúde das integrações, Backup & DR, Command Palette, Notificações, Agendamentos, Catálogo/Vendas |
| [01-viagens.md](01-viagens.md) | Agência de Viagens (`isTravelNiche`) | Cotações, Ofertas, Reservas, Bloqueios, Embarques, Documentos, Roteirista, Explorar Voos (não implementado), Créditos de Viagem |
| [02-trafego.md](02-trafego.md) | Agência de Tráfego (`isTrafficNiche`) | Clientes de Tráfego, Painel do cliente, Planos (Catálogo reaproveitado), Vendas→assinatura com contrato, `plan_contracts`, Dashboard Tráfego |
| [03-clinicas.md](03-clinicas.md) | Clínicas (`isClinicNiche`) | Fundação, Lembrete automático, Orçamentos, Atendimentos, Tratamentos/Pacotes, Lista de Espera, Comissões, Retornos, Dashboard clínico, LGPD, Eventos de automação, Copiloto IA |
| [04-imoveis.md](04-imoveis.md) | Imobiliárias (`isRealEstateNiche`) | Cadastro de imóveis, Match lead×imóvel, Matching por IA, Visitas, Propostas (multi-imóvel + link público), Negociação/Fechamento, Pipeline dedicado, Dashboard |
| [05-seguros.md](05-seguros.md) | Corretora de Seguros (`isInsuranceNiche`) | Produtos de Seguro, Seguradoras, Cotações (comparação), Apólices (comissão parcelada), Lembrete de renovação, Sinistros |

**Advocacia** (`NICHE_OPTIONS` em `lib/niche.ts`) não tem documento — só existe como opção de nicho + landing page institucional (`app/(public)/advocacia/page.tsx`); zero funcionalidade construída até o momento.

## Achados que atravessam vários documentos (vale ler antes de usar o mapa)

Coisas que apareceram de forma consistente em mais de um agente e que valem a atenção do dono do produto antes de virar central de ajuda/doc por módulo:

1. **Enforcement de permissão é majoritariamente client-side.** Quase todo módulo do Core (Pipeline, Contatos, Tarefas, WhatsApp, Automações, Financeiro, Marketing, Configurações) tem Server Actions que nunca chamam `checkMemberPermission` — a única barreira real hoje é a Sidebar esconder o link. Não é um bug de uma vertical, é um padrão repetido no Core inteiro (ver `00-core.md`, seção 14). Vale uma tarefa própria de hardening antes de crescer a base de usuários por org.
2. **Financeiro existe só pra Viagens hoje**, mesmo sendo dado/lógica 100% genéricos — `app/app/[orgSlug]/financeiro/page.tsx` redireciona se a org não for `isTravelNiche`. Seguros já injeta comissão parcelada direto na tabela (`financial_entries`) sem passar pela tela — ou seja, o dado já é multi-vertical, só a tela não está liberada ainda.
3. **Vazamento cross-tenant possível em Marketing**: `docs/audit/marketing.md` (usado como insumo pelo agente do Core) flagou que `getMarketingOverview` não filtra `organization_id` numa query de atribuição de lead sobre `form_submissions`. Precisa reconfirmar se já foi corrigido — não foi verificado nesta rodada de mapeamento.
4. **Padrão consistente e saudável**: nenhuma vertical criou um "motor paralelo" pra automação, agenda ou financeiro — todas plugam eventos no motor de automação genérico (`lib/inngest/automation.ts`) e reaproveitam `tasks`/`financial_entries`/`contatos` em vez de duplicar tabela. As duas exceções deliberadas e documentadas são: **Pipeline imobiliário** (tabela própria `pipelines.kind='imoveis'`, convive com o Pipeline genérico) e **Visitas de imóveis** (`property_visits` própria, em vez de `appointments`, por não encaixar no fluxo de agendamento público genérico).
5. **Tráfego é a vertical com mais pontos de modificação do Core** (14, contra ~10 das outras) — por reaproveitar Catálogo/Vendas via reskinning condicional em vez de ter telas 100% próprias como Viagens/Clínicas/Imóveis/Seguros. Se a central de ajuda for organizada por "isso é exclusivo de Tráfego" vs. "isso é Vendas normal", essa vertical vai exigir mais cuidado editorial que as demais.
6. **Catálogo/Vendas é a área com mais mudança em andamento agora** — commits recentes (`38d4cbd`…`22a4c2a`) reformularam Vendas→assinatura de plano especificamente para Tráfego. Bom lugar pra revisar antes de congelar a doc como "central de ajuda oficial".

## Próximos passos sugeridos

1. Revisar os 6 documentos (principalmente as seções "Onde modifica o Core" e os achados acima) e confirmar/corrigir com quem construiu cada vertical.
2. A partir daqui, gerar a central de ajuda (público final) filtrando cada documento pelo que é relevante pro usuário final (não pro desenvolvedor) — arquivo:linha e nome de tabela ficam de fora dessa camada.
3. Gerar documentação por módulo (público interno/dev) reaproveitando a estrutura "O que é / Funcionalidades / Arquivos / Conexões" já usada em cada seção destes documentos.
