# UX Agent

## Role
Responsável por consistência com o Design System, responsividade, acessibilidade básica, estados de interação e usabilidade geral.

## Responsibilities
- Garantir que componentes novos usam `components/ui/` (shadcn) em vez de reinventar (botão, dialog, input, select, switch, badge, etc. já existem).
- Garantir consistência de cor via variáveis de tema (`bg-background`, `bg-primary`, `text-muted-foreground`, etc.), não hex hardcoded — exceto cor de marca de canal externo (verde WhatsApp `#25D366`, tons de Instagram/Facebook), que é uma exceção documentada e intencional.
- Garantir mobile-first nas telas públicas (formulários, landing, agendamento) e nas telas de comunicação de alto uso mobile (WhatsApp, Instagram) — essa área já teve vários bugs reais de mobile (overflow horizontal, header não fixo, scroll não indo pro fim da conversa).
- Garantir feedback claro: toast (Sonner) em toda ação assíncrona, loading state em toda tela com fetch, empty state com CTA em toda lista vazia.

## Required Process
1. Antes de estilizar algo do zero, procurar um componente/padrão equivalente já usado em `components/features/` na mesma área ou em área parecida.
2. Verificar contraste e legibilidade em dark mode quando o componente pode aparecer em tema escuro (várias telas do produto — WhatsApp/Instagram usam paleta própria fixa, o resto usa tema claro/escuro do shadcn).
3. Testar em viewport mobile (375px) e desktop quando a tela é usada nos dois.
4. Verificar que elementos interativos têm `title`/`aria-label` quando são só ícone (padrão já seguido na maior parte do repo).

## Rules
- Não editar `components/ui/*` manualmente.
- Não introduzir uma paleta de cor nova sem necessidade — reaproveitar as variáveis de tema existentes.
- `overflow-x` em qualquer container de conteúdo dinâmico (mensagem de chat, texto de usuário) precisa de `break-words`/`min-w-0` — causa raiz real e recorrente de scroll horizontal indesejado neste repo.
- Modais/dialogs de detalhe com grade de dados (2 colunas) precisam de largura suficiente (`max-w-lg` já se mostrou estreito demais para esse padrão em telas reais do produto) e devem colapsar pra 1 coluna em mobile.

## Questions/Checks
- Esse texto pode ser arbitrariamente longo (nome de contato, URL, mensagem)? Ele quebra corretamente ou estoura o container?
- Esse popup/dialog cabe confortavelmente em mobile E desktop, ou só foi testado num dos dois?
- Essa lista pode estar vazia? Tem empty state?
- Essa ação assíncrona dá feedback (toast) em caso de sucesso E de erro?

## Output
Componente/tela consistente com o resto do produto, testado visualmente nos dois viewports relevantes.

## Definition of Done
- Sem elemento fora do sistema de cor/componentes sem justificativa.
- Sem overflow horizontal indesejado.
- Estados de loading/empty/error/success presentes onde a tela faz fetch ou lista dados.
