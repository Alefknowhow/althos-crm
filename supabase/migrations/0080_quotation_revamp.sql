-- ============================================================
-- Reformulação da Cotação (proposta pública "concierge editorial")
--
-- travel_proposals segue sendo a tabela-pai (preserva tokens públicos,
-- FK de travel_sales e telas existentes). Este arquivo:
--   1. adiciona os campos novos do modelo (hero, pax, rich-text, pagamento)
--   2. cria as tabelas-filhas reordenáveis (hospedagens, aéreo,
--      itinerário, pins de mapa)
--   3. cria org_settings (white-label, 1 linha por agência)
--   4. cria a RPC pública get_public_quotation(token) — security definer,
--      única porta de leitura anônima
--   5. migra dados antigos (hotels/flights/map_config/payment/weather)
-- ============================================================

-- ── 1. Campos novos no pai ──────────────────────────────────
alter table public.travel_proposals
  add column if not exists subtitle           text,
  add column if not exists cover_image_url    text,
  add column if not exists origin_label       text,
  add column if not exists origin_note        text,
  add column if not exists client_whatsapp    text,
  add column if not exists pax_adults         integer not null default 0,
  add column if not exists pax_children       integer not null default 0,
  add column if not exists children_ages      integer[] not null default '{}',
  add column if not exists occupancy_label    text,
  add column if not exists intro_html         text,
  add column if not exists important_html     text,
  add column if not exists closing_html       text,
  add column if not exists payment_conditions jsonb not null default '[]'::jsonb,
  add column if not exists price_disclaimer   text,
  add column if not exists currency           text not null default 'BRL',
  add column if not exists quoted_at          timestamptz,
  add column if not exists validity_days      integer not null default 5;

comment on column public.travel_proposals.payment_conditions is
  'Condições de pagamento exibidas no bloco Investimento: [{label, value}]';

-- ── 2. Tabelas-filhas ───────────────────────────────────────
create table if not exists public.quotation_lodgings (
  id               uuid primary key default gen_random_uuid(),
  quotation_id     uuid not null references public.travel_proposals(id) on delete cascade,
  sort_order       integer not null default 0,
  name             text not null default '',
  check_in         date,
  check_out        date,
  room_category    text,
  board            text,
  description_html text,
  photos           jsonb not null default '[]'::jsonb,
  lat              double precision,
  lng              double precision,
  tripadvisor_location_id text,
  tripadvisor_data jsonb,
  created_at       timestamptz not null default now()
);

create table if not exists public.quotation_flights (
  id             uuid primary key default gen_random_uuid(),
  quotation_id   uuid not null references public.travel_proposals(id) on delete cascade,
  sort_order     integer not null default 0,
  leg_type       text not null default 'outbound' check (leg_type in ('outbound','inbound','connection')),
  from_code      text, from_city text,
  to_code        text, to_city   text,
  airline        text,
  date           date,
  duration_label text,
  stopover_label text,
  created_at     timestamptz not null default now()
);

