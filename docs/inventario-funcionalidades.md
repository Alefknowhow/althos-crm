# Inventário de Funcionalidades — Althos CRM

> Documento-base para organizar o site institucional: o que o produto faz, módulo a módulo, com foco no que resolve pra quem usa. Reflete o estado real do código nesta data — não é copy de marketing, é a fonte de verdade pra escrever a copy.
>
> **Nichos estratégicos definidos:** Viagens, Clínicas, Imobiliárias, Advocacia e Corretoras de Seguros — escolhidos por dependerem de um CRM completo pra operar (não é ferramenta acessória) e por estarem entre os verticais de menor churn do mercado de SaaS (alto custo de troca por causa do histórico de caso/cliente/apólice acumulado no sistema).
>
> As seções 1–6 abaixo descrevem o que **já está construído** (genérico + módulo de Viagens). As seções 7–10 são **especificações de produto a construir** — Advocacia e Seguros (nichos novos) e Clínicas/Imobiliárias (otimização dos nichos já existentes, hoje operando só com CRM genérico) — no mesmo nível de profundidade do módulo de Viagens. Servem de roteiro de desenvolvimento, não de funcionalidade já existente.
>
> **Financeiro deixa de ser exclusivo do módulo de Viagens** — vira módulo transversal, disponível como complemento pra qualquer nicho (ver seção 2 e o modelo de preços).

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

## 7. Módulo de Advocacia *(especificação — a construir)*

> Espelha o papel que o Módulo de Viagens tem hoje: um conjunto de telas exclusivas do nicho, gated por `isLawNiche(org.niche)` (ou equivalente), que faz o escritório operar 100% dentro do Althos — do primeiro contato do cliente até o arquivamento do processo. Reaproveita ao máximo a infraestrutura genérica já existente (Pipeline, Contatos, Tarefas, Financeiro, Documentos, Automações, IA Qualificadora) e cobre com telas próprias o que só existe em escritório de advocacia: processo, prazo fatal e honorários.

### Processos
**O que é:** Registro central de cada processo/caso do escritório — o equivalente direto à Reserva do módulo de viagens.
**Recursos necessários:**
- Cadastro do processo: número (CNJ), vara/comarca, área do direito, cliente (parte), parte contrária, advogado responsável, fase processual
- Vínculo a um ou mais contatos do CRM (cliente e, quando relevante, parte contrária/testemunhas)
- Linha do tempo de andamentos processuais (manual ou, numa fase futura, por integração com tribunais/Escavador/Judit)
- Checklist do processo (petição inicial protocolada, citação, contestação, sentença, recurso, trânsito em julgado) — mesmo padrão do checklist de venda em Reservas
- Tarefas geradas automaticamente a partir de eventos do processo (ex.: "protocolar contestação" ao registrar a citação)
- Upload de documentos do processo com histórico de versões
**Resolve:** substitui a planilha/caderno de acompanhamento processual, dando ao escritório uma visão única de "onde está cada processo" sem depender da memória do advogado responsável.

### Prazos (Agenda Processual)
**O que é:** Linha do tempo/alerta de prazos fatais e não-fatais vinculados a cada processo — o equivalente a Embarques + Bloqueios (visibilidade + contagem regressiva).
**Recursos necessários:**
- Cadastro de prazo vinculado ao processo (tipo, data fatal, responsável, se é prazo fatal ou preparatório)
- Cálculo automático de prazo em dias úteis, considerando feriados forenses (nacionais + da comarca)
- Alertas escalonados (ex.: 5 dias, 2 dias, véspera) por e-mail/WhatsApp pro advogado responsável
- Dashboard "Próximos prazos" (mesmo padrão do card "Próximos vencimentos" já existente no Financeiro)
- Marcação de prazo cumprido, com registro de quem cumpriu e quando
**Resolve:** é o maior risco operacional de um escritório (perda de prazo = erro grave, responsabilidade civil) — automatizar esse controle é o principal motivo de adoção de um sistema jurídico.

### Documentos & Modelos Jurídicos
**O que é:** Geração de peças (petições, procurações, contratos de honorários) a partir de modelos com campos automáticos — reaproveita 100% a engine de merge-fields já construída em Documentos/Reservas.
**Recursos necessários:**
- Modelos editáveis por área do direito (cível, trabalhista, família, tributário etc.), com variáveis do processo/cliente resolvidas automaticamente
- Geração de procuração e contrato de honorários assinável (upload do assinado, mesmo padrão do contrato de viagem)
- Biblioteca de documentos gerados por processo, com busca
**Resolve:** elimina o "abrir o Word e copiar da última petição parecida", com consistência e menos erro de digitação de dados do cliente/processo.

