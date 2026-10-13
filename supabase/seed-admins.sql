-- Seed the two admin accounts (run once, in the Supabase SQL editor, AFTER
-- creating both users under Authentication → Users → "Add user").
-- Replace the e-mails if the real ones differ. Alternative: `pnpm seed:admins`.

insert into public.admins (user_id, full_name, role)
select id, 'მიშა კაჭკაჭიშვილი', 'director' from auth.users where email = 'mikheilkachkachishvili@gmail.com'
on conflict (user_id) do update set full_name = excluded.full_name, role = excluded.role;

insert into public.admins (user_id, full_name, role)
select id, 'ანუკა გამსახურდია', 'manager' from auth.users where email = 'anuka@graysons.local'
on conflict (user_id) do update set full_name = excluded.full_name, role = excluded.role;

select a.full_name, a.role, u.email from public.admins a join auth.users u on u.id = a.user_id;
