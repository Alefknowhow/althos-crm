-- get_public_quotation: adiciona star_rating/check_in_time/check_out_time
-- ao jsonb de "lodgings" — já existem em quotation_products.data (gravados
-- pelo editor), só faltava expor pro link público.
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
    'flights_html', q.flights_html,
    'tours_html', q.tours_html,
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
        'id', p.id, 'name', p.name,
        'check_in', p.data->>'check_in', 'check_out', p.data->>'check_out',
        'check_in_time', p.data->>'check_in_time', 'check_out_time', p.data->>'check_out_time',
        'star_rating', (p.data->>'star_rating')::integer,
        'room_category', p.data->>'room_category', 'board', p.data->>'board',
        'description_html', p.data->>'description_html', 'photos', coalesce(p.data->'photos', '[]'::jsonb),
        'lat', (p.data->>'lat')::double precision, 'lng', (p.data->>'lng')::double precision,
        'tripadvisor_data', p.data->'tripadvisor_data',
        'is_alternative_option', coalesce((p.data->>'is_alternative_option')::boolean, false),
        'option_price_per_person_cents', (p.data->>'option_price_per_person_cents')::integer,
        'option_total_cents', (p.data->>'option_total_cents')::integer
      ) order by p.sort_order)
      from public.quotation_products p where p.quotation_id = q.id and p.product_type = 'hospedagem'
    ), '[]'::jsonb),
    'flights', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'leg_type', p.data->>'leg_type',
        'from_code', p.data->>'from_code', 'from_city', p.data->>'from_city',
        'to_code', p.data->>'to_code', 'to_city', p.data->>'to_city',
        'airline', p.data->>'airline', 'flight_number', p.data->>'flight_number',
        'date', p.data->>'date', 'departure_time', p.data->>'departure_time',
        'arrival_date', p.data->>'arrival_date', 'arrival_time', p.data->>'arrival_time',
        'duration_label', p.data->>'duration_label', 'stopover_label', p.data->>'stopover_label',
        'baggage', coalesce(p.data->'baggage', '[]'::jsonb), 'cabin_class', p.data->>'cabin_class'
      ) order by p.sort_order)
      from public.quotation_products p where p.quotation_id = q.id and p.product_type = 'aereo'
    ), '[]'::jsonb),
    'cruises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'summary', p.summary,
        'date_start', p.date_start, 'date_end', p.date_end, 'price_cents', p.price_cents,
        'data', p.data
      ) order by p.sort_order)
      from public.quotation_products p where p.quotation_id = q.id and p.product_type = 'cruzeiro'
    ), '[]'::jsonb),
    'other_products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'product_type', p.product_type, 'name', p.name, 'summary', p.summary,
        'date_start', p.date_start, 'date_end', p.date_end, 'price_cents', p.price_cents,
        'data', p.data
      ) order by p.sort_order)
      from public.quotation_products p where p.quotation_id = q.id and p.product_type in ('transfer', 'passeio', 'seguro', 'locacao')
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
