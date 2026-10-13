import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { todayInTbilisi } from "@/lib/domain/dates";
import { LOCALES, type Locale } from "@/lib/domain/types";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { publicBackend } from "@/lib/server/backend";
import { BookingApp } from "@/components/booking/booking-app";
import { BookingUnavailable } from "@/components/booking/booking-unavailable";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) return {};
  return { title: dictionaries[locale as Locale].pageTitle };
}

export default async function BookingPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) notFound();
  await connection();

  const today = todayInTbilisi();
  const backend = publicBackend();
  const data = await Promise.all([
    backend.getPublicSettings(),
    backend.getAvailability("HOTEL", today, today),
    backend.getAvailability("GARDEN", today, today),
  ]).catch((err) => {
    console.error("Failed to load booking page data", err);
    return null;
  });
  if (!data) return <BookingUnavailable locale={locale as Locale} />;
  const [settings, hotel, garden] = data;
  return (
    <BookingApp
      initialLocale={locale as Locale}
      settings={settings}
      today={today}
      todayAvailability={{ hotel: hotel[0], garden: garden[0] }}
    />
  );
}
