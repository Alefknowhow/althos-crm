# Plano de Atualização do Site — Home + Páginas de Nicho

> Documento de planejamento de conteúdo. **Nenhum código será alterado nesta etapa** — isso aqui organiza o que vai em cada página, o que muda no que já existe, e quais recursos gráficos faltam. Depois de aprovado, viramos leva de implementação (código).

**Base:** [inventario-funcionalidades.md](./inventario-funcionalidades.md) — toda a copy abaixo deriva do que está descrito lá (funcionalidades reais) + das especificações de Advocacia/Seguros (roadmap).

**Nichos definidos:** Viagens · Clínicas · Imobiliárias · Advocacia · Corretoras de Seguros.

**Design:** mantém 100% o que já existe — tema Carbon dark (`#1a1a1a`/`#262626`/`#383838`), tipografia IBM Plex Sans, azul `#0f62fe`/gradiente accent, componentes `SiteShell`, `NicheLanding`, `PricingPlans`, botões e cards no padrão atual. Este plano é só conteúdo e estrutura — zero proposta de redesign.

---

## 1. Estrutura do site (mapa)

```
/                    → Home (funções do CRM, genérico, todos os nichos)
/viagens             → já existe, repaginada recentemente — mantém
/clinicas            → existe, revisar copy (ver seção 4)
/imobiliarias        → existe, revisar copy (ver seção 4)
/advocacia           → NOVA — página de nicho (spec-based, ver seção 5)
/seguros             → NOVA — página de nicho (spec-based, ver seção 5)
```

Páginas de nicho hoje ativas que **saem do ar** (ou viram redirect pra Home): `/veiculos`, `/trafego`, `/pequenas-empresas`. Decisão a confirmar antes de implementar — ver seção 7.

Todas as páginas de nicho reaproveitam o componente `NicheLanding` já existente (hero → dores → como resolve → recursos → casos de uso → FAQ → CTA final) — nenhuma estrutura nova, só o objeto de conteúdo em `lib/landing/niches.ts`.

---

## 2. Home — conteúdo por seção

A Home fala com **todo mundo**, então é organizada por **função do CRM**, não por nicho (os nichos ficam na seção "Segmentos", que linka pra cada página dedicada). Mapeamento seção → conteúdo:

| Seção atual | O que muda |
|---|---|
| **Hero** | Mantém a mensagem de dor→solução ("nenhum lead esquecido"). Sem mudança de estrutura. |
| **Pains** (motivos de perder venda) | Mantém — já é genérico e correto. |
| **Stats** | Mantém. |
| **Compare** (vs. planilha/concorrente) | Mantém. |
| **Ecosystem** | Mantém — visão macro do produto. |
| **Solutions** (abas por função, com screenshot) | **Expandir as abas.** Hoje cobre Pipeline/Tarefas/Dashboard/Automações/Insights. Adicionar abas ou substituir por: **Pipeline, Contatos, Tarefas & Agendamentos, Conversas/WhatsApp + Agente IA, Automações, Financeiro, Dashboard/Insights**. Isso é o coração da atualização — reflete o inventário completo, não só os 5 módulos originais. |
| **AI block** | Mantém — já cobre Agente IA + IA Qualificadora + Copiloto. Só ajustar a 4ª capacidade pra citar o Copiloto do Dashboard explicitamente (hoje fala genericamente de "relatórios em português"). |
| **Segments** (bento de nichos) | **Atualizar a lista para os 5 nichos definidos** (ver seção 3). |
| **Pricing** | Mantém — já reflete os planos reais. |
| **Onboarding** | Mantém. |
| **Geo/Sobre** | Mantém. |
| **FAQ** | Adicionar 1-2 perguntas novas: "O Althos serve pra qualquer tipo de negócio?" (respondendo que hoje tem módulos verticais dedicados pros 5 nichos) e "Tem módulo específico pra minha área?" com link cruzado pras 5 páginas. |
| **Final CTA** | Mantém. |

### Nova seção "Solutions" — as 7 abas propostas

