# Novo Modelo de Preços — Althos CRM

> Consolidação das decisões da sessão de estudo de pricing. Documento de planejamento — nenhuma implementação (código, tabela `plans`, Stripe/gateway) foi feita ainda. Os valores aqui são **hipótese de lançamento**, não preço validado em mercado — sinalizo onde recomendo testar antes de travar.

**Decisões já tomadas:**
- Elimina o plano Free perpétuo → substitui por **trial completo de 15 dias**.
- Módulos de nicho viram **complemento pago**, não incluídos no preço base.
- Setup/onboarding **grátis** em todo plano pago.
- Assentos extras: **incluídos por plano** + add-on avulso só no Pro (modelo híbrido).

---

## 1. Planos base (CRM)

Mantém a estrutura atual de 3 planos — o produto genérico (Pipeline, Contatos, Tarefas, Agendamentos, WhatsApp + Agente IA, Automações, IA Qualificadora, Dashboard) já está bem segmentado por **volume de uso**, não por feature. Nenhum módulo de nicho incluso aqui.

| | **Starter** | **Pro** | **Business** |
|---|---|---|---|
| **Preço mensal** | R$137 | R$397 | R$697 |
| **Semestral** (−10%) | R$73,98/mês equiv. | R$214,38/mês equiv. | R$376,38/mês equiv. |
| **Anual** (−18%) | R$134,81/mês total/12 | R$390,65/mês total/12 | R$685,85/mês total/12 |
| **Usuários inclusos** | 1 | 6 | Ilimitado |
| **Empresas (multi-tenant)** | 1 | Até 5 | Ilimitado |
| **Clientes cadastrados** | 500 | 2.000 | Ilimitado |
| **Pipelines** | 2 | 5 | Ilimitado |
| **Automações ativas** | 5 | 20 | Ilimitado |
| **Disparos de automação/mês** | 1.000 | 10.000 | Ilimitado |
| **Contas sociais conectadas** | 1 | 3 | Ilimitado |
| **Créditos de IA/mês** | 300 | 1.200 | 3.000 |
| **Insights de IA + Exportar relatórios** | — | ✓ | ✓ |
| **Módulo de nicho incluso** | — | — | **1 módulo incluso** (ver seção 3) |
| **Setup/onboarding guiado** | ✓ Grátis | ✓ Grátis | ✓ Grátis + call dedicada |

*(Preços de Starter/Pro/Business mantidos exatamente como já configurado em `lib/plans/config.ts` — nenhuma mudança nos valores base, só na composição da oferta.)*

---

## 2. Trial de 15 dias (substitui o Free)

**Mecânica proposta:**
- Cadastro sem cartão de crédito, **exigindo telefone/WhatsApp válido** (dupla função: reduz abuso de múltiplas contas + já é o canal que o produto usa de verdade).
- Acesso **completo ao plano Pro + 1 módulo de nicho** durante os 15 dias — inclusive o que seria pago (é isso que gera o "aha moment" completo, ao invés de um Free capado que nunca mostra o fluxo real).
- Aviso automático em D-3 e D-1 antes do fim do trial (e-mail + WhatsApp), com CTA direto pra escolher plano.
- **Ao expirar sem pagamento: conta é congelada, não apagada.** Dados ficam intactos e visíveis em modo leitura; toda ação de criação/edição fica bloqueada. Reativação imediata ao inserir forma de pagamento, sem precisar recadastrar nada.
- Sem trial "renovável" — 1 trial por CNPJ/telefone (regra a validar tecnicamente na implementação, evita reset infinito).

**Por que isso substitui bem o Free:** o Free existia pra capturar quem "ainda não sabe se precisa" — agora essa captura acontece **antes** da conta existir, pelo formulário de qualificação da página de nicho (seção 4), que já filtra e nutre esse lead sem custo de manter conta viva.

---

## 3. Módulos de nicho (complemento pago)

Só faz sentido cobrar por módulo em nichos que **têm funcionalidade extra construída** além do CRM genérico configurado pro nicho. Hoje isso é:

| Nicho | Tem módulo próprio? | Cobra add-on? |
|---|---|---|
| **Agências de Viagens** | ✓ Cotações, Reservas, Documentos, Financeiro, Bloqueios, Embarques, Ofertas, Créditos | **Sim** |
| **Advocacia** | Planejado (Processos, Prazos, Honorários, Propostas) — não construído ainda | Sim, quando lançar |
| **Corretoras de Seguros** | Planejado (Apólices, Renovações, Sinistros, Comissões) — não construído ainda | Sim, quando lançar |
| **Clínicas** | Usa só CRM genérico + Agendamentos (já incluso em todo plano) | **Não** — nenhuma tela extra a monetizar separadamente |
| **Imobiliárias** | Usa só CRM genérico + Agendamentos + Pipeline por corretor | **Não** — idem |

