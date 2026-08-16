# Etapa 1 — Inventário de Funcionalidades por Nicho

> Primeira etapa da estratégia de plano de pagamentos. Objetivo: listar **todas** as funcionalidades do Althos CRM e mapear quais se aplicam a cada nicho, considerando a **stack finalizada** — ou seja, os módulos de Advocacia, Seguros, Clínicas e Imobiliárias entram aqui como se já estivessem 100% implementados (hoje são especificação/roadmap, não código em produção; ver aviso em cada seção).
>
> Fonte: `docs/inventario-funcionalidades.md` (inventário técnico já existente, mantido junto ao código) + `lib/plans/config.ts` (estado real de gating por plano hoje). Este documento reorganiza essa informação no formato que a etapa 2 (desenho dos planos) vai precisar: matriz de feature × nicho.
>
> **Nichos considerados:** Genérico (todos os nichos, base comum) · Viagens · Clínicas · Imobiliárias · Advocacia · Corretoras de Seguros.

---

## 1. Lista completa de funcionalidades

### 1.1 Vendas & Relacionamento (base — todos os nichos)
| # | Funcionalidade | O que faz |
|---|---|---|
| 1 | Pipeline (Kanban) | Funil de leads/negócios, múltiplos pipelines, etapas customizáveis, drag-and-drop, score/tier de IA, filtros, ações em massa |
| 2 | Contatos | Ficha central de lead/cliente, filtros avançados, parentesco, documentos, tags, filtros salvos, importação em massa |
| 3 | Tarefas | Kanban/Lista/Calendário, vínculo a lead/venda, prioridade e status |
| 4 | Agendamentos | Tipos de evento, página pública de reserva sem login, cálculo automático de slots, vínculo a contato/pipeline |
| 5 | Catálogo & Vendas (genérico) | Produtos/serviços, registro de venda, KPIs de vendas |

### 1.2 Comunicação
| # | Funcionalidade | O que faz |
|---|---|---|
| 6 | Conversas (WhatsApp) | Inbox via API oficial (Cloud API), Embedded Signup, templates aprovados, tags por atendente, envio agendado |
| 7 | Agente de IA no WhatsApp | Responde automaticamente 24/7 — personalidade, base de conhecimento, horário comercial, ferramentas, memória entre conversas, transferência pra humano com resumo, sandbox de teste |
| 8 | Instagram / Social | Inbox de DM/comentário, automações de resposta, funis de conversa, pausa manual da automação |

### 1.3 Marketing
| # | Funcionalidade | O que faz |
|---|---|---|
| 9 | Automações (motor genérico) | Workflows disparados por evento (ex.: submissão de formulário), passos editáveis, estatísticas |
| 10 | Campanhas / Meta Ads | Contas de anúncio, registro de métricas manual/CSV, overview consolidado |
| 11 | CAPI + Pixel (Meta) | Conversão server-side, atribuição de venda a anúncio de origem |
| 12 | Formulários | Construtor de captação (clássico ou "uma pergunta por vez"), página hospedada, insights por formulário |
| 13 | Google Meu Negócio | Conexão OAuth + sincronização de unidades *(fase 1 — só conexão)* |
| 14 | Campanhas de Envio em massa | Disparo de mensagens em lote (WhatsApp/Social) |

### 1.4 Inteligência Artificial
| # | Funcionalidade | O que faz |
|---|---|---|
| 15 | IA Qualificadora (Lead Scoring) | Score 0–100, tier hot/warm/cold, justificativa, tags, objeções — a partir do schema do formulário |
| 16 | Copiloto do Dashboard | Chat de IA em streaming, fixa respostas/cards na tela |
| 17 | Insights automáticos | Detecção de anomalias (ex. gasto fora do padrão) via job agendado |

### 1.5 Plataforma (transversal)
| # | Funcionalidade | O que faz |
|---|---|---|
| 18 | Dashboard (Inicial) | 4 abas, KPIs configuráveis, filtros globais de período/pipeline/vendedor |
| 19 | Relatórios | Exportação PDF/Excel/CSV — Leads, Vendas, Agendamentos, Comissões |
| 20 | Financeiro | Lançamentos manuais + importação CSV, categorias/contas/centros de custo, DRE simplificado, dashboard de fluxo de caixa |
| 21 | Configurações / Equipe | Papéis e permissões granulares por módulo (16 módulos, 4 seções) |
| 22 | Integrações | Hub central + painel de saúde (status, erros, disponibilidade) |
| 23 | Multi-tenant | Mais de uma organização por conta (limite varia por plano) |
| 24 | Créditos de IA | Medição de uso de IA por ação/modelo, pacotes avulsos |

