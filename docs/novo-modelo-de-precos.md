# Novo Modelo de Preços — Althos CRM

> Consolidação das decisões da sessão de estudo de pricing. Documento de planejamento — nenhuma implementação (código, tabela `plans`, gateway de pagamento) foi feita ainda. Os valores aqui são **hipótese de lançamento**, não preço validado em mercado — sinalizo onde recomendo testar antes de travar.

**Decisões já tomadas:**
- Elimina o plano Free perpétuo → substitui por **trial completo de 15 dias**.
- Módulos de nicho viram **complemento pago**, não incluídos no preço base — agora cobrindo Viagens, Clínicas, Imobiliárias (specs em `inventario-funcionalidades.md`) e, no futuro, Advocacia/Seguros.
- **Financeiro vira módulo transversal** — não é exclusivo de nenhum nicho, qualquer plano pode adicionar.
- **Nova unidade de escala: "loja/agência extra"** — add-on pra rede/franquia que precisa de mais de uma unidade operacional dentro da mesma conta.
- Setup/onboarding **grátis** em todo plano pago.
- 4 categorias de add-on: **Usuários extras · Lojas extras · Módulos de nicho · Créditos de IA**.

---

## 1. Planos base (CRM)

Mantém a estrutura de 3 planos — o produto genérico (Pipeline, Contatos, Tarefas, Agendamentos, WhatsApp + Agente IA, Automações, IA Qualificadora, Dashboard) já está bem segmentado por **volume de uso**, não por feature. Nenhum módulo de nicho incluso aqui.

| | **Starter** | **Pro** | **Business** |
|---|---|---|---|
| **Preço mensal** | R$137 | R$397 | R$697 |
| **Semestral** (−10%, cobrado a cada 6 meses) | R$739,80 (equiv. R$123,30/mês) | R$2.143,80 (equiv. R$357,30/mês) | R$3.763,80 (equiv. R$627,30/mês) |
| **Anual** (−18%, cobrado a cada 12 meses) | R$1.348,08 (equiv. R$112,34/mês) | R$3.906,48 (equiv. R$325,54/mês) | R$6.858,48 (equiv. R$571,54/mês) |
| **Usuários inclusos** | 1 | 6 | Ilimitado |
| **Empresas/lojas inclusas (multi-tenant)** | 1 | 5 | Ilimitado |
| **Clientes cadastrados** | 500 | 2.000 | Ilimitado |
| **Pipelines** | 2 | 5 | Ilimitado |
| **Automações ativas** | 5 | 20 | Ilimitado |
| **Disparos de automação/mês** | 1.000 | 10.000 | Ilimitado |
| **Contas sociais conectadas** | 1 | 3 | Ilimitado |
| **Créditos de IA/mês** | 300 | 1.200 | 3.000 |
| **Insights de IA + Exportar relatórios** | — | ✓ | ✓ |
| **Módulo de nicho incluso** | — | — | **1 módulo à escolha** (ver seção 3) |
| **Setup/onboarding guiado** | ✓ Grátis | ✓ Grátis | ✓ Grátis + call dedicada |

*(Preço mensal de Starter/Pro/Business mantido exatamente como já configurado em `lib/plans/config.ts`. Os totais semestral/anual acima são o cálculo correto de −10%/−18% sobre o mensal — o valor de `priceSemestralCents`/`priceAnnualCents` já configurado no código é o **total do ciclo**, não um valor mensal; a tabela anterior deste documento exibia esse total como se fosse mensal, por engano — corrigido aqui.)*

---

## 2. Trial de 15 dias (substitui o Free)

**Mecânica proposta:**
- Cadastro sem cartão de crédito, **exigindo telefone/WhatsApp válido** (reduz abuso de múltiplas contas + já é o canal que o produto usa de verdade).
- Acesso **completo ao plano Pro + 1 módulo de nicho** durante os 15 dias — inclusive o que seria pago (gera o "aha moment" completo, em vez de um Free capado que nunca mostra o fluxo real).
- Aviso automático em D-3 e D-1 antes do fim do trial (e-mail + WhatsApp), com CTA direto pra escolher plano.
- **Ao expirar sem pagamento: conta é congelada, não apagada.** Dados intactos, visíveis em modo leitura; toda criação/edição bloqueada. Reativação imediata ao inserir forma de pagamento.
- Sem trial "renovável" — 1 trial por CNPJ/telefone (regra a validar tecnicamente na implementação).

