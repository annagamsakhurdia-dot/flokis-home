"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { BedDouble, CalendarDays, CheckCircle2, Clock, Dog, Loader2, PawPrint, Sparkles, Trees, UserRound } from "lucide-react";
import { addDays } from "@/lib/domain/dates";
import { dmy, gel, lineLabel } from "@/lib/domain/format";
import { MONTH_WINDOW_DAYS, PACKAGE_VISITS, packagePrice } from "@/lib/domain/pricing";
import type {
  BookingErrorCode,
  BookingRequest,
  DayAvailability,
  DogInfo,
  GardenPackageCode,
  Locale,
  OwnerInfo,
  PublicSettings,
  QuoteResult,
  ServiceCode,
} from "@/lib/domain/types";
import { LOCALES } from "@/lib/domain/types";
import { dictionaries, format, type Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { quoteAction, submitBookingAction } from "@/app/[locale]/actions";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GardenCalendar } from "./garden-calendar";
import { Field, InfoBox, SectionCard, StatusBox, Tile, inputClass } from "./primitives";

interface Props {
  initialLocale: Locale;
  settings: PublicSettings;
  today: string;
  todayAvailability: { hotel?: DayAvailability; garden?: DayAvailability };
}

const EMPTY_DOG: DogInfo = { name: "", age: "", breed: "", sex: "", sterilized: "", vaccines: "", deworming: "", vetClinic: "", vetPhone: "" };
const EMPTY_OWNER: OwnerInfo = { fullName: "", phone: "", email: "", emergencyContact: "" };
const SERVICE_ICONS: Record<ServiceCode, typeof BedDouble> = { HOTEL: BedDouble, GARDEN: Trees };
const PKG_LABEL: Record<GardenPackageCode, keyof Dictionary> = { SINGLE: "pkgSingle", P8: "pkgP8", P10: "pkgP10", P12: "pkgP12", MONTH: "pkgMonth" };

type QuoteState = { status: "idle" } | { status: "loading" } | { status: "done"; result: QuoteResult } | { status: "failed" };
type FieldKey = "dogName" | "vetClinic" | "vetPhone" | "ownerName" | "phone" | "email" | "arrival" | "departure" | "terms";

function serviceName(settings: PublicSettings, code: ServiceCode, locale: Locale) {
  const s = settings.services[code];
  return locale === "en" ? s.nameEn : locale === "uk" ? s.nameUk : s.nameKa;
}

