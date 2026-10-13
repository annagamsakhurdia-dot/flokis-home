-- Public RPCs. These are the ONLY entry points available to the anon role.
-- Pricing mirrors src/lib/domain/pricing.ts (resolveBooking); keep them in sync.

create or replace function public.hhmm_to_minutes(t text) returns int
language plpgsql immutable set search_path = public as $$
declare h int; m int;
begin
  if t is null or t !~ '^\d{2}:\d{2}$' then return null; end if;
  h := substr(t, 1, 2)::int;
  m := substr(t, 4, 2)::int;
  if m > 59 or h > 24 or (h = 24 and m <> 0) then return null; end if;
  return h * 60 + m;
end $$;

-- Validates the service part of a request and returns
-- {ok, days[], lines[], total} or {ok:false, error}.
create or replace function public.compute_quote(p jsonb, s jsonb, today date) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  v_service text := p->>'service';
  v_last date := today + 365;
  v_days date[];
  v_lines jsonb := '[]'::jsonb;
  v_in date; v_out date;
  v_nights int; v_months int; v_rest int; q int;
  v_pkg text; v_visits int; v_price numeric; v_n int;
  v_unit numeric;
  d date;
begin
  if v_service is null or v_service not in ('HOTEL', 'GARDEN') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if not coalesce((s->'services'->v_service->>'active')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'service_inactive');
  end if;

  if v_service = 'HOTEL' then
    begin
      v_in := (p->>'checkIn')::date;
      v_out := (p->>'checkOut')::date;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'invalid');
    end;
    if v_in is null or v_out is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
    if v_in < today or v_out < today then return jsonb_build_object('ok', false, 'error', 'past_date'); end if;
    if v_in > v_last or v_out > v_last then return jsonb_build_object('ok', false, 'error', 'too_far'); end if;
    v_nights := v_out - v_in;
    if v_nights < 1 or v_nights > 180 then return jsonb_build_object('ok', false, 'error', 'bad_range'); end if;

    v_months := v_nights / 30;
    v_rest := v_nights % 30;
    if v_months > 0 then
      v_unit := (s->'hotel'->>'month')::numeric;
      v_lines := v_lines || jsonb_build_object('kind', 'hotel_month', 'qty', v_months, 'unit', v_unit, 'amount', v_months * v_unit);
    end if;
    q := least(v_rest, 3);
    if q > 0 then
      v_unit := (s->'hotel'->>'tier1')::numeric;
      v_lines := v_lines || jsonb_build_object('kind', 'hotel_tier1', 'qty', q, 'unit', v_unit, 'amount', q * v_unit);
    end if;
    q := greatest(0, least(v_rest, 7) - 3);
    if q > 0 then
      v_unit := (s->'hotel'->>'tier2')::numeric;
      v_lines := v_lines || jsonb_build_object('kind', 'hotel_tier2', 'qty', q, 'unit', v_unit, 'amount', q * v_unit);
    end if;
    q := greatest(0, v_rest - 7);
    if q > 0 then
      v_unit := (s->'hotel'->>'tier3')::numeric;
      v_lines := v_lines || jsonb_build_object('kind', 'hotel_tier3', 'qty', q, 'unit', v_unit, 'amount', q * v_unit);
    end if;
    v_days := array(select g::date from generate_series(v_in, v_out - 1, interval '1 day') g);

  else
    v_pkg := coalesce(p->>'gardenPackage', 'SINGLE');
    if v_pkg not in ('SINGLE', 'P8', 'P10', 'P12', 'MONTH') then
      return jsonb_build_object('ok', false, 'error', 'invalid');
    end if;
    begin
      v_days := array(
        select distinct x::date from jsonb_array_elements_text(coalesce(p->'gardenDays', '[]'::jsonb)) x order by 1
      );
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'invalid');
    end;
    foreach d in array v_days loop
      if d < today then return jsonb_build_object('ok', false, 'error', 'past_date'); end if;
      if d > v_last then return jsonb_build_object('ok', false, 'error', 'too_far'); end if;
    end loop;
    v_n := coalesce(array_length(v_days, 1), 0);
    v_visits := case v_pkg when 'SINGLE' then 1 when 'P8' then 8 when 'P10' then 10 when 'P12' then 12 else null end;
    if v_visits is not null and v_n <> v_visits then
      return jsonb_build_object('ok', false, 'error', 'bad_package_days');
    end if;
    if v_visits is null and (v_n < 1 or v_days[v_n] - v_days[1] >= 30) then
      return jsonb_build_object('ok', false, 'error', 'bad_package_days');
    end if;
    v_price := (s->'garden'->>(case v_pkg when 'SINGLE' then 'single' when 'P8' then 'p8' when 'P10' then 'p10'
                                          when 'P12' then 'p12' else 'month' end))::numeric;
    if v_pkg = 'SINGLE' then
      v_lines := jsonb_build_array(jsonb_build_object('kind', 'garden_single', 'qty', 1, 'unit', v_price, 'amount', v_price));
    else
      v_lines := jsonb_build_array(jsonb_build_object('kind', 'garden_package', 'qty', v_n, 'unit', v_price,
                                                      'amount', v_price, 'packageCode', v_pkg));
    end if;

  end if;

  return jsonb_build_object(
    'ok', true,
    'days', to_jsonb(v_days),
    'lines', v_lines,
    'total', (select coalesce(sum((l->>'amount')::numeric), 0) from jsonb_array_elements(v_lines) l)
  );