1. **Pipeline** — funil visual, drag-and-drop, score de IA, filtros avançados *(screenshot existente: `screen-pipeline.png`)*
2. **Contatos** — ficha 360º do lead/cliente, segmentação, importação em massa *(screenshot novo — ver lista de imagens)*
3. **Tarefas & Agendamentos** — kanban/lista/calendário + agenda pública de horários *(screenshot existente: `screen-tasks.png`, + 1 novo pra agendamentos)*
4. **Conversas & Agente IA** — WhatsApp oficial + atendente 24h *(screenshot novo)*
5. **Automações** — sequências de follow-up, gatilhos, estatísticas *(screenshot existente: `screen-automacoes.png`)*
6. **Financeiro** — receitas/despesas, fluxo de caixa, DRE *(screenshot novo)*
7. **Dashboard & Insights** — KPIs configuráveis, copiloto de IA *(screenshots existentes: `screen-dashboard.png`, `screen-insights.png`)*

---

## 3. Segments (bento de nichos) — conteúdo novo

Substituir o array `SEGMENTS` (hoje 6 itens) por 5, um por nicho, mantendo o card "Nicho-âncora" (Viagens) em destaque:

| Nicho | Tag | Frase (bento) |
|---|---|---|
| **Agências de viagens** | Nicho-âncora | "Cotações, contratos e financeiro de viagem num só lugar — do 'quanto custa?' ao embarque." |
| **Clínicas e consultórios** | — | "Agendamentos, confirmações e retorno de pacientes sem fila no WhatsApp." |
| **Imobiliárias** | — | "Captação de leads e agendamento de visitas no piloto automático." |
| **Escritórios de advocacia** | Em breve* | "Processos, prazos e honorários organizados — sem planilha, sem prazo perdido." |
| **Corretoras de seguros** | Em breve* | "Apólices, renovações e comissões sob controle, do fechamento à renovação." |

`*` — ver decisão pendente na seção 7 sobre publicar ou não essas duas páginas antes dos módulos existirem.

Ícones: reaproveitar o estilo de ícone SVG inline já usado (linha única, 24×24, `strokeWidth 1.7`) — sugestões: advocacia = balança (ícone de justiça), seguros = escudo/guarda-chuva.

---

## 4. Páginas de nicho já existentes — revisão de copy

### `/clinicas`
Conteúdo atual já é coerente com o produto (agendamento 24h, atendente de IA, confirmação/redução de faltas, lembrete de retorno). **Não precisa reescrever.** Ajuste pontual sugerido: adicionar 1 bullet em "recursos" citando explicitamente **Automações** (hoje some entre as linhas) e destacar a **Ficha do paciente** (Contatos) como recurso nomeado.

### `/imobiliarias`
Mesma situação — conteúdo coerente (captação centralizada, IA 24h, agendamento de visita, funil por corretor). Ajuste pontual: citar **Relatórios**/exportação como recurso pra corretoras que reportam a incorporadoras.

Nenhuma das duas precisa de reescrita estrutural — o gap real está nas duas páginas novas abaixo.

---

## 5. Páginas de nicho novas — rascunho de conteúdo

> Aviso importante: Advocacia e Seguros ainda **não têm os módulos construídos** (só especificação em `inventario-funcionalidades.md`, seções 7-8). O rascunho abaixo já usa a estrutura padrão do `NicheLanding` (hero, dores, resolve, recursos, casos, faq, cta), mas a decisão de **publicar agora ou só depois dos módulos prontos** é o ponto de decisão da seção 7.

### `/advocacia`

**Eyebrow:** Para escritórios de advocacia
**H1 / accent:** "Nenhum prazo perdido," / "nenhum processo esquecido"
**Sub:** Escritório pequeno/médio vive de prazo e organização — perder um prazo fatal é o maior risco do negócio. O Althos centraliza processo, prazo, cliente e financeiro num só lugar, com alertas antes que seja tarde.
**Hero chips:** Agenda de prazos com alerta · Processos organizados · Honorários e parcelamento · Propostas de honorários