### Honorários (Financeiro jurídico)
**O que é:** Camada específica sobre o módulo Financeiro genérico para controlar as formas de cobrança típicas da advocacia.
**Recursos necessários:**
- Tipos de honorário: fixo, por hora, êxito (percentual sobre o valor da causa/ganho), contrato de risco
- Parcelamento de honorários vinculado ao processo, com vencimentos e status (reaproveita Financeiro + "próximos vencimentos")
- Registro de custas processuais e despesas reembolsáveis por processo (centro de custo = processo)
- Relatório de honorários a receber por processo/cliente/advogado
**Resolve:** dá ao escritório controle de fluxo de caixa ligado diretamente ao andamento de cada processo, sem depender de planilha paralela pro financeiro do escritório.

### Propostas de Honorários (Cotações jurídicas)
**O que é:** Equivalente a Cotações — proposta formal de prestação de serviço enviada ao cliente antes de fechar o contrato.
**Recursos necessários:**
- Montagem de proposta com escopo do serviço, forma de honorário e condições
- Link público compartilhável + PDF com a marca do escritório
- Conversão direta da proposta aceita em Processo + Contrato de Honorários
**Resolve:** profissionaliza a captação de novos clientes, com um documento formal em vez de orçamento por WhatsApp.

### Reaproveitados sem alteração
Pipeline (funil de captação de clientes), Contatos (clientes/partes), Tarefas, Automações (lembretes automáticos), IA Qualificadora (priorizar consultas), Agendamentos (agenda de audiências e reuniões), Conversas/WhatsApp, Configurações/Permissões.

---

## 8. Módulo de Corretoras de Seguros *(especificação — a construir)*

> Mesmo princípio: telas exclusivas gated por `isInsuranceNiche(org.niche)`, cobrindo o ciclo apólice → renovação → sinistro → comissão, reaproveitando toda a base genérica (Pipeline, Contatos, Financeiro, Documentos, Automações).

### Apólices
**O que é:** Registro central de cada apólice vendida — equivalente direto à Reserva/Processo.
**Recursos necessários:**
- Cadastro da apólice: seguradora, ramo (auto, vida, residencial, empresarial, saúde), número da apólice, vigência (início/fim), prêmio, forma de pagamento
- Vínculo ao contato (segurado) e ao bem segurado (veículo, imóvel, etc. — campos por ramo)
- Checklist da apólice (proposta enviada, aceita pela seguradora, emitida, boleto enviado, ativa)
- Upload da apólice em PDF e endossos/aditivos vinculados
- Histórico de alterações (endosso) com data e motivo
**Resolve:** substitui a planilha de controle de apólices que praticamente toda corretora pequena/média usa hoje, com toda a informação vinculada ao cliente certo.

### Renovações
**O que é:** Painel de apólices a vencer — o ativo mais valioso de uma corretora, já que é o momento de maior risco de perda do cliente pra outra corretora.
**Recursos necessários:**
- Dashboard "Próximas renovações" (30/60/90 dias), mesmo padrão do "Próximos vencimentos" do Financeiro
- Disparo automático de tarefa e/ou mensagem de WhatsApp ao entrar na janela de renovação
- Comparação automática entre prêmio atual e cotação de renovação (quando integrado a cotador de seguradora, fase futura)
- Marcação de renovada / não-renovada (com motivo de perda, pra métrica de retenção)
**Resolve:** é a funcionalidade que mais protege a receita recorrente da corretora — não perder renovação por falta de acompanhamento é o principal argumento de venda desse módulo.

### Sinistros
**O que é:** Acompanhamento do processo de sinistro do segurado, do aviso até o pagamento/negativa.
**Recursos necessários:**
- Abertura de sinistro vinculado à apólice, com tipo, data do evento, status (aberto, em análise, aprovado, pago, negado)
- Checklist de documentos exigidos pela seguradora, com upload
- Linha do tempo de comunicação com a seguradora
- Notificação ao cliente a cada mudança de status
**Resolve:** o momento de sinistro é o de maior ansiedade do cliente — ter um processo claro e visível aumenta a percepção de valor da corretora (que muitas vezes só é lembrada nesse momento).

