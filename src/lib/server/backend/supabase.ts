import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type {
  Booking,
  CreateBookingResult,
  DayAvailability,
  GardenPackageCode,
  Locale,
  PaymentMethod,
  PriceLine,
  PublicSettings,
  QuoteResult,
  ServiceCode,
  Settings,
} from "@/lib/domain/types";
import { supabaseConfig } from "../config";
import type { AdminBackend, PublicBackend } from "./types";

function anonClient(): SupabaseClient {
  const cfg = supabaseConfig()!;
  return createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Cookie-bound client: queries run as the signed-in user, so RLS applies. */
export async function userClient(): Promise<SupabaseClient> {
  const cfg = supabaseConfig()!;
  const store = await cookies();
  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

export const supabasePublicBackend: PublicBackend & { quote(req: unknown): Promise<QuoteResult> } = {
  async getPublicSettings() {
    const { data, error } = await anonClient().rpc("get_public_settings");
    if (error) throw error;
    return data as PublicSettings;
  },

  async getAvailability(service: ServiceCode, from: string, to: string) {
    const { data, error } = await anonClient().rpc("get_availability", { p_service: service, p_from: from, p_to: to });
    if (error) throw error;
    return (data as { day: string; booked: number; capacity: number }[]).map(
      (r): DayAvailability => ({ date: r.day, booked: r.booked, capacity: r.capacity }),
    );
  },

  async quote(req) {
    const { data, error } = await anonClient().rpc("quote_booking", { p: req });
    if (error) throw error;
    const r = data as { ok: boolean; error?: string; fullDays?: string[]; days?: string[]; lines?: PriceLine[]; total?: number; minFree?: number };
    if (!r.ok) return { ok: false, error: r.error as never, fullDays: r.fullDays };
    return { ok: true, quote: { days: r.days!, lines: r.lines!.map(numLine), total: Number(r.total) }, minFree: r.minFree ?? 0 };
  },

  async createBooking(req) {
    const { data, error } = await anonClient().rpc("create_booking", { p: req });
    if (error) throw error;
    const r = data as { ok: boolean; error?: string; fullDays?: string[]; ref?: string; total?: number; days?: string[] };
    if (!r.ok) return { ok: false, error: r.error as never, fullDays: r.fullDays } satisfies CreateBookingResult;
    return { ok: true, ref: r.ref!, total: Number(r.total), days: r.days! };
  },
};

function numLine(l: PriceLine): PriceLine {
  return { ...l, qty: Number(l.qty), unit: Number(l.unit), amount: Number(l.amount) };
}

const BOOKING_SELECT = "*, owner:owners(*), dog:dogs(*), payments(*), booking_days(day)";

interface BookingRow {
  id: string;
  ref: string;
  created_at: string;
  status: Booking["status"];
  service: ServiceCode;
  check_in: string;
  check_out: string;
  garden_package: GardenPackageCode | null;
  arrival_time: string | null;
  departure_time: string | null;
  walk: boolean;
  notes: string;
  photo_consent: boolean;
  locale: Locale;
  base_price: number | string;
  discount_pct: number;
  total: number | string;
  price_lines: PriceLine[];
  invoice_sent_at: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  owner: { full_name: string; phone: string; email: string; emergency_contact: string };
  dog: {
    name: string; age: string; breed: string; sex: Booking["dog"]["sex"]; sterilized: Booking["dog"]["sterilized"];
    vaccines: string; deworming: string; vet_clinic: string; vet_phone: string;
  };
  payments: {
    id: string; booking_id: string; amount: number | string; method: PaymentMethod; note: string;
    paid_on: string; recorded_by_name: string | null; created_at: string;
  }[];
  booking_days: { day: string }[];
}

function mapBooking(r: BookingRow): Booking {
  return {
    id: r.id,
    ref: r.ref,
    createdAt: r.created_at,
    status: r.status,
    service: r.service,
    days: r.booking_days.map((d) => d.day).sort(),
    checkIn: r.check_in,
    checkOut: r.check_out,
    gardenPackage: r.garden_package,
    arrivalTime: r.arrival_time ?? "",
    departureTime: r.departure_time ?? "",
    dog: {
      name: r.dog.name, age: r.dog.age, breed: r.dog.breed, sex: r.dog.sex, sterilized: r.dog.sterilized,
      vaccines: r.dog.vaccines, deworming: r.dog.deworming, vetClinic: r.dog.vet_clinic, vetPhone: r.dog.vet_phone,
    },
    owner: {
      fullName: r.owner.full_name, phone: r.owner.phone, email: r.owner.email, emergencyContact: r.owner.emergency_contact,
    },
    walk: r.walk,
    notes: r.notes,
    photoConsent: r.photo_consent,
    locale: r.locale,
    basePrice: Number(r.base_price),
    discountPct: r.discount_pct,
    total: Number(r.total),
    priceLines: (r.price_lines ?? []).map(numLine),
    invoiceSentAt: r.invoice_sent_at,
    reviewedBy: r.reviewed_by_name,
    reviewedAt: r.reviewed_at,
    rejectReason: r.reject_reason,
    payments: r.payments.map((p) => ({
      id: p.id, bookingId: p.booking_id, amount: Number(p.amount), method: p.method, note: p.note,
      paidOn: p.paid_on, recordedBy: p.recorded_by_name ?? "", createdAt: p.created_at,
    })),
  };
}

export const supabaseAdminBackend: AdminBackend = {
  async listBookings() {
    const db = await userClient();
    const { data, error } = await db.from("bookings").select(BOOKING_SELECT).order("created_at", { ascending: false }).limit(2000);
    if (error) throw error;
    return (data as BookingRow[]).map(mapBooking);
  },
  async getBooking(id) {
    const db = await userClient();
    const { data, error } = await db.from("bookings").select(BOOKING_SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapBooking(data as BookingRow) : null;
  },
  async approveBooking(id, discountPct, admin) {
    const db = await userClient();
    const { data, error } = await db
      .from("bookings")
      .update({ status: "approved", discount_pct: discountPct, reviewed_by: admin.id, reviewed_by_name: admin.fullName, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select(BOOKING_SELECT)
      .maybeSingle();
    if (error) throw error;
    return data ? mapBooking(data as BookingRow) : null;
  },
  async rejectBooking(id, reason, admin) {
    const db = await userClient();
    const { data, error } = await db
      .from("bookings")
      .update({ status: "rejected", reject_reason: reason || null, reviewed_by: admin.id, reviewed_by_name: admin.fullName, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select(BOOKING_SELECT)
      .maybeSingle();
    if (error) throw error;
    return data ? mapBooking(data as BookingRow) : null;
  },
  async markInvoiceSent(id) {
    const db = await userClient();
    const { error } = await db.from("bookings").update({ invoice_sent_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  },
  async addPayment(input, admin) {
    const db = await userClient();
    const { error } = await db.from("payments").insert({
      booking_id: input.bookingId, amount: input.amount, method: input.method, note: input.note,
      paid_on: input.paidOn, recorded_by: admin.id, recorded_by_name: admin.fullName,
    });
    if (error) throw error;
  },
  async deletePayment(paymentId) {
    const db = await userClient();
    const { error } = await db.from("payments").delete().eq("id", paymentId);
    if (error) throw error;
  },
  async getSettings() {
    const db = await userClient();
    const { data, error } = await db.from("settings").select("data").eq("id", 1).single();
    if (error) throw error;
    return data.data as Settings;
  },
  async saveSettings(settings) {
    const db = await userClient();
    const { error } = await db.from("settings").update({ data: settings, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw error;
  },
};
