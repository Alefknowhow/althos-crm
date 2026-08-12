# Roteiro de App Review — Meta (Althos CRM)

Texto de caso de uso, roteiro de vídeo (screencast) e instruções de teste para
cada uma das 6 permissões solicitadas. Ordem de gravação sugerida: **Instagram
→ Ads → WhatsApp** (WhatsApp por último).

> A Meta aceita a descrição em português, mas os revisores costumam ser
> falantes de inglês — por isso cada caso de uso vem com as duas versões. Cole
> a que preferir (ou as duas, uma abaixo da outra) no campo "Descrição do caso
> de uso" de cada permissão.

> **Regra geral de gravação:** tela cheia, sem dados fictícios óbvios demais
> (use uma conta/org de teste real, com nome de negócio plausível), sem
> cortes bruscos, narração ou legendas explicando cada clique. Grave em 1080p,
> MP4, até ~3-5 min por vídeo. Comece sempre mostrando o app já logado —
> não precisa gravar o cadastro/login no CRM, só a permissão em uso.

## Credenciais de teste (login no CRM)

Cole isso no campo de instruções gerais do App Review (a Meta sempre pede
login/senha quando o app avaliado exige autenticação):

> - URL: https://althoscrm.com.br
> - Organização de teste: **Clínica Teste** (`clinica-teste`)
> - E-mail: `aleftrentin+metareview@gmail.com`
> - Senha: `Teste123@`
>
> Após o login, o app já abre direto na organização de teste — não é
> necessário selecionar nada.

---

## 1. `instagram_business_basic`

**O que é:** acesso básico ao perfil profissional do Instagram conectado
(nome, username, foto, id) — usado pra identificar a conta e o remetente das
mensagens/comentários.

### Caso de uso (PT)

> O Althos CRM é um sistema de gestão de relacionamento com clientes (CRM)
> usado por empresas para atender seus próprios clientes. Um dos módulos
> permite que o dono do negócio conecte sua conta profissional do Instagram
> ao CRM para centralizar e automatizar o atendimento via Direct (DM) e
> comentários. A permissão `instagram_business_basic` é usada para
> identificar a conta profissional conectada (nome, username, foto de perfil)
> e os remetentes das mensagens recebidas, exibindo essas informações no
> painel de atendimento do CRM. A conexão é sempre iniciada e autorizada
> explicitamente pelo dono da conta Instagram, via OAuth oficial da Meta.

### Caso de uso (EN)

> Althos CRM is a customer relationship management (CRM) system used by
> businesses to manage their own customer communications. One of its modules
> lets a business owner connect their Instagram professional account to the
> CRM to centralize and automate Direct Message and comment support. The
> `instagram_business_basic` permission is used to identify the connected
> professional account (name, username, profile picture) and the senders of
> incoming messages, displaying this information in the CRM's support inbox.
> The connection is always initiated and explicitly authorized by the
> Instagram account owner via Meta's official OAuth flow.

### Roteiro do vídeo

1. Abra o CRM já logado, clique em **"Instagram"** na sidebar (abre a aba
   Direct Inbox).
2. No canto superior direito, clique em **"Conectar Instagram"** — mostre o
   popup de login/autorização real da Meta abrindo (não corte essa parte, é
   o que o revisor mais quer ver: o consentimento explícito do usuário).
3. Autorize com a conta Instagram profissional de teste.
4. De volta ao CRM, mostre o botão virando **"Instagram conectado"**, com o
   **username e a foto de perfil reais** vindos da API (prova visual de que
   `instagram_business_basic` está sendo usado).
5. Na mesma tela (Direct Inbox), mostre a lista de conversas — aponte que
   nome/username/foto de cada remetente vêm da mesma permissão.

### Instruções de teste para o revisor

