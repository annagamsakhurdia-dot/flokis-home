# Floki's Home — dog hotel booking + admin

Booking system for **Floki's Home** (ფლოკის სახლი / Дім Флокі), a dog hotel in Tbilisi.

- **Guest booking page** (`/ka`, `/en`, `/uk`): mobile-first, in Georgian, English and Ukrainian. Guests choose a service (🏨 Hotel overnight, or 🌳 Garden daycare as a single day or a package), then dates or package days. The server computes the price and checks capacity. Guests then enter dog, owner, vet and emergency contact details, give photo consent, accept the terms, confirm, and get a booking number.
- **Admin panel** (`/admin`, Georgian): login, a pending queue (approve with a 0–50% discount, or reject), bookings list with bank-transfer and barter payments, an invoice PDF from the booking card, an occupancy calendar with a day panel, and settings for services, prices, capacity and invoice/bank details.

Stack: Next.js 16 (App Router, Server Actions), TypeScript, Tailwind v4, shadcn/ui (Base UI), Supabase (Postgres + Auth), Zod.

## Run locally

```bash
pnpm install
pnpm dev            # http://localhost:4317
```

No credentials are needed. Without Supabase env vars the app uses an **in-memory demo store** that is seeded with sample bookings and is reset on every server restart. Invoices are printed or saved from the booking; they are not e-mailed.

Demo admin logins (password `graysons-demo`, or whatever you set in `ADMIN_DEMO_PASSWORD`):

| Person | Role | E-mail |
|---|---|---|
| მიშა კაჭკაჭიშვილი (Misha Kachkachishvili) | Director | `mikheilkachkachishvili@gmail.com` |
| ანუკა გამსახურდია (Anuka Gamsakhurdia) | Admin manager | `anuka@graysons.local` |

Other scripts: `pnpm build`, `pnpm start` (port 4317), `pnpm lint`.

## Security model

- **Prices, status and capacity are decided on the server.** The browser only sends the selection. In Supabase mode, `create_booking()` re-computes the price in SQL, forces `status = 'pending'` and checks capacity under a per-service advisory lock. Pending requests hold a place, so many requests can't overbook a day.
- **Public availability is counts only.** `get_availability()` returns `(day, booked, capacity)` and no personal data.
- **RLS:** the `anon` role has no table privileges at all, only `EXECUTE` on `get_availability`, `get_public_settings`, `quote_booking` and `create_booking`. Every table allows access only when `is_admin()` is true, meaning the user has a row in `public.admins`.
- **Admin session:** checked in `src/proxy.ts` (a coarse gate) and again in every page and Server Action (`requireAdmin`). With Supabase, admin queries run as the signed-in user, so RLS applies too. Login is rate-limited.
- **Invoice e-mail** is built on the server from the stored booking, and every value is HTML-escaped. The client never sends recipients or HTML.
- **Dates** use the `Asia/Tbilisi` timezone.

## Plugging in Supabase

1. Create a Supabase project.
2. Apply the migrations in order, using either the SQL editor or the CLI (`supabase link && supabase db push`):
   - `supabase/migrations/20261008000001_schema_and_rls.sql`: tables, RLS and default settings
   - `supabase/migrations/20261008000002_booking_rpcs.sql`: the public RPCs
   - `supabase/migrations/20261012000003_business_bank_defaults.sql`: bank and invoice-sender defaults, if the first migration was applied while those fields were still blank
   - `supabase/migrations/20261012000004_brand_name.sql`: renames a still-default business name to ფლოკის სახლი
3. Seed the two admins. Pick **one** of these:
   - **Script:** set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_DIRECTOR_EMAIL` and `ADMIN_MANAGER_EMAIL` in `.env.local`, then run `pnpm seed:admins`. It creates both Auth users (printing temporary passwords) and links them in `public.admins`.
   - **Manual:** under Authentication → Users, use "Add user" to create both users. Then edit the e-mails in `supabase/seed-admins.sql` and run it in the SQL editor.
4. Put `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env.local` (or in your hosting env) and restart. The demo banner disappears and all data lives in Supabase.

The service-role key is only needed for step 3. Don't deploy it. The manager seed address is `anuka@graysons.local` until a real one is provided.

## Deploy on Netlify

`netlify.toml` sets the build: `pnpm build`, publish directory `.next`, Node 22, `PNPM_FLAGS=--shamefully-hoist`, and `@netlify/plugin-nextjs` (unpinned, so Netlify updates the adapter). Connect the Git repo in the Netlify dashboard and deploy that branch. Do not add a second set of env names — the app reads these and nothing else:

| Name | Where it is used |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Runtime. Both are required to leave demo mode. |
| `SESSION_SECRET` | Runtime. Required in production only when Supabase is not configured (32+ characters). |
| `ADMIN_DEMO_PASSWORD` | In-memory demo login only. |
| `RESEND_API_KEY` | Optional. Staff notice when a guest creates a booking. Without it, the notice is skipped. The booking still succeeds. Invoices are not e-mailed. |
| `INVOICE_FROM_EMAIL`, `RESEND_FROM` | Optional `From` for the staff notice (`INVOICE_FROM_EMAIL` wins). Unset uses `Floki's Home <onboarding@resend.dev>`, which only delivers to the Resend account email until a domain is verified. |
| `BOOKING_NOTIFY_EMAIL` | Optional recipient of the new-booking notice. Defaults to `mikheilkachkachishvili@gmail.com`. |
| `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_DIRECTOR_EMAIL`, `ADMIN_MANAGER_EMAIL` | `pnpm seed:admins` only. Do not put the service-role key on Netlify. |

## Invoice

Approving a booking does not e-mail the guest. On an approved booking, **ინვოისი** (next to **გადახდა**) downloads a PDF file. The file is A4, black on white, and in Georgian. It shows the business name from Settings (ფლოკის სახლი by default), the dog, owner, phone, service, dates, price, booking number, and the bank details stored on Settings. Defaults, editable in Admin → Settings:

- Bank: საქართველოს ბანკი (Bank of Georgia)
- IBAN: `GE44BG0000000612766478`
- Account number: `510001200`
- Account holder: მიშა კაჭკაჭიშვილი

Contact phone and the terms link stay empty.

## New-booking notice

When a guest booking is stored, the server sends one plain-text e-mail to `BOOKING_NOTIFY_EMAIL` (default `mikheilkachkachishvili@gmail.com`). Subject: `ახალი ჯავშანი — ფლოკის სახლი`. The body lists dog name, owner, phone, e-mail, service (სასტუმრო / ბაღი), dates, price and the booking number (`ref`).

No API key means the notice is skipped. A failed send is logged and the guest still sees success. Gmail SMTP is not used. Invoices are not part of this notice.

## Project layout

```
src/app/[locale]/          guest booking page + public Server Actions
src/app/admin/             login, invoice PDF download, (panel)/ dashboard, bookings, calendar, settings, outbox
src/components/booking/    booking flow UI
src/components/admin/      admin UI
src/lib/domain/            types, pricing (mirrors SQL compute_quote), dates, zod schemas
src/lib/server/backend/    memory.ts (demo) and supabase.ts adapters
src/lib/server/            auth, e-mail, invoice template, rate limit
supabase/                  migrations + admin seed SQL
scripts/seed-admins.mjs    creates the admin users in Supabase Auth
```

When you change pricing rules, update both `src/lib/domain/pricing.ts` and `compute_quote()` in the RPC migration.