### Comissões
**O que é:** Camada específica sobre o Financeiro genérico pra controlar o repasse de comissão por apólice/seguradora.
**Recursos necessários:**
- Percentual de comissão por seguradora/ramo/produto
- Cálculo automático da comissão esperada por apólice emitida
- Conciliação entre comissão esperada x paga pela seguradora (identifica divergência/glosa)
- Relatório de comissões por corretor (quando há equipe de vendas), por seguradora e por período
**Resolve:** hoje esse controle costuma ser feito em planilha separada da seguradora — automatizar a conciliação evita perda de receita por comissão não paga/errada.

### Cotações Comparativas
**O que é:** Equivalente a Cotações — comparação de propostas de diferentes seguradoras antes de fechar com o cliente.
**Recursos necessários:**
- Registro de cotações recebidas de diferentes seguradoras pro mesmo perfil de risco
- Comparativo lado a lado (prêmio, coberturas, franquia) pra apresentar ao cliente
- Geração de proposta em PDF com a marca da corretora
- Conversão da cotação escolhida em Apólice com um clique
**Resolve:** demonstra o valor do corretor frente a comprar direto com uma seguradora — ele estuda e compara o mercado, algo que precisa ficar visível e organizado.

### Reaproveitados sem alteração
Pipeline (funil comercial de novos segurados), Contatos (segurados + bens segurados), Tarefas, Automações (lembretes de renovação), IA Qualificadora, Conversas/WhatsApp, Configurações/Permissões.

---

## 9. Módulo de Clínicas *(especificação — a construir)*

> Hoje Clínicas usa só CRM genérico + Agendamentos. Este módulo dá funcionalidade própria de clínica (estética, odontológica, saúde em geral) — gated por `isClinicNiche(org.niche)`, reaproveitando Contatos, Documentos, Financeiro e Automações já existentes.

### Prontuário / Ficha de Atendimento
**O que é:** Registro clínico do paciente, vinculado ao contato — histórico de procedimentos/consultas realizados.
**Recursos necessários:**
- Ficha por atendimento: procedimento realizado, profissional responsável, observações, data
- Upload de fotos "antes/depois" vinculadas ao atendimento (uso comum em estética)
- Termo de consentimento gerado a partir de modelo e assinado/anexado (reaproveita a engine de Documentos)
- Linha do tempo de atendimentos do paciente na ficha do contato
**Resolve:** substitui a pasta física/PDF solto de prontuário, com tudo vinculado ao histórico do paciente no CRM.

### Pacotes de Sessões
**O que é:** Controle de pacotes vendidos com múltiplas sessões (ex.: 10 sessões de laser, 5 de fisioterapia).
**Recursos necessários:**
- Cadastro do pacote (procedimento, nº de sessões, validade)
- Baixa automática de sessão a cada atendimento registrado, com saldo visível na ficha do paciente
- Alerta de pacote perto de vencer sem sessões usadas (gatilho de retorno automático)
**Resolve:** hoje controlado em caderno/planilha — saldo errado de sessão é fonte comum de atrito com o paciente.

### Estoque de Insumos
**O que é:** Controle de produtos/insumos usados em procedimento (toxina botulínica, preenchedor, anestésico etc.).
**Recursos necessários:**
- Cadastro de insumo com quantidade em estoque e validade
- Baixa automática de insumo ao registrar um atendimento que o consome
- Alerta de estoque baixo e de validade próxima
**Resolve:** evita ruptura de estoque em procedimento agendado e descarte por vencimento não percebido.

### Comissão por Profissional
**O que é:** Camada sobre o Financeiro genérico pra calcular comissão de cada profissional/esteticista por procedimento realizado.
**Recursos necessários:**
- Percentual de comissão por profissional e/ou por tipo de procedimento
- Cálculo automático da comissão a partir do atendimento registrado
- Relatório de comissões a pagar por profissional/período
**Resolve:** hoje calculado à parte em planilha — automatizar evita erro e disputa sobre valor de repasse.

### Reaproveitados sem alteração
Pipeline, Contatos (ficha do paciente), Tarefas, Agendamentos (já genérico, aqui é o core do negócio), Automações (lembrete de retorno), Conversas/WhatsApp, IA Qualificadora, Financeiro (módulo transversal), Configurações/Permissões.

