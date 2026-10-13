import type { Locale } from "@/lib/domain/types";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { Logo } from "@/components/brand/logo";

export function BookingUnavailable({ locale }: { locale: Locale }) {
  const t = dictionaries[locale];
  return (
    <main className="min-h-screen">
      <header className="bg-forest px-5 py-10 text-center text-white">
        <Logo name={t.brand} className="text-3xl" />
      </header>
      <div className="mx-auto max-w-[540px] p-4">
        <div className="rounded-2xl border-[1.5px] border-[#f0c4be] bg-[#fdf0ee] p-5 text-sm font-semibold text-[#922b21] shadow-soft">
          {t.errors.network}
        </div>
      </div>
    </main>
  );
}