**Dores (4):**
1. *Prazo perdido por falta de controle* — planilha ou agenda de papel não avisa a tempo; um prazo fatal perdido vira erro grave e responsabilidade civil.
2. *Cliente sem retorno* — sem CRM, o advogado esquece de atualizar o cliente sobre o andamento, e a relação de confiança se desgasta.
3. *Honorário sem controle* — parcelas, êxito e custas processuais soltos em anotações, sem visão de quanto tem a receber por processo.
4. *Captação de cliente sem processo* — consulta inicial e proposta de honorários feitas por WhatsApp solto, sem padrão nem follow-up.

**Como resolve (3):**
1. *Agenda de prazos com alerta escalonado* — cada prazo do processo entra no sistema com contagem em dias úteis e aviso automático antes do vencimento.
2. *Processo com checklist e cliente sempre informado* — cada fase do processo é visível, e follow-ups automáticos avisam o cliente sem trabalho manual.
3. *Honorários e proposta organizados* — dos honorários por processo à proposta que vira contrato com um clique.

**Recursos (6):** Agenda de prazos com alerta · Gestão de processos com checklist · Modelos de petição/procuração/contrato · Honorários (fixo/hora/êxito) com parcelamento · Propostas de honorários com link público · Funil de captação de novos clientes

**Casos de uso (4):**
- Prazo de contestação vence em 3 dias — o sistema já avisou o advogado responsável há uma semana.
- Cliente pergunta "como está meu processo?" — a resposta está pronta, sem precisar abrir a pasta física.
- Fim do mês — relatório mostra quanto ainda falta receber de honorários, por processo e por cliente.
- Consulta inicial vira proposta de honorários formal, enviada por link, sem digitar tudo nas mensagens do WhatsApp.

**FAQ (5):** Serve pra escritório pequeno/individual? · Consigo controlar prazo de vários processos ao mesmo tempo? · Dá pra gerar petição automaticamente? · O sistema calcula prazo em dias úteis considerando feriado forense? · Tem fidelidade?

**CTA final:** "Pare de arriscar um prazo perdido" / "Organize processos, prazos e honorários num só lugar."

---

### `/seguros`

**Eyebrow:** Para corretoras de seguros
**H1 / accent:** "Nenhuma renovação perdida," / "nenhuma comissão esquecida"
**Sub:** O maior risco de uma corretora não é vender a primeira apólice — é perder a renovação pra outra corretora por falta de acompanhamento. O Althos avisa antes, com cliente e apólice organizados num só lugar.
**Hero chips:** Painel de renovações · Controle de comissões · Sinistro acompanhado · Cotação comparativa

**Dores (4):**
1. *Renovação perdida por falta de aviso* — sem controle de vencimento, o cliente é abordado por outra corretora antes e a receita recorrente vai embora.
2. *Comissão não conferida* — sem conciliar o que a seguradora paga com o que deveria pagar, a corretora perde receita sem perceber.
3. *Sinistro sem acompanhamento* — cliente ansioso, sem retorno claro sobre o andamento junto à seguradora — o pior momento pra ficar sem resposta.
4. *Cotação feita no improviso* — comparar seguradoras manualmente, sem registro organizado pra apresentar ao cliente.

**Como resolve (3):**
1. *Painel de renovações com antecedência* — apólices a vencer em 30/60/90 dias aparecem antes que o cliente esqueça — ou pior, seja abordado por outra corretora.
2. *Comissão conciliada automaticamente* — o esperado por apólice é comparado ao pago pela seguradora, expondo divergência na hora.
3. *Sinistro com status visível* — o cliente sabe em que pé está o sinistro sem precisar ligar toda semana.

**Recursos (6):** Painel de próximas renovações · Cadastro completo de apólices e endossos · Acompanhamento de sinistro com checklist · Conciliação de comissões por seguradora · Cotação comparativa entre seguradoras · Proposta em PDF com a marca da corretora

**Casos de uso (4):**
- Apólice vence em 45 dias — o corretor já recebe o alerta e liga antes do cliente pensar em trocar.
- Comissão paga veio menor que o esperado — o sistema aponta a divergência pra correr atrás com a seguradora.
- Cliente sofre um sinistro — o status muda em tempo real e ele acompanha sem precisar perguntar.
- Cliente pede cotação de seguro de carro — a corretora compara 3 seguradoras e manda a proposta em PDF em minutos.

