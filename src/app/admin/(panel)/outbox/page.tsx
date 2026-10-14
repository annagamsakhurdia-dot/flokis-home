import { requireAdmin } from "@/lib/server/auth";
import { mockOutbox } from "@/lib/server/email";

export default async function OutboxPage() {
  await requireAdmin();
  const emails = mockOutbox();
  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold text-forest">ელფოსტა (სატესტო)</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        რეალური გაგზავნა გამორთულია. Resend-ს სჭირდება RESEND_API_KEY და დადასტურებული დომენი — Gmail-ის მისამართი ინვოისზე ჩანს, მაგრამ იქიდან წერილი არ გაიგზავნება.
      </p>
      {emails.length === 0 ? (
        <div className="rounded-2xl border-[1.5px] border-dashed border-sand bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          წერილები ჯერ არ არის.
        </div>
      ) : (
        <div className="space-y-4">
          {emails.map((m) => (
            <article key={m.id} className="overflow-hidden rounded-2xl border-[1.5px] border-sand bg-card shadow-soft">
              <div className="border-b border-sand px-4 py-2.5 text-xs">
                <p className="font-bold text-forest">{m.subject}</p>
                <p className="text-muted-foreground">
                  {m.from} → {m.to} · {new Date(m.sentAt).toLocaleString("ka-GE", { timeZone: "Asia/Tbilisi" })}
                </p>
              </div>
              <iframe title={m.subject} sandbox="" srcDoc={m.html} className="h-[520px] w-full bg-cream" />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