**Por que isso substitui bem o Free:** a captura de quem "ainda não sabe se precisa" passa a acontecer **antes** da conta existir, pelo formulário de qualificação da página de nicho (seção 5) — sem custo de manter conta Free viva indefinidamente.

---

## 3. Módulos de nicho (complemento pago)

Cobra-se por módulo em todo nicho que tenha (ou venha a ter) **funcionalidade extra construída** além do CRM genérico configurado pro nicho. Com as especificações de Clínicas e Imobiliárias adicionadas ao inventário, os 5 nichos passam a ter módulo próprio — muda o que valia antes (quando só Viagens tinha módulo dedicado):

| Nicho | Módulo | Status |
|---|---|---|
| **Agências de Viagens** | Cotações, Reservas, Documentos, Bloqueios, Embarques, Ofertas, Créditos | ✓ Construído |
| **Clínicas** | Prontuário/Ficha, Pacotes de Sessões, Estoque de Insumos, Comissão por Profissional | Especificado — a construir |
| **Imobiliárias** | Catálogo de Imóveis, Match Lead×Imóvel, Controle de Visitas, Documentos/Propostas, Comissão por Corretor | Especificado — a construir |
| **Advocacia** | Processos, Prazos, Documentos Jurídicos, Honorários, Propostas | Especificado — a construir |
| **Corretoras de Seguros** | Apólices, Renovações, Sinistros, Comissões, Cotações Comparativas | Especificado — a construir |

> **Financeiro sai da lista de módulos de nicho** — vira módulo **transversal** (seção 3.1), porque toda comissão/honorário/repasse dos módulos acima (comissão de profissional, de corretor, honorário de advogado) já depende dele. Faz mais sentido cobrar separado e permitir que qualquer plano/nicho adicione, em vez de reempacotar a mesma lógica financeira dentro de cada módulo de nicho.

### Preço do módulo de nicho (hipótese a validar)

**R$147/mês por módulo**, empilhável sobre Starter ou Pro. **Incluso sem custo extra no Business** (1 módulo à escolha).

Racional do valor: cada módulo cobre o que hoje é vendido como sistema à parte no respectivo mercado (sistema de gestão pra clínica, pra imobiliária, pra agência de viagens) — esse tipo de sistema isolado custa na faixa de R$150-500/mês no Brasil. R$147 como complemento de um CRM que já resolve captação/atendimento/vendas é oferta agressiva de entrada.

**A validar antes de travar:** rodar com prospects reais de cada nicho antes do lançamento; considerar se módulos mais complexos (Advocacia/Seguros) justificam preço diferente de Viagens/Clínicas/Imobiliárias.

### 3.1 Financeiro (módulo transversal)

**O que é:** controle de receitas/despesas, categorias/contas/centros de custo, dashboard com fluxo de caixa e DRE (já construído — hoje restrito ao nicho Viagens, passa a ficar disponível a qualquer plano/nicho).

**Preço:** **R$67/mês**, empilhável em qualquer plano, independente de módulo de nicho. Mais barato que um módulo de nicho completo porque é uma fatia menor de funcionalidade (só a camada financeira, sem tela dedicada de operação do nicho).

**Incluso automaticamente** em qualquer módulo de nicho contratado (Viagens já embute; Clínicas/Imobiliárias/Advocacia/Seguros, quando construídos, também embutem) — só é cobrado à parte por quem quer Financeiro **sem** nenhum módulo de nicho (ex.: uma pequena empresa genérica que só quer controlar caixa).

### Oferta de lançamento — Advocacia e Seguros
Como esses dois módulos ainda não existem, sugiro uma janela **"fundador"**: quem se cadastrar na lista de espera da página de nicho garante o módulo com **30% de desconto vitalício** quando lançar.

---

## 4. Lojas/agências extras (novo add-on)

Pra redes e franquias que precisam de mais unidades operacionais do que o plano inclui, sem precisar upgradar de tier inteiro.

| Plano | Lojas/agências inclusas | Loja extra |
|---|---|---|
| Starter | 1 | Não disponível — precisa subir pra Pro |
| **Pro** | 5 | **+R$97/loja/mês** (hipótese a validar) |
| Business | Ilimitado | Não se aplica |

Preço da loja extra é maior que o do usuário extra (seção 6) porque representa uma unidade operacional inteira (própria carteira de leads/vendas), não um acento adicional de uma equipe já existente. Mesmo racional do usuário extra: só disponível a partir do Pro — Starter é desenhado pra operação de unidade única.

---