> Isso muda a comunicação do site: Clínicas e Imobiliárias vendem "CRM + IA configurado pro seu fluxo", sem menção a "módulo pago" — só Viagens (hoje) e Advocacia/Seguros (quando prontos) têm de fato um produto adicional por trás.

### Preço do módulo (hipótese a validar)

**R$147/mês por módulo de nicho**, empilhável sobre Starter ou Pro. **Incluso sem custo extra no Business** (1 módulo à escolha — é o que torna o tier mais caro claramente mais atrativo pra quem é do nicho).

Racional do valor: o Módulo de Viagens sozinho cobre o que hoje é vendido como sistema à parte no mercado de turismo (controle financeiro, geração de contrato/voucher, gestão de bloqueio aéreo) — sistemas desse tipo isolados custam na faixa de R$200-500/mês no mercado brasileiro. R$147 como complemento de um CRM que já resolve captação/atendimento/vendas é uma oferta agressiva de entrada, com margem pra ajustar pra cima depois de validar conversão.

**A validar antes de travar o preço definitivo:**
- Rodar o preço com 5-10 prospects reais do ICP de viagens antes do lançamento (sensibilidade de preço)
- Testar se módulo por nicho deveria ter preço diferente por complexidade (Advocacia/Seguros podem justificar preço diferente de Viagens quando prontos)

### Oferta de lançamento — Advocacia e Seguros
Como esses dois módulos ainda não existem, sugiro uma janela de **"fundador"**: quem se cadastrar na lista de espera da página de nicho (formulário de qualificação, seção 4) garante o módulo com **30% de desconto vitalício** quando lançar. Cria senso de urgência pra captar interesse real e já forma uma lista de beta testers pra validar o produto antes do lançamento oficial.

---

## 4. Formulário de qualificação nas páginas de nicho

Captura o lead **antes** de precisar de conta/trial, alimentando tanto o funil comercial quanto o IA Qualificadora (score) assim que o contato entra no CRM da própria Althos.

**Campos sugeridos (ajustar por nicho):**
- Nome, e-mail, telefone/WhatsApp (obrigatórios)
- Nº de unidades/filiais/agências
- Nº de funcionários/vendedores na equipe
- Usa algum sistema hoje? Qual? (texto livre — sinaliza objeção de troca)
- Faturamento mensal aproximado (faixas, não valor exato — reduz fricção)
- Maior dificuldade hoje (texto livre ou múltipla escolha por nicho, ex. viagens: "perder venda por demora", "financeiro sem controle", "prazo/processo perdido" pra advocacia)

**Uso comercial:** cada envio dispara automaticamente uma automação de nutrição (WhatsApp/e-mail) e entra classificado no funil comercial da própria Althos — dogfooding do produto.

---

## 5. Assentos extras (modelo híbrido)

| Plano | Usuários inclusos | Assento extra |
|---|---|---|
| Starter | 1 | Não disponível — precisa subir pra Pro |
| **Pro** | 6 | **+R$47/usuário/mês** (hipótese a validar) |
| Business | Ilimitado | Não se aplica |

Só o Pro tem add-on de assento — Starter é desenhado pra operação enxuta (1 usuário) e força upgrade natural quando a equipe cresce; Business já resolve de vez com ilimitado, sem precisar de complemento.

---

## 6. Tabela-resumo — cenários reais

| Cenário | Composição | Total/mês |
|---|---|---|
| Agência de viagens pequena (2 pessoas) | Starter + Módulo Viagens | R$137 + R$147 = **R$284** |
| Agência de viagens em crescimento (8 vendedores) | Pro + Módulo Viagens + 2 assentos extras | R$397 + R$147 + R$94 = **R$638** |
| Rede de clínicas (multi-unidade) | Pro (multi-tenant até 5 orgs) | **R$397** (sem módulo — não se aplica) |
| Escritório de advocacia médio (quando módulo existir) | Business (módulo incluso) | **R$697** |
| Imobiliária pequena | Starter | **R$137** |

---

## 7. Itens ainda em aberto

1. **Preço do módulo de nicho** (R$147) é ponto de partida — validar com prospects reais antes do lançamento.
2. **Preço do assento extra** (R$47) — idem.
3. **Regra técnica de "1 trial por CNPJ/telefone"** — como impedir múltiplos trials da mesma empresa (bloqueio por telefone verificado é o mais simples de começar).
4. **Congelamento de conta pós-trial** — definir prazo de retenção dos dados congelados antes de exclusão definitiva (ex.: 90 dias), pra política de privacidade/LGPD já escrita.
5. **Desconto "fundador" de Advocacia/Seguros** — definir prazo de validade da oferta (ex.: primeiros 20 clientes, ou até a data de lançamento oficial).

Quando esses 5 pontos estiverem fechados, a implementação vira leva de código: ajuste de `lib/plans/config.ts` + migração da tabela `plans`/`subscriptions` (trial_ends_at, congelamento), páginas `/planos` e de nicho, e o formulário de qualificação.
