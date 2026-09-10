# MCP: gerenciamento do CRM e aprovação humana

O endpoint `/api/mcp` passa a anunciar 34 ferramentas (8 existentes e 26 novas).

| Área | Novas ferramentas |
| --- | --- |
| Contatos | `get_contacts`, `get_contact`, `create_contact`, `update_contact`, `delete_contact` |
| Reservas | `get_reservations`, `get_reservation`, `create_reservation`, `update_reservation`, `delete_reservation` |
| Financeiro | `get_financial_entries`, `get_financial_entry`, `create_financial_entry`, `update_financial_entry`, `delete_financial_entry` |
| Pipeline | `get_pipelines`, `get_pipeline_contacts`, `create_pipeline`, `update_pipeline`, `delete_pipeline`, `create_pipeline_stage`, `update_pipeline_stage`, `delete_pipeline_stage`, `move_pipeline_contact` |
| Indicadores | `get_dashboard_data` (pipeline, reservas e financeiro) |
| Aprovações | `get_operation_status` |

## Aprovação

Criações e consultas são executadas diretamente, dentro das permissões do usuário do token. Edições e exclusões apenas criam uma solicitação pendente. O assistente deve mostrar no chat o registro, a alteração proposta, os efeitos e o aviso **“Esta ação não poderá ser desfeita.”**, pedindo autorização pelo link retornado. Não deve aprovar pelo usuário usando automação de navegador.

O link abre uma página autenticada do Althos; somente o mesmo usuário, ainda membro da mesma organização, pode marcar a declaração e clicar em **Autorizar e executar**. A autorização expira em 15 minutos. A operação usa uma transição atômica de `pending` para `executing`, impedindo clique duplo e replay. Token, permissões e preview são revalidados. Se os dados mudarem, é necessária uma nova solicitação. Recusa, expiração e revogação não executam a mutação.

Não existe argumento `approved=true` nem ferramenta MCP que aprove pedidos. A tabela não oferece escrita ao papel `authenticated`; o servidor consome a aprovação após validar a sessão. Se a tabela não estiver instalada, escritas que exigem aprovação falham sem executar.

O transporte permanece stateless e compatível com Vercel. Não depende de uma elicitação mantida em memória entre requisições. Uma confirmação somente textual no chat não executa a mudança: é necessário usar o link autenticado. Após a autorização, o assistente consulta `get_operation_status` e comunica o resultado.

## Escopo e limites

- Contatos: nome, e-mail, telefone, tags, CPF, nascimento e notas internas. Criação requer uma etapa existente e cria o negócio associado conforme a lógica do CRM.
- Reservas: criação em aberto vinculada a contato, com proposta opcional; edição de informações de viagem, localizadores e valores/comissões. Sincroniza financeiro usando o mesmo serviço da interface. Não implementa cancelamento com crédito, upload de vouchers nem edição de produtos/passageiros.
- Financeiro: lançamentos individuais; não cria recorrência ou parcelamento. Editar/excluir uma parcela não altera as demais. Anexos são removidos pela rotina existente ao excluir.
- Pipeline: pipelines, etapas e movimentação de oportunidades representadas por contatos. A movimentação preserva negócios, histórico e automações. Não oferece troca entre pipelines nem alteração de pipeline padrão.
- Exclusões de contatos/reservas ficam restritas a owner/admin por poderem afetar registros dependentes. Outros módulos mantêm seus gates granulares. Edição de reserva requer financeiro por causa da sincronização de comissões.
- Dashboards: indicadores de pipeline, reservas e financeiro para período inclusivo em UTC. Os valores monetários vêm em centavos, acompanhados da base de cálculo. Não reproduz todas as abas e filtros das dashboards da interface. As ferramentas existentes de tráfego continuam disponíveis.
- Agregações fazem paginação de 1.000 registros. Acima de 50 mil exigem um período menor, sem retornar totais parciais.
- As rotinas existentes podem ter múltiplas escritas/efeitos externos; não há rollback distribuído. Se uma execução falhar ou ficar em `executing` após timeout, confira os dados e o audit log antes de tentar de novo. A aprovação não é reutilizada automaticamente.

## Publicação e verificação

1. Aplicar `supabase/migrations/20260910143457_agent_approval_requests.sql` ao projeto correspondente ao deployment (nova tabela, sem alterar RLS das tabelas do CRM).
2. Publicar a branch aprovada na Vercel.
3. Verificar `initialize` e `tools/list`: versão `1.1.0`, 34 ferramentas.
4. Em ambiente de teste, criar um registro, solicitar edição, recusar e conferir que nada mudou; repetir aprovando e conferir o resultado. Testar replay, usuário diferente, token revogado e registro alterado durante a espera.
5. Atualizar/reiniciar a conexão MCP no cliente para carregar o novo catálogo.

Testes unitários cobrem fronteiras do motor de execução, consumo de aprovação, escopo de IDs, schemas, cálculo financeiro e o transporte MCP real com autenticação mockada. Não equivalem a um teste de ponta a ponta contra Supabase/Vercel.
