-- Comissão retida na fonte: quando o cliente paga uma entrada à vista, a
-- agência costuma reter parte (ou o total) da comissão nesse momento em vez
-- de esperar o repasse da operadora. `retained_commission_cents` guarda esse
-- valor retido (parte de `commission_cents`, nunca maior que ele — validado
-- na action). `commission_role` marca, em cada lançamento gerado no
-- Financeiro, se ele é a parte 'retida' (vencimento = data da venda) ou o
-- 'repasse' (vencimento = data de pagamento da operadora) — permite que uma
-- única venda gere dois lançamentos e o sync continue idempotente.
alter table travel_sales
  add column if not exists retained_commission_cents integer check (retained_commission_cents >= 0);

alter table financial_entries
  add column if not exists commission_role text check (commission_role in ('retida', 'repasse'));