export function BookingApp({ initialLocale, settings, today, todayAvailability }: Props) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const t = dictionaries[locale];
  const activeServices = (["HOTEL", "GARDEN"] as const).filter((s) => settings.services[s].active);

  const [service, setService] = useState<ServiceCode>(activeServices[0] ?? "HOTEL");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [pkg, setPkg] = useState<GardenPackageCode>("SINGLE");
  const [gardenDays, setGardenDays] = useState<string[]>([]);
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [dog, setDog] = useState<DogInfo>(EMPTY_DOG);
  const [owner, setOwner] = useState<OwnerInfo>(EMPTY_OWNER);
  const [walk, setWalk] = useState(false);
  const [notes, setNotes] = useState("");
  const [photoConsent, setPhotoConsent] = useState(false);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Set<FieldKey>>(new Set());
  const [quoteResult, setQuoteResult] = useState<{ key: string; state: QuoteState } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ ref: string; total: number } | null>(null);
  const [submitting, startSubmit] = useTransition();
  const quoteSeq = useRef(0);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t.pageTitle;
  }, [locale, t.pageTitle]);

  function switchLocale(l: Locale) {
    setLocale(l);
    window.history.replaceState(null, "", `/${l}`);
  }

  const selection = useMemo(() => {
    if (service === "HOTEL") return checkIn && checkOut ? { service, checkIn, checkOut } : null;
    const need = PACKAGE_VISITS[pkg];
    const complete = need === null ? gardenDays.length > 0 : gardenDays.length === need;
    return complete ? { service, gardenPackage: pkg, gardenDays } : null;
  }, [service, checkIn, checkOut, pkg, gardenDays]);

  const selectionKey = selection ? JSON.stringify(selection) : null;
  const quote: QuoteState = !selectionKey
    ? { status: "idle" }
    : quoteResult?.key === selectionKey
      ? quoteResult.state
      : { status: "loading" };
  const setQuote = (state: QuoteState) => selectionKey && setQuoteResult({ key: selectionKey, state });

  useEffect(() => {
    if (!selection || !selectionKey) return;
    const seq = ++quoteSeq.current;
    const timer = setTimeout(() => {
      quoteAction(selection)
        .then((result) => seq === quoteSeq.current && setQuoteResult({ key: selectionKey, state: { status: "done", result } }))
        .catch(() => seq === quoteSeq.current && setQuoteResult({ key: selectionKey, state: { status: "failed" } }));
    }, 250);
    return () => clearTimeout(timer);
  }, [selection, selectionKey]);

  const errorText = (code: BookingErrorCode | "network" | "rate_limited", fullDays?: string[]) =>
    format(t.errors[code], { days: (fullDays ?? []).map(dmy).join(", ") });

  function pickService(s: ServiceCode) {
    setService(s);
    setSubmitError(null);
  }

  function pickPackage(p: GardenPackageCode) {
    setPkg(p);
    const max = PACKAGE_VISITS[p];
    setGardenDays((days) => (max === null ? days.filter((d) => !days[0] || d < addDays(days[0], MONTH_WINDOW_DAYS)) : days.slice(0, max)));
  }

  function validate(): Set<FieldKey> {
    const e = new Set<FieldKey>();
    if (!dog.name.trim()) e.add("dogName");
    if (!dog.vetClinic.trim()) e.add("vetClinic");
    if (!dog.vetPhone.trim()) e.add("vetPhone");
    if (!owner.fullName.trim()) e.add("ownerName");
    if (!owner.phone.trim()) e.add("phone");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner.email.trim())) e.add("email");
    if (!arrival) e.add("arrival");
    if (!departure) e.add("departure");
    if (!terms) e.add("terms");
    return e;
  }

  function onSubmitClick() {
    setSubmitError(null);
    if (!(quote.status === "done" && quote.result.ok)) {
      toast.error(quote.status === "done" && !quote.result.ok ? errorText(quote.result.error, quote.result.fullDays) : t.priceHint);
      document.getElementById("dates-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const e = validate();
    setErrors(e);
    if (e.size) {
      toast.error(t.fixErrors);
      const firstId = { dogName: "dogName", vetClinic: "vetClinic", vetPhone: "vetPhone", ownerName: "ownerName", phone: "ownerPhone", email: "ownerEmail", arrival: "arrival", departure: "departure", terms: "terms" }[[...e][0]];
      document.getElementById(firstId)?.focus();
      return;
    }
    setConfirmOpen(true);
  }

  function confirmBooking() {
    if (!selection) return;
    const req: BookingRequest = {
      ...selection,
      arrivalTime: arrival,
      departureTime: departure,
      dog,
      owner,
      walk,
      notes,
      photoConsent,
      termsAccepted: terms,
      locale,
    };
    startSubmit(async () => {
      try {
        const res = await submitBookingAction(req);
        if (res.ok) {
          setConfirmOpen(false);
          setSuccess({ ref: res.ref, total: res.total });
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        const msg = errorText(res.error, "fullDays" in res ? res.fullDays : undefined);
        setSubmitError(msg);
        toast.error(msg);
        if (res.error === "full") setQuote({ status: "done", result: { ok: false, error: "full", fullDays: res.fullDays } });
      } catch {
        setSubmitError(t.errors.network);
        toast.error(t.errors.network);
      }
    });
  }

  function resetAll() {
    setSuccess(null);
    setCheckIn("");
    setCheckOut("");
    setGardenDays([]);
    setArrival("");
    setDeparture("");
    setDog(EMPTY_DOG);
    setOwner(EMPTY_OWNER);
    setWalk(false);
    setNotes("");
    setPhotoConsent(false);
    setTerms(false);
    setErrors(new Set());
    setSubmitError(null);
  }

  const err = (k: FieldKey) => (errors.has(k) ? t.required : undefined);
  const clearErr = (k: FieldKey) => errors.has(k) && setErrors((s) => new Set([...s].filter((x) => x !== k)));

  const datesText = (() => {
    if (service === "HOTEL") return checkIn && checkOut ? `${dmy(checkIn)} → ${dmy(checkOut)}` : "";
    return gardenDays.map(dmy).join(", ");
  })();

  return (
    <div className="min-h-screen pb-10">
      <Hero t={t} locale={locale} onLocale={switchLocale} />
      <AvailabilityBar t={t} hotel={todayAvailability.hotel} garden={todayAvailability.garden} />

      <main className="mx-auto max-w-[540px] p-3.5">
        {success ? (
          <SuccessScreen t={t} success={success} owner={owner} dogName={dog.name} service={serviceName(settings, service, locale)} datesText={datesText} onNew={resetAll} />
        ) : (
          <>
            <SectionCard title={t.stepService} icon={<PawPrint className="size-4" />}>
              <div className="grid grid-cols-2 gap-2">
                {activeServices.map((s) => {
                  const Icon = SERVICE_ICONS[s];
                  const selected = service === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => pickService(s)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                        selected ? "border-terracotta bg-clay" : "border-sand bg-card hover:border-terracotta/50",
                      )}
                    >
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", selected ? "bg-terracotta text-white" : "bg-clay text-forest")}>
                        <Icon className="size-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-forest">{serviceName(settings, s, locale)}</span>
                        <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">{s === "HOTEL" ? t.hotelSub : t.gardenSub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <div id="dates-card">
              <SectionCard title={t.stepDates} icon={<CalendarDays className="size-4" />}>
                {service === "HOTEL" && (
                  <>
                    <InfoBox>{format(t.hotelInfo, { t1: settings.hotel.tier1, t2: settings.hotel.tier2, t3: settings.hotel.tier3, month: settings.hotel.month })}</InfoBox>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label={t.checkIn} htmlFor="checkIn" required>
                        <Input id="checkIn" type="date" className={inputClass} min={today} max={addDays(today, 365)} value={checkIn}
                          onChange={(e) => {
                            setCheckIn(e.target.value);
                            if (checkOut && e.target.value >= checkOut) setCheckOut("");
                          }} />
                      </Field>
                      <Field label={t.checkOut} htmlFor="checkOut" required>
                        <Input id="checkOut" type="date" className={inputClass} min={checkIn ? addDays(checkIn, 1) : addDays(today, 1)} max={addDays(today, 365)} value={checkOut}
                          onChange={(e) => setCheckOut(e.target.value)} />
                      </Field>
                    </div>
                  </>
                )}

                {service === "GARDEN" && (
                  <>
                    <InfoBox>{t.gardenInfo}</InfoBox>
                    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(["SINGLE", "P8", "P10", "P12", "MONTH"] as const).map((p) => (
                        <Tile key={p} tone="gold" on={pkg === p} onClick={() => pickPackage(p)} className="py-2.5">
                          <span className="block">{t[PKG_LABEL[p]] as string}</span>
                          <span className="mt-0.5 block text-[13px] font-extrabold">
                            {gel(packagePrice(settings, p))}
                            {p === "SINGLE" && <span className="text-[10px] font-semibold"> / {t.perDay}</span>}
                          </span>
                        </Tile>
                      ))}
                    </div>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      {pkg === "MONTH" ? t.pickDaysMonth : pkg === "SINGLE" ? t.date : format(t.pickDays, { n: PACKAGE_VISITS[pkg]! })}
                      {pkg !== "SINGLE" && <span className="ml-1 text-sage">· {format(t.selectedDays, { n: gardenDays.length })}</span>}
                    </p>
                    <GardenCalendar t={t} today={today} selected={gardenDays} maxDays={PACKAGE_VISITS[pkg]} windowDays={MONTH_WINDOW_DAYS} onChange={setGardenDays} />
                  </>
                )}

                <PriceBox t={t} quote={quote} errorText={errorText} />
              </SectionCard>
            </div>

            <SectionCard title={t.stepTiming} icon={<Clock className="size-4" />}>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label={t.arrival} htmlFor="arrival" required error={err("arrival")}>
                  <Input id="arrival" type="time" className={inputClass} value={arrival} aria-invalid={errors.has("arrival")} onChange={(e) => { setArrival(e.target.value); clearErr("arrival"); }} />
                </Field>
                <Field label={t.departure} htmlFor="departure" required error={err("departure")}>
                  <Input id="departure" type="time" className={inputClass} value={departure} aria-invalid={errors.has("departure")} onChange={(e) => { setDeparture(e.target.value); clearErr("departure"); }} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title={t.stepDog} icon={<Dog className="size-4" />}>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label={t.dogName} htmlFor="dogName" required error={err("dogName")}>
                  <Input id="dogName" className={inputClass} maxLength={80} value={dog.name} aria-invalid={errors.has("dogName")} onChange={(e) => { setDog({ ...dog, name: e.target.value }); clearErr("dogName"); }} />
                </Field>
                <Field label={t.dogAge} htmlFor="dogAge">
                  <Input id="dogAge" className={inputClass} maxLength={40} value={dog.age} onChange={(e) => setDog({ ...dog, age: e.target.value })} />
                </Field>
              </div>
              <Field label={t.dogBreed} htmlFor="dogBreed">
                <Input id="dogBreed" className={inputClass} maxLength={80} value={dog.breed} onChange={(e) => setDog({ ...dog, breed: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="mb-3">
                  <p className="mb-1.5 text-xs font-semibold text-[#555]">{t.dogSex}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Tile on={dog.sex === "male"} onClick={() => setDog({ ...dog, sex: dog.sex === "male" ? "" : "male" })} className="py-2">♂ {t.male}</Tile>
                    <Tile on={dog.sex === "female"} onClick={() => setDog({ ...dog, sex: dog.sex === "female" ? "" : "female" })} className="py-2">♀ {t.female}</Tile>
                  </div>
                </div>
                <div className="mb-3">
                  <p className="mb-1.5 text-xs font-semibold text-[#555]">{t.sterilized}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Tile on={dog.sterilized === "yes"} onClick={() => setDog({ ...dog, sterilized: dog.sterilized === "yes" ? "" : "yes" })} className="py-2">{t.yes}</Tile>
                    <Tile on={dog.sterilized === "no"} onClick={() => setDog({ ...dog, sterilized: dog.sterilized === "no" ? "" : "no" })} className="py-2">{t.no}</Tile>
                  </div>
                </div>
              </div>
              <Field label={t.vaccines} htmlFor="vaccines">
                <Textarea id="vaccines" className="min-h-16 rounded-[10px] border-[1.5px] border-sand bg-cream" maxLength={500} value={dog.vaccines} onChange={(e) => setDog({ ...dog, vaccines: e.target.value })} />
              </Field>
              <Field label={t.deworming} htmlFor="deworming">
                <Textarea id="deworming" className="min-h-16 rounded-[10px] border-[1.5px] border-sand bg-cream" maxLength={500} value={dog.deworming} onChange={(e) => setDog({ ...dog, deworming: e.target.value })} />
              </Field>
              <div className="grid grid-cols-1 gap-x-2.5 sm:grid-cols-2">
                <Field label={t.vetClinic} htmlFor="vetClinic" required error={err("vetClinic")}>
                  <Input id="vetClinic" className={inputClass} maxLength={120} value={dog.vetClinic} aria-invalid={errors.has("vetClinic")} onChange={(e) => { setDog({ ...dog, vetClinic: e.target.value }); clearErr("vetClinic"); }} />
                </Field>
                <Field label={t.vetPhone} htmlFor="vetPhone" required error={err("vetPhone")}>
                  <Input id="vetPhone" type="tel" className={inputClass} maxLength={40} value={dog.vetPhone} aria-invalid={errors.has("vetPhone")} onChange={(e) => { setDog({ ...dog, vetPhone: e.target.value }); clearErr("vetPhone"); }} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title={t.stepOwner} icon={<UserRound className="size-4" />}>
              <div className="grid grid-cols-1 gap-x-2.5 sm:grid-cols-2">
                <Field label={t.ownerName} htmlFor="ownerName" required error={err("ownerName")}>
                  <Input id="ownerName" className={inputClass} autoComplete="name" maxLength={120} value={owner.fullName} aria-invalid={errors.has("ownerName")} onChange={(e) => { setOwner({ ...owner, fullName: e.target.value }); clearErr("ownerName"); }} />
                </Field>
                <Field label={t.phone} htmlFor="ownerPhone" required error={err("phone")}>
                  <Input id="ownerPhone" type="tel" className={inputClass} autoComplete="tel" placeholder="5XX XXX XXX" maxLength={40} value={owner.phone} aria-invalid={errors.has("phone")} onChange={(e) => { setOwner({ ...owner, phone: e.target.value }); clearErr("phone"); }} />
                </Field>
              </div>
              <Field label={t.email} htmlFor="ownerEmail" required error={err("email")}>
                <Input id="ownerEmail" type="email" className={inputClass} autoComplete="email" placeholder="example@gmail.com" maxLength={160} value={owner.email} aria-invalid={errors.has("email")} onChange={(e) => { setOwner({ ...owner, email: e.target.value }); clearErr("email"); }} />
              </Field>
              <Field label={t.emergency} htmlFor="emergency">
                <Input id="emergency" className={inputClass} placeholder="… · 5XX XXX XXX" maxLength={160} value={owner.emergencyContact} onChange={(e) => setOwner({ ...owner, emergencyContact: e.target.value })} />
              </Field>
            </SectionCard>

            <SectionCard title={t.stepExtras} icon={<Sparkles className="size-4" />}>
              <label htmlFor="walk" className="mb-3 flex cursor-pointer items-start gap-3 rounded-[10px] border border-sand bg-cream px-3 py-2.5">
                <Checkbox id="walk" checked={walk} onCheckedChange={(v) => setWalk(v === true)} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold">{t.walk}</span>
                  <span className="block text-xs text-muted-foreground">{t.walkSub}</span>
                </span>
              </label>
              <Field label={t.notes} htmlFor="notes">
                <Textarea id="notes" className="min-h-20 rounded-[10px] border-[1.5px] border-sand bg-cream" placeholder={t.notesPh} maxLength={1500} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </SectionCard>

            <div className="mb-3 space-y-3 px-1">
              <label htmlFor="photoConsent" className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-normal text-[#444]">
                <Checkbox id="photoConsent" checked={photoConsent} onCheckedChange={(v) => setPhotoConsent(v === true)} className="mt-0.5" />
                <span>{t.photoConsent}</span>
              </label>
              <label htmlFor="terms" className={cn("flex cursor-pointer items-start gap-2.5 text-[13px] leading-normal text-[#444]", errors.has("terms") && "text-destructive")}>
                <Checkbox id="terms" checked={terms} aria-invalid={errors.has("terms")} onCheckedChange={(v) => { setTerms(v === true); clearErr("terms"); }} className="mt-0.5" />
                <span>
                  {t.terms} <span className="text-destructive">*</span>
                  {settings.business.termsUrl && (
                    <a href={settings.business.termsUrl} target="_blank" rel="noopener noreferrer" className="ml-1 font-semibold text-sage underline">
                      {t.termsLink}
                    </a>
                  )}
                </span>
              </label>
            </div>

            {submitError && <div className="mb-3"><StatusBox tone="no">{submitError}</StatusBox></div>}

            <button
              type="button"
              onClick={onSubmitClick}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta py-4 text-base font-extrabold text-white shadow-soft transition-colors hover:bg-[#b85a38] active:scale-[0.99]"
            >
              <PawPrint className="size-5" />
              {t.submit}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">{t.payNote}</p>
          </>
        )}
        <footer className="pt-6 text-center text-[11px] text-muted-foreground">
          © {t.footer}
          {settings.business.phone && <> · {settings.business.phone}</>}
        </footer>
      </main>

      <Dialog open={confirmOpen} onOpenChange={(o) => !submitting && setConfirmOpen(o)}>
        <DialogContent className="rounded-[20px] p-6 sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <PawPrint className="size-8 text-terracotta" />
            <DialogTitle className="text-lg font-extrabold text-forest">{t.confirmTitle}</DialogTitle>
            <DialogDescription>{t.confirmSub}</DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl bg-cream p-4 text-[13px]">
            <ConfirmRow label={t.service} value={`${serviceName(settings, service, locale)}${service === "GARDEN" ? ` · ${t[PKG_LABEL[pkg]] as string}` : ""}`} />
            <ConfirmRow label={t.dates} value={datesText} />
            <ConfirmRow label={`${t.arrival} / ${t.departure}`} value={`${arrival} / ${departure}`} />
            <ConfirmRow label={t.dog} value={[dog.name, dog.breed].filter(Boolean).join(" · ")} />
            <ConfirmRow label={t.owner} value={`${owner.fullName} · ${owner.phone}`} />
            <ConfirmRow label={t.email} value={owner.email} />
            {quote.status === "done" && quote.result.ok && (
              <div className="mt-3 flex items-center justify-between border-t-2 border-forest pt-3">
                <span className="font-bold">{t.total}</span>
                <span className="text-2xl font-extrabold text-forest">{gel(quote.result.quote.total)}</span>
              </div>
            )}
          </div>
          {submitError && <StatusBox tone="no">{submitError}</StatusBox>}
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="outline" className="h-11 rounded-xl text-sm font-bold" disabled={submitting} onClick={() => setConfirmOpen(false)}>
              {t.cancel}
            </Button>
            <Button className="h-11 rounded-xl bg-terracotta text-sm font-bold text-white hover:bg-[#b85a38]" disabled={submitting} onClick={confirmBooking}>
              {submitting ? <><Loader2 className="animate-spin" /> {t.sending}</> : t.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Hero({ t, locale, onLocale }: { t: Dictionary; locale: Locale; onLocale: (l: Locale) => void }) {
  return (
    <header className="bg-forest text-white">
      <div className="mx-auto flex max-w-[540px] items-start justify-between gap-3 px-5 pt-6">
        <div className="flex min-w-0 items-center gap-2">
          <Image src="/floki-puppy.png" alt="ფლოკი" width={275} height={282} className="h-11 w-auto shrink-0" />
          <Logo name={t.brand} className="text-[30px] leading-none" />
        </div>
        <div className="flex gap-1.5 pt-1" role="group" aria-label="Language">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onLocale(l)}
              aria-pressed={l === locale}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors",
                l === locale ? "bg-terracotta text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              {dictionaries[l].langName}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-[540px] px-5 pt-3 pb-5">
        <p className="text-xs font-semibold tracking-wide text-white/70">{t.tagline}</p>
        <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-white/85">{t.heroSub}</p>
      </div>
    </header>
  );
}

function AvailabilityBar({ t, hotel, garden }: { t: Dictionary; hotel?: DayAvailability; garden?: DayAvailability }) {
  const hotelFree = hotel ? Math.max(0, hotel.capacity - hotel.booked) : 0;
  const gardenFree = garden ? Math.max(0, garden.capacity - garden.booked) : 0;
  const hotelCap = hotel?.capacity ?? 0;
  const state = hotelFree === 0 && gardenFree === 0 ? "full" : hotelCap > 0 && hotelFree / hotelCap < 0.25 ? "warn" : "free";
  return (
    <div className="mx-auto max-w-[540px] px-3.5">
      <div className="mt-3.5 flex items-center gap-2.5 rounded-xl border-[1.5px] border-sand bg-card px-4 py-2.5 shadow-soft">
        <span
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            state === "free" && "bg-[#27ae60] shadow-[0_0_0_3px_rgba(39,174,96,0.2)]",
            state === "warn" && "bg-[#e67e22] shadow-[0_0_0_3px_rgba(230,126,34,0.2)]",
            state === "full" && "bg-destructive shadow-[0_0_0_3px_rgba(192,57,43,0.2)]",
          )}
        />
        <div className="flex-1">
          <div className="text-[13px] font-bold text-forest">
            {t.availTitle}: {state === "free" ? t.availFree : state === "warn" ? t.availFew : t.availFull}
          </div>
          <div className="text-[11px] text-muted-foreground">{format(t.availLine, { hotel: hotelFree, garden: gardenFree })}</div>
        </div>
      </div>
    </div>
  );
}

function PriceBox({ t, quote, errorText }: { t: Dictionary; quote: QuoteState; errorText: (c: BookingErrorCode | "network", d?: string[]) => string }) {
  if (quote.status === "idle") return <p className="mt-2 text-center text-xs text-muted-foreground">{t.priceHint}</p>;
  if (quote.status === "loading") {
    return (
      <div className="mt-2.5 flex items-center gap-2 rounded-[14px] bg-terracotta px-5 py-4 text-sm text-white/80" aria-live="polite">
        <Loader2 className="size-4 animate-spin" /> {t.priceLoading}
      </div>
    );
  }
  if (quote.status === "failed") return <StatusBox tone="no">{t.errors.network}</StatusBox>;
  const { result } = quote;
  if (!result.ok) return <StatusBox tone="no">{errorText(result.error, result.fullDays)}</StatusBox>;
  return (
    <>
      <StatusBox tone={result.minFree <= 2 ? "warn" : "ok"}>
        {format(t.freePlaces, { n: result.minFree })}
      </StatusBox>
      <div className="mt-2.5 rounded-[14px] bg-terracotta px-5 py-4 text-white" aria-live="polite">
        <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-white/70 uppercase">{t.priceTitle}</div>
        {result.quote.lines.map((l, i) => (
          <div key={i} className="flex justify-between py-0.5 text-xs text-white/80">
            <span>{lineLabel(l, t)}</span>
            <span>{gel(l.amount)}</span>
          </div>
        ))}
        <div className="mt-1.5 flex justify-between border-t border-white/20 pt-2 text-[22px] font-extrabold">
          <span>{t.total}</span>
          <span>{gel(result.quote.total)}</span>
        </div>
      </div>
    </>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 border-b border-sand py-1.5 last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-semibold break-words">{value}</span>
    </div>
  );
}

function SuccessScreen({
  t, success, owner, dogName, service, datesText, onNew,
}: { t: Dictionary; success: { ref: string; total: number }; owner: OwnerInfo; dogName: string; service: string; datesText: string; onNew: () => void }) {
  return (
    <div className="py-8 text-center">
      <CheckCircle2 className="mx-auto mb-3 size-14 text-sage" />
      <h1 className="mb-2 text-2xl font-extrabold text-forest">{t.successTitle}</h1>
      <p className="mx-auto mb-5 max-w-sm text-sm leading-relaxed text-muted-foreground">{t.successMsg}</p>
      <div className="rounded-2xl border-[1.5px] border-sand bg-card p-4 text-left text-[13px] shadow-soft">
        <ConfirmRow label={t.successRef} value={success.ref} />
        <ConfirmRow label={t.service} value={service} />
        <ConfirmRow label={t.dates} value={datesText} />
        <ConfirmRow label={t.dog} value={dogName} />
        <ConfirmRow label={t.email} value={owner.email} />
        <div className="mt-2 flex justify-between border-t-2 border-forest pt-2.5">
          <span className="font-bold">{t.total}</span>
          <span className="text-xl font-extrabold text-forest">{gel(success.total)}</span>
        </div>
      </div>
      <button type="button" onClick={onNew} className="mt-5 rounded-[10px] border-2 border-forest px-6 py-3 text-sm font-bold text-forest hover:bg-forest hover:text-white">
        {t.newBooking}
      </button>
    </div>
  );
}