## 5. Formulário de qualificação nas páginas de nicho

Captura o lead **antes** de precisar de conta/trial, alimentando o funil comercial e o IA Qualificadora assim que o contato entra no CRM da própria Althos.

**Campos sugeridos (ajustar por nicho):**
- Nome, e-mail, telefone/WhatsApp (obrigatórios)
- Nº de unidades/filiais/lojas/agências
- Nº de funcionários/vendedores na equipe
- Usa algum sistema hoje? Qual? (sinaliza objeção de troca)
- Faturamento mensal aproximado (faixas, reduz fricção)
- Maior dificuldade hoje (texto livre ou múltipla escolha por nicho)

**Uso comercial:** cada envio dispara automação de nutrição (WhatsApp/e-mail) e entra classificado no funil comercial da própria Althos — dogfooding do produto.

---

## 6. Usuários extras

| Plano | Usuários inclusos | Usuário extra |
|---|---|---|
| Starter | 1 | Não disponível — precisa subir pra Pro |
| **Pro** | 6 | **+R$47/usuário/mês** (hipótese a validar) |
| Business | Ilimitado | Não se aplica |

---

## 7. Créditos de IA (add-on existente, mantido)

Já existe e funciona bem — não precisa de mudança: pacotes avulsos de créditos (100/500/1000, ~R$0,13-0,15 por crédito) além dos créditos mensais inclusos no plano. Consumo por ação (qualificar lead, resposta do atendente, insight, gerar proposta) e por modelo de IA escolhido (Haiku 1×, Sonnet/GPT-4o 3×, Opus 5×).

---

## 8. Resumo dos 4 add-ons

| Add-on | Disponível a partir de | Preço (hipótese) |
|---|---|---|
| **Usuários extras** | Pro | R$47/usuário/mês |
| **Lojas/agências extras** | Pro | R$97/loja/mês |
| **Módulos de nicho** | Starter | R$147/mês por módulo (Financeiro sozinho: R$67/mês) |
| **Créditos de IA** | Todos | Pacotes avulsos (100/500/1000 créditos) |

---

## 9. Tabela-resumo — cenários reais

| Cenário | Composição | Total/mês |
|---|---|---|
| Agência de viagens pequena (2 pessoas, 1 loja) | Starter + Módulo Viagens | R$137 + R$147 = **R$284** |
| Agência de viagens em crescimento (8 vendedores) | Pro + Módulo Viagens + 2 usuários extras | R$397 + R$147 + R$94 = **R$638** |
| Rede de clínicas (3 unidades) | Pro + Módulo Clínicas | R$397 + R$147 = **R$544** (3 lojas já inclusas no Pro) |
| Rede de clínicas grande (7 unidades) | Pro + Módulo Clínicas + 2 lojas extras | R$397 + R$147 + R$194 = **R$738** |
| Escritório de advocacia médio (quando módulo existir) | Business (módulo incluso) | **R$697** |
| Imobiliária pequena, só controle de caixa (sem módulo de nicho) | Starter + Financeiro | R$137 + R$67 = **R$204** |
| Imobiliária com módulo completo | Starter + Módulo Imobiliárias | R$137 + R$147 = **R$284** |

---

## 10. Itens ainda em aberto

1. **Preço do módulo de nicho** (R$147) e do **Financeiro avulso** (R$67) — ponto de partida, validar com prospects reais.
2. **Preço do usuário extra** (R$47) e da **loja extra** (R$97) — idem.
3. **Regra técnica de "1 trial por CNPJ/telefone"** — bloqueio por telefone verificado é o mais simples de começar.
4. **Congelamento de conta pós-trial** — definir prazo de retenção antes de exclusão definitiva (ex.: 90 dias), alinhado à política de privacidade/LGPD já escrita.
5. **Desconto "fundador" de Advocacia/Seguros** — definir prazo de validade da oferta.
6. **Ordem de construção dos módulos** — Clínicas e Imobiliárias entraram agora na lista de módulos pagos; decidir se eles são construídos antes ou depois de Advocacia/Seguros (ambos já tinham prioridade definida na sessão anterior).

Quando esses pontos estiverem fechados, a implementação vira leva de código: ajuste de `lib/plans/config.ts` (nova entidade "loja extra" e "módulo de nicho" como add-ons independentes de feature flag por plano) + migração da tabela `plans`/`subscriptions` (trial_ends_at, congelamento, add-ons contratados) + páginas `/planos` e de nicho + formulário de qualificação.
