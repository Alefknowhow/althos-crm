-- Reserva ganha um identificador curto e único, gerado automaticamente,
-- pra poder ser localizada/citada por telefone/WhatsApp sem depender do
-- UUID interno. Segue o mesmo padrão já usado em accounts.referral_code
-- (0057_billing_plans.sql): 8 caracteres alfanuméricos maiúsculos.

alter table public.travel_sales
  add column if not exists sale_number text;

create or replace function generate_travel_sale_number()
returns trigger as $$
begin
  if new.sale_number is null then
    new.sale_number := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_travel_sale_number on public.travel_sales;
create trigger trg_travel_sale_number
  before insert on public.travel_sales
  for each row
  execute function generate_travel_sale_number();

-- Backfill das reservas já existentes.
update public.travel_sales
set sale_number = upper(substring(md5(random()::text || clock_timestamp()::text || id::text) from 1 for 8))
where sale_number is null;

alter table public.travel_sales
  alter column sale_number set not null;

create unique index if not exists travel_sales_sale_number_key
  on public.travel_sales (sale_number);
