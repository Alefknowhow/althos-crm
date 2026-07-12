-- Itinerário vira texto livre rico (fonte/cor/foto) em vez de dias estruturados.
-- Mantemos quotation_itinerary_days para compatibilidade, mas o editor novo
-- escreve em itinerary_html.
alter table public.travel_proposals
  add column if not exists itinerary_html text;

create or replace function public.get_public_quotation(p_token text)
returns jsonb
language plpgsql
stable
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
    'cancellation_html', q.cancellation_html,
    'itinerary_html', q.itinerary_html,
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
        'duration_label', f.duration_label, 'stopover_label', f.stopover_label,
        'baggage', f.baggage, 'cabin_class', f.cabin_class
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