### 1.6 Módulo de Viagens *(único nicho 100% implementado hoje)*
| # | Funcionalidade | O que faz |
|---|---|---|
| 25 | Cotações | Propostas visuais compartilháveis, roteiro dia a dia, orçamento gerado por IA a partir de voucher/PDF |
| 26 | Reservas | Registro operacional da venda, checklist, contrato com modelo, leitura de voucher por IA |
| 27 | Documentos & Modelos (viagens) | Contratos, MEDIF, FREMEC |
| 28 | Bloqueios | Lotes de assento negociados com operadora, controle de disponibilidade |
| 29 | Embarques | Linha do tempo de próximas partidas vendidas |
| 30 | Ofertas | Vitrine de pacotes prontos, conversão em cotação com 1 clique |
| 31 | Créditos de Viagem | Crédito em loja por cancelamento, aplicável em vendas futuras |

### 1.7 Módulo de Advocacia *(roadmap — considerado completo nesta análise)*
| # | Funcionalidade | O que faz |
|---|---|---|
| 32 | Processos | Registro central do caso, checklist processual, tarefas automáticas |
| 33 | Prazos (Agenda Processual) | Prazo fatal em dias úteis, alertas escalonados, dashboard de próximos prazos |
| 34 | Documentos & Modelos Jurídicos | Petições/procurações/contratos de honorários com merge-fields |
| 35 | Honorários | Fixo/hora/êxito, parcelamento, custas reembolsáveis |
| 36 | Propostas de Honorários | Proposta formal, link público, conversão em Processo + Contrato |

### 1.8 Módulo de Seguros *(roadmap — considerado completo nesta análise)*
| # | Funcionalidade | O que faz |
|---|---|---|
| 37 | Apólices | Cadastro por ramo, checklist, upload + endossos |
| 38 | Renovações | Painel 30/60/90 dias, disparo automático de tarefa/WhatsApp |
| 39 | Sinistros | Abertura, checklist de documentos, linha do tempo, notificação ao cliente |
| 40 | Comissões (seguros) | % por seguradora/ramo, cálculo automático, conciliação esperado × pago |
| 41 | Cotações Comparativas | Comparativo entre seguradoras, PDF, conversão em Apólice |

### 1.9 Módulo de Clínicas *(roadmap — considerado completo nesta análise)*
| # | Funcionalidade | O que faz |
|---|---|---|
| 42 | Prontuário / Ficha de Atendimento | Histórico clínico, fotos antes/depois, termo de consentimento |
| 43 | Pacotes de Sessões | Saldo de sessões, baixa automática, alerta de vencimento |
| 44 | Estoque de Insumos | Baixa automática por atendimento, alerta de estoque/validade |
| 45 | Comissão por Profissional | % por profissional/procedimento, cálculo automático |

### 1.10 Módulo de Imobiliárias *(roadmap — considerado completo nesta análise)*
| # | Funcionalidade | O que faz |
|---|---|---|
| 46 | Catálogo de Imóveis | Cadastro com campos do setor, galeria de fotos, busca/filtro |
| 47 | Match Lead × Imóvel | Cruzamento automático de perfil de busca com imóveis disponíveis |
| 48 | Controle de Visitas | Agendamento vinculado ao imóvel, feedback pós-visita, histórico |
| 49 | Documentos & Propostas | Proposta de compra/locação + contrato via merge-fields |
| 50 | Comissão por Corretor | % por corretor/tipo de operação, cálculo automático |

---

## 2. Matriz Feature × Nicho

Legenda: ✅ se aplica diretamente · 🔧 reaproveitado sem alteração (módulo genérico já cobre) · — não se aplica

