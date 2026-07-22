# Inventário de Funcionalidades — Althos CRM

> Documento-base para organizar o site institucional: o que o produto faz, módulo a módulo, com foco no que resolve pra quem usa. Reflete o estado real do código nesta data — não é copy de marketing, é a fonte de verdade pra escrever a copy.

---

## 1. Vendas & Relacionamento (todos os nichos)

### Pipeline
**O que é:** Funil kanban de leads/negócios, organizado por etapas configuráveis, do primeiro contato ao fechamento.
**Principais recursos:**
- Múltiplos pipelines por organização, com seletor e pipeline padrão
- Arrastar e soltar leads entre etapas (drag-and-drop)
- Etapas customizáveis (nome, cor, ordem), com marcação de etapa "ganho"/"perdido"
- Score e tier de IA por lead, com qualificação sob demanda
- Filtros por responsável, tier e leads "estagnados" (sem atividade), busca por nome
- Atribuição de responsável (owner), valor monetário por negócio
- KPIs do funil e detecção de leads duplicados
- Ações em massa (mover, excluir, etiquetar vários leads de uma vez) + visão mobile em lista
**Resolve:** visibilidade total do funil em tempo real, sem oportunidade perdida entre etapas, com IA priorizando os leads mais quentes.

### Contatos
**O que é:** Cadastro central de leads e clientes, com ficha completa e histórico.
**Principais recursos:**
- Lista paginada com filtros avançados (pipeline, etapa, tag, origem, dias sem contato, faixa de valor, tier, período)
- Abas por status: Todos, Leads, Clientes, Inativos
- Parentesco/relacionamentos entre contatos, notas, tags, avatar
- Conversão de lead em cliente com perfil dedicado
- Upload e gerenciamento de documentos do cliente (download seguro)
- Filtros salvos reutilizáveis + importação em massa
- **Créditos de Viagem** na ficha (nicho viagens): saldo, histórico, validade, status
**Resolve:** unifica toda informação de um lead/cliente num só lugar, com segmentação poderosa pra priorizar follow-up.

### Tarefas
**O que é:** Gestão de tarefas internas, vinculável a leads/vendas, com múltiplas visualizações.
**Principais recursos:**
- 3 modos: Kanban, Lista e Calendário (persistido por usuário)
- Colunas customizáveis, status e prioridade
- Toggle rápido de conclusão
- Vinculação de tarefas a uma venda específica
- Kanban vira lista automaticamente no mobile
**Resolve:** centraliza o "o que fazer" da equipe num só lugar, evitando follow-up esquecido.

### Agendamentos (nichos não-viagem)
**O que é:** Agendamento de compromissos com página pública de reserva de horários.
**Principais recursos:**
- Tipos de evento configuráveis (duração, cor, local, buffers)
- Disponibilidade por organização
- Página pública (`/book/[org]/[evento]`) sem login
- Cálculo automático de slots livres (buffers, duração, conflitos)
- Agendamento manual pelo time + vínculo a contato/pipeline
- Cancelamento com motivo, marcação de concluído
**Resolve:** elimina troca de mensagens pra marcar horário — o cliente agenda sozinho e já entra no funil.

### Catálogo & Vendas (nichos não-viagem)
**O que é:** Catálogo de produtos/serviços + registro de vendas.
**Principais recursos:**
- Abas Todos/Produtos/Serviços, busca e filtros por categoria/status
- Visão dividida lista + detalhe
- Registro de venda vinculado a produto, vendedor e cliente
- KPIs de vendas do mês e histórico total
**Resolve:** controle simples de "o que vendo" e "o que já vendi", sem precisar de ERP separado.

---

## 2. Módulo de Viagens (exclusivo agências de viagem)