---

## 10. Módulo de Imobiliárias *(especificação — a construir)*

> Hoje Imobiliárias usa só CRM genérico + Agendamentos + Pipeline. Este módulo adiciona o que só existe em imobiliária: o imóvel como entidade própria (não é só "produto de catálogo") e o match entre lead e imóvel.

### Catálogo de Imóveis
**O que é:** Cadastro de imóveis com campos próprios do setor — diferente do Catálogo genérico de produto/serviço.
**Recursos necessários:**
- Cadastro: endereço, tipo (apto/casa/comercial/terreno), metragem, quartos/vagas, valor (venda e/ou locação), status (disponível/reservado/vendido/alugado)
- Fotos do imóvel com galeria
- Vínculo do imóvel ao corretor responsável e ao proprietário (contato)
- Busca/filtro por região, faixa de preço, tipo, nº de quartos
**Resolve:** hoje controlado em planilha ou portal externo sem integração com o funil de vendas — aqui o imóvel já nasce conectado ao lead interessado.

### Match Lead × Imóvel
**O que é:** Cruzamento do perfil de busca do lead com os imóveis disponíveis no catálogo.
**Recursos necessários:**
- Perfil de busca no cadastro do lead (região, faixa de preço, tipo, quartos)
- Sugestão automática de imóveis compatíveis ao lead (e vice-versa, quando entra imóvel novo)
- Envio da sugestão por WhatsApp direto da ficha do imóvel
**Resolve:** elimina o trabalho manual de "lembrar" quais imóveis combinam com qual cliente — o sistema cruza sozinho.

### Controle de Visitas
**O que é:** Histórico de visitas realizadas a cada imóvel, vinculado ao lead e ao corretor.
**Recursos necessários:**
- Agendamento de visita vinculado ao imóvel (reaproveita Agendamentos)
- Registro de feedback pós-visita (interessado / não interessado / motivo)
- Histórico de visitas por imóvel (quantas, por quem, quando)
**Resolve:** dá ao gestor visão de quais imóveis têm alta procura e baixa conversão (possível problema de preço/condição), e evita agendar visita duplicada.

### Documentos & Propostas
**O que é:** Geração de proposta de compra/locação e contrato a partir de modelo — reaproveita a engine de Documentos.
**Recursos necessários:**
- Modelo de proposta/contrato com campos do imóvel e das partes resolvidos automaticamente
- Histórico de propostas por imóvel (várias propostas concorrentes no mesmo imóvel)
**Resolve:** substitui o contrato montado manualmente no Word a cada negociação.

### Comissão por Corretor
**O que é:** Camada sobre o Financeiro genérico pra calcular comissão por imóvel vendido/alugado.
**Recursos necessários:**
- Percentual de comissão por corretor e/ou por tipo de operação (venda/locação)
- Cálculo automático a partir do fechamento registrado no imóvel
- Relatório de comissões por corretor/período
**Resolve:** dá transparência de repasse numa operação onde comissão é frequentemente motivo de atrito entre corretor e imobiliária.

### Reaproveitados sem alteração
Pipeline (funil por corretor), Contatos (leads/proprietários), Tarefas, Agendamentos (visitas), Automações, Conversas/WhatsApp, IA Qualificadora, Financeiro (módulo transversal), Relatórios, Configurações/Permissões.

---

## Como usar este documento

Cada bloco acima pode virar:
- Uma seção de **recursos** na home ou em `/funcionalidades`
- Um bullet point num H2 "Por que a Althos" segmentado por nicho (viagens, clínicas, imobiliárias etc.)
- Um item de FAQ respondendo "vocês têm X?"

O ponto central pro cliente: **ele precisa ver o próprio fluxo de trabalho refletido aqui** — não uma lista de features genéricas. Isso significa organizar a comunicação do site por *jornada* (captação → atendimento → venda → operação → financeiro) em vez de por nome de tela, usando a linguagem de cada seção acima como munição.

As seções 7–10 (Advocacia, Seguros, Clínicas, Imobiliárias) são roteiro de desenvolvimento — nenhuma linha de código foi alterada ainda. Quando entrarmos na implementação, cada bloco vira uma leva de trabalho no mesmo formato das demais (migração → actions → tela → verificação/deploy).