| Funcionalidade | Genérico | Viagens | Clínicas | Imobiliárias | Advocacia | Seguros |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Pipeline | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Contatos | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Tarefas | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Agendamentos | ✅ | — | 🔧 (core) | 🔧 (visitas) | 🔧 (audiências) | — |
| Catálogo & Vendas (genérico) | ✅ | — | — | — | — | — |
| Conversas (WhatsApp) | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Agente de IA no WhatsApp | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Instagram / Social | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Automações (motor) | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Campanhas / Meta Ads | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| CAPI + Pixel | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Formulários | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Google Meu Negócio | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Campanhas de Envio (bulk) | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| IA Qualificadora | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Copiloto do Dashboard | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Insights automáticos | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Dashboard | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Relatórios | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Financeiro | ✅ | 🔧 | 🔧 (comissão) | 🔧 (comissão) | 🔧 (honorários) | 🔧 (comissão) |
| Configurações / Equipe | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Integrações | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Multi-tenant | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Créditos de IA | ✅ | 🔧 | 🔧 | 🔧 | 🔧 | 🔧 |
| Cotações (viagem) | — | ✅ | — | — | — | — |
| Reservas | — | ✅ | — | — | — | — |
| Documentos/Modelos (viagem: MEDIF/FREMEC) | — | ✅ | — | — | — | — |
| Bloqueios | — | ✅ | — | — | — | — |
| Embarques | — | ✅ | — | — | — | — |
| Ofertas | — | ✅ | — | — | — | — |
| Créditos de Viagem | — | ✅ | — | — | — | — |
| Processos | — | — | — | — | ✅ | — |
| Prazos (Agenda Processual) | — | — | — | — | ✅ | — |
| Documentos/Modelos Jurídicos | — | — | — | — | ✅ | — |
| Honorários | — | — | — | — | ✅ | — |
| Propostas de Honorários | — | — | — | — | ✅ | — |
| Apólices | — | — | — | — | — | ✅ |
| Renovações | — | — | — | — | — | ✅ |
| Sinistros | — | — | — | — | — | ✅ |
| Comissões (seguros) | — | — | — | — | — | ✅ |
| Cotações Comparativas | — | — | — | — | — | ✅ |
| Prontuário / Ficha de Atendimento | — | — | ✅ | — | — | — |
| Pacotes de Sessões | — | — | ✅ | — | — | — |
| Estoque de Insumos | — | — | ✅ | — | — | — |
| Comissão por Profissional | — | — | ✅ | — | — | — |
| Catálogo de Imóveis | — | — | — | ✅ | — | — |
| Match Lead × Imóvel | — | — | — | ✅ | — | — |
| Controle de Visitas | — | — | — | ✅ | — | — |
| Documentos & Propostas (imóveis) | — | — | — | ✅ | — | — |
| Comissão por Corretor | — | — | — | ✅ | — | — |

**Leitura:** a base "Genérico" (24 funcionalidades) é 100% comum a todos os nichos — é o que já existe hoje pra Clínicas e Imobiliárias, que ainda não têm módulo próprio. Cada nicho soma sua camada de 5–7 funcionalidades exclusivas por cima dessa base. Viagens é o único módulo verticalizado já em produção; Advocacia, Seguros, Clínicas e Imobiliárias estão no estado "roadmap" (ver avisos nas seções 1.7–1.10).

---

## 3. Estado atual de cobrança (referência — antes da nova estratégia)

Snapshot do que já existe em código (`lib/plans/config.ts`), pra servir de ponto de partida/comparação na etapa 2:

- **Planos hoje:** Starter (R$137/mês) · Pro (R$397/mês) · Business (R$697/mês) — desconto 10% semestral / 18% anual. *(Existe um plano "Free" ainda definido no código com todos os recursos zerados, mas — conforme já alinhado — não é mais oferecido; o modelo atual é só teste grátis de 14 dias.)*
- **Critério de diferenciação atual:** majoritariamente **volume de uso** (pipelines, automações, contas sociais, clientes, usuários, orgs), não recursos — a maioria das funcionalidades já está disponível a partir do Starter.
- **Únicos recursos hoje travados a Pro/Business:** WhatsApp, Insights com IA, Exportar relatórios, Automação de Instagram, Campanhas de Envio em massa.
- **Multi-tenant:** Starter = 1 org · Pro = até 5 · Business = ilimitado.
- **Créditos de IA mensais:** Starter 300 · Pro 1200 · Business 3000 (custo por ação/modelo, + pacotes avulsos).
- **Módulos por nicho (Viagens) hoje:** não têm gate de plano próprio — ficam disponíveis a quem tem `organizations.niche = viagens`, dentro do plano contratado.

---

## Próximos passos (fora do escopo desta etapa)

1. Definir o **critério de segmentação dos planos**: por nicho, por volume, por combinação dos dois, ou por camada de módulo (base + add-on de nicho).
2. Decidir se os módulos de nicho (Viagens, e futuramente Advocacia/Seguros/Clínicas/Imobiliárias) são **inclusos no plano** ou **add-on pago à parte**.
3. Redesenhar a tabela de preços com base na matriz da seção 2.
4. Revisar créditos de IA e limites de uso por plano à luz do novo desenho.
