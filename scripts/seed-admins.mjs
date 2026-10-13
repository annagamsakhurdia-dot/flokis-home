#!/usr/bin/env node
// Creates (or updates) the two Floki's Home admin users in Supabase Auth and links
// them in public.admins. Needs the service-role key; run locally, never ship it.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   ADMIN_DIRECTOR_EMAIL=mikheilkachkachishvili@gmail.com ADMIN_MANAGER_EMAIL=anuka@... pnpm seed:admins
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admins = [
  { email: process.env.ADMIN_DIRECTOR_EMAIL || "mikheilkachkachishvili@gmail.com", fullName: "მიშა კაჭკაჭიშვილი", role: "director" },
  { email: process.env.ADMIN_MANAGER_EMAIL || "anuka@graysons.local", fullName: "ანუკა გამსახურდია", role: "manager" },
];

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserByEmail(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

for (const admin of admins) {
  let user = await findUserByEmail(admin.email);
  let tempPassword = null;
  if (!user) {
    tempPassword = randomBytes(12).toString("base64url");
    const { data, error } = await supabase.auth.admin.createUser({
      email: admin.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: admin.fullName },
    });
    if (error) throw error;
    user = data.user;
  }
  const { error } = await supabase
    .from("admins")
    .upsert({ user_id: user.id, full_name: admin.fullName, role: admin.role }, { onConflict: "user_id" });
  if (error) throw error;
  console.log(
    `${admin.role.padEnd(8)} ${admin.email}` +
      (tempPassword ? `  temporary password: ${tempPassword}  (change it after first login)` : "  (existing user, password unchanged)"),
  );
}
