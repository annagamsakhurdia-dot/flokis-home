import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/admin/login-form";
import { getCurrentAdmin } from "@/lib/server/auth";
import { backendMode } from "@/lib/server/config";
import { DEMO_ADMINS } from "@/lib/server/backend/memory";

export const metadata = { title: "შესვლა — ფლოკის სახლი" };

export default async function LoginPage() {
  await connection();
  if (await getCurrentAdmin()) redirect("/admin");
  const demo = backendMode() === "memory";

  return (
    <main className="flex min-h-screen flex-col">
      <div className="bg-forest px-5 py-10 text-center text-white">
        <Logo className="text-3xl" />
        <p className="mt-1 text-xs font-semibold text-white/75">ადმინისტრატორის პანელი</p>
      </div>
      <div className="mx-auto -mt-6 w-full max-w-sm px-4">
        <div className="rounded-2xl border-[1.5px] border-sand bg-card p-6 shadow-soft">
          <h1 className="mb-4 text-lg font-extrabold text-forest">შესვლა</h1>
          <LoginForm defaultEmail={demo ? DEMO_ADMINS[0].email : ""} />
        </div>
        {demo && (
          <div className="mt-3 rounded-xl border-[1.5px] border-gold bg-gold-soft p-4 text-xs leading-relaxed text-gold-ink">
            <p className="mb-1 font-bold">სატესტო რეჟიმი (Supabase არ არის მიერთებული)</p>
            {DEMO_ADMINS.map((a) => (
              <p key={a.id}>
                {a.fullName} · <span className="font-mono">{a.email}</span>
              </p>
            ))}
            <p className="mt-1">
              პაროლი: <span className="font-mono">{process.env.ADMIN_DEMO_PASSWORD ? "ADMIN_DEMO_PASSWORD" : "graysons-demo"}</span>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