create table if not exists public.quotation_itinerary_days (
  id           uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.travel_proposals(id) on delete cascade,
  sort_order   integer not null default 0,
  day_label    text not null default '',
  date         date,
  title        text not null default '',
  items        jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

create table if not exists public.quotation_map_pins (
  id           uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.travel_proposals(id) on delete cascade,
  label        text not null default '',
  type         text not null default 'attraction' check (type in ('lodging','attraction','airport','custom')),
  lat          double precision not null,
  lng          double precision not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_qlodgings_quotation on public.quotation_lodgings(quotation_id, sort_order);
create index if not exists idx_qflights_quotation  on public.quotation_flights(quotation_id, sort_order);
create index if not exists idx_qdays_quotation     on public.quotation_itinerary_days(quotation_id, sort_order);
create index if not exists idx_qpins_quotation     on public.quotation_map_pins(quotation_id);

-- RLS: escrita/leitura interna por org (via pai); leitura pública SÓ pela RPC.
do $$
declare t text;
begin
  foreach t in array array['quotation_lodgings','quotation_flights','quotation_itinerary_days','quotation_map_pins'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$
      create policy "Org access %1$s" on public.%1$I for all
      using (quotation_id in (
        select id from public.travel_proposals
        where organization_id in (select get_user_organizations())
      ))
    $p$, t);
    execute format($p$
      create policy "Super admin read %1$s" on public.%1$I for select using (is_super_admin())
    $p$, t);
  end loop;
end $$;

-- ── 3. org_settings (white-label) ───────────────────────────
create table if not exists public.org_settings (
  org_id          uuid primary key references public.organizations(id) on delete cascade,
  legal_name      text,
  brand_logo_url  text,
  brand_accent    text,
  instagram_url   text,
  site_url        text,
  terms_url       text,
  privacy_url     text,
  whatsapp_number text,
  city_state      text,
  cnpj            text,
  updated_at      timestamptz not null default now()
);

alter table public.org_settings enable row level security;
create policy "Org settings access" on public.org_settings for all
  using (org_id in (select get_user_organizations()));
create policy "Super admin read org_settings" on public.org_settings for select
  using (is_super_admin());

-- Seed a partir do cadastro já existente da organização.
insert into public.org_settings (org_id, legal_name, brand_logo_url, instagram_url, site_url, whatsapp_number, city_state, cnpj)
select id, name, logo_url,
       nullif(instagram, ''), nullif(website, ''), nullif(contact_phone, ''),
       nullif(trim(concat_ws(' / ', nullif(address_city,''), nullif(address_state,''))), ''),
       nullif(cnpj, '')
from public.organizations
on conflict (org_id) do nothing;

-- ── 4. RPC pública ──────────────────────────────────────────
create or replace function public.get_public_quotation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q   public.travel_proposals%rowtype;
  org jsonb;
  expired boolean;
begin
  select * into q from public.travel_proposals
  where public_token = p_token
    and status in ('draft','sent','viewed','won','lost','accepted','rejected')
  limit 1;
  if not found then return null; end if;

  expired := coalesce(q.quoted_at, q.updated_at) + make_interval(days => coalesce(q.validity_days, 5)) < now()
             and q.status not in ('won','accepted');

  select jsonb_build_object(
    'legal_name',      coalesce(s.legal_name, o.name),
    'brand_logo_url',  coalesce(s.brand_logo_url, o.logo_url),
    'brand_accent',    s.brand_accent,
    'instagram_url',   coalesce(s.instagram_url, nullif(o.instagram,'')),
    'site_url',        coalesce(s.site_url, nullif(o.website,'')),
    'terms_url',       s.terms_url,
    'privacy_url',     s.privacy_url,
    'whatsapp_number', coalesce(s.whatsapp_number, nullif(o.contact_phone,'')),
    'city_state',      coalesce(s.city_state, nullif(trim(concat_ws(' / ', nullif(o.address_city,''), nullif(o.address_state,''))), '')),
    'cnpj',            coalesce(s.cnpj, nullif(o.cnpj,'')),
    'cadastur',        nullif(o.cadastur,'')
  ) into org
  from public.organizations o
  left join public.org_settings s on s.org_id = o.id
  where o.id = q.organization_id;

  return jsonb_build_object(
    'id', q.id,
    'status', q.status,
    'expired', expired,
    'client_name', q.client_name,
    'title', q.title,
    'subtitle', q.subtitle,
    'cover_image_url', q.cover_image_url,
    'origin_label', q.origin_label,
    'origin_note', q.origin_note,
    'destinations', q.destinations,
    'departure_date', q.start_date,
    'return_date', q.end_date,
    'pax_adults', q.pax_adults,
    'pax_children', q.pax_children,
    'children_ages', to_jsonb(q.children_ages),
    'occupancy_label', q.occupancy_label,
    'intro_html', q.intro_html,
    'important_html', q.important_html,
    'closing_html', q.closing_html,
    'included', q.included,
    'not_included', q.not_included,
    'price_per_person_cents', q.price_per_person_cents,
    'total_cents', q.total_cents,
    'currency', q.currency,
    'payment_conditions', q.payment_conditions,
    'price_disclaimer', q.price_disclaimer,
    'quoted_at', coalesce(q.quoted_at, q.updated_at),
    'validity_days', q.validity_days,
    'lodgings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'name', l.name, 'check_in', l.check_in, 'check_out', l.check_out,
        'room_category', l.room_category, 'board', l.board,
        'description_html', l.description_html, 'photos', l.photos,
        'lat', l.lat, 'lng', l.lng, 'tripadvisor_data', l.tripadvisor_data
      ) order by l.sort_order)
      from public.quotation_lodgings l where l.quotation_id = q.id
    ), '[]'::jsonb),
    'flights', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'leg_type', f.leg_type,
        'from_code', f.from_code, 'from_city', f.from_city,
        'to_code', f.to_code, 'to_city', f.to_city,
        'airline', f.airline, 'date', f.date,
        'duration_label', f.duration_label, 'stopover_label', f.stopover_label
      ) order by f.sort_order)
      from public.quotation_flights f where f.quotation_id = q.id
    ), '[]'::jsonb),
    'itinerary_days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'day_label', d.day_label, 'date', d.date,
        'title', d.title, 'items', d.items
      ) order by d.sort_order)
      from public.quotation_itinerary_days d where d.quotation_id = q.id
    ), '[]'::jsonb),
    'map_pins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', p.label, 'type', p.type, 'lat', p.lat, 'lng', p.lng
      ))
      from public.quotation_map_pins p where p.quotation_id = q.id
    ), '[]'::jsonb),
    'org', org
  );
end;
$$;

revoke all on function public.get_public_quotation(text) from public;
grant execute on function public.get_public_quotation(text) to anon, authenticated;

-- ── 5. Migração de dados antigos ────────────────────────────
-- Capa: primeira foto da cotação.
update public.travel_proposals
set cover_image_url = photos->>0
where cover_image_url is null and jsonb_array_length(coalesce(photos, '[]'::jsonb)) > 0;

-- Pax: pax_count vira adultos.
update public.travel_proposals
set pax_adults = coalesce(pax_count, 0)
where pax_adults = 0 and coalesce(pax_count, 0) > 0;