end $$;

create or replace function public.booked_count(p_service text, p_day date) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.booking_days bd
  join public.bookings b on b.id = bd.booking_id
  where bd.service = p_service and bd.day = p_day and b.status in ('pending', 'approved');
$$;

-- Counts only, no personal data. Pending requests hold a place.
create or replace function public.get_availability(p_service text, p_from date, p_to date)
returns table (day date, booked int, capacity int)
language plpgsql stable security definer set search_path = public as $$
declare v_cap int;
begin
  if p_service not in ('HOTEL', 'GARDEN') or p_to < p_from or p_to - p_from > 62 then
    raise exception 'invalid availability range' using errcode = '22023';
  end if;
  select (data->'services'->p_service->>'capacity')::int into v_cap from public.settings where id = 1;
  return query
    select g::date, public.booked_count(p_service, g::date), v_cap
    from generate_series(p_from, p_to, interval '1 day') g;
end $$;

create or replace function public.get_public_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select (data - 'business') || jsonb_build_object('business', jsonb_build_object(
    'name', data->'business'->>'name',
    'phone', data->'business'->>'phone',
    'termsUrl', data->'business'->>'termsUrl'))
  from public.settings where id = 1;
$$;

create or replace function public.quote_booking(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s jsonb;
  q jsonb;
  v_cap int;
  v_full jsonb;
  v_min_free int;
begin
  select data into s from public.settings where id = 1;
  q := public.compute_quote(p, s, (now() at time zone 'Asia/Tbilisi')::date);
  if not (q->>'ok')::boolean then return q; end if;
  v_cap := (s->'services'->(p->>'service')->>'capacity')::int;
  select coalesce(jsonb_agg(d order by d) filter (where public.booked_count(p->>'service', d::date) >= v_cap), '[]'::jsonb),
         min(v_cap - public.booked_count(p->>'service', d::date))
    into v_full, v_min_free
  from jsonb_array_elements_text(q->'days') d;
  if jsonb_array_length(v_full) > 0 then
    return jsonb_build_object('ok', false, 'error', 'full', 'fullDays', v_full);
  end if;
  return q || jsonb_build_object('minFree', v_min_free);
end $$;

-- Creates a PENDING booking. Price, status and capacity are decided here,
-- never by the client. A per-service advisory lock makes the capacity check
-- and the insert atomic against concurrent requests.
create or replace function public.create_booking(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s jsonb;
  q jsonb;
  v_today date := (now() at time zone 'Asia/Tbilisi')::date;
  v_service text := p->>'service';
  v_cap int;
  v_days date[];
  v_full jsonb;
  v_owner uuid;
  v_dog uuid;
  v_booking uuid;
  v_ref text;
  v_arrival text;
  v_departure text;
begin
  if coalesce(p->>'termsAccepted', 'false') <> 'true'
     or coalesce(p->'owner'->>'email', '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or length(trim(coalesce(p->'dog'->>'name', ''))) = 0
     or length(trim(coalesce(p->'owner'->>'fullName', ''))) = 0
     or length(trim(coalesce(p->'owner'->>'phone', ''))) = 0
     or length(trim(coalesce(p->'dog'->>'vetClinic', ''))) = 0
     or length(trim(coalesce(p->'dog'->>'vetPhone', ''))) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  v_arrival := nullif(p->>'arrivalTime', '');
  v_departure := nullif(p->>'departureTime', '');
  if public.hhmm_to_minutes(v_arrival) is null or public.hhmm_to_minutes(v_departure) is null then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select data into s from public.settings where id = 1;
  q := public.compute_quote(p, s, v_today);
  if not (q->>'ok')::boolean then return q; end if;

  v_cap := (s->'services'->v_service->>'capacity')::int;
  v_days := array(select x::date from jsonb_array_elements_text(q->'days') x);

  perform pg_advisory_xact_lock(hashtext('graysons:capacity:' || v_service));

  select coalesce(jsonb_agg(d order by d), '[]'::jsonb) into v_full
  from unnest(v_days) d
  where public.booked_count(v_service, d) >= v_cap;
  if jsonb_array_length(v_full) > 0 then
    return jsonb_build_object('ok', false, 'error', 'full', 'fullDays', v_full);
  end if;

  insert into public.owners (full_name, phone, email, emergency_contact)
  values (trim(p->'owner'->>'fullName'), trim(p->'owner'->>'phone'), lower(trim(p->'owner'->>'email')),
          coalesce(trim(p->'owner'->>'emergencyContact'), ''))
  returning id into v_owner;

  insert into public.dogs (owner_id, name, age, breed, sex, sterilized, vaccines, deworming, vet_clinic, vet_phone)
  values (v_owner, trim(p->'dog'->>'name'), coalesce(p->'dog'->>'age', ''), coalesce(p->'dog'->>'breed', ''),
          coalesce(p->'dog'->>'sex', ''), coalesce(p->'dog'->>'sterilized', ''), coalesce(p->'dog'->>'vaccines', ''),
          coalesce(p->'dog'->>'deworming', ''), trim(p->'dog'->>'vetClinic'), trim(p->'dog'->>'vetPhone'))
  returning id into v_dog;

  v_ref := 'GR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.bookings (
    ref, status, service, owner_id, dog_id, check_in, check_out, garden_package,
    arrival_time, departure_time, walk, notes, photo_consent, terms_accepted_at, locale, base_price, price_lines
  ) values (
    v_ref, 'pending', v_service, v_owner, v_dog,
    v_days[1],
    case when v_service = 'HOTEL' then (p->>'checkOut')::date else v_days[array_length(v_days, 1)] end,
    case when v_service = 'GARDEN' then coalesce(p->>'gardenPackage', 'SINGLE') end,
    v_arrival,
    v_departure,
    coalesce((p->>'walk')::boolean, false),
    coalesce(p->>'notes', ''),
    coalesce((p->>'photoConsent')::boolean, false),
    now(),
    coalesce(nullif(p->>'locale', ''), 'ka'),
    (q->>'total')::numeric,
    q->'lines'
  ) returning id into v_booking;

  insert into public.booking_days (booking_id, service, day)
  select v_booking, v_service, unnest(v_days);

  return jsonb_build_object('ok', true, 'ref', v_ref, 'total', (q->>'total')::numeric, 'days', q->'days');
exception
  when check_violation or not_null_violation or invalid_text_representation or string_data_right_truncation then
    return jsonb_build_object('ok', false, 'error', 'invalid');
end $$;

revoke all on function public.hhmm_to_minutes(text) from public, anon;
revoke all on function public.compute_quote(jsonb, jsonb, date) from public, anon, authenticated;
revoke all on function public.booked_count(text, date) from public, anon, authenticated;

grant execute on function public.get_availability(text, date, date) to anon, authenticated;
grant execute on function public.get_public_settings() to anon, authenticated;
grant execute on function public.quote_booking(jsonb) to anon, authenticated;
grant execute on function public.create_booking(jsonb) to anon, authenticated;