> 1. Faça login em https://althoscrm.com.br com as credenciais de teste do
>    topo deste documento.
> 2. Faça login com uma conta Instagram profissional (Comercial ou Criador de
>    Conteúdo) de teste.
> 3. No app avaliado, acesse o item "Instagram" na sidebar e clique em
>    "Conectar Instagram" no canto superior direito.
> 4. Autorize o acesso solicitado.
> 5. Confirme que o nome, username e foto de perfil da conta aparecem
>    corretamente na tela de conexão e na lista de conversas.

---

## 2. `instagram_business_manage_messages`

**O que é:** ler e enviar DMs (Direct) da conta profissional conectada —
usado pelo inbox manual de atendimento e pelas automações/funis de resposta.

### Caso de uso (PT)

> O Althos CRM permite que o dono de um negócio centralize o atendimento via
> Direct do Instagram dentro do próprio CRM, junto com os demais canais de
> contato com o cliente (WhatsApp, e-mail). A permissão
> `instagram_business_manage_messages` é usada para: (1) receber, em tempo
> real via webhook, as mensagens diretas enviadas por clientes à conta
> conectada, exibindo-as no inbox do CRM; (2) permitir que o atendente
> responda manualmente pelo próprio CRM, sem precisar abrir o aplicativo do
> Instagram; e (3) permitir automações configuráveis pelo dono do negócio
> (ex.: resposta automática a uma pergunta frequente, ou um funil de
> qualificação por DM) — sempre respeitando a janela de mensagens de 24h da
> Meta. Nenhuma mensagem é enviada sem que o fluxo tenha sido configurado ou
> disparado por uma interação real do cliente.

### Caso de uso (EN)

> Althos CRM lets a business owner centralize Instagram Direct support
> inside the CRM itself, alongside other customer contact channels (WhatsApp,
> email). The `instagram_business_manage_messages` permission is used to:
> (1) receive, in real time via webhook, direct messages sent by customers to
> the connected account, displaying them in the CRM's inbox; (2) let a human
> agent reply manually from within the CRM, without needing to open the
> Instagram app; and (3) allow configurable automations set up by the
> business owner (e.g., an automatic reply to a frequently asked question, or
> a DM qualification flow) — always respecting Meta's 24-hour messaging
> window. No message is ever sent without either being manually typed by an
> agent or triggered by a real customer interaction within an automation the
> business owner explicitly configured.

### Roteiro do vídeo