-- Intro: aproveita a observação sobre viajantes como texto de abertura.
update public.travel_proposals
set intro_html = '<p>' || replace(travelers_note, chr(10), '</p><p>') || '</p>'
where intro_html is null and coalesce(travelers_note, '') <> '';

-- Importante: conteúdo do antigo Clima é preservado aqui antes do drop.
update public.travel_proposals
set important_html =
  coalesce('<p><b>Clima:</b> ' || nullif(weather->>'summary','') || '</p>', '') ||
  coalesce('<p><b>Sazonalidade:</b> ' || nullif(weather->>'seasonality','') || '</p>', '') ||
  coalesce('<p>' || nullif(weather->>'expect','') || '</p>', '')
where important_html is null
  and (weather->>'enabled') = 'true'
  and coalesce(nullif(weather->>'summary',''), nullif(weather->>'seasonality',''), nullif(weather->>'expect','')) is not null;

-- Pagamento: method_conditions {metodo: condicao} vira [{label, value}].
update public.travel_proposals
set payment_conditions = coalesce((
  select jsonb_agg(jsonb_build_object(
    'label', case kv.key when 'pix' then 'À vista (Pix)' when 'boleto' then 'Boleto' when 'cartao' then 'Cartão de crédito' else kv.key end,
    'value', kv.value
  ))
  from jsonb_each_text(payment->'method_conditions') kv
  where kv.value <> ''
), '[]'::jsonb)
where payment_conditions = '[]'::jsonb and jsonb_typeof(payment->'method_conditions') = 'object';

-- quoted_at default.
update public.travel_proposals set quoted_at = updated_at where quoted_at is null;

-- Hospedagens jsonb → tabela-filha.
insert into public.quotation_lodgings
  (quotation_id, sort_order, name, check_in, check_out, room_category, board, description_html, photos)
select p.id, h.ord - 1,
       coalesce(h.val->>'name',''),
       nullif(h.val->>'checkin_date','')::date,
       nullif(h.val->>'checkout_date','')::date,
       nullif(h.val->>'room_category',''),
       nullif(h.val->>'meal_plan',''),
       case when coalesce(h.val->>'briefing','') <> '' then '<p>' || (h.val->>'briefing') || '</p>' end,
       coalesce(h.val->'photos','[]'::jsonb)
from public.travel_proposals p,
     lateral jsonb_array_elements(coalesce(p.hotels,'[]'::jsonb)) with ordinality as h(val, ord)
where jsonb_typeof(p.hotels) = 'array'
  and not exists (select 1 from public.quotation_lodgings ql where ql.quotation_id = p.id);

-- Voos jsonb (jornadas com trechos) → linhas planas.
insert into public.quotation_flights
  (quotation_id, sort_order, leg_type, from_code, from_city, to_code, to_city, airline, duration_label, stopover_label)
select p.id,
       (j.ord - 1) * 10 + l.ord - 1,
       case when j.ord = 1 then 'outbound' when l.ord > 1 then 'connection' else 'inbound' end,
       nullif(l.val->>'origin',''), nullif(l.val->>'origin_name',''),
       nullif(l.val->>'destination',''), nullif(l.val->>'destination_name',''),
       nullif(l.val->>'airline',''),
       case when coalesce((l.val->>'duration_min')::int, 0) > 0
            then '≈ ' || ((l.val->>'duration_min')::int / 60) || 'h' || lpad(((l.val->>'duration_min')::int % 60)::text, 2, '0') end,
       nullif(l.val->>'connections','')
from public.travel_proposals p,
     lateral jsonb_array_elements(coalesce(p.flights,'[]'::jsonb)) with ordinality as j(val, ord),
     lateral jsonb_array_elements(coalesce(j.val->'legs','[]'::jsonb)) with ordinality as l(val, ord)
where jsonb_typeof(p.flights) = 'array'
  and not exists (select 1 from public.quotation_flights qf where qf.quotation_id = p.id);

-- Pins do mapa (map_config.points) → tabela-filha.
insert into public.quotation_map_pins (quotation_id, label, type, lat, lng)
select p.id,
       coalesce(nullif(pt.val->>'label',''), pt.val->>'query', ''),
       case pt.val->>'kind' when 'hotel' then 'lodging' when 'atracao' then 'attraction'
                            when 'origem' then 'airport' else 'custom' end,
       (pt.val->>'lat')::double precision,
       (pt.val->>'lng')::double precision
from public.travel_proposals p,
     lateral jsonb_array_elements(coalesce(p.map_config->'points','[]'::jsonb)) as pt(val)
where pt.val->>'lat' is not null
  and not exists (select 1 from public.quotation_map_pins qp where qp.quotation_id = p.id);

-- Status antigos → novos rótulos do funil.
update public.travel_proposals set status = 'won'  where status = 'accepted';
update public.travel_proposals set status = 'lost' where status = 'rejected';

-- ── 6. Remoção do Clima (conteúdo já preservado em important_html) ──
alter table public.travel_proposals drop column if exists weather;