### Cotações
**O que é:** Construtor de propostas de viagem visuais e compartilháveis + geração de orçamento institucional via IA a partir de voucher/PDF de operadora.
**Principais recursos:**
- Roteiro dia a dia, mapa com pins dos destinos, incluso/não incluso, condições de pagamento
- Vínculo a um lead do pipeline
- Link público compartilhável (design próprio, countdown, blocos retráteis) + PDF
- Duplicação de propostas
- Geocodificação e lookup no TripAdvisor
- **Orçamento IA**: upload de voucher/PDF, extração automática de dados, PDF no estilo da operadora
**Resolve:** elimina o retrabalho manual de montar apresentação de viagem no PowerPoint/Canva; transforma um voucher recebido em orçamento formal em minutos.

### Reservas
**O que é:** Registro operacional da venda, do fechamento ao pós-venda, com checklist de execução.
**Principais recursos:**
- Criação a partir de proposta aceita, ou automática ao mover lead para "Fechado"
- Dados dos viajantes com opção de puxar de contatos já cadastrados
- Checklist (contrato gerado/assinado, voucher entregue, embarque, pós-venda)
- Editor de contrato com modelo padrão configurável por organização
- Upload de vouchers com leitura por IA preenchendo campos automaticamente
- Geração automática de tarefas operacionais vinculadas à venda
- Aplicação de créditos de viagem + cancelamento com fluxo dedicado
**Resolve:** centraliza contrato, documentação e voucher entre fechamento e embarque, sem planilha paralela.

### Documentos
**O que é:** Central de modelos e documentos gerados, incluindo formulários médicos especiais de embarque.
**Principais recursos:**
- Aba Gerados: documentos já emitidos
- Aba Modelos: criação/edição (contrato padrão, comunicados) com editor HTML
- Aba MEDIF: modelo de assistência médica pra passageiros
- Aba FREMEC: modelo pra passageiro com mobilidade reduzida
**Resolve:** padroniza a documentação exigida por companhias aéreas pra viajantes com necessidades especiais, sem depender de e-mail solto.

### Financeiro
**O que é:** Controle financeiro completo de receitas/despesas com dashboard analítico.
**Principais recursos:**
- Lançamento manual + importação CSV de extrato bancário
- Categorias, contas e centros de custo configuráveis
- Anexos de comprovante por lançamento, com sugestão automática de categoria (IA)
- Dashboard com filtro de período: fluxo de caixa diário, despesas por categoria, DRE simplificado
- Lista de vencimentos próximos
**Resolve:** dá visão de caixa e lucratividade sem planilha externa, na mesma base de dados das vendas.

### Bloqueios
**O que é:** Gestão de lotes de assentos negociados com operadoras/companhias aéreas.
**Principais recursos:**
- Cadastro por trecho, datas, voos, assentos, prazo de release
- Controle de disponibilidade com +/- conforme a venda acontece
- Importação em lote via CSV/XLSX
**Resolve:** substitui o controle manual em planilha de quantos assentos restam antes do prazo de devolução à operadora.

### Embarques
**O que é:** Linha do tempo visual das próximas partidas já vendidas.
**Principais recursos:**
- Viagens ordenadas por data de embarque/retorno
- Tarefas vinculadas visíveis no card
- Atalho direto pro WhatsApp do cliente
**Resolve:** visibilidade rápida de "quem embarca quando" pra antecipar follow-up de pré-embarque.

### Ofertas
**O que é:** Vitrine de pacotes prontos pra divulgação, sem cliente vinculado.
**Principais recursos:**
- Mesma estrutura de uma cotação (roteiro, preços, inclusos), sem cliente atribuído
- Publicação em vitrine pública com link compartilhável
- Conversão em cotação vinculada a um lead com um clique
**Resolve:** pacotes "de prateleira" prontos pra campanha, reaproveitados instantaneamente quando aparece um lead interessado.

### Créditos de Viagem
**O que é:** Crédito em loja gerado por cancelamento, usável em vendas futuras do mesmo contato.
**Principais recursos:**
- Geração automática ao cancelar uma venda
- Listagem de créditos disponíveis/usados por contato
- Aplicação direta em nova venda + histórico de uso
**Resolve:** formaliza a prática comum de reter valor de cancelamento como crédito futuro, com transparência pro cliente e pro financeiro.

---

## 3. Comunicação

