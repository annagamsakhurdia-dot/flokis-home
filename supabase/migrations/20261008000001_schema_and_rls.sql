-- Floki's Home dog hotel: core schema + row level security.
-- Public (anon) users get NO table access; they only call the security-definer
-- RPCs in the next migration. Admins (rows in public.admins) get full access.

-- ---------------------------------------------------------------------------
-- Settings: one JSON document (services, prices, capacity, business details).
-- Shape matches src/lib/domain/types.ts `Settings`; validated by the app (zod).
-- ---------------------------------------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('director', 'manager')),
  created_at timestamptz not null default now()
);

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(full_name) between 1 and 120),
  phone text not null check (length(phone) between 1 and 40),
  email text not null check (length(email) <= 160),
  emergency_contact text not null default '' check (length(emergency_contact) <= 160),
  created_at timestamptz not null default now()
);

create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  age text not null default '' check (length(age) <= 40),
  breed text not null default '' check (length(breed) <= 80),
  sex text not null default '' check (sex in ('', 'male', 'female')),
  sterilized text not null default '' check (sterilized in ('', 'yes', 'no')),
  vaccines text not null default '' check (length(vaccines) <= 500),
  deworming text not null default '' check (length(deworming) <= 500),
  vet_clinic text not null check (length(vet_clinic) between 1 and 120),
  vet_phone text not null check (length(vet_phone) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  service text not null check (service in ('HOTEL', 'GARDEN')),
  owner_id uuid not null references public.owners (id),
  dog_id uuid not null references public.dogs (id),
  check_in date not null,
  check_out date not null,
  garden_package text check (garden_package in ('SINGLE', 'P8', 'P10', 'P12', 'MONTH')),
  arrival_time text not null,
  departure_time text not null,
  walk boolean not null default false,
  notes text not null default '' check (length(notes) <= 1500),
  photo_consent boolean not null default false,
  terms_accepted_at timestamptz not null,
  locale text not null default 'ka' check (locale in ('ka', 'en', 'uk')),
  base_price numeric(10, 2) not null check (base_price >= 0),
  discount_pct int not null default 0 check (discount_pct between 0 and 50),
  total numeric(10, 2) generated always as (round(base_price * (100 - discount_pct) / 100.0, 2)) stored,
  price_lines jsonb not null default '[]'::jsonb,
  invoice_sent_at timestamptz,
  reviewed_by uuid references auth.users (id),
  reviewed_by_name text,
  reviewed_at timestamptz,
  reject_reason text
);

-- One row per occupied day: capacity is a simple count per (service, day).
create table public.booking_days (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  service text not null check (service in ('HOTEL', 'GARDEN')),
  day date not null,
  primary key (booking_id, day)
);
create index booking_days_service_day_idx on public.booking_days (service, day);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  method text not null check (method in ('bank_transfer', 'barter')),
  note text not null default '' check (length(note) <= 300),
  paid_on date not null,
  recorded_by uuid references auth.users (id),
  recorded_by_name text,
  created_at timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Admin check. SECURITY DEFINER so policies can call it without recursion.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- RLS: deny by default, admins only.
-- ---------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.admins enable row level security;
alter table public.owners enable row level security;
alter table public.dogs enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_days enable row level security;
alter table public.payments enable row level security;

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
grant execute on function public.is_admin() to authenticated;

grant select, update on public.settings to authenticated;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.owners, public.dogs, public.bookings,
  public.booking_days, public.payments to authenticated;

create policy settings_admin_read on public.settings for select to authenticated using (public.is_admin());
create policy settings_admin_write on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- An admin may read their own row (to resolve name/role) and the team list.
-- Inserting admins is only possible with the service role / SQL editor.
create policy admins_read on public.admins for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy owners_admin on public.owners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy dogs_admin on public.dogs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy bookings_admin on public.bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy booking_days_admin on public.booking_days for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy payments_admin on public.payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Default settings (prototype values). Edit later in /admin/settings.
insert into public.settings (id, data) values (1, $json$
{
  "services": {
    "HOTEL":  {"code": "HOTEL",  "active": true, "capacity": 18, "nameKa": "სასტუმრო", "nameEn": "Hotel",  "nameUk": "Готель"},
    "GARDEN": {"code": "GARDEN", "active": true, "capacity": 5,  "nameKa": "ბაღი",     "nameEn": "Garden", "nameUk": "Сад"}
  },
  "hotel":  {"tier1": 65, "tier2": 60, "tier3": 50, "month": 1200},
  "garden": {"single": 45, "p8": 320, "p10": 375, "p12": 420, "month": 600},
  "business": {
    "name": "ფლოკის სახლი", "phone": "", "address": "Tbilisi",
    "bankName": "საქართველოს ბანკი (Bank of Georgia)",
    "iban": "GE44BG0000000612766478",
    "accountNumber": "510001200",
    "recipient": "მიშა კაჭკაჭიშვილი",
    "invoiceSenderEmail": "mikheilkachkachishvili@gmail.com",
    "termsUrl": ""
  }
}
$json$::jsonb);
