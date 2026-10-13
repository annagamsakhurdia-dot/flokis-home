import Image from "next/image";
import { connection } from "next/server";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { logoutAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/server/auth";
import { backendMode } from "@/lib/server/config";
import { emailTransport } from "@/lib/server/email";
import { LogOut } from "lucide-react";

export const metadata = { title: "ფლოკის სახლი — ადმინი" };

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  const admin = await requireAdmin();
  const memory = backendMode() === "memory";
  const mockEmail = emailTransport() === "mock";

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-forest text-white">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <Image src="/floki-puppy.png" alt="ფლოკი" width={275} height={282} className="h-9 w-auto shrink-0" />
            <Logo className="text-2xl" />
            <span className="text-xs font-semibold text-white/70">ადმინი</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <div className="text-right leading-tight">
              <div className="font-bold">{admin.fullName}</div>
              <div className="text-white/70">{admin.role === "director" ? "დირექტორი" : "ადმინისტრატორი-მენეჯერი"}</div>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm" className="text-white hover:bg-white/15 hover:text-white">
                <LogOut /> გასვლა
              </Button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-[1080px] px-2">
          <AdminNav showOutbox={mockEmail} />
        </div>
      </header>
      {(memory || mockEmail) && (
        <div className="border-b border-gold/40 bg-gold-soft px-4 py-1.5 text-center text-[11px] font-semibold text-gold-ink">
          {memory && "სატესტო რეჟიმი: მონაცემები ინახება მეხსიერებაში და სერვერის გადატვირთვისას განახლდება. "}
          {mockEmail && "ელფოსტა არ იგზავნება — წერილები ჩანს „ელფოსტის“ ჩანართში."}
        </div>
      )}
      <main className="mx-auto max-w-[1080px] p-4">{children}</main>
    </div>
  );
}