### Conversas (WhatsApp)
**O que é:** Inbox de WhatsApp via API oficial do Meta (Cloud API), conectado direto aos leads do CRM.
**Principais recursos:**
- Conexão via Embedded Signup do Meta (fluxo guiado) ou config manual
- Inbox unificado com histórico, contexto do lead/pipeline, envio agendado
- Templates aprovados pela Meta como fallback fora da janela de 24h
- Tags coloridas por atendente
- **Agente de IA** com 8 sub-abas de configuração (personalidade, base de conhecimento, fluxos, horários, transferência pra humano, ferramentas, memória, sandbox de teste)
- Deep-link: abrir a conversa mais recente do lead direto do card do pipeline
**Resolve:** elimina a fragmentação entre WhatsApp Business App e CRM; o agente de IA responde 24/7 sem depender de operador sempre disponível.

### Instagram / Social
**O que é:** Automação e inbox unificado pra DMs/comentários do Instagram.
**Principais recursos:**
- Conexão OAuth da conta
- Automações configuráveis de resposta automática (DM/comentário)
- Funis de conversão dedicados por automação
- Inbox social com envio manual, marcação de lida, pausa pontual da automação pra intervenção humana
**Resolve:** consolida um canal geralmente disperso e manual num inbox só, com opção de assumir a conversa quando precisa.

---

## 4. Marketing

### Automações
**O que é:** Motor de workflows internos disparado por eventos (ex.: submissão de formulário).
**Principais recursos:**
- Gatilho configurável + sequência de passos editável
- Estatísticas de sucesso/erro por passo
- Ativar/pausar, exclusão, histórico de execuções por lead
**Resolve:** automatiza follow-up e nutrição sem intervenção manual, com visibilidade de onde cada automação converte ou falha.

### Campanhas (Marketing)
**O que é:** Gestão de campanhas de anúncios (Meta Ads) com registro de métricas e visão consolidada.
**Principais recursos:**
- Cadastro de contas de anúncio e campanhas vinculadas
- Registro de métricas manual e em lote (importador CSV)
- Overview consolidado por período com gráfico
**Resolve:** voltado a agências de tráfego que precisam provar ROI de campanha pro cliente, mesmo com dados vindos de fora via CSV.

### Formulários
**O que é:** Construtor de formulários públicos de captação, com página hospedada e conversão direta em lead.
**Principais recursos:**
- Modo clássico ou "uma pergunta por vez" (estilo Typeform)
- Tela de boas-vindas configurável, presets de fundo (inclusive escuro)
- Fallback de WhatsApp dentro do formulário
- Vínculo automático a pipeline/etapa de destino
- Aba de insights/analytics por formulário
**Resolve:** monta landing page de captação sem ferramenta externa, entregando o lead direto no funil certo.

### Google Meu Negócio *(em construção — Fase 1)*
**O que é:** Integração OAuth com o Google Business Profile.
**Principais recursos (hoje):**
- Conexão OAuth por organização + sincronização de unidades (locations)
- Vínculo/desvínculo manual de cada unidade
**Ainda não implementado:** gerenciar avaliações, publicações e indicadores (fases futuras).
**Resolve:** primeiro passo pra trazer a presença no Google pro CRM — hoje só conecta a conta.

---

## 5. Inteligência Artificial

### IA Qualificadora (Lead Scoring)
**O que é:** Qualificação automática de leads via IA com tool-use estruturado.
**Principais recursos:**
- Score 0–100 e tier (hot/warm/cold)
- Justificativa em português + tags úteis pro vendedor + objeções identificadas
- Usa o schema do formulário pra decodificar campos customizados
- Prompt de sistema customizável por organização
**Resolve:** elimina triagem manual — o vendedor já sabe quem priorizar e por quê, reduzindo tempo de resposta ao lead quente.

### Agente de Atendimento IA
*(configurado dentro de Conversas/Configurações — ver acima)* Responde no WhatsApp 24/7, com personalidade, base de conhecimento, horários e transferência pra humano configuráveis, e sandbox de teste antes de publicar.

