-- Traffic Agent — Skills iniciais de Paid Media (#22, passo 3.3).
-- library_items com source_module='trafego', um item curto por categoria
-- (checklist de diagnóstico), pra cada org já no nicho tráfego. Idempotente:
-- só insere pra orgs que ainda não têm nenhum item 'trafego' (não duplica
-- se a migration rodar de novo, e não sobrescreve edição manual futura).
insert into library_items (organization_id, source_module, category, title, content, priority)
select o.id, 'trafego', v.category, v.title, v.content, v.priority
from organizations o
cross join (values
  ('meta-ads', 'Checklist: CPL subiu de repente',
   '1. Compare CPM do período vs. anterior — CPM em alta geralmente indica saturação de audiência ou mais concorrência no leilão.\n2. Veja CTR — se caiu, o criativo pode estar cansado (fadiga de anúncio).\n3. Confira se o orçamento diário está limitando a entrega (delivery insight "Limited by budget").\n4. Verifique se houve mudança de audiência/segmentação recente.\n5. Confirme que o Pixel/CAPI continua enviando eventos (ver aba Tracking) — perda de sinal de conversão também eleva CPL.', 10),
  ('google-ads', 'Checklist: sem integração viva ainda',
   'O Althos ainda não tem integração OAuth com Google Ads (sem developer token/App aprovado). Contas Google só aparecem no nível de campanha (dados manuais/CSV), sem drill-down Conjunto/Anúncio nem termos de busca. Não afirme métricas que a plataforma não está fornecendo automaticamente.', 5),
  ('tracking', 'Checklist: saúde do tracking',
   '1. Pixel/CAPI configurado no pipeline do cliente? (aba Tracking mostra "não configurado" caso contrário)\n2. Último envio CAPI recente e sem falhas nos últimos 7 dias?\n3. Links de rastreamento ativos e recebendo clique?\n4. Contas de anúncio sincronizadas há menos de 3 dias?\nSe qualquer um desses estiver com problema, os números de leads/CPL podem estar subestimados — investigue antes de concluir que a campanha piorou.', 10),
  ('campaign-planning', 'Checklist: estruturar campanha nova',
   '1. Defina o objetivo primário (leads, vendas, awareness) — isso muda a otimização escolhida na plataforma.\n2. Separe por estágio de funil (topo/meio/fundo) quando o orçamento permitir mais de uma campanha.\n3. Reserve orçamento de teste (A/B de criativo) antes de escalar.\n4. Vincule o item do Plano de Mídia à campanha publicada assim que ela existir, pra permitir a reconciliação automática.', 5),
  ('diagnostics', 'Checklist: queda de leads',
   '1. Investimento caiu no período? (campanha pausada, orçamento esgotado)\n2. CPM subiu sem queda proporcional de CTR? (mercado mais caro, não é problema do anúncio)\n3. Sazonalidade — compare com o mesmo período do mês/ano anterior, não só com a semana passada.\n4. Tracking com falha (ver categoria "tracking") pode fazer parecer que não há leads quando na verdade eles não estão sendo capturados.', 10),
  ('optimization', 'Checklist: quando pausar um conjunto de anúncios',
   '1. CPL do conjunto specific está 50%+ acima da meta por pelo menos 3-4 dias consecutivos (não um dia isolado).\n2. Frequência de exibição muito alta (>3-4 num período curto) sem conversão — sinal de fadiga.\n3. Antes de pausar, confirme que não é um problema de tracking (ver categoria correspondente) — pausar por engano custa aprendizado de algoritmo.', 5),
  ('reporting', 'Checklist: como apresentar resultado ao cliente',
   'Sempre separe "reportado pela plataforma" (investimento, leads que a Meta/Google contam) de "resultado real no Althos" (vendas/receita confirmadas) — nunca some as duas fontes como se fossem a mesma coisa. Use o card "Plataforma × Real" como referência de como isso é feito no painel.', 5)
) as v(category, title, content, priority)
where o.niche = 'trafego'
  and not exists (
    select 1 from library_items li where li.organization_id = o.id and li.source_module = 'trafego'
  );