**FAQ (5):** Funciona pra corretora individual ou pequena equipe? · Consigo controlar comissão de mais de uma seguradora? · O sistema avisa a renovação automaticamente? · Dá pra acompanhar sinistro de dentro do sistema? · Tem fidelidade?

**CTA final:** "Não deixe nenhuma renovação passar batido" / "Organize apólices, comissões e sinistros num só lugar."

---

## 6. Recursos gráficos — lista de imagens necessárias

Convenção existente: pasta `public/home/` para screenshots genéricos usados na Home, formato PNG, nome `screen-{funcionalidade}.png`. Proposta: manter o mesmo padrão e criar `public/niches/{nicho}/` pras imagens específicas de cada página de nicho (hoje as páginas de nicho **não usam nenhuma imagem**, só ícones SVG inline — então isso é novo, ver decisão na seção 7 sobre se vale adicionar screenshot nas páginas de nicho ou manter só texto+ícone, que é o padrão atual do `NicheLanding`).

### Já existentes (reaproveitar)
- `public/home/screen-pipeline.png`
- `public/home/screen-dashboard.png`
- `public/home/screen-automacoes.png`
- `public/home/screen-insights.png`
- `public/home/screen-tasks.png`

### Novos — pra seção "Solutions" da Home (7 abas)
- `screen-contatos.png` — ficha de contato/lead aberta, mostrando tags/segmentação
- `screen-conversas.png` — inbox do WhatsApp com uma conversa aberta e o indicador do Agente IA
- `screen-financeiro.png` — dashboard do Financeiro (gráfico de fluxo de caixa + KPIs)
- `screen-agendamentos.png` *(opcional, se a aba 3 virar 2 imagens)* — tela de agendamento público ou lista de compromissos

### Novos — se decidirmos usar screenshot nas páginas de nicho (opcional, ver seção 7)
Um screenshot "hero" por nicho, mostrando a tela mais representativa daquele módulo:
- **Viagens:** `screen-reservas.png` — tela de Reservas com o checklist visível
- **Clínicas:** `screen-agendamentos-publico.png` — a página pública de agendamento
- **Imobiliárias:** `screen-pipeline-corretor.png` — pipeline filtrado por corretor
- **Advocacia:** *(não gerar agora — módulo não existe; usar mockup ilustrativo genérico ou adiar a imagem até o módulo ser construído)*
- **Seguros:** *(idem — adiar)*

### Ícones novos (SVG inline, mesmo estilo dos já existentes em `SEGMENTS`)
- Advocacia: balança da justiça
- Seguros: escudo ou guarda-chuva

### Nenhuma imagem stock/ilustração nova
O site não usa fotografia stock hoje (só screenshots reais do produto + ícones vetoriais) — manter essa linguagem visual. Não introduzir banco de imagens externo.

---

## 7. Decisões pendentes antes de implementar

1. **Publicar `/advocacia` e `/seguros` agora (como "em breve"/waitlist) ou só depois que os módulos existirem?** Recomendo marcar com badge "Em breve" no bento da Home linkando pra uma versão simplificada da página (dores + solução prometida, sem "recursos" detalhados de tela), até o módulo ser construído — evita prometer recurso que ainda não existe.
2. **Desligar ou redirecionar `/veiculos`, `/trafego`, `/pequenas-empresas`?** Se já têm tráfego/SEO indexado, considerar redirect 301 pra Home em vez de 404.
3. **Screenshot nas páginas de nicho — sim ou não?** Hoje o `NicheLanding` é 100% texto+ícone. Adicionar imagem é uma mudança de estrutura (ainda que pequena) — decidir se vale o esforço de captura de tela por nicho ou se mantemos o padrão atual.
4. **Abas da seção "Solutions" da Home: 5 → 7 é aceitável na UI (tabbar), ou reduzimos pra 6 combinando "Tarefas & Agendamentos" em uma só aba com "Automações"?** Vale testar visualmente antes de decidir.

Assim que essas 4 decisões estiverem fechadas, a implementação vira leva de código no padrão de sempre (ajuste de `niches.ts`, `AlthosHome.tsx`, captura dos screenshots novos, typecheck/build/deploy).
