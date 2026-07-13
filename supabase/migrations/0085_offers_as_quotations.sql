-- ══════════════════════════════════════════════════════════════════════════
-- Ofertas (vitrine) passam a ser montadas como COTAÇÕES.
-- Uma oferta = travel_proposals com is_offer=true e sem contato vinculado.
-- Reusa o editor, as tabelas-filhas, a RPC pública e a PublicQuotationView.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.travel_proposals
  add column if not exists is_offer        boolean not null default false,
  add column if not exists offer_published boolean not null default false,
  add column if not exists offer_category  text;

create index if not exists idx_travel_proposals_offers
  on public.travel_proposals(organization_id, is_offer, offer_published);

-- ── Migra os pacotes existentes da vitrine antiga para o modelo novo ──────
insert into public.travel_proposals (
  organization_id, created_by, title, status, is_offer, offer_published,
  offer_category, start_date, end_date, destinations, included, not_included,
  order_bumps, total_cents, pax_count, price_per_person_cents, payment,
  cover_image_url, intro_html, currency, quoted_at
)
select
  p.organization_id, p.created_by, coalesce(p.title, 'Oferta'), 'sent', true, coalesce(p.is_published, false),
  p.category, p.start_date, p.end_date, coalesce(p.destinations, '[]'::jsonb),
  coalesce(p.included, '[]'::jsonb), coalesce(p.not_included, '[]'::jsonb),
  coalesce(p.order_bumps, '[]'::jsonb), coalesce(p.total_cents, 0), p.pax_count,
  p.price_per_person_cents, coalesce(p.payment, '{}'::jsonb),
  p.cover_photos->>0,
  case when coalesce(p.briefing, '') <> '' then '<p>' || p.briefing || '</p>' end,
  'BRL', now()
from public.travel_showcase_packages p
where not exists (
  -- idempotência: não duplica se já migrado (mesma org + título + is_offer)
  select 1 from public.travel_proposals tp
  where tp.organization_id = p.organization_id and tp.is_offer = true
    and coalesce(tp.title,'') = coalesce(p.title,'Oferta')
);

-- Hospedagens (hotels jsonb → quotation_lodgings) dos pacotes migrados.
insert into public.quotation_lodgings
  (quotation_id, sort_order, name, check_in, check_out, room_category, board, description_html, photos)
select tp.id, h.ord - 1,
       coalesce(h.val->>'name',''),
       nullif(h.val->>'checkin_date','')::date,
       nullif(h.val->>'checkout_date','')::date,
       nullif(h.val->>'room_category',''),
       nullif(h.val->>'meal_plan',''),
       case when coalesce(h.val->>'briefing','') <> '' then '<p>' || (h.val->>'briefing') || '</p>' end,
       coalesce(h.val->'photos','[]'::jsonb)
from public.travel_showcase_packages p
join public.travel_proposals tp
  on tp.organization_id = p.organization_id and tp.is_offer = true
  and coalesce(tp.title,'') = coalesce(p.title,'Oferta')
, lateral jsonb_array_elements(coalesce(p.hotels,'[]'::jsonb)) with ordinality as h(val, ord)
where jsonb_typeof(p.hotels) = 'array'
  and not exists (select 1 from public.quotation_lodgings ql where ql.quotation_id = tp.id);

-- Voos (flights jsonb com legs → quotation_flights).
insert into public.quotation_flights
  (quotation_id, sort_order, leg_type, from_code, from_city, to_code, to_city, airline)
select tp.id,
       (j.ord - 1) * 10 + l.ord - 1,
       case when j.ord = 1 then 'outbound' when l.ord > 1 then 'connection' else 'inbound' end,
       nullif(l.val->>'origin',''), nullif(l.val->>'origin_name',''),
       nullif(l.val->>'destination',''), nullif(l.val->>'destination_name',''),
       nullif(l.val->>'airline','')
from public.travel_showcase_packages p
join public.travel_proposals tp
  on tp.organization_id = p.organization_id and tp.is_offer = true
  and coalesce(tp.title,'') = coalesce(p.title,'Oferta')
, lateral jsonb_array_elements(coalesce(p.flights,'[]'::jsonb)) with ordinality as j(val, ord)
, lateral jsonb_array_elements(coalesce(j.val->'legs','[]'::jsonb)) with ordinality as l(val, ord)
where jsonb_typeof(p.flights) = 'array'
  and not exists (select 1 from public.quotation_flights qf where qf.quotation_id = tp.id);

-- ── RPC pública da vitrine: lista as ofertas publicadas de uma organização ──
create or replace function public.get_public_vitrine(p_vitrine_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare org_row public.organizations%rowtype; result jsonb;
begin
  select * into org_row from public.organizations where vitrine_token = p_vitrine_token limit 1;
  if not found then return null; end if;

  select jsonb_build_object(
    'org', jsonb_build_object(
      'legal_name', coalesce(s.legal_name, org_row.name),
      'brand_logo_url', coalesce(s.brand_logo_url, org_row.logo_url),
      'brand_accent', s.brand_accent,
      'instagram_url', coalesce(s.instagram_url, nullif(org_row.instagram,'')),
      'site_url', coalesce(s.site_url, nullif(org_row.website,'')),
      'whatsapp_number', coalesce(s.whatsapp_number, nullif(org_row.contact_phone,'')),
      'city_state', coalesce(s.city_state, nullif(trim(concat_ws(' / ', nullif(org_row.address_city,''), nullif(org_row.address_state,''))), ''))
    ),
    'offers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'public_token', q.public_token,
        'title', q.title,
        'category', q.offer_category,
        'cover_image_url', q.cover_image_url,
        'destinations', q.destinations,
        'start_date', q.start_date,
        'end_date', q.end_date,
        'price_per_person_cents', q.price_per_person_cents,
        'total_cents', q.total_cents,
        'pax_count', q.pax_count
      ) order by q.updated_at desc)
      from public.travel_proposals q
      where q.organization_id = org_row.id and q.is_offer = true and q.offer_published = true
        and q.public_token is not null
    ), '[]'::jsonb)
  ) into result
  from public.organizations o
  left join public.org_settings s on s.org_id = o.id
  where o.id = org_row.id;

  return result;
end;
$$;

revoke all on function public.get_public_vitrine(text) from public;
grant execute on function public.get_public_vitrine(text) to anon, authenticated;