1. (Pode continuar do vídeo anterior, com a conta já conectada.)
2. De um segundo dispositivo/conta de teste, **envie uma DM real** para a
   conta Instagram conectada (ex.: "Oi, vocês têm horário disponível
   amanhã?").
3. No CRM, mostre a mensagem **chegando em tempo real** na aba
   **Instagram → Direct Inbox** (pode dar um refresh se não for via
   websocket).
4. Mostre o atendente **respondendo manualmente** pelo campo de texto do
   CRM — e a resposta chegando de volta na conta de teste que enviou a DM
   (grave a tela do celular/segunda conta recebendo, se der).
5. Em seguida, mostre a tela **Instagram → Automações**: abra uma automação
   já configurada (ex.: gatilho por palavra-chave) e explique brevemente que
   ela responde sozinha quando a mensagem bate no gatilho — pode disparar
   uma segunda DM de teste pra mostrar a automação respondendo automaticamente.
6. Feche mostrando o toggle de **pausar automação** quando um humano assume a
   conversa (evidencia controle do dono do negócio sobre quando é bot ou
   humano).

### Instruções de teste para o revisor

> 1. Faça login em https://althoscrm.com.br com as credenciais de teste do
>    topo deste documento.
> 2. Conecte uma conta Instagram profissional de teste (ver seção 1).
> 3. De uma segunda conta Instagram, envie uma DM para a conta conectada.
> 4. No CRM, acesse Instagram → Direct Inbox — a mensagem deve aparecer na
>    lista de conversas.
> 5. Responda pelo campo de texto do CRM e confirme o recebimento na segunda
>    conta.
> 6. Opcional: configure uma automação simples em Instagram → Automações
>    (gatilho por palavra-chave) e envie uma nova DM contendo a palavra para
>    ver a resposta automática.

---

## 3. `instagram_business_manage_comments`

**O que é:** ler e responder comentários em publicações da conta conectada
— usado pra automações do tipo "comentou → resposta pública e/ou DM
privada" e pela fila de resposta manual em Instagram → Comentários.

> O CRM responde comentários de duas formas: **automação** (regra por
> palavra-chave, resposta pública e/ou DM privada) e, desde a aba
> **Instagram → Comentários**, **resposta manual** — todo comentário que não
> bate em nenhuma automação fica pendente ali, com uma caixa de texto pra
> responder na hora (com opção de também mandar como DM privada).

### Caso de uso (PT)

> Além do Direct, o Althos CRM permite que o dono do negócio responda
> comentários recebidos em suas publicações do Instagram de duas formas:
> automaticamente, por meio de automações configuráveis (ex.: responder
> publicamente a um comentário com uma palavra-chave específica como "quero
> saber mais", opcionalmente com uma resposta privada complementar via DM);
> ou manualmente, pela aba "Comentários" do CRM, onde ficam listados os
> comentários que ainda não foram respondidos, prontos para o atendente
> responder diretamente pelo próprio CRM. A permissão
> `instagram_business_manage_comments` é usada para: (1) receber, via
> webhook, os comentários feitos nas publicações da conta conectada; e (2)
> publicar a resposta pública e/ou disparar a resposta privada, seja ela
> automática ou digitada manualmente pelo atendente. Como a API do Instagram
> não oferece evento de "novo seguidor", o CRM usa esse gatilho de comentário
> (junto com resposta a stories) como forma legítima de iniciar um
> atendimento — automatizado ou humano.

### Caso de uso (EN)

> In addition to Direct Messages, Althos CRM lets a business owner reply to
> comments received on their Instagram posts in two ways: automatically,
> through configurable automations (e.g. publicly replying to a comment
> containing a specific keyword such as "tell me more", optionally with a
> complementary private DM reply); or manually, from the CRM's "Comments"
> tab, which lists comments that haven't been answered yet, ready for an
> agent to reply directly from within the CRM. The
> `instagram_business_manage_comments` permission is used to: (1) receive,
> via webhook, comments made on the connected account's posts; and (2)
> publish the public reply and/or trigger the private reply, whether
> automatic or manually typed by the agent. Since the Instagram API does not
> provide a "new follower" event, the CRM uses this comment trigger (along
> with story-reply triggers) as a legitimate way to start a support
> interaction — automated or human.

### Roteiro do vídeo

1. Mostre, no CRM, uma automação configurada em
   **Instagram → Automações** com gatilho **"Comentário"** e uma
   palavra-chave (ex.: "preço").
2. De uma segunda conta, **comente numa publicação real** da conta
   conectada, usando a palavra-chave configurada.
3. Mostre a **resposta pública automática** aparecendo no post (do lado do
   Instagram real, não só do CRM).
4. Se a automação também disparar DM privada, mostre a **resposta privada**
   chegando na conta que comentou.
5. **Fluxo manual:** de uma segunda conta, comente no post de novo com uma
   frase que NÃO bate em nenhuma automação (ex.: "adorei o post!").
6. No CRM, abra a aba **Instagram → Comentários** e mostre esse comentário
   aparecendo como **pendente**.
7. Digite uma resposta na caixa de texto, marque (ou não) "Também enviar
   como DM privada", e clique em **Responder** — mostre a resposta
   aparecendo no post real do Instagram e o card sumindo da fila de
   pendentes no CRM.

### Instruções de teste para o revisor

> 1. Faça login em https://althoscrm.com.br com as credenciais de teste do
>    topo deste documento.
> 2. Conecte uma conta Instagram profissional de teste (ver seção 1).
> 3. No CRM, crie uma automação em Instagram → Automações com gatilho
>    "Comentário" e uma palavra-chave (ex.: "preço").
> 4. Publique um post na conta de teste (ou use um já existente).
> 5. De uma segunda conta, comente no post usando a palavra-chave.
> 6. Confirme que a resposta pública aparece no comentário e, se configurado,
>    que a resposta privada chega como DM.
> 7. Comente novamente com um texto que não bate em nenhuma automação e
>    confirme que ele aparece em Instagram → Comentários como pendente.
> 8. Responda pelo CRM e confirme que a resposta aparece no comentário real
>    do Instagram.

---

## 4. `ads_read`

**O que é:** leitura (somente leitura) de campanhas, conjuntos de anúncios,
anúncios e métricas de desempenho (impressões, cliques, gasto, conversas
iniciadas etc.) de uma conta de anúncios da Meta já autorizada pelo
cliente.

### Caso de uso (PT)

> O Althos CRM oferece um painel de "Anúncios" onde o dono do negócio
> acompanha, dentro do próprio CRM, o desempenho das campanhas que roda na
> Meta (Facebook/Instagram Ads) — sem precisar abrir o Gerenciador de
> Anúncios. A permissão `ads_read` é usada exclusivamente para **ler**
> (nunca criar, editar ou pausar) campanhas, conjuntos de anúncios e métricas
> diárias (gasto, impressões, cliques, conversas iniciadas, conversões) da
> conta de anúncios que o próprio cliente conectou e autorizou via login
> oficial do Facebook (a lista de contas disponíveis é carregada
> automaticamente pela API após o login, sem inserção manual de ID ou
> token). Os dados são sincronizados periodicamente e exibidos em tabelas e
> gráficos no painel do CRM, permitindo comparar campanhas e identificar as
> que geram mais resultado — tudo isso sobre a própria conta de anúncios do
> usuário, nunca de terceiros.

### Caso de uso (EN)

> Althos CRM offers an "Ads" dashboard where a business owner can track, from
> within the CRM itself, the performance of the campaigns they run on Meta
> (Facebook/Instagram Ads) — without needing to open Meta Ads Manager. The
> `ads_read` permission is used strictly to **read** (never create, edit, or
> pause) campaigns, ad sets, and daily metrics (spend, impressions, clicks,
> conversations started, conversions) from the ad account the customer
> themselves connected and authorized via official Facebook Login (the list
> of available accounts is loaded automatically by the API right after
> login, with no manual ID or token entry). Data is synced periodically and
> displayed in tables and charts inside the CRM dashboard, letting the owner
> compare campaigns and identify which ones perform best — always over the
> user's own ad account, never a third party's.

### Roteiro do vídeo

1. No CRM, vá em **Marketing → Contas** e clique em **"Conectar com Facebook
   (Meta Ads)"**.
2. Mostre o **popup oficial de login do Facebook** abrindo, o login com a
   conta de teste e a tela de permissões — não corte essa parte.
3. De volta ao CRM, mostre a **lista de contas de anúncio carregada
   automaticamente** (nada digitado manualmente — é a API que devolve as
   contas que o usuário tem acesso) e selecione uma pra conectar.
4. Abra o painel **Marketing → Anúncios**.
5. Mostre a **tabela de campanhas** carregando com nome, status, objetivo e
   métricas reais (gasto, impressões, cliques).
6. Mostre o **gráfico de desempenho** ao longo do tempo, e o filtro/checkbox
   de seleção de campanhas específicas.
7. Abra o **drill-down** de uma campanha (clique numa linha) pra mostrar
   detalhamento por conjunto de anúncios/anúncio — reforça que é leitura
   detalhada, não edição (não há nenhum botão de "editar campanha" na tela).

### Instruções de teste para o revisor

> 1. Faça login em https://althoscrm.com.br com as credenciais de teste do
>    topo deste documento.
> 2. Use uma conta de anúncios de teste da Meta com pelo menos uma campanha
>    ativa (ou histórico) com métricas.
> 3. No CRM, acesse Marketing → Contas e clique em "Conectar com Facebook
>    (Meta Ads)", autorizando o login e selecionando a conta na lista
>    carregada automaticamente pela API (nenhum ID é digitado manualmente).
> 4. Acesse Marketing → Anúncios e confirme que campanhas e métricas da
>    conta conectada aparecem corretamente na tabela e no gráfico.
> 5. Confirme que não há nenhuma ação de escrita disponível na tela (criar,
>    editar, pausar campanha) — o painel é somente leitura.

---

## 5. `whatsapp_business_management`

**O que é:** gerenciar recursos da conta do WhatsApp Business (WABA) em nome
do cliente — números de telefone, templates de mensagem — usado no fluxo de
conexão "Embedded Signup" (1 clique) e na tela de Templates.

### Caso de uso (PT)

> O Althos CRM permite que cada cliente conecte sua própria conta do
> WhatsApp Business (WABA) ao CRM através do fluxo oficial de **Embedded
> Signup** da Meta — o cliente faz login com a própria conta Meta Business,
> escolhe o número de telefone e autoriza a conexão em poucos cliques, sem
> precisar copiar Phone Number ID/token manualmente. A permissão
> `whatsapp_business_management` é usada para: (1) concluir esse fluxo de
> conexão, associando o número de telefone escolhido pelo cliente à
> organização dele dentro do CRM; e (2) permitir que o cliente crie e liste,
> pela tela de "Templates" do CRM, os templates de mensagem da própria WABA,
> que depois são usados para enviar mensagens dentro das regras da Meta
> (fora da janela de 24h, só com template aprovado). Nenhuma alteração é
> feita em contas de WhatsApp Business que não sejam explicitamente
> conectadas e autorizadas pelo próprio dono.

### Caso de uso (EN)

> Althos CRM lets each customer connect their own WhatsApp Business Account
> (WABA) to the CRM through Meta's official **Embedded Signup** flow — the
> customer logs in with their own Meta Business account, picks the phone
> number, and authorizes the connection in a few clicks, without manually
> copying a Phone Number ID or access token. The `whatsapp_business_management`
> permission is used to: (1) complete this connection flow, associating the
> phone number the customer chose with their organization inside the CRM;
> and (2) let the customer create and list, from the CRM's "Templates"
> screen, message templates belonging to their own WABA, which are later
> used to send messages within Meta's rules (outside the 24-hour window,
> only approved templates can be used). No changes are ever made to a
> WhatsApp Business account that hasn't been explicitly connected and
> authorized by its owner.

### Roteiro do vídeo

1. No CRM, vá em **Configurações → WhatsApp** e clique em **"Conectar
   WhatsApp"** (Embedded Signup).
2. Mostre o **popup oficial da Meta** abrindo, o login com a conta Meta
   Business de teste, e a escolha do número de telefone — não corte essa
   parte.
3. De volta ao CRM, mostre o número **conectado com sucesso**.
4. Abra a tela **Templates de WhatsApp**, crie um template novo (nome,
   categoria, corpo da mensagem) e mostre ele sendo salvo/listado.
5. (Opcional) Mostre o status do template (local/pendente/aprovado) —
   evidencia que o CRM sabe diferenciar o que já foi de fato aprovado pela
   Meta.

### Instruções de teste para o revisor

> 1. Faça login em https://althoscrm.com.br com as credenciais de teste do
>    topo deste documento.
> 2. Use uma conta Meta Business de teste com um número de telefone
>    disponível para conectar ao WhatsApp Business.
> 3. No CRM, acesse Configurações → WhatsApp → Conectar WhatsApp e siga o
>    fluxo de Embedded Signup.
> 4. Confirme que o número aparece conectado no CRM após a autorização.
> 5. Acesse a tela de Templates de WhatsApp e crie um template de teste,
>    confirmando que ele é salvo e listado corretamente.

---

## 6. `whatsapp_business_messaging`

**O que é:** enviar e receber mensagens via WhatsApp Cloud API — usado no
inbox de Conversas (atendimento 1:1) e nas Campanhas de Envio (disparo em
massa por template aprovado).

### Caso de uso (PT)

> Depois de conectada a conta do WhatsApp Business (ver permissão anterior),
> o Althos CRM centraliza o atendimento via WhatsApp dentro da aba
> **Conversas**: mensagens recebidas de clientes chegam em tempo real via
> webhook, e o atendente responde diretamente pelo CRM. A permissão
> `whatsapp_business_messaging` é usada para: (1) receber mensagens
> inbound via webhook e exibi-las no inbox; (2) enviar respostas manuais do
> atendente, respeitando a janela de 24h da Meta (fora dela, só com template
> aprovado); e (3) enviar campanhas de mensagens em massa (módulo
> "Campanhas de Envio"), sempre usando um template pré-aprovado pela Meta e
> filtrando o público por tags/estágio do funil configurados pelo próprio
> dono do negócio — nunca texto livre fora da janela, e nunca para uma lista
> de contatos que não seja da própria base de clientes do cliente do CRM.

### Caso de uso (EN)

> Once the WhatsApp Business account is connected (see previous permission),
> Althos CRM centralizes WhatsApp support inside the **Conversas** (Chats)
> tab: messages received from customers arrive in real time via webhook, and
> the agent replies directly from the CRM. The `whatsapp_business_messaging`
> permission is used to: (1) receive inbound messages via webhook and display
> them in the inbox; (2) send manual agent replies, respecting Meta's
> 24-hour messaging window (outside of it, only an approved template can be
> used); and (3) send bulk message campaigns ("Campanhas de Envio" module),
> always using a Meta-approved template and filtering the audience by
> tags/pipeline stage configured by the business owner — never free-form
> text outside the window, and never to a contact list other than the CRM
> customer's own customer base.

### Roteiro do vídeo

1. Com o número já conectado (continuação do vídeo anterior), abra a aba
   **Conversas**.
2. De um celular/número de teste, **envie uma mensagem real** pro WhatsApp
   conectado.
3. Mostre a mensagem chegando **em tempo real** no inbox do CRM.
4. Responda manualmente pelo CRM e mostre a resposta chegando no celular de
   teste.
5. Abra o módulo **Campanhas de Envio → Nova campanha**: monte uma campanha
   de teste (nome, template aprovado, filtro de público pequeno), confirme
   e mostre a tela de detalhe com o destinatário de teste recebendo a
   mensagem (status "Enviado").
6. Feche mostrando que, se tentar responder uma conversa fora da janela de
   24h, o CRM **bloqueia** o envio de texto livre (evidencia conformidade
   com a regra da Meta).

### Instruções de teste para o revisor

> 1. Faça login em https://althoscrm.com.br com as credenciais de teste do
>    topo deste documento.
> 2. Conecte um número de teste do WhatsApp Business ao CRM (ver permissão
>    `whatsapp_business_management`).
> 3. De outro número, envie uma mensagem para o número conectado.
> 4. No CRM, acesse Conversas e confirme que a mensagem aparece no inbox.
> 5. Responda pelo CRM e confirme o recebimento no número de teste.
> 6. Opcional: em Campanhas de Envio, crie uma campanha de teste com um
>    template aprovado e um público pequeno, e confirme o envio.

---

## Checklist antes de submeter

- [ ] Gravar os 6 vídeos (ou agrupar Instagram nos 3 primeiros e WhatsApp nos
      2 últimos, já que reaproveitam a mesma sessão conectada).
- [ ] Cortar cada vídeo pro trecho relevante (sem tempo morto excessivo).
- [ ] Colar o texto de caso de uso (PT+EN) em cada permissão no painel
      **Revisão do aplicativo → Permissões e recursos**.
- [ ] Preencher as instruções de teste no mesmo formulário.
- [ ] Confirmar que a política de privacidade e os termos de uso do CRM
      estão públicos e linkados no app (a Meta cobra isso à parte).
- [ ] Enviar e aguardar (normalmente 1–4 semanas, pode haver idas e voltas
      pedindo ajuste no vídeo ou no texto).