### Copiloto do Dashboard
*(ver Inicial, abaixo)* Chat de IA em streaming dentro do dashboard, capaz de fixar respostas/cards direto na tela.

---

## 6. Plataforma

### Inicial (Dashboard)
**O que é:** Ponto de entrada do CRM — dashboard multi-aba com KPIs, insights automáticos e copiloto de IA.
**Principais recursos:**
- 4 abas (Visão Geral, Comercial, Vendas & Clientes, Equipe & Atendimento)
- Grid de KPIs configurável, com cards fixáveis
- Detecção automática de insights (job agendado varrendo anomalias, ex. mudança de categoria de despesa)
- Copiloto de IA em dock flutuante, com streaming e capacidade de fixar cards
- Widget de receita vs. meta, funil/forecast com filtro por vendedor, ranking, funil de origem
- Filtros globais de período/pipeline/vendedor aplicados a todos os widgets
**Resolve:** substitui a necessidade de abrir várias telas pra entender a saúde do negócio — reúne vendas, atendimento e operação, com IA apontando o que precisa de atenção antes de perguntar.

### Relatórios
**O que é:** Central de exportação de relatórios (PDF/Excel/CSV).
**Principais recursos:**
- Tipos: Leads, Vendas, Agendamentos, Comissões (viagens)
- Filtro por período, preview em tabela antes de exportar
- Exportação CSV + impressão/PDF dedicados
**Resolve:** dados prontos pra prestação de contas e comissionamento sem exportação manual do banco.

### Configurações
**O que é:** Área administrativa central — conta, equipe, integrações, IA.
**Principais recursos:**
- Organização/perfil, segurança
- Equipe com papéis e permissões granulares por módulo
- Assinatura/planos, créditos de IA
- Agente IA (8 sub-abas)
- Hub de Integrações: WhatsApp, e-mail (Resend), IA Qualificadora, Meta Ads (Capi/Pixel), Instagram, Google Meu Negócio
- Painel de Saúde das Integrações (status, último erro, disponibilidade 30 dias)
- Fila de exclusão de dados (compliance)
**Resolve:** centraliza governança técnica e operacional num só lugar, reduzindo dependência de suporte técnico.

### Multi-tenant, Planos & Créditos de IA
**Planos:** Free (R$0) · Starter (R$137/mês) · Pro (R$397/mês) · Business (R$697/mês) — desconto 10% semestral / 18% anual.
**Diferenciação principal:** volume de uso e limites, não recursos — `ai_insights` e `export_reports` são exclusivos Pro/Business; os demais já entram no Starter.
**Multi-tenant real:** Starter = 1 organização, Pro = até 5, Business = ilimitado.
**Créditos de IA mensais:** Starter 300 · Pro 1200 · Business 3000, com custo por ação e por modelo (Haiku 1x, Sonnet/GPT-4o 3x, Opus 5x) + pacotes avulsos.
**Segurança:** enforcement 100% server-side (fail-closed), nunca confia no client.

### Sistema de Permissões
**O que é:** RBAC (owner/admin/member) + toggles granulares por módulo.
**Principais recursos:**
- 16 módulos permissionáveis em 4 seções (Vendas, Comunicação, Marketing, Operações + Configurações)
- Perfil padrão conservador pra novos membros
- Aplicado tanto na UI quanto no server (dupla checagem)
**Resolve:** controle fino de quem vê/faz o quê — essencial em times com funções distintas, sem multiplicar contas.

---

## Como usar este documento

Cada bloco acima pode virar:
- Uma seção de **recursos** na home ou em `/funcionalidades`
- Um bullet point num H2 "Por que a Althos" segmentado por nicho (viagens, clínicas, imobiliárias etc.)
- Um item de FAQ respondendo "vocês têm X?"

O ponto central pro cliente: **ele precisa ver o próprio fluxo de trabalho refletido aqui** — não uma lista de features genéricas. Isso significa organizar a comunicação do site por *jornada* (captação → atendimento → venda → operação → financeiro) em vez de por nome de tela, usando a linguagem de cada seção acima como munição.
