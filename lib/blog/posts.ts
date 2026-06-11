/**
 * Engine simples de blog sem dependências externas.
 * O conteúdo é modelado em blocos (heading/parágrafo/lista/citação) e
 * renderizado por components/site/PostBody.tsx. Cada post é otimizado para SEO
 * (title, description, headings, palavras-chave) e tráfego orgânico.
 *
 * Para adicionar um post: acrescente um objeto a POSTS. O slug vira a URL
 * /blog/[slug]. Mantenha 1 H1 (o title) e use h2/h3 nos blocos.
 */

export type PostBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'cta'; text: string }

export interface BlogPost {
  slug: string
  title: string
  description: string
  category: BlogCategory
  author: string
  date: string            // ISO yyyy-mm-dd
  readingMinutes: number
  excerpt: string
  blocks: PostBlock[]
}

export type BlogCategory =
  | 'Meta Ads'
  | 'Google Ads'
  | 'Funil de Vendas'
  | 'Gestão de Equipe'
  | 'Treinamento de Vendas'
  | 'WhatsApp API'

export const BLOG_CATEGORIES: BlogCategory[] = [
  'Meta Ads',
  'Google Ads',
  'Funil de Vendas',
  'Gestão de Equipe',
  'Treinamento de Vendas',
  'WhatsApp API',
]

export const POSTS: BlogPost[] = [
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'meta-ads-leads-qualificados',
    title: 'Meta Ads: como gerar leads qualificados (e não só curtidas)',
    description:
      'Guia prático de Meta Ads para gerar leads qualificados: estrutura de campanha, públicos, criativos e integração com CRM para medir o que realmente importa — vendas.',
    category: 'Meta Ads',
    author: 'Equipe Althos',
    date: '2026-05-20',
    readingMinutes: 7,
    excerpt:
      'Anunciar no Facebook e Instagram é fácil. Difícil é transformar cliques em clientes. Veja como estruturar campanhas de Meta Ads focadas em leads que realmente compram.',
    blocks: [
      { type: 'p', text: 'Investir em Meta Ads sem um processo de qualificação é como abrir a torneira sem ter onde guardar a água. Você gera volume, mas perde a maior parte no caminho. Neste guia, você vai entender como estruturar campanhas para atrair leads qualificados e, principalmente, como medir o que importa: vendas, não curtidas.' },
      { type: 'h2', text: 'Comece pelo objetivo certo' },
      { type: 'p', text: 'O erro mais comum é escolher o objetivo de campanha errado. Se você quer leads, não otimize para "engajamento" ou "alcance". Use objetivos de "Cadastros" (formulário instantâneo) ou "Vendas" com conversões rastreadas. O algoritmo da Meta entrega para quem tem maior probabilidade de realizar a ação que você otimiza.' },
      { type: 'h2', text: 'Estruture a campanha em 3 camadas' },
      { type: 'ol', items: [
        'Topo (frio): públicos amplos e interesses. Objetivo de gerar reconhecimento e capturar os primeiros leads.',
        'Meio (morno): remarketing de quem engajou com vídeos, visitou o site ou abriu o formulário sem concluir.',
        'Fundo (quente): remarketing de quem demonstrou intenção clara. Aqui o custo por lead é menor e a conversão é maior.',
      ] },
      { type: 'h2', text: 'Públicos que funcionam' },
      { type: 'ul', items: [
        'Públicos semelhantes (lookalike) a partir da sua base de clientes — quanto melhor a base, melhor o público.',
        'Remarketing de visitantes do site e de quem interagiu no Instagram/Facebook.',
        'Interesses combinados com comportamento de compra, testados um de cada vez.',
      ] },
      { type: 'h2', text: 'Criativos: pare o scroll e qualifique' },
      { type: 'p', text: 'O criativo é onde a qualificação começa. Uma headline específica ("Consultoria para clínicas que querem lotar a agenda") filtra naturalmente quem não é seu público. Use prova social, mostre o resultado e deixe claro para quem é. Teste pelo menos 3 variações por conjunto.' },
      { type: 'h2', text: 'O elo perdido: integração com o CRM' },
      { type: 'p', text: 'Aqui está o que separa quem desperdiça verba de quem escala. Quando os leads do Meta Ads caem direto no seu CRM, com a origem identificada por campanha, você consegue responder em segundos e medir quais campanhas geram vendas — não só leads.' },
      { type: 'quote', text: 'Um lead respondido em até 5 minutos tem até 9x mais chance de converter do que um respondido depois de 30 minutos.' },
      { type: 'p', text: 'No Althos CRM, cada lead do Meta Ads chega com a origem da campanha, é atendido automaticamente por IA 24h e entra no funil. No fim do mês, você vê exatamente qual campanha trouxe receita — e corta o que não funciona.' },
      { type: 'cta', text: 'Conecte seus anúncios ao funil e meça vendas, não curtidas.' },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'como-montar-funil-de-vendas',
    title: 'Como montar um funil de vendas que converte (passo a passo)',
    description:
      'Aprenda a montar um funil de vendas do zero: etapas, critérios de avanço, follow-up e métricas. Um guia prático para parar de perder leads por desorganização.',
    category: 'Funil de Vendas',
    author: 'Equipe Althos',
    date: '2026-05-14',
    readingMinutes: 8,
    excerpt:
      'A maioria das vendas é perdida não por falta de leads, mas por falta de processo. Veja como estruturar um funil que conduz o cliente da primeira conversa ao fechamento.',
    blocks: [
      { type: 'p', text: 'Funil de vendas é a representação visual da jornada que um lead percorre desde o primeiro contato até virar cliente. Sem ele, sua equipe vende no improviso: esquece de retornar, não sabe em que pé está cada negociação e perde oportunidades por puro descontrole.' },
      { type: 'h2', text: 'As etapas essenciais de um funil' },
      { type: 'p', text: 'Não existe funil universal, mas a maioria dos negócios funciona bem com estas etapas. Adapte ao seu ciclo de venda:' },
      { type: 'ol', items: [
        'Novo lead: acabou de chegar, ainda não foi contatado.',
        'Em contato: você já iniciou a conversa e está qualificando.',
        'Qualificado: o lead tem perfil, interesse e poder de decisão.',
        'Proposta enviada: a oferta está na mesa.',
        'Negociação: ajustes finais, objeções, condições.',
        'Fechado (ganho/perdido): o desfecho — e sempre registre o motivo da perda.',
      ] },
      { type: 'h2', text: 'Defina critérios claros de avanço' },
      { type: 'p', text: 'O maior erro em funis é mover o lead "no feeling". Cada etapa precisa de um critério objetivo de entrada. Por exemplo: só vai para "Qualificado" quem confirmou orçamento e prazo. Isso evita um funil inflado de oportunidades que nunca vão fechar.' },
      { type: 'h2', text: 'Follow-up: onde as vendas acontecem' },
      { type: 'p', text: 'Estudos mostram que a maioria das vendas exige vários contatos, mas grande parte dos vendedores desiste no primeiro "não". Um bom funil tem follow-up programado em cada etapa — e o ideal é que ele seja automático.' },
      { type: 'ul', items: [
        'Lead parado há 2 dias em "Em contato"? Dispare uma mensagem automática.',
        'Proposta enviada e sem resposta há 3 dias? Crie uma tarefa de retorno.',
        'Negócio perdido? Programe uma reativação em 90 dias.',
      ] },
      { type: 'h2', text: 'Métricas que mostram a saúde do funil' },
      { type: 'ul', items: [
        'Taxa de conversão por etapa: onde os leads travam?',
        'Tempo médio em cada etapa: onde está o gargalo?',
        'Motivos de perda: o que mais derruba suas vendas?',
        'Previsão de receita: quanto há no funil ponderado pela probabilidade.',
      ] },
      { type: 'quote', text: 'O que não é medido não é gerenciado. Um funil sem métricas é só uma lista de tarefas bonita.' },
      { type: 'p', text: 'No Althos CRM, o funil é visual e arrastável, com indicadores de tempo parado, leads em risco e previsão de receita automática. Você vê o gargalo na hora e age antes de perder a venda.' },
      { type: 'cta', text: 'Monte seu funil visual e pare de perder leads por desorganização.' },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'sdr-closer-cs-estrutura-time-vendas',
    title: 'SDR, Closer e CS: como estruturar um time de vendas que escala',
    description:
      'Entenda os papéis de SDR, Closer e Customer Success, quando contratar cada um e como treiná-los. O modelo de time de vendas que permite escalar com previsibilidade.',
    category: 'Treinamento de Vendas',
    author: 'Equipe Althos',
    date: '2026-05-08',
    readingMinutes: 9,
    excerpt:
      'Vendedor que faz tudo sozinho é gargalo. Separar prospecção, fechamento e pós-venda em papéis especializados é o que permite escalar. Veja como estruturar.',
    blocks: [
      { type: 'p', text: 'Conforme a operação cresce, o "vendedor faz-tudo" vira o maior gargalo do negócio. A solução que empresas de alto crescimento adotaram é simples: especializar. Cada etapa da venda passa a ter um responsável. Vamos aos três papéis fundamentais.' },
      { type: 'h2', text: 'SDR — o especialista em prospecção e qualificação' },
      { type: 'p', text: 'O SDR (Sales Development Representative) é responsável pelo topo do funil: fazer o primeiro contato, qualificar o lead e agendar a reunião para o closer. Ele não fecha vendas — ele entrega oportunidades quentes e bem qualificadas.' },
      { type: 'ul', items: [
        'Responde leads rapidamente (velocidade é tudo no topo).',
        'Aplica critérios de qualificação (perfil, dor, orçamento, decisor).',
        'Agenda reuniões e passa o contexto completo para o closer.',
      ] },
      { type: 'h2', text: 'Closer — o especialista em fechamento' },
      { type: 'p', text: 'O closer recebe leads já qualificados e foca no que faz de melhor: conduzir a negociação, lidar com objeções e fechar. Como ele só fala com quem tem real intenção, sua taxa de conversão é muito maior do que a de um vendedor que prospecta e fecha ao mesmo tempo.' },
      { type: 'h3', text: 'Por que separar SDR e closer funciona' },
      { type: 'p', text: 'Prospecção e fechamento exigem perfis e energias diferentes. Quem fica o dia todo recebendo "nãos" na prospecção raramente está no melhor estado para uma negociação delicada. Separar protege o foco e a performance de cada um.' },
      { type: 'h2', text: 'CS — o especialista em retenção e expansão' },
      { type: 'p', text: 'O Customer Success (CS) entra depois da venda. Sua missão é garantir que o cliente tenha resultado, reduzir cancelamentos e gerar novas vendas (upsell e indicações). Em negócios recorrentes, o CS costuma ser o papel com maior impacto no faturamento de longo prazo.' },
      { type: 'h2', text: 'Quando contratar cada papel' },
      { type: 'ol', items: [
        'Comece com vendedores full-cycle (fazem tudo) enquanto o volume é baixo.',
        'Contrate o primeiro SDR quando a prospecção começar a roubar o tempo de fechamento.',
        'Estruture o CS quando a retenção e o pós-venda passarem a definir o crescimento.',
      ] },
      { type: 'h2', text: 'O treinamento que faz a diferença' },
      { type: 'ul', items: [
        'Scripts e playbooks por etapa (abordagem, qualificação, objeções).',
        'Role-play semanal: treinar a venda antes de fazê-la com o cliente real.',
        'Revisão de gravações e métricas individuais para feedback objetivo.',
      ] },
      { type: 'quote', text: 'Time especializado sem processo registrado é talento desperdiçado. O CRM é onde o playbook vira execução.' },
      { type: 'p', text: 'No Althos CRM, SDRs qualificam com a ajuda da IA, closers recebem leads com todo o histórico e o time de CS acompanha clientes e reativações — tudo com papéis, permissões e ranking de produtividade.' },
      { type: 'cta', text: 'Dê ao seu time a estrutura para vender com previsibilidade.' },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'google-ads-ou-meta-ads',
    title: 'Google Ads ou Meta Ads: qual escolher para o seu negócio?',
    description:
      'Google Ads x Meta Ads: as diferenças de intenção, custo e funil. Entenda quando usar cada um (ou os dois) e como medir o retorno real de cada canal.',
    category: 'Google Ads',
    author: 'Equipe Althos',
    date: '2026-05-02',
    readingMinutes: 6,
    excerpt:
      'Não é uma guerra: é uma questão de momento e intenção. Veja a diferença entre demanda capturada e demanda gerada — e como decidir onde investir.',
    blocks: [
      { type: 'p', text: 'A pergunta "Google Ads ou Meta Ads?" aparece em toda reunião de marketing. A resposta honesta é: depende do tipo de demanda que você quer atingir. Entender essa diferença economiza muito dinheiro.' },
      { type: 'h2', text: 'Google Ads: captura demanda existente' },
      { type: 'p', text: 'Quem pesquisa "dentista em São Paulo" ou "CRM para imobiliária" já está procurando. O Google Ads coloca você na frente dessa pessoa no momento exato da intenção. O custo por clique tende a ser mais alto, mas a intenção é maior — ótimo para fundo de funil.' },
      { type: 'ul', items: [
        'Ideal quando já existe procura ativa pelo seu produto/serviço.',
        'Alta intenção: o lead já sabe o que quer.',
        'Excelente para serviços locais e buscas específicas.',
      ] },
      { type: 'h2', text: 'Meta Ads: gera demanda nova' },
      { type: 'p', text: 'No Facebook e Instagram, as pessoas não estão procurando você — estão rolando o feed. O Meta Ads é imbatível para gerar interesse em quem ainda não sabia que precisava da sua solução. Custo por lead menor, mas exige mais qualificação e nutrição.' },
      { type: 'ul', items: [
        'Ideal para criar demanda e alcançar quem ainda não procura.',
        'Forte em segmentação por perfil, interesses e comportamento.',
        'Ótimo para topo e meio de funil, com remarketing poderoso.',
      ] },
      { type: 'h2', text: 'A resposta na maioria dos casos: os dois' },
      { type: 'p', text: 'Meta Ads gera a demanda e aquece o público; Google Ads captura quem passou a procurar pela sua marca ou solução. Juntos, cobrem a jornada inteira. A decisão de por onde começar depende do seu orçamento e do quanto já existe de procura pelo que você vende.' },
      { type: 'h2', text: 'O que realmente define o vencedor: medição' },
      { type: 'p', text: 'De nada adianta debater canais se você não mede qual deles gera venda. Sem origem rastreada no CRM, você decide no escuro. Com ela, descobre que — por exemplo — o Google traz menos leads, mas converte o dobro; ou que o Meta enche o funil que o Google fecha.' },
      { type: 'quote', text: 'O melhor canal é aquele que, no seu CRM, mostra o menor custo por venda — não por clique ou por lead.' },
      { type: 'p', text: 'No Althos CRM, cada lead carrega a origem da campanha, e os relatórios mostram custo por venda por canal. Você para de adivinhar e passa a investir onde o retorno é real.' },
      { type: 'cta', text: 'Meça o retorno real de cada canal direto no seu funil.' },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'gestao-equipe-vendas-metricas',
    title: 'Gestão de equipe de vendas: 7 métricas que todo gestor deve acompanhar',
    description:
      'As 7 métricas essenciais para gerir um time de vendas com clareza: conversão, ciclo de venda, ticket médio, atividades, follow-up, taxa de no-show e ranking.',
    category: 'Gestão de Equipe',
    author: 'Equipe Althos',
    date: '2026-04-25',
    readingMinutes: 7,
    excerpt:
      'Gerir vendas no "achismo" custa caro. Estas 7 métricas transformam sua gestão em decisão baseada em dados — e mostram exatamente onde agir.',
    blocks: [
      { type: 'p', text: 'Gerir uma equipe de vendas sem métricas é dirigir olhando só pelo retrovisor. Você sabe o que já aconteceu (o faturamento do mês), mas não consegue agir a tempo. As 7 métricas a seguir dão visão de presente e futuro.' },
      { type: 'h2', text: '1. Taxa de conversão por etapa' },
      { type: 'p', text: 'Não basta saber a conversão geral. Veja em qual etapa os leads travam. Se muita gente entra como "qualificado" mas poucos chegam a "proposta", o problema está na abordagem comercial, não na geração de leads.' },
      { type: 'h2', text: '2. Ciclo de venda' },
      { type: 'p', text: 'Quanto tempo, em média, um lead leva do primeiro contato ao fechamento? Ciclos que aumentam sem explicação indicam gargalos no processo ou leads cada vez menos qualificados.' },
      { type: 'h2', text: '3. Ticket médio' },
      { type: 'p', text: 'O valor médio por venda. Acompanhar por vendedor revela quem vende mais barato (e poderia subir) e quem domina vendas maiores (e poderia treinar os demais).' },
      { type: 'h2', text: '4. Atividades por vendedor' },
      { type: 'p', text: 'Ligações, mensagens, reuniões. Resultado é consequência de atividade. Quando alguém está abaixo da meta, o número de atividades quase sempre explica antes de qualquer outra coisa.' },
      { type: 'h2', text: '5. Taxa de follow-up' },
      { type: 'p', text: 'Quantos leads recebem o retorno programado? Essa é a métrica mais negligenciada e a que mais dinheiro deixa na mesa. Automatizar o follow-up costuma ser o ajuste de maior impacto imediato.' },
      { type: 'h2', text: '6. Taxa de no-show' },
      { type: 'p', text: 'Em operações com reuniões e agendamentos, faltas matam a produtividade. Lembretes automáticos por WhatsApp reduzem drasticamente o no-show.' },
      { type: 'h2', text: '7. Ranking e produtividade individual' },
      { type: 'p', text: 'Comparar performance de forma transparente cria saudável competição e revela quem precisa de apoio. Mas só funciona com dados confiáveis — registrados, não estimados.' },
      { type: 'quote', text: 'Gestão de vendas é 80% processo e 20% inspiração. As métricas são o termômetro do processo.' },
      { type: 'p', text: 'No Althos CRM, todas essas métricas aparecem em dashboards automáticos, com ranking de vendedores, previsão de receita e alertas de leads em risco. O gestor para de cobrar planilha e passa a agir sobre o que importa.' },
      { type: 'cta', text: 'Tenha as métricas da sua equipe em tempo real, sem planilha.' },
    ],
  },
  // ─── META ADS ──────────────────────────────────────────────────────────────
  {
    slug: 'meta-ads-publico-lookalike',
    title: 'Público semelhante (lookalike) no Meta Ads: o guia definitivo',
    description:
      'Como criar públicos semelhantes (lookalike) no Meta Ads que realmente convertem: qual base usar, percentual ideal e como combinar com remarketing.',
    category: 'Meta Ads',
    author: 'Equipe Althos',
    date: '2026-05-22',
    readingMinutes: 6,
    excerpt:
      'O público semelhante é a arma mais subutilizada do Meta Ads. O segredo não está na ferramenta, mas na qualidade da base que você entrega ao algoritmo.',
    blocks: [
      { type: 'p', text: 'O público semelhante (lookalike) pega uma lista sua — clientes, leads quentes, compradores — e pede à Meta para encontrar pessoas parecidas. Bem usado, é a forma mais barata de escalar leads qualificados. Mal usado, é só queima de verba.' },
      { type: 'h2', text: 'Tudo começa pela base de origem' },
      { type: 'p', text: 'O algoritmo só é tão bom quanto a lista que você dá a ele. Um lookalike de "todos que visitaram o site" é fraco. Um lookalike de "clientes que compraram acima do ticket médio" é ouro. Quanto mais específica e valiosa a base, melhor o público gerado.' },
      { type: 'ul', items: [
        'Melhor base: clientes que realmente compraram (idealmente os de maior valor).',
        'Boa base: leads qualificados que avançaram no funil.',
        'Base fraca: lista genérica de visitantes ou seguidores.',
      ] },
      { type: 'h2', text: 'Qual percentual escolher (1% a 10%)' },
      { type: 'p', text: 'O percentual define o tamanho e a precisão. 1% é o público mais parecido com a sua base (mais qualificado, menor alcance). 5% a 10% amplia o alcance, mas dilui a semelhança. Comece em 1%–2% e suba conforme precisar de volume.' },
      { type: 'h2', text: 'Combine lookalike com remarketing' },
      { type: 'p', text: 'Lookalike preenche o topo do funil com gente nova e parecida com seus melhores clientes. O remarketing recupera quem já interagiu. Rodar os dois em conjunto cobre desde a descoberta até o fechamento.' },
      { type: 'quote', text: 'Um lookalike só é tão inteligente quanto a base que você alimenta. Lixo entra, lixo sai.' },
      { type: 'p', text: 'No Althos CRM, sua base de clientes fica organizada e segmentada, pronta para exportar como base de origem dos seus melhores públicos semelhantes — e você ainda mede quais campanhas trazem os clientes de maior valor.' },
      { type: 'cta', text: 'Transforme sua base de clientes nos melhores públicos do Meta Ads.' },
    ],
  },
  {
    slug: 'meta-ads-criativos-que-convertem',
    title: 'Criativos de Meta Ads que convertem: a anatomia do anúncio que vende',
    description:
      'O que faz um criativo de Meta Ads converter: gancho, prova, oferta e CTA. Estrutura prática, formatos que funcionam e como testar variações.',
    category: 'Meta Ads',
    author: 'Equipe Althos',
    date: '2026-05-16',
    readingMinutes: 6,
    excerpt:
      'No Meta Ads, o criativo é 80% do resultado. Veja a anatomia de um anúncio que para o scroll, qualifica e gera lead — e como testar do jeito certo.',
    blocks: [
      { type: 'p', text: 'Com a automatização da segmentação, o criativo virou a principal alavanca de performance no Meta Ads. É ele quem para o scroll, comunica a oferta e filtra quem é (ou não) seu público. Vamos à anatomia de um criativo que converte.' },
      { type: 'h2', text: '1. Gancho: os 3 primeiros segundos' },
      { type: 'p', text: 'Se o início não prende, nada mais importa. Comece com a dor do cliente, uma pergunta direta ou um resultado surpreendente. Em vídeo, mostre movimento e fala nos primeiros segundos. No estático, uma headline forte e visual contrastante.' },
      { type: 'h2', text: '2. Prova: por que acreditar em você' },
      { type: 'ul', items: [
        'Depoimentos reais de clientes.',
        'Números e resultados concretos.',
        'Antes e depois, prints de conversas, casos.',
      ] },
      { type: 'h2', text: '3. Oferta clara e para quem é' },
      { type: 'p', text: 'Diga exatamente o que a pessoa ganha e para quem aquilo serve. Especificidade qualifica: "para clínicas que querem lotar a agenda" afasta quem não é público e atrai quem é.' },
      { type: 'h2', text: '4. CTA: o próximo passo óbvio' },
      { type: 'p', text: 'Um único pedido claro: "Chame no WhatsApp", "Preencha o formulário", "Agende uma avaliação". Mais de um CTA confunde e derruba a conversão.' },
      { type: 'h2', text: 'Como testar sem desperdiçar' },
      { type: 'p', text: 'Teste uma variável por vez: mude só o gancho, depois só a oferta. Rode pelo menos 3 variações por conjunto e dê tempo de a Meta otimizar antes de julgar. E o teste de verdade não termina no clique.' },
      { type: 'quote', text: 'Um criativo que gera muitos leads ruins é pior do que um que gera poucos leads bons.' },
      { type: 'p', text: 'No Althos CRM, você vê quais criativos trazem leads que viram venda — não só os que geram cliques baratos. Assim, escala o que dá lucro e corta o que só infla métrica.' },
      { type: 'cta', text: 'Descubra quais criativos trazem clientes, não só cliques.' },
    ],
  },
  {
    slug: 'meta-ads-orcamento-quanto-investir',
    title: 'Quanto investir em Meta Ads? Como definir o orçamento certo',
    description:
      'Como definir o orçamento de Meta Ads sem chutar: cálculo por meta de vendas, CPL, fase de aprendizado e quando escalar a verba com segurança.',
    category: 'Meta Ads',
    author: 'Equipe Althos',
    date: '2026-05-10',
    readingMinutes: 6,
    excerpt:
      '"Quanto devo investir em anúncios?" A resposta não é um número mágico — é uma conta. Veja como calcular o orçamento a partir da sua meta de vendas.',
    blocks: [
      { type: 'p', text: 'A pergunta certa não é "quanto gastar", e sim "quanto preciso investir para bater minha meta". Orçamento de tráfego é cálculo, não palpite. Vamos à conta.' },
      { type: 'h2', text: 'Comece pela meta, não pela verba' },
      { type: 'ol', items: [
        'Defina quantas vendas você quer no mês.',
        'Use sua taxa de conversão de lead para venda para descobrir quantos leads precisa.',
        'Multiplique pelos leads pelo seu custo por lead (CPL) estimado.',
      ] },
      { type: 'p', text: 'Exemplo: meta de 10 vendas, conversão de 20% (logo, 50 leads), CPL de R$ 30 = R$ 1.500 de investimento mínimo. Sem saber sua conversão real, você chuta — e por isso o CRM é parte da conta.' },
      { type: 'h2', text: 'Respeite a fase de aprendizado' },
      { type: 'p', text: 'A Meta precisa de volume de conversões para otimizar (a famosa fase de aprendizado). Orçamentos muito baixos nunca saem dela, e o desempenho fica instável. Garanta verba suficiente para gerar conversões consistentes por semana.' },
      { type: 'h2', text: 'Quando (e como) escalar' },
      { type: 'ul', items: [
        'Escale quando o custo por venda estiver dentro do que é lucrativo para você.',
        'Aumente a verba em incrementos (20%–30%) para não reiniciar o aprendizado.',
        'Antes de escalar, garanta que o time dá conta do volume de leads.',
      ] },
      { type: 'quote', text: 'Não existe orçamento certo sem saber seu custo por venda. E custo por venda só existe com CRM.' },
      { type: 'p', text: 'No Althos CRM você acompanha CPL, taxa de conversão e custo por venda por campanha. Com esses números, definir e escalar o orçamento deixa de ser aposta e vira decisão.' },
      { type: 'cta', text: 'Saiba exatamente quanto investir para bater sua meta de vendas.' },
    ],
  },
  {
    slug: 'meta-ads-remarketing-que-vende',
    title: 'Remarketing no Meta Ads: como recuperar quem quase comprou',
    description:
      'Estratégias de remarketing no Meta Ads para recuperar leads que demonstraram interesse: segmentação por etapa, criativos e frequência ideal.',
    category: 'Meta Ads',
    author: 'Equipe Althos',
    date: '2026-05-04',
    readingMinutes: 5,
    excerpt:
      'A maioria das pessoas não compra no primeiro contato. O remarketing é o que recupera esse interesse — e costuma ser a verba de melhor retorno na conta.',
    blocks: [
      { type: 'p', text: 'Remarketing é mostrar anúncios para quem já interagiu com você: visitou o site, assistiu ao vídeo, abriu o formulário, conversou no direct. Como essas pessoas já conhecem sua marca, o custo por resultado costuma ser o menor da conta.' },
      { type: 'h2', text: 'Segmente por nível de interesse' },
      { type: 'ul', items: [
        'Quente: abandonou o checkout ou abriu o formulário sem concluir.',
        'Morno: visitou páginas-chave ou interagiu várias vezes.',
        'Frio recente: viu um vídeo ou seguiu o perfil.',
      ] },
      { type: 'p', text: 'Cada nível merece uma mensagem diferente. Quem quase comprou precisa de um empurrão (oferta, urgência). Quem só assistiu a um vídeo precisa de mais prova e contexto.' },
      { type: 'h2', text: 'Criativos de remarketing que funcionam' },
      { type: 'ul', items: [
        'Depoimentos para quebrar a objeção final.',
        'Respostas às dúvidas mais comuns.',
        'Oferta com prazo para gerar decisão.',
      ] },
      { type: 'h2', text: 'Cuidado com a frequência' },
      { type: 'p', text: 'Remarketing repetido demais irrita e queima a marca. Monitore a frequência e renove os criativos para não cansar o público.' },
      { type: 'quote', text: 'O remarketing recupera o interesse online. O follow-up no CRM recupera a venda.' },
      { type: 'p', text: 'No Althos CRM, o lead que voltou pelo remarketing é atendido na hora e entra no funil com follow-up automático. Anúncio reacende o interesse; o processo fecha a venda.' },
      { type: 'cta', text: 'Recupere quem quase comprou com anúncio e follow-up no mesmo fluxo.' },
    ],
  },
  {
    slug: 'meta-ads-erros-comuns',
    title: '7 erros em Meta Ads que estão queimando sua verba',
    description:
      'Os erros mais comuns em Meta Ads que desperdiçam dinheiro: objetivo errado, público estreito, mexer cedo demais e não medir vendas. Veja como evitar.',
    category: 'Meta Ads',
    author: 'Equipe Althos',
    date: '2026-04-28',
    readingMinutes: 6,
    excerpt:
      'Se seus anúncios não dão retorno, provavelmente é um destes 7 erros. A boa notícia: todos têm solução simples.',
    blocks: [
      { type: 'p', text: 'Meta Ads não perdoa erro de estrutura: o algoritmo simplesmente gasta sua verba do jeito errado. Veja os sete deslizes mais comuns e como corrigi-los.' },
      { type: 'h2', text: '1. Escolher o objetivo errado' },
      { type: 'p', text: 'Otimizar para "engajamento" quando se quer venda entrega curtidas, não clientes. Escolha o objetivo alinhado ao resultado que importa.' },
      { type: 'h2', text: '2. Público estreito demais' },
      { type: 'p', text: 'Empilhar interesses até sobrar pouca gente impede o algoritmo de aprender. Dê espaço para a Meta encontrar quem converte.' },
      { type: 'h2', text: '3. Mexer cedo demais' },
      { type: 'p', text: 'Pausar ou editar antes do fim da fase de aprendizado reinicia tudo. Dê tempo e volume antes de julgar.' },
      { type: 'h2', text: '4. Um único criativo' },
      { type: 'p', text: 'Sem variações, não há o que otimizar. Rode pelo menos três criativos por conjunto.' },
      { type: 'h2', text: '5. Ignorar o remarketing' },
      { type: 'p', text: 'Rodar só público frio é deixar dinheiro na mesa. Quem já interagiu converte mais barato.' },
      { type: 'h2', text: '6. Não responder rápido' },
      { type: 'p', text: 'Gerar lead e demorar horas para responder mata a conversão. Velocidade é parte da campanha.' },
      { type: 'h2', text: '7. Não medir vendas' },
      { type: 'p', text: 'O pior de todos: olhar CPL e cliques, mas não saber quais campanhas geram receita. Sem isso, você otimiza para a métrica errada.' },
      { type: 'quote', text: 'O anúncio gera o lead. O que acontece depois define se a verba virou lucro ou prejuízo.' },
      { type: 'p', text: 'No Althos CRM, leads chegam com origem rastreada, atendimento automático em segundos e relatório de custo por venda. Você evita os erros 6 e 7 — os que mais doem no bolso.' },
      { type: 'cta', text: 'Pare de queimar verba: meça do clique até a venda.' },
    ],
  },
  // ─── GOOGLE ADS ────────────────────────────────────────────────────────────
  {
    slug: 'google-ads-palavras-chave',
    title: 'Palavras-chave no Google Ads: como escolher as que trazem clientes',
    description:
      'Guia de palavras-chave para Google Ads: tipos de correspondência, intenção de compra, palavras negativas e como evitar gastar com cliques que não vendem.',
    category: 'Google Ads',
    author: 'Equipe Althos',
    date: '2026-05-18',
    readingMinutes: 7,
    excerpt:
      'No Google Ads, a palavra-chave é a aposta. Escolher errado é pagar por cliques de curiosos. Veja como mirar quem está pronto para comprar.',
    blocks: [
      { type: 'p', text: 'No Google Ads você paga para aparecer quando alguém pesquisa. A palavra-chave define quem vê seu anúncio — e é por isso que ela faz ou quebra a campanha. O objetivo: atrair intenção de compra, não curiosidade.' },
      { type: 'h2', text: 'Entenda a intenção por trás da busca' },
      { type: 'ul', items: [
        'Alta intenção: "comprar", "preço", "contratar", "perto de mim".',
        'Pesquisa/comparação: "melhor", "x ou y", "vale a pena".',
        'Informacional: "como fazer", "o que é" — raramente compra agora.',
      ] },
      { type: 'p', text: 'Para vender já, priorize alta intenção. Termos informacionais servem para topo de funil e conteúdo, não para campanhas de conversão direta.' },
      { type: 'h2', text: 'Tipos de correspondência' },
      { type: 'ol', items: [
        'Ampla: maior alcance, menor controle — gaste com cautela.',
        'De frase: equilíbrio entre alcance e relevância.',
        'Exata: máximo controle, ideal para os termos campeões.',
      ] },
      { type: 'h2', text: 'Palavras negativas: o filtro que economiza' },
      { type: 'p', text: 'Tão importante quanto escolher palavras é excluir as erradas. Se você vende serviço pago, negative "grátis", "download", "vaga de emprego". Palavras negativas evitam cliques que nunca virariam cliente.' },
      { type: 'quote', text: 'Cada clique de curioso é dinheiro que não volta. Palavras negativas são o seu filtro de qualidade.' },
      { type: 'p', text: 'No Althos CRM, você vê quais palavras-chave geraram leads que viraram venda. Em vez de otimizar por clique, otimiza por receita — e descobre que poucos termos trazem a maior parte do faturamento.' },
      { type: 'cta', text: 'Descubra quais palavras-chave realmente trazem clientes.' },
    ],
  },
  {
    slug: 'google-ads-primeira-campanha-passo-a-passo',
    title: 'Como criar sua primeira campanha no Google Ads (passo a passo)',
    description:
      'Tutorial para criar a primeira campanha de pesquisa no Google Ads: estrutura de conta, grupos de anúncios, textos, extensões e acompanhamento de conversão.',
    category: 'Google Ads',
    author: 'Equipe Althos',
    date: '2026-05-12',
    readingMinutes: 8,
    excerpt:
      'Um passo a passo claro para lançar sua primeira campanha de pesquisa no Google Ads sem cair nas armadilhas que custam caro para iniciantes.',
    blocks: [
      { type: 'p', text: 'Criar uma campanha no Google Ads é simples; criar uma que dá retorno exige estrutura. Veja o caminho do começo ao fim, evitando os erros que fazem iniciantes queimarem verba.' },
      { type: 'h2', text: '1. Estruture a conta corretamente' },
      { type: 'p', text: 'Pense em camadas: a campanha define orçamento e objetivo; dentro dela, grupos de anúncios reúnem palavras-chave de um mesmo tema. Um grupo focado significa anúncios mais relevantes e custo menor.' },
      { type: 'h2', text: '2. Comece com campanha de Pesquisa' },
      { type: 'p', text: 'Para a maioria dos negócios, a Rede de Pesquisa é o melhor ponto de partida: você aparece para quem já procura sua solução. Deixe Display e Performance Max para depois de dominar o básico.' },
      { type: 'h2', text: '3. Agrupe palavras por tema' },
      { type: 'ul', items: [
        'Um grupo por serviço/produto, com 5–15 palavras relacionadas.',
        'Anúncios que repetem a palavra-chave do grupo no título.',
        'Use correspondência de frase e exata para começar com controle.',
      ] },
      { type: 'h2', text: '4. Escreva anúncios relevantes' },
      { type: 'p', text: 'Repita o termo buscado no título, destaque o diferencial e termine com um CTA claro. Quanto mais o anúncio "responde" à busca, melhor o índice de qualidade e menor o custo por clique.' },
      { type: 'h2', text: '5. Use extensões' },
      { type: 'p', text: 'Sitelinks, chamada, localização e frases de destaque ocupam mais espaço e aumentam o clique sem custo extra. Não deixe de configurá-las.' },
      { type: 'h2', text: '6. O passo que ninguém pode pular: medir conversão' },
      { type: 'p', text: 'Sem acompanhamento de conversão, você voa no escuro. O mínimo é rastrear o lead; o ideal é saber quais cliques viraram venda lá no fim.' },
      { type: 'quote', text: 'Campanha sem medição de conversão é só uma forma elegante de gastar dinheiro.' },
      { type: 'p', text: 'No Althos CRM, o lead vindo do Google entra com a origem identificada e segue no funil até o fechamento. Assim você vê o retorno real de cada campanha, não só o custo por clique.' },
      { type: 'cta', text: 'Ligue seu Google Ads ao funil e veja o retorno de verdade.' },
    ],
  },
  {
    slug: 'google-ads-performance-max',
    title: 'Performance Max: vale a pena para o seu negócio?',
    description:
      'O que é Performance Max no Google Ads, como funciona a automação, quando faz sentido usar e os cuidados para não perder o controle da verba.',
    category: 'Google Ads',
    author: 'Equipe Althos',
    date: '2026-05-06',
    readingMinutes: 6,
    excerpt:
      'Performance Max promete automatizar tudo e entregar resultado. Mas a automação total tem armadilhas. Veja quando usar — e quando evitar.',
    blocks: [
      { type: 'p', text: 'Performance Max (PMax) é o tipo de campanha em que você fornece os criativos e a meta, e o Google distribui automaticamente por Pesquisa, Display, YouTube, Gmail e Maps. A promessa é máximo resultado com mínimo esforço. A realidade exige cuidado.' },
      { type: 'h2', text: 'Como funciona' },
      { type: 'p', text: 'Você sobe ativos (textos, imagens, vídeos) e define a conversão-alvo. A IA do Google decide onde, quando e para quem mostrar. Em troca de controle, você ganha alcance e automação.' },
      { type: 'h2', text: 'Quando faz sentido usar' },
      { type: 'ul', items: [
        'Quando já há histórico de conversões para a IA aprender.',
        'E-commerce com catálogo e volume.',
        'Para escalar depois de validar o que converte na Pesquisa.',
      ] },
      { type: 'h2', text: 'Quando ter cautela' },
      { type: 'ul', items: [
        'Contas novas, sem dados de conversão confiáveis.',
        'Orçamentos pequenos, onde a falta de controle pesa.',
        'Quando você ainda não sabe quais leads realmente viram venda.',
      ] },
      { type: 'h2', text: 'O risco da caixa-preta' },
      { type: 'p', text: 'A PMax otimiza para a conversão que você define. Se você marca "lead" como conversão, ela traz volume de leads — inclusive ruins. Sem qualidade de dado, a IA persegue a métrica errada.' },
      { type: 'quote', text: 'Automação é tão inteligente quanto o sinal de conversão que você dá a ela. Lead ruim ensina a IA a trazer mais lead ruim.' },
      { type: 'p', text: 'No Althos CRM, você identifica quais leads viram venda e alimenta o Google com o sinal certo. A PMax deixa de perseguir volume e passa a perseguir receita.' },
      { type: 'cta', text: 'Dê à automação do Google o sinal certo: vendas, não leads vazios.' },
    ],
  },
  {
    slug: 'google-ads-quanto-custa',
    title: 'Quanto custa anunciar no Google Ads? Entenda CPC, qualidade e ROI',
    description:
      'Quanto custa o Google Ads de verdade: como funciona o leilão, o que é CPC, índice de qualidade e como calcular o retorno real do investimento.',
    category: 'Google Ads',
    author: 'Equipe Althos',
    date: '2026-04-30',
    readingMinutes: 6,
    excerpt:
      'Não existe preço fixo no Google Ads — existe leilão. Entenda o que define seu custo por clique e como saber se o investimento está dando lucro.',
    blocks: [
      { type: 'p', text: 'A pergunta "quanto custa o Google Ads?" não tem resposta única porque o sistema funciona por leilão. O que você paga depende da concorrência pela palavra e da qualidade do seu anúncio.' },
      { type: 'h2', text: 'Como funciona o leilão' },
      { type: 'p', text: 'A cada busca, o Google calcula um ranking combinando seu lance com o índice de qualidade (relevância do anúncio, experiência da página e CTR esperado). Um anúncio melhor pode pagar menos e aparecer acima de um concorrente que deu um lance maior.' },
      { type: 'h2', text: 'O índice de qualidade reduz seu custo' },
      { type: 'ul', items: [
        'Anúncio relevante à busca: paga menos por clique.',
        'Página de destino coerente: melhora a experiência e a posição.',
        'Bom CTR histórico: o Google entende que seu anúncio responde à intenção.',
      ] },
      { type: 'h2', text: 'CPC importa menos que custo por venda' },
      { type: 'p', text: 'Focar só no custo por clique engana. Uma palavra cara que converte muito pode ser mais lucrativa que uma barata que não vende. O número que decide é o custo por venda — e o retorno (ROI) que ele gera.' },
      { type: 'quote', text: 'Clique barato que não vende é caro. Clique caro que vende é barato.' },
      { type: 'p', text: 'No Althos CRM, você acompanha o lead do clique até o fechamento e calcula o ROI real por campanha e por palavra-chave. Assim, decide onde investir com base em lucro, não em CPC.' },
      { type: 'cta', text: 'Calcule o ROI real das suas campanhas, do clique à venda.' },
    ],
  },
  {
    slug: 'google-ads-remarketing-recuperar-visitantes',
    title: 'Remarketing no Google Ads: recupere quem visitou e não comprou',
    description:
      'Como usar o remarketing no Google Ads para reimpactar visitantes: listas de público, Display, YouTube e RLSA na Pesquisa para fechar mais vendas.',
    category: 'Google Ads',
    author: 'Equipe Althos',
    date: '2026-04-22',
    readingMinutes: 5,
    excerpt:
      'A maior parte de quem visita seu site vai embora sem comprar. O remarketing do Google traz essas pessoas de volta — em vários formatos.',
    blocks: [
      { type: 'p', text: 'Pouca gente compra na primeira visita. O remarketing do Google permite reimpactar quem já passou pelo seu site, em diferentes canais, lembrando-os da sua solução no momento certo.' },
      { type: 'h2', text: 'Formatos de remarketing' },
      { type: 'ul', items: [
        'Display: banners que seguem o visitante por sites e apps.',
        'YouTube: vídeos para quem já demonstrou interesse.',
        'RLSA: ajustar lances na Pesquisa para quem já visitou.',
      ] },
      { type: 'h2', text: 'Segmente por comportamento' },
      { type: 'p', text: 'Quem visitou a página de preços está mais quente do que quem viu só o blog. Crie listas por páginas visitadas e por tempo desde a visita, e adapte a mensagem ao nível de interesse.' },
      { type: 'h2', text: 'Não canse o público' },
      { type: 'p', text: 'Limite a frequência e renove os anúncios. Remarketing repetitivo demais vira incômodo e mancha a marca.' },
      { type: 'quote', text: 'O remarketing traz a pessoa de volta. O atendimento rápido e o follow-up fecham a conta.' },
      { type: 'p', text: 'No Althos CRM, o visitante que voltou e virou lead é atendido na hora e entra no funil com follow-up. O anúncio reabre a porta; o processo conduz até a venda.' },
      { type: 'cta', text: 'Traga os visitantes de volta e conduza-os até a venda.' },
    ],
  },
  // ─── FUNIL DE VENDAS ───────────────────────────────────────────────────────
  {
    slug: 'funil-vendas-follow-up-automatico',
    title: 'Follow-up automático: a venda está no acompanhamento',
    description:
      'Por que a maioria das vendas exige vários contatos e como montar um follow-up automático no funil para parar de perder negócios por esquecimento.',
    category: 'Funil de Vendas',
    author: 'Equipe Althos',
    date: '2026-05-19',
    readingMinutes: 6,
    excerpt:
      'A maioria das vendas acontece depois do quinto contato. O problema: quase ninguém faz follow-up suficiente. A solução é automatizar.',
    blocks: [
      { type: 'p', text: 'Existe um abismo entre o número de contatos que uma venda costuma exigir e o número que os vendedores realmente fazem. A maioria desiste cedo demais — e é exatamente aí que o dinheiro escapa. A solução é tornar o follow-up um processo, não uma lembrança.' },
      { type: 'h2', text: 'Por que o follow-up falha' },
      { type: 'ul', items: [
        'O vendedor esquece (volume de leads alto).',
        'Acha que insistir é "incomodar".',
        'Não tem um sistema lembrando quem retornar e quando.',
      ] },
      { type: 'h2', text: 'A estrutura de uma cadência de follow-up' },
      { type: 'ol', items: [
        'Contato 1: resposta imediata ao lead (minutos, não horas).',
        'Contato 2: no mesmo dia ou no dia seguinte, agregando valor.',
        'Contato 3 a 5: espaçados, com provas, casos e quebra de objeções.',
        'Reativação: para quem não respondeu, em 30/60/90 dias.',
      ] },
      { type: 'h2', text: 'Automatize sem perder o toque humano' },
      { type: 'p', text: 'Nem todo follow-up precisa ser manual. Lembretes automáticos, mensagens programadas e tarefas geradas pelo sistema garantem que ninguém caia no esquecimento — e liberam o vendedor para o contato que realmente exige atenção humana.' },
      { type: 'quote', text: 'Não é falta de leads que derruba as vendas. É falta de acompanhamento.' },
      { type: 'p', text: 'No Althos CRM, leads parados disparam alertas, follow-ups são programados por etapa e a IA pode dar o primeiro retorno na hora. O acompanhamento deixa de depender da memória do vendedor.' },
      { type: 'cta', text: 'Nunca mais perca uma venda por esquecer de retornar.' },
    ],
  },
  {
    slug: 'funil-vendas-qualificacao-bant',
    title: 'Qualificação de leads: o método BANT explicado na prática',
    description:
      'Como qualificar leads com o método BANT (orçamento, autoridade, necessidade e prazo) para focar o time no que fecha e parar de perder tempo com curioso.',
    category: 'Funil de Vendas',
    author: 'Equipe Althos',
    date: '2026-05-13',
    readingMinutes: 6,
    excerpt:
      'Atender todo lead igual é desperdício. O método BANT ajuda a separar quem está pronto para comprar de quem só está pesquisando.',
    blocks: [
      { type: 'p', text: 'Nem todo lead merece o mesmo esforço. Tentar fechar com quem não tem perfil, verba ou poder de decisão consome o tempo que deveria ir para quem está pronto. O BANT é um filtro simples para priorizar.' },
      { type: 'h2', text: 'O que significa BANT' },
      { type: 'ul', items: [
        'Budget (orçamento): a pessoa tem condições de pagar?',
        'Authority (autoridade): ela decide ou influencia a compra?',
        'Need (necessidade): existe uma dor real que você resolve?',
        'Timing (prazo): a decisão é para agora ou para "algum dia"?',
      ] },
      { type: 'h2', text: 'Como aplicar na conversa' },
      { type: 'p', text: 'Você não precisa de um interrogatório. Perguntas naturais revelam o BANT: "como vocês resolvem isso hoje?", "quem mais participa dessa decisão?", "para quando você precisa disso resolvido?". As respostas dizem o quão quente é o lead.' },
      { type: 'h2', text: 'Nem todo lead frio deve ser descartado' },
      { type: 'p', text: 'Um lead com necessidade clara, mas sem prazo, não está perdido — está para nutrição. Em vez de jogá-lo fora, coloque-o numa cadência de acompanhamento até o momento amadurecer.' },
      { type: 'quote', text: 'Qualificar não é dispensar leads — é decidir a quem dar atenção agora e a quem nutrir para depois.' },
      { type: 'p', text: 'No Althos CRM, você marca o nível de qualificação de cada lead, prioriza os quentes no funil e mantém os mornos numa cadência automática. O time foca onde a venda está mais perto.' },
      { type: 'cta', text: 'Foque o time nos leads que realmente vão fechar.' },
    ],
  },
  {
    slug: 'funil-vendas-aumentar-taxa-conversao',
    title: 'Como aumentar a taxa de conversão do seu funil de vendas',
    description:
      'Táticas práticas para aumentar a conversão em cada etapa do funil: velocidade de resposta, qualificação, quebra de objeções e redução de atrito.',
    category: 'Funil de Vendas',
    author: 'Equipe Althos',
    date: '2026-05-07',
    readingMinutes: 7,
    excerpt:
      'Dobrar a conversão do funil costuma render mais que dobrar o investimento em tráfego — e é mais barato. Veja onde mexer em cada etapa.',
    blocks: [
      { type: 'p', text: 'Antes de gastar mais com anúncios, vale uma pergunta: e se você convertesse melhor o que já entra? Aumentar a taxa de conversão do funil multiplica resultado sem aumentar a verba. Vamos etapa por etapa.' },
      { type: 'h2', text: 'No topo: velocidade de resposta' },
      { type: 'p', text: 'O fator que mais move conversão no topo é o tempo de resposta. Responder em minutos, e não em horas, pode multiplicar suas chances. Automatize o primeiro contato para nunca deixar um lead esfriar.' },
      { type: 'h2', text: 'No meio: qualificação e nutrição' },
      { type: 'ul', items: [
        'Qualifique para não empurrar quem não tem perfil.',
        'Nutra os mornos com conteúdo e prova até amadurecerem.',
        'Mantenha o follow-up constante — a maioria das vendas mora aqui.',
      ] },
      { type: 'h2', text: 'No fundo: quebra de objeções e atrito' },
      { type: 'p', text: 'Perto do fechamento, conversão é função de remover dúvidas e fricção. Tenha respostas prontas para as objeções mais comuns e elimine atritos (formulário longo, processo confuso, demora para enviar proposta).' },
      { type: 'h2', text: 'Meça onde os leads travam' },
      { type: 'p', text: 'Não dá para melhorar o que você não enxerga. Acompanhe a conversão de cada etapa para descobrir o gargalo — quase sempre ele está concentrado em um ponto específico.' },
      { type: 'quote', text: 'Melhorar 10% em cada etapa do funil pode quase dobrar o resultado final. O segredo é saber onde mexer.' },
      { type: 'p', text: 'No Althos CRM, você vê a conversão por etapa, identifica o gargalo e age com automação de resposta e follow-up. Conversão deixa de ser sorte e vira processo.' },
      { type: 'cta', text: 'Descubra o gargalo do seu funil e converta mais sem gastar mais.' },
    ],
  },
  {
    slug: 'funil-vendas-reativar-leads-frios',
    title: 'Leads frios: como reativar a base que você já tem',
    description:
      'Sua base de leads antigos vale dinheiro. Veja como reativar leads frios com segmentação, ofertas certas e cadência sem parecer desesperado.',
    category: 'Funil de Vendas',
    author: 'Equipe Althos',
    date: '2026-05-01',
    readingMinutes: 5,
    excerpt:
      'Antes de comprar mais leads, olhe para os que você já tem. Uma base de contatos antigos bem trabalhada costuma ser a fonte de venda mais barata.',
    blocks: [
      { type: 'p', text: 'Toda empresa acumula uma lista de leads que um dia demonstraram interesse e nunca compraram. Em vez de tratá-los como perdidos, encare-os como ativo: já conhecem você e custaram caro para entrar. Reativar é a venda mais barata que existe.' },
      { type: 'h2', text: 'Segmente antes de falar' },
      { type: 'ul', items: [
        'Por etapa em que pararam (proposta enviada vale mais que primeiro contato).',
        'Por motivo da perda (preço, timing, escolheu concorrente).',
        'Por tempo desde o último contato.',
      ] },
      { type: 'h2', text: 'Dê um motivo para voltar' },
      { type: 'p', text: 'Reativação genérica ("oi, ainda tem interesse?") rende pouco. Traga novidade: um novo recurso, uma condição especial, um caso de sucesso parecido com o problema dele. Mostre que algo mudou desde a última conversa.' },
      { type: 'h2', text: 'Cadência sem desespero' },
      { type: 'p', text: 'Reative com uma sequência curta e espaçada, não com bombardeio. Respeite quem pede para sair e concentre energia em quem reabre a conversa.' },
      { type: 'quote', text: 'A base que você já tem é uma mina. A maioria das empresas só não cava.' },
      { type: 'p', text: 'No Althos CRM, leads perdidos ficam organizados por motivo e etapa, prontos para campanhas de reativação automáticas. Você transforma contatos esquecidos em novas vendas — sem gastar mais com tráfego.' },
      { type: 'cta', text: 'Reative sua base e venda para quem já te conhece.' },
    ],
  },
  {
    slug: 'funil-vendas-previsao-receita',
    title: 'Previsão de receita: como prever vendas com o seu funil',
    description:
      'Como usar o funil de vendas para prever receita: ponderação por etapa, probabilidade de fechamento e por que a previsão muda a gestão do negócio.',
    category: 'Funil de Vendas',
    author: 'Equipe Althos',
    date: '2026-04-24',
    readingMinutes: 6,
    excerpt:
      'Prever quanto você vai faturar no mês não é adivinhação — é matemática do funil. Veja como transformar oportunidades em previsão confiável.',
    blocks: [
      { type: 'p', text: 'Tomar decisões (contratar, investir, comprar estoque) sem prever receita é arriscado. A boa notícia: um funil bem gerido já contém a previsão. Basta ler os números do jeito certo.' },
      { type: 'h2', text: 'Como funciona a previsão ponderada' },
      { type: 'p', text: 'Cada etapa do funil tem uma probabilidade média de fechamento. Multiplicando o valor de cada oportunidade pela probabilidade da etapa em que ela está, você chega a uma previsão realista — nem otimista demais, nem pessimista.' },
      { type: 'ul', items: [
        'Proposta enviada: probabilidade média alta.',
        'Em negociação: alta, perto do fechamento.',
        'Qualificado: média.',
        'Novo lead: baixa.',
      ] },
      { type: 'h2', text: 'Por que isso muda a gestão' },
      { type: 'p', text: 'Com previsão, você antecipa o mês fraco e age antes — intensifica prospecção, ativa a base, ajusta a meta. Sem ela, você só descobre o problema quando já é tarde.' },
      { type: 'h2', text: 'Cuidado com o funil inflado' },
      { type: 'p', text: 'A previsão só vale se o funil for honesto. Oportunidades paradas há meses ou mal qualificadas distorcem o número. Higienize o funil regularmente.' },
      { type: 'quote', text: 'Quem prevê receita gerencia o futuro. Quem não prevê apenas reage ao passado.' },
      { type: 'p', text: 'No Althos CRM, a previsão de receita é calculada automaticamente a partir do valor e da etapa de cada oportunidade. Você abre o painel e sabe quanto deve faturar — e onde agir para chegar lá.' },
      { type: 'cta', text: 'Tenha previsão de receita automática direto do seu funil.' },
    ],
  },
  // ─── GESTÃO DE EQUIPE ──────────────────────────────────────────────────────
  {
    slug: 'gestao-equipe-definir-metas-vendas',
    title: 'Como definir metas de vendas que o time realmente bate',
    description:
      'Metas de vendas que motivam em vez de frustrar: como calcular a partir do funil, desdobrar em atividades e acompanhar para corrigir a tempo.',
    category: 'Gestão de Equipe',
    author: 'Equipe Althos',
    date: '2026-05-17',
    readingMinutes: 6,
    excerpt:
      'Meta tirada do teto desmotiva e não se cumpre. Veja como definir metas realistas, desdobrá-las em ação e acompanhar sem virar cobrança vazia.',
    blocks: [
      { type: 'p', text: 'Meta mal definida faz dois estragos: se for inalcançável, desmotiva; se for frouxa, acomoda. O caminho é construir a meta a partir de dados e desdobrá-la em ações que o time controla no dia a dia.' },
      { type: 'h2', text: 'Construa a meta de baixo para cima' },
      { type: 'p', text: 'Em vez de "quero faturar X", parta da capacidade real: número de leads, taxa de conversão e ticket médio. A meta que respeita esses números é desafiadora, mas crível — e o time compra a ideia.' },
      { type: 'h2', text: 'Desdobre em atividades' },
      { type: 'ul', items: [
        'Quantos leads cada vendedor precisa atender?',
        'Quantas reuniões/propostas por semana?',
        'Quantos follow-ups por oportunidade?',
      ] },
      { type: 'p', text: 'Resultado é consequência de atividade. O vendedor não controla diretamente "fechar 10 vendas", mas controla "fazer 50 contatos qualificados". Metas de atividade dão tração diária.' },
      { type: 'h2', text: 'Acompanhe para corrigir, não só para cobrar' },
      { type: 'p', text: 'Meta acompanhada só no fim do mês é meta perdida. Olhe o ritmo semanalmente: se a atividade está abaixo, dá tempo de agir. A cobrança vira apoio.' },
      { type: 'quote', text: 'Meta sem desdobramento em atividade é só um número de Excel torcendo para dar certo.' },
      { type: 'p', text: 'No Althos CRM, você define metas, acompanha o progresso em tempo real e vê as atividades de cada vendedor. Dá para corrigir a rota no meio do mês, não no fechamento.' },
      { type: 'cta', text: 'Defina metas realistas e acompanhe o time em tempo real.' },
    ],
  },
  {
    slug: 'gestao-equipe-reuniao-vendas-eficiente',
    title: 'Reunião de vendas: como fazer encontros que geram resultado',
    description:
      'Como conduzir reuniões de vendas eficientes: pauta baseada em dados, foco em gargalos e ações, e como evitar a reunião que só toma tempo do time.',
    category: 'Gestão de Equipe',
    author: 'Equipe Althos',
    date: '2026-05-11',
    readingMinutes: 5,
    excerpt:
      'Reunião de vendas pode ser o motor do time ou um buraco de tempo. A diferença está em ter dados na mesa e sair com ações claras.',
    blocks: [
      { type: 'p', text: 'A reunião de vendas é um dos rituais mais importantes da gestão comercial — e um dos mais mal aproveitados. Quando vira sessão de desabafo ou repasse de números que ninguém confere, ela só rouba tempo de venda. Veja como torná-la útil.' },
      { type: 'h2', text: 'Comece com dados, não com opinião' },
      { type: 'p', text: 'Abra a reunião com os números reais: funil, conversão por etapa, atividades da semana, previsão. Quando todos olham para o mesmo painel, a conversa para de girar em torno de "acho que" e foca no que de fato está acontecendo.' },
      { type: 'h2', text: 'Foque no gargalo da semana' },
      { type: 'ul', items: [
        'Onde os leads estão travando?',
        'Quem está abaixo do ritmo e por quê?',
        'Quais oportunidades grandes precisam de ação conjunta?',
      ] },
      { type: 'h2', text: 'Saia com ações, donos e prazos' },
      { type: 'p', text: 'Toda reunião deve terminar com uma lista clara: o que será feito, por quem e até quando. Sem isso, a reunião é só conversa. Na semana seguinte, comece revisando essas ações.' },
      { type: 'quote', text: 'Reunião boa é curta, baseada em dados e termina com ações. O resto é tempo que poderia virar venda.' },
      { type: 'p', text: 'No Althos CRM, você leva para a reunião dashboards prontos: funil, ranking, previsão e atividades. A conversa parte de fatos e termina em ações — sem ninguém montar planilha na véspera.' },
      { type: 'cta', text: 'Leve dados reais para a reunião e saia com ações claras.' },
    ],
  },
  {
    slug: 'gestao-equipe-comissionamento',
    title: 'Comissionamento de vendedores: como criar um plano que motiva',
    description:
      'Como estruturar comissão de vendas: percentual fixo x escalonado, metas, gatilhos por margem e os erros que fazem o plano desmotivar o time.',
    category: 'Gestão de Equipe',
    author: 'Equipe Althos',
    date: '2026-05-05',
    readingMinutes: 6,
    excerpt:
      'O plano de comissão molda o comportamento do time. Mal desenhado, premia a venda errada. Veja como alinhar incentivo e estratégia.',
    blocks: [
      { type: 'p', text: 'Vendedor faz o que é recompensado. Por isso o plano de comissão é, na prática, a sua estratégia comercial traduzida em dinheiro. Um plano mal desenhado incentiva o comportamento errado — descontos excessivos, foco em volume e não em margem, abandono do pós-venda.' },
      { type: 'h2', text: 'Modelos comuns' },
      { type: 'ul', items: [
        'Percentual fixo sobre a venda: simples, mas não diferencia esforço.',
        'Escalonado por meta: a comissão sobe ao bater faixas — incentiva o "empurrão" final.',
        'Atrelado à margem: premia quem vende sem destruir preço.',
      ] },
      { type: 'h2', text: 'Alinhe a comissão à estratégia' },
      { type: 'p', text: 'Se a meta é margem, não comissione só faturamento. Se a meta é retenção, recompense também o pós-venda. O incentivo precisa apontar para onde o negócio quer ir.' },
      { type: 'h2', text: 'Erros que desmotivam' },
      { type: 'ul', items: [
        'Regras complicadas que ninguém entende.',
        'Mudar o plano no meio do jogo.',
        'Cálculo manual sujeito a erro e desconfiança.',
      ] },
      { type: 'quote', text: 'Mostre-me como alguém é comissionado e eu te direi como ele vende.' },
      { type: 'p', text: 'No Althos CRM, cada venda fica registrada com valor, responsável e etapa, tornando o cálculo de comissão transparente e auditável. O vendedor confia no número — e confiança no plano é parte do que motiva.' },
      { type: 'cta', text: 'Tenha vendas registradas e comissões transparentes para o time.' },
    ],
  },
  {
    slug: 'gestao-equipe-onboarding-vendedor',
    title: 'Onboarding de vendedor: como fazer um novato vender mais rápido',
    description:
      'Um processo de onboarding de vendedores que reduz o tempo de rampa: playbook, acompanhamento, metas progressivas e uso do CRM desde o dia 1.',
    category: 'Gestão de Equipe',
    author: 'Equipe Althos',
    date: '2026-04-29',
    readingMinutes: 6,
    excerpt:
      'Cada semana a mais para um vendedor "ramper" custa caro. Um onboarding estruturado encurta esse tempo e reduz a rotatividade.',
    blocks: [
      { type: 'p', text: 'Contratar é só o começo. O tempo que um vendedor leva para atingir produtividade plena — a rampa — é um custo silencioso. Onboarding improvisado alonga essa rampa e aumenta a chance de o novato desistir. Estruturar muda o jogo.' },
      { type: 'h2', text: 'Tenha um playbook, não um "vai aprendendo"' },
      { type: 'p', text: 'O conhecimento de vendas não pode morar só na cabeça dos veteranos. Documente: como abordar, como qualificar, objeções comuns e respostas, etapas do funil e critérios de avanço. O novato aprende em dias o que levaria meses por tentativa e erro.' },
      { type: 'h2', text: 'Metas progressivas' },
      { type: 'ul', items: [
        'Semana 1: aprender produto, processo e CRM.',
        'Semanas 2–3: acompanhar e simular (role-play).',
        'A partir daí: meta crescente até o pleno.',
      ] },
      { type: 'h2', text: 'CRM desde o primeiro dia' },
      { type: 'p', text: 'Quem começa registrando tudo no CRM cria o hábito certo. Quem começa no caderno e na memória vira um problema de gestão depois. Integre a ferramenta ao onboarding como parte do processo, não como burocracia.' },
      { type: 'h2', text: 'Acompanhe de perto no início' },
      { type: 'p', text: 'Feedback frequente nas primeiras semanas corrige vícios cedo e dá segurança ao novato. Use gravações e métricas para orientar, não só para avaliar.' },
      { type: 'quote', text: 'Onboarding ruim não economiza tempo — empurra o custo para frente, em forma de rampa longa e turnover.' },
      { type: 'p', text: 'No Althos CRM, o novato encontra funil, histórico e processo prontos para seguir desde o dia 1, e o gestor acompanha suas atividades e evolução. A rampa encurta e o padrão se mantém.' },
      { type: 'cta', text: 'Coloque novos vendedores para produzir mais rápido, com processo claro.' },
    ],
  },
  {
    slug: 'gestao-equipe-adocao-crm',
    title: 'Como fazer o time realmente usar o CRM (e parar de resistir)',
    description:
      'Por que vendedores resistem ao CRM e como garantir a adoção: simplicidade, valor para o vendedor, dados que entram sozinhos e exemplo da liderança.',
    category: 'Gestão de Equipe',
    author: 'Equipe Althos',
    date: '2026-04-21',
    readingMinutes: 6,
    excerpt:
      'O melhor CRM do mundo não serve para nada se o time não usa. A boa notícia: resistência quase sempre é sintoma, não causa.',
    blocks: [
      { type: 'p', text: 'Muitas empresas compram um CRM e seis meses depois o sistema está vazio: o time voltou para o WhatsApp e o caderno. O problema raramente é o vendedor preguiçoso — é o CRM que dá trabalho e não devolve valor. Veja como inverter isso.' },
      { type: 'h2', text: 'Por que o time resiste' },
      { type: 'ul', items: [
        'Dá mais trabalho do que ajuda (preenchimento manual interminável).',
        'O vendedor não vê benefício para si, só controle do chefe.',
        'A ferramenta é complicada e lenta.',
      ] },
      { type: 'h2', text: 'O segredo: o CRM tem que ajudar a vender' },
      { type: 'p', text: 'Adoção vem quando o vendedor percebe que o CRM facilita a vida dele: lembra de follow-ups, centraliza conversas, organiza o dia. Quando vira aliado de venda — e não relatório para o gestor — o uso acontece naturalmente.' },
      { type: 'h2', text: 'Reduza o atrito de entrada de dados' },
      { type: 'p', text: 'Quanto mais coisa entra sozinha (leads dos anúncios, mensagens do WhatsApp, histórico), menos o vendedor digita. Dado que entra automático é dado que não vira motivo de briga.' },
      { type: 'h2', text: 'Liderança dá o exemplo' },
      { type: 'p', text: 'Se o gestor cobra pelo CRM mas decide pelo "achômetro", o time percebe e abandona. A liderança precisa olhar os dados do sistema nas reuniões e decisões.' },
      { type: 'quote', text: 'CRM que só serve para o chefe vigiar morre. CRM que ajuda o vendedor a vender se torna indispensável.' },
      { type: 'p', text: 'O Althos CRM foi desenhado para o vendedor: leads e conversas entram automaticamente, a IA atende e os follow-ups são lembrados. Menos digitação, mais venda — e por isso o time usa.' },
      { type: 'cta', text: 'Adote um CRM que o time usa porque ajuda a vender.' },
    ],
  },
  // ─── TREINAMENTO DE VENDAS ─────────────────────────────────────────────────
  {
    slug: 'treinamento-vendas-contornar-objecoes',
    title: 'Como contornar objeções de vendas (sem ser chato)',
    description:
      'Técnicas para contornar objeções de vendas como preço, tempo e "vou pensar": ouça, valide, esclareça e avance. Roteiro prático para o seu time.',
    category: 'Treinamento de Vendas',
    author: 'Equipe Althos',
    date: '2026-05-21',
    readingMinutes: 7,
    excerpt:
      'Objeção não é um "não" — é um pedido de mais informação. Veja um método para lidar com as mais comuns sem empurrar e sem desistir cedo demais.',
    blocks: [
      { type: 'p', text: 'A maioria dos vendedores trava ou desiste na primeira objeção. Mas "está caro" ou "vou pensar" raramente significam "não". Quase sempre são dúvidas não resolvidas. Encare a objeção como sinal de interesse que precisa ser destravado.' },
      { type: 'h2', text: 'O método em 4 passos' },
      { type: 'ol', items: [
        'Ouça por inteiro, sem interromper nem rebater na hora.',
        'Valide ("entendo, faz sentido se preocupar com isso").',
        'Esclareça com pergunta ("o que exatamente pesa: o valor ou o retorno?").',
        'Avance com a resposta certa e proponha o próximo passo.',
      ] },
      { type: 'h2', text: 'As objeções mais comuns' },
      { type: 'h3', text: '"Está caro"' },
      { type: 'p', text: 'Quase nunca é sobre preço, e sim sobre valor percebido. Reposicione no retorno: o que custa não resolver o problema? Compare com o ganho, não com o gasto.' },
      { type: 'h3', text: '"Vou pensar"' },
      { type: 'p', text: 'Geralmente esconde uma dúvida específica. Pergunte com gentileza o que ainda falta esclarecer e trate a objeção real por trás da frase.' },
      { type: 'h3', text: '"Não é o momento"' },
      { type: 'p', text: 'Pode ser verdade — ou medo de decidir. Mostre o custo de adiar e, se for real, agende a retomada em vez de soltar o lead.' },
      { type: 'quote', text: 'Objeção é a pergunta que o cliente ainda não conseguiu formular. Seu trabalho é respondê-la.' },
      { type: 'p', text: 'No Althos CRM, você registra as objeções de cada negociação e os motivos de perda. Com o tempo, vê quais objeções mais derrubam vendas e treina o time exatamente nelas.' },
      { type: 'cta', text: 'Mapeie as objeções que mais derrubam suas vendas e treine para vencê-las.' },
    ],
  },
  {
    slug: 'treinamento-vendas-script-whatsapp',
    title: 'Script de abordagem no WhatsApp: como iniciar sem espantar o lead',
    description:
      'Como criar um script de abordagem por WhatsApp que gera resposta: primeira mensagem, qualificação leve, tom certo e o erro de já mandar preço.',
    category: 'Treinamento de Vendas',
    author: 'Equipe Althos',
    date: '2026-05-15',
    readingMinutes: 6,
    excerpt:
      'A primeira mensagem decide se a conversa começa ou morre. Veja como abordar leads no WhatsApp de um jeito que gera resposta — sem parecer robô.',
    blocks: [
      { type: 'p', text: 'O WhatsApp é onde a maioria das vendas acontece hoje no Brasil. Mas a primeira mensagem é decisiva: aborde errado e o lead some. Veja como começar a conversa do jeito certo.' },
      { type: 'h2', text: 'A primeira mensagem' },
      { type: 'p', text: 'Personalize, contextualize e seja breve. Mostre que você sabe de onde o lead veio ("vi que você se interessou pela nossa avaliação gratuita") e faça uma pergunta simples que convide à resposta. Mensagem longa e genérica é ignorada.' },
      { type: 'h2', text: 'Erros que matam a conversa' },
      { type: 'ul', items: [
        'Mandar preço de cara, antes de entender a necessidade.',
        'Texto enorme em bloco único.',
        'Tom robótico de copia-e-cola.',
        'Demorar horas para responder — o lead esfria.',
      ] },
      { type: 'h2', text: 'Qualifique com leveza' },
      { type: 'p', text: 'Antes de oferecer, entenda. Uma ou duas perguntas ("me conta um pouco do que você precisa") revelam a dor e permitem uma proposta sob medida — que converte muito mais do que um preço solto.' },
      { type: 'h2', text: 'Velocidade é tudo' },
      { type: 'p', text: 'Responder em minutos pode multiplicar a conversão. Como ninguém fica 24h no celular, o ideal é ter atendimento automático para o primeiro contato e passar ao humano na sequência.' },
      { type: 'quote', text: 'No WhatsApp, quem responde primeiro e personaliza melhor leva a venda.' },
      { type: 'p', text: 'No Althos CRM, a IA dá o primeiro retorno na hora, qualifica e entrega o lead aquecido para o vendedor — com todo o histórico da conversa. Você nunca mais perde um lead por demora.' },
      { type: 'cta', text: 'Atenda todo lead na hora, com IA, e passe aquecido para o time.' },
    ],
  },
  {
    slug: 'treinamento-vendas-spin-selling',
    title: 'SPIN Selling: o método de perguntas que faz o cliente se convencer',
    description:
      'O método SPIN Selling explicado: perguntas de Situação, Problema, Implicação e Necessidade. Como usar para vender consultivamente sem empurrar.',
    category: 'Treinamento de Vendas',
    author: 'Equipe Althos',
    date: '2026-05-09',
    readingMinutes: 7,
    excerpt:
      'Os melhores vendedores falam menos e perguntam mais. O SPIN Selling é o roteiro de perguntas que leva o cliente a concluir, sozinho, que precisa de você.',
    blocks: [
      { type: 'p', text: 'Vendedor que só fala empurra; vendedor que pergunta conduz. O SPIN Selling é um método baseado em quatro tipos de pergunta que levam o cliente a enxergar o próprio problema e o valor da solução — sem pressão. Funciona especialmente em vendas consultivas.' },
      { type: 'h2', text: 'S — Situação' },
      { type: 'p', text: 'Perguntas para entender o contexto atual: "como vocês fazem isso hoje?", "quantas pessoas no time?". Servem para mapear o terreno. Use com moderação — excesso entedia.' },
      { type: 'h2', text: 'P — Problema' },
      { type: 'p', text: 'Perguntas que trazem à tona as dores: "o que mais te incomoda no processo atual?", "onde costuma travar?". Aqui o cliente começa a verbalizar o que não vai bem.' },
      { type: 'h2', text: 'I — Implicação' },
      { type: 'p', text: 'O coração do método: perguntas que ampliam a dor mostrando suas consequências. "Quanto isso custa por mês?", "o que acontece se continuar assim?". O cliente passa a sentir a urgência de resolver.' },
      { type: 'h2', text: 'N — Necessidade de solução' },
      { type: 'p', text: 'Perguntas que fazem o cliente declarar o valor da solução: "se você resolvesse isso, qual seria o impacto?". Quando ele mesmo diz, o convencimento já aconteceu.' },
      { type: 'quote', text: 'As melhores vendas são aquelas em que o cliente se convence sozinho. Boas perguntas fazem isso melhor que qualquer argumento.' },
      { type: 'p', text: 'No Althos CRM, você registra as respostas-chave de cada negociação (dor, implicação, urgência) no histórico do lead. O time aplica o SPIN com consistência e nenhum contexto se perde entre uma conversa e outra.' },
      { type: 'cta', text: 'Padronize a venda consultiva e guarde cada contexto no histórico do lead.' },
    ],
  },
  {
    slug: 'treinamento-vendas-rapport-conexao',
    title: 'Rapport em vendas: como criar conexão e confiança rápido',
    description:
      'Técnicas de rapport para vendedores: escuta ativa, espelhamento, interesse genuíno e como construir confiança sem ser forçado ou bajulador.',
    category: 'Treinamento de Vendas',
    author: 'Equipe Althos',
    date: '2026-05-03',
    readingMinutes: 5,
    excerpt:
      'As pessoas compram de quem confiam. Rapport é a habilidade de criar essa confiança rápido — e, ao contrário do que parece, dá para treinar.',
    blocks: [
      { type: 'p', text: 'Antes de comprar o produto, o cliente compra o vendedor. Rapport é o nome dessa conexão de confiança — e ela não é "dom", é técnica que se treina. Sem rapport, até a melhor proposta esbarra na resistência.' },
      { type: 'h2', text: 'Escuta ativa: a base de tudo' },
      { type: 'p', text: 'Conexão começa por ouvir de verdade — não esperando a vez de falar. Demonstre que entendeu, repita pontos importantes com as palavras do cliente e faça perguntas de aprofundamento. Quem se sente ouvido baixa a guarda.' },
      { type: 'h2', text: 'Espelhamento (com naturalidade)' },
      { type: 'p', text: 'Adaptar o ritmo, o tom e o vocabulário ao do cliente cria sintonia. Cliente acelerado? Vá mais direto. Cliente cauteloso? Dê espaço. Espelhar não é imitar — é se sintonizar.' },
      { type: 'h2', text: 'Interesse genuíno vence técnica decorada' },
      { type: 'ul', items: [
        'Lembre detalhes que o cliente mencionou.',
        'Interesse-se pelo problema dele, não só pela comissão.',
        'Cumpra o que prometeu — confiança se constrói com consistência.',
      ] },
      { type: 'quote', text: 'Técnica de rapport sem interesse verdadeiro vira manipulação — e o cliente sente. Conexão real começa por querer ajudar.' },
      { type: 'p', text: 'No Althos CRM, todo histórico do cliente fica registrado: o que ele falou, o que importa para ele, contatos anteriores. O vendedor retoma a conversa lembrando dos detalhes — e nada constrói mais confiança do que ser lembrado.' },
      { type: 'cta', text: 'Tenha todo o histórico do cliente à mão e construa confiança a cada contato.' },
    ],
  },
  {
    slug: 'treinamento-vendas-tecnicas-fechamento',
    title: 'Técnicas de fechamento: como conduzir o cliente à decisão',
    description:
      'Técnicas de fechamento de vendas que funcionam sem pressão: fechamento por resumo, por alternativa e por próximo passo. Quando e como usar cada uma.',
    category: 'Treinamento de Vendas',
    author: 'Equipe Althos',
    date: '2026-04-27',
    readingMinutes: 6,
    excerpt:
      'Fechar não é forçar — é conduzir. Veja técnicas de fechamento que ajudam o cliente a decidir, sem a pressão que afasta.',
    blocks: [
      { type: 'p', text: 'Muitos vendedores fazem tudo certo e travam na hora de pedir a venda, com medo de parecer insistentes. Mas fechar bem não é pressionar — é conduzir o cliente naturalmente à decisão que ele já está pronto para tomar. Veja técnicas que funcionam.' },
      { type: 'h2', text: 'Fechamento por resumo' },
      { type: 'p', text: 'Antes de pedir a decisão, recapitule os pontos de valor que o próprio cliente reconheceu: "então, isso resolve seu problema X, cabe no seu prazo Y e está dentro do orçamento Z". Ouvir os benefícios somados facilita o sim.' },
      { type: 'h2', text: 'Fechamento por alternativa' },
      { type: 'p', text: 'Em vez de perguntar "você quer fechar?", ofereça uma escolha entre dois caminhos: "prefere começar pelo plano mensal ou pelo anual?". A pergunta assume o avanço e simplifica a decisão.' },
      { type: 'h2', text: 'Fechamento por próximo passo' },
      { type: 'p', text: 'Conduza para uma ação concreta e pequena: "vou te enviar o link agora, tudo bem?". Microcompromissos reduzem o peso da grande decisão.' },
      { type: 'h2', text: 'Saiba a hora certa' },
      { type: 'ul', items: [
        'O cliente perguntou sobre prazos, formas de pagamento ou implementação? É sinal de compra.',
        'As objeções principais já foram resolvidas.',
        'Não force antes do valor estar claro — fechar cedo demais queima a venda.',
      ] },
      { type: 'quote', text: 'Fechar é a consequência natural de uma venda bem conduzida, não um truque do final.' },
      { type: 'p', text: 'No Althos CRM, o vendedor enxerga em que etapa cada negociação está e recebe lembretes para avançar no momento certo. Menos venda perdida por timing, mais fechamentos no ponto.' },
      { type: 'cta', text: 'Conduza cada negociação ao fechamento no momento certo.' },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'whatsapp-api-utility-vs-marketing',
    title: 'WhatsApp API: Utility vs Marketing e como economizar até 70%',
    description:
      'Entenda as categorias de template da API oficial do WhatsApp (Utility, Marketing, Authentication, Service), a diferença de custo entre elas e como classificar certo para economizar até 70% na sua conta da Meta.',
    category: 'WhatsApp API',
    author: 'Equipe Althos',
    date: '2026-06-10',
    readingMinutes: 8,
    excerpt:
      'Na API oficial do WhatsApp, cada template tem uma categoria — e a categoria define o preço. Classificar uma mensagem como Marketing quando ela poderia ser Utility pode multiplicar seu custo. Veja como acertar.',
    blocks: [
      { type: 'p', text: 'A API oficial do WhatsApp (WhatsApp Business Platform) deixou de ser um canal gratuito há tempos. A Meta cobra por conversa iniciada, e o valor depende da categoria do template que você usa. É aqui que muitas empresas perdem dinheiro sem perceber: enviam como Marketing mensagens que poderiam ser Utility — e pagam várias vezes mais pela mesma comunicação.' },
      { type: 'h2', text: 'As categorias de template do WhatsApp' },
      { type: 'p', text: 'Todo template precisa ser submetido à Meta com uma categoria. São quatro, mas duas concentram a maior parte do uso e da diferença de custo:' },
      { type: 'ul', items: [
        'Utility (Utilidade): mensagens transacionais, disparadas por uma ação do cliente — confirmação de pedido, atualização de status, cobrança, lembrete de agendamento. É a categoria mais barata.',
        'Marketing: comunicações promocionais que incentivam a compra — ofertas, descontos, lançamentos, reengajamento. É a categoria mais cara.',
        'Authentication (Autenticação): códigos de verificação e login (OTP). Faixa de preço própria, geralmente baixa.',
        'Service (Atendimento): respostas dentro de uma conversa iniciada pelo cliente. Em boa parte dos casos, essas mensagens são gratuitas dentro da janela de 24h.',
      ] },
      { type: 'h2', text: 'A diferença de preço que muda o jogo' },
      { type: 'p', text: 'Os valores variam por país e são reajustados pela Meta de tempos em tempos, então trate os números como referência, não como tabela fixa. Mas a ordem de grandeza é o que importa: uma conversa de Utility costuma sair por uma fração do que custa uma de Marketing — a economia ao classificar corretamente pode chegar a 70%.' },
      { type: 'quote', text: 'A mesma mensagem, classificada como Utility em vez de Marketing, pode custar a metade ou menos. Em escala, isso são milhares de reais por mês.' },
      { type: 'p', text: 'Um exemplo simples: 5.000 mensagens mensais classificadas como Marketing quando deveriam ser Utility podem representar mais de R$ 1.500 de custo extra todo mês — só por uma categoria errada.' },
      { type: 'h2', text: 'Como a Meta decide a categoria' },
      { type: 'p', text: 'A classificação é baseada na intenção do conteúdo, não no nome que você dá ao template. Qualquer elemento promocional — mesmo sutil, como "aproveite", "confira nossas ofertas" ou um cupom — faz a Meta reclassificar a mensagem como Marketing. E a reclassificação é automática: se você submeter como Utility uma mensagem com cara de promoção, a Meta corrige e ainda pode cobrar a diferença retroativamente.' },
      { type: 'h2', text: 'Exemplos práticos de classificação' },
      { type: 'p', text: 'Use esta régua mental ao escrever um template:' },
      { type: 'ul', items: [
        'Utility: "Seu pedido #1234 foi enviado e chega até sexta." / "Lembrete: sua consulta é amanhã às 14h." / "Sua fatura de junho está disponível."',
        'Marketing: "20% OFF só hoje!" / "Conheça nossa nova coleção." / "Sentimos sua falta — volte com frete grátis."',
        'Authentication: "Seu código de verificação é 482190."',
      ] },
      { type: 'h2', text: 'O caso de fronteira que mais custa caro' },
      { type: 'p', text: 'O erro clássico é misturar transacional com promocional na mesma mensagem: "Obrigado pela compra! Seu pedido está confirmado. Aproveite e veja nossos lançamentos: [link]". A primeira parte seria Utility, mas o convite no final contamina a mensagem inteira — ela passa a ser cobrada como Marketing. A regra é simples: separe. Confirmação é uma mensagem; oferta é outra.' },
      { type: 'h2', text: 'Como economizar de verdade' },
      { type: 'ol', items: [
        'Mapeie seus templates e marque quais são puramente transacionais — eles devem ser Utility.',
        'Remova qualquer gancho promocional dos templates de Utility (nada de "aproveite", cupom ou link de oferta).',
        'Concentre o conteúdo de venda em templates de Marketing assumidos, disparados com estratégia, não no automático.',
        'Audite periodicamente: a Meta pode reclassificar com o tempo, então não confie só na aprovação inicial.',
      ] },
      { type: 'p', text: 'No Althos CRM, a integração com a API oficial do WhatsApp organiza seus templates por categoria e dispara as mensagens transacionais (confirmações, lembretes, cobranças) de forma automática a partir do funil — mantendo o conteúdo limpo, sem ganchos promocionais que encareceriam o envio. Você comunica mais e paga menos.' },
      { type: 'cta', text: 'Automatize suas mensagens transacionais no WhatsApp e corte custo de template.' },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'whatsapp-api-janela-24h-como-funciona-cobranca',
    title: 'Janela de 24h do WhatsApp: como funciona a cobrança por conversa',
    description:
      'A API oficial do WhatsApp cobra por conversa, não por mensagem — e a janela de atendimento de 24h muda tudo. Entenda como funciona, quando você precisa de template e como usar a janela a seu favor.',
    category: 'WhatsApp API',
    author: 'Equipe Althos',
    date: '2026-06-04',
    readingMinutes: 7,
    excerpt:
      'Muita gente acha que paga por mensagem no WhatsApp oficial. Não é bem assim: você paga por conversa, e a janela de 24h define quando o envio é livre e quando exige um template pago. Entenda o modelo.',
    blocks: [
      { type: 'p', text: 'Para usar bem a API oficial do WhatsApp — e não estourar o orçamento — você precisa entender duas coisas que andam juntas: a cobrança por conversa e a janela de atendimento de 24 horas. Quem domina esses dois conceitos paga menos e atende melhor.' },
      { type: 'h2', text: 'Você paga por conversa, não por mensagem' },
      { type: 'p', text: 'A Meta não cobra mensagem a mensagem. Ela abre uma "conversa" — uma sessão que dura 24 horas — e cobra por ela conforme a categoria (Utility, Marketing, Authentication). Dentro dessa janela aberta, as mensagens trocadas no mesmo contexto não geram cobrança adicional. Ou seja: o custo está em iniciar a conversa, não em cada balão enviado.' },
      { type: 'h2', text: 'A janela de atendimento de 24h' },
      { type: 'p', text: 'Toda vez que o cliente te envia uma mensagem, abre-se uma janela de 24 horas. Dentro dela, você pode responder com mensagens livres (texto, imagem, áudio — sem template pré-aprovado), de forma muito mais natural. Essa janela é renovada a cada nova mensagem do cliente.' },
      { type: 'ul', items: [
        'Dentro da janela de 24h: você responde livremente, sem precisar de template aprovado.',
        'Fora da janela: para reabrir o contato, você precisa enviar um template pré-aprovado pela Meta — e isso inicia (e cobra) uma nova conversa.',
        'A janela reinicia toda vez que o cliente responde.',
      ] },
      { type: 'h2', text: 'Quando você é obrigado a usar template' },
      { type: 'p', text: 'O template existe justamente para iniciar a conversa ou reabri-la fora da janela. Se passaram mais de 24h desde a última mensagem do cliente, você não pode simplesmente mandar um texto solto — precisa de um template aprovado, e a categoria dele define o preço. Por isso a escolha entre Utility e Marketing pesa tanto no custo total.' },
      { type: 'quote', text: 'A mensagem mais barata é a que acontece dentro da janela de 24h. Responder rápido não é só bom atendimento — é economia.' },
      { type: 'h2', text: 'Como usar a janela de 24h a seu favor' },
      { type: 'ol', items: [
        'Responda rápido: quanto antes você atende dentro da janela, mais você resolve sem custo de novo template.',
        'Concentre o atendimento: resolva o assunto enquanto a conversa está aberta, em vez de fragmentar contatos ao longo de dias.',
        'Planeje reaberturas: se precisa retomar fora da janela, escolha a categoria de template certa (Utility para transacional, Marketing só quando for promoção de fato).',
        'Evite reabrir sem necessidade: cada template fora da janela é uma nova conversa cobrada.',
      ] },
      { type: 'h2', text: 'Por que a velocidade de resposta vira dinheiro' },
      { type: 'p', text: 'Além de converter mais (lead respondido em minutos fecha muito mais que lead respondido em horas), atender dentro da janela reduz o número de templates pagos que você precisa disparar para reabrir conversas. Atendimento ágil é, ao mesmo tempo, mais venda e menos custo de plataforma.' },
      { type: 'p', text: 'No Althos CRM, o atendimento por IA responde os clientes 24h dentro da janela, mantém a conversa aberta e só recorre a templates quando realmente necessário. Você aproveita ao máximo cada janela de 24h — convertendo mais e gastando menos com a Meta.' },
      { type: 'cta', text: 'Atenda dentro da janela de 24h com IA e reduza o custo de templates.' },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: 'whatsapp-api-erros-de-template-que-aumentam-custo',
    title: '5 erros de template que inflam seu custo no WhatsApp (e como auditar)',
    description:
      'Erros de classificação e uso de templates na API oficial do WhatsApp que aumentam o custo, derrubam seu quality rating e podem restringir sua conta. Veja os 5 mais comuns e uma rotina de auditoria.',
    category: 'WhatsApp API',
    author: 'Equipe Althos',
    date: '2026-05-28',
    readingMinutes: 7,
    excerpt:
      'Na API oficial do WhatsApp, um template mal classificado não só custa mais caro — ele pode derrubar seu quality rating e travar seus envios. Veja os 5 erros que mais drenam orçamento e como auditá-los.',
    blocks: [
      { type: 'p', text: 'Depois de configurada, a API oficial do WhatsApp tende a virar "piloto automático" — e é justamente aí que o custo escapa do controle. Templates mal classificados, conteúdo misturado e disparos desnecessários inflam a fatura da Meta mês após mês. Veja os cinco erros mais comuns e como auditar seus templates antes que eles custem caro.' },
      { type: 'h2', text: '1. Classificar promoção como Utility' },
      { type: 'p', text: 'Tentar "economizar" marcando uma mensagem promocional como Utility não funciona — e sai pela culatra. A Meta avalia a intenção do conteúdo, reclassifica automaticamente para Marketing e ainda pode cobrar a diferença retroativamente. Você paga o valor cheio e ainda arranha a reputação da conta.' },
      { type: 'h2', text: '2. Misturar transacional com promocional' },
      { type: 'p', text: 'Aquele "obrigado pela compra, e aproveite nossa promoção" parece eficiente, mas transforma uma mensagem que seria barata (Utility) em uma cara (Marketing). Qualquer gancho de venda no template puxa a mensagem inteira para a categoria mais cara. Regra de ouro: uma mensagem, uma intenção.' },
      { type: 'h2', text: '3. Disparar template quando a janela de 24h está aberta' },
      { type: 'p', text: 'Se o cliente te respondeu há menos de 24h, você pode mandar mensagem livre — de graça, dentro da janela. Disparar um template nesse momento é abrir (e pagar por) uma conversa que não precisava existir. Automação mal configurada costuma cometer esse erro em volume.' },
      { type: 'h2', text: '4. Ignorar o quality rating da conta' },
      { type: 'p', text: 'A Meta atribui uma nota de qualidade ao seu número, baseada em como os clientes reagem (bloqueios, denúncias, marcação de spam). Nota baixa significa limites de envio menores e, no limite, suspensão. Templates mal classificados e disparos irrelevantes derrubam essa nota — e o estrago é difícil de reverter.' },
      { type: 'h2', text: '5. Não revisar templates após a aprovação' },
      { type: 'p', text: 'A aprovação inicial não é definitiva. A Meta pode reclassificar um template ao longo do tempo conforme ajusta seus critérios. Quem nunca revisa descobre o aumento de custo só na fatura — sem entender de onde veio.' },
      { type: 'quote', text: 'Template aprovado não é template esquecido. O que era Utility ontem pode ser cobrado como Marketing amanhã.' },
      { type: 'h2', text: 'Uma rotina simples de auditoria' },
      { type: 'ol', items: [
        'Liste todos os templates ativos e a categoria atual de cada um.',
        'Releia o conteúdo procurando ganchos promocionais escondidos em templates de Utility.',
        'Cruze o uso com a janela de 24h: você está disparando templates quando poderia responder de graça?',
        'Monitore o quality rating mensalmente e investigue qualquer queda.',
        'Defina um padrão interno: exemplos do que é aceitável em cada categoria, revisados por mais de uma pessoa antes de submeter.',
      ] },
      { type: 'p', text: 'No Althos CRM, os disparos de WhatsApp saem do funil de forma controlada: mensagens transacionais como Utility, sem ganchos promocionais, e respeitando a janela de 24h para evitar templates desnecessários. Menos custo com a Meta, melhor quality rating e nenhuma surpresa na fatura.' },
      { type: 'cta', text: 'Organize seus templates de WhatsApp e pare de pagar mais do que precisa.' },
    ],
  },
]

/** Lista de posts ordenada do mais novo para o mais antigo. */
export const POSTS_SORTED = [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1))

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find(p => p.slug === slug)
}

export function getRelatedPosts(post: BlogPost, limit = 2): BlogPost[] {
  return POSTS_SORTED.filter(p => p.slug !== post.slug && p.category === post.category)
    .concat(POSTS_SORTED.filter(p => p.slug !== post.slug && p.category !== post.category))
    .slice(0, limit)
}

export function formatPostDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}
