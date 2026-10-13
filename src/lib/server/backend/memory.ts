import "server-only";
import { randomUUID } from "node:crypto";
import { addDays, todayInTbilisi } from "@/lib/domain/dates";
import { DEFAULT_SETTINGS } from "@/lib/domain/defaults";
import { applyDiscount, resolveBooking } from "@/lib/domain/pricing";
import type {
  AdminUser,
  Booking,
  BookingRequest,
  CreateBookingResult,
  DayAvailability,
  Payment,
  ServiceCode,
  Settings,
} from "@/lib/domain/types";
import { toPublicSettings, type AdminBackend, type NewPayment, type PublicBackend } from "./types";

interface MemoryAdmin extends AdminUser {
  password: string;
}

interface MemoryState {
  settings: Settings;
  bookings: Booking[];
  admins: MemoryAdmin[];
}

const HOLDING: Booking["status"][] = ["pending", "approved"];

function demoPassword(): string {
  return process.env.ADMIN_DEMO_PASSWORD || "graysons-demo";
}

export const DEMO_ADMINS: Omit<MemoryAdmin, "password">[] = [
  { id: "admin-misha", email: "mikheilkachkachishvili@gmail.com", fullName: "მიშა კაჭკაჭიშვილი", role: "director" },
  { id: "admin-anuka", email: "anuka@graysons.local", fullName: "ანუკა გამსახურდია", role: "manager" },
];

function makeRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "GR-";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function seedBooking(
  settings: Settings,
  partial: Omit<BookingRequest, "dog" | "owner" | "walk" | "notes" | "photoConsent" | "termsAccepted" | "locale"> & {
    dog: Partial<Booking["dog"]> & { name: string };
    owner: Partial<Booking["owner"]> & { fullName: string; phone: string; email: string };
    status: Booking["status"];
    discountPct?: number;
    notes?: string;
    createdDaysAgo: number;
    payments?: Omit<Payment, "id" | "bookingId" | "createdAt" | "recordedBy">[];
  },
): Booking {
  const today = todayInTbilisi();
  const resolved = resolveBooking(partial, settings, addDays(today, -60));
  if (!resolved.ok) throw new Error(`Bad seed booking: ${resolved.error}`);
  const { quote } = resolved;
  const id = randomUUID();
  const discountPct = partial.discountPct ?? 0;
  const createdAt = new Date(Date.now() - partial.createdDaysAgo * 86_400_000).toISOString();
  return {
    id,
    ref: makeRef(),
    createdAt,
    status: partial.status,
    service: partial.service,
    days: quote.days,
    checkIn: quote.days[0],
    checkOut: partial.service === "HOTEL" ? partial.checkOut! : quote.days[quote.days.length - 1],
    gardenPackage: partial.service === "GARDEN" ? partial.gardenPackage ?? "SINGLE" : null,
    arrivalTime: partial.arrivalTime,
    departureTime: partial.departureTime,
    dog: { age: "", breed: "", sex: "", sterilized: "", vaccines: "", deworming: "", vetClinic: "", vetPhone: "", ...partial.dog },
    owner: { emergencyContact: "", ...partial.owner },
    walk: true,
    notes: partial.notes ?? "",
    photoConsent: true,
    locale: "ka",
    basePrice: quote.total,
    discountPct,
    total: applyDiscount(quote.total, discountPct),
    priceLines: quote.lines,
    invoiceSentAt: partial.status === "approved" ? createdAt : null,
    reviewedBy: partial.status === "pending" ? null : "მიშა კაჭკაჭიშვილი",
    reviewedAt: partial.status === "pending" ? null : createdAt,
    rejectReason: partial.status === "rejected" ? "ამ თარიღებზე ადგილი აღარ არის" : null,
    payments: (partial.payments ?? []).map((p) => ({
      ...p,
      id: randomUUID(),
      bookingId: id,
      createdAt,
      recordedBy: "ანუკა გამსახურდია",
    })),
  };
}

function createSeedState(): MemoryState {
  const settings: Settings = structuredClone(DEFAULT_SETTINGS);
  const t = todayInTbilisi();
  const d = (n: number) => addDays(t, n);
  const vet = { vetClinic: "ვეტ კლინიკა „ზოო“", vetPhone: "599 11 22 33" };
  const bookings: Booking[] = [
    seedBooking(settings, {
      service: "HOTEL", checkIn: d(-2), checkOut: d(3), arrivalTime: "10:00", departureTime: "18:00",
      dog: { name: "ბეთა", age: "3 წელი", breed: "ლაბრადორი", sex: "female", sterilized: "yes", ...vet },
      owner: { fullName: "ნინო კვარაცხელია", phone: "555 12 34 56", email: "nino@example.com", emergencyContact: "გიორგი · 577 00 11 22" },
      status: "approved", createdDaysAgo: 6,
      payments: [
        { amount: 150, method: "bank_transfer", note: "TBC გადარიცხვა", paidOn: d(-3) },
        { amount: 40, method: "barter", note: "ფოტოსესია სოციალური ქსელისთვის", paidOn: d(0) },
      ],
    }),
    seedBooking(settings, {
      service: "HOTEL", checkIn: d(0), checkOut: d(10), arrivalTime: "09:30", departureTime: "12:00",
      dog: { name: "როკი", age: "5 წელი", breed: "გერმანული ნაგაზი", sex: "male", sterilized: "no", ...vet },
      owner: { fullName: "Oleksandr Bondar", phone: "+995 591 00 00 01", email: "oleks@example.com" },
      status: "approved", discountPct: 10, createdDaysAgo: 4,
      payments: [{ amount: 300, method: "bank_transfer", note: "BOG", paidOn: d(-1) }],
    }),
    seedBooking(settings, {
      service: "GARDEN", gardenPackage: "SINGLE", gardenDays: [d(0)], arrivalTime: "09:00", departureTime: "19:00",
      dog: { name: "ფიფქი", age: "1 წელი", breed: "შპიცი", sex: "female", ...vet },
      owner: { fullName: "თამარ ბერიძე", phone: "593 44 55 66", email: "tamar@example.com" },
      status: "approved", createdDaysAgo: 2,
    }),
    seedBooking(settings, {
      service: "HOTEL", checkIn: d(5), checkOut: d(9), arrivalTime: "11:00", departureTime: "17:00",
      dog: { name: "ლუნა", age: "2 წელი", breed: "ჰასკი", sex: "female", sterilized: "no", vaccines: "ცოფი 03/2026, კომპლექსური 04/2026", ...vet },
      owner: { fullName: "Emily Carter", phone: "+995 599 12 12 12", email: "emily@example.com", emergencyContact: "Mark · 599 13 13 13" },
      status: "pending", createdDaysAgo: 0, notes: "Luna is afraid of thunder, please keep her inside in the evening.",
    }),
    seedBooking(settings, {
      service: "GARDEN", gardenPackage: "P8",
      gardenDays: [1, 2, 3, 4, 7, 8, 9, 10].map((n) => d(n)), arrivalTime: "08:30", departureTime: "18:30",
      dog: { name: "ბადი", age: "4 თვე", breed: "ჯეკ რასელი", sex: "male", ...vet },
      owner: { fullName: "მარიამ ჯაფარიძე", phone: "568 22 33 44", email: "mariam@example.com" },
      status: "pending", createdDaysAgo: 0,
    }),
    seedBooking(settings, {
      service: "HOTEL", checkIn: d(-20), checkOut: d(-15), arrivalTime: "10:00", departureTime: "10:00",
      dog: { name: "მაქსი", breed: "პუდელი", sex: "male", ...vet },
      owner: { fullName: "დავით ლომიძე", phone: "577 55 66 77", email: "davit@example.com" },
      status: "rejected", createdDaysAgo: 25,
    }),
  ];
  return {
    settings,
    bookings,
    admins: DEMO_ADMINS.map((a) => ({ ...a, password: demoPassword() })),
  };
}

const globalStore = globalThis as unknown as { __graysonsMemory?: MemoryState };

function state(): MemoryState {
  if (!globalStore.__graysonsMemory) globalStore.__graysonsMemory = createSeedState();
  return globalStore.__graysonsMemory;
}

function bookedOn(service: ServiceCode, day: string): number {
  return state().bookings.filter((b) => b.service === service && HOLDING.includes(b.status) && b.days.includes(day)).length;
}

export function verifyMemoryAdmin(email: string, password: string): AdminUser | null {
  const admin = state().admins.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  if (!admin || admin.password !== password) return null;
  const { password: _pw, ...user } = admin;
  void _pw;
  return user;
}

export function findMemoryAdmin(id: string): AdminUser | null {
  const admin = state().admins.find((a) => a.id === id);
  if (!admin) return null;
  return { id: admin.id, email: admin.email, fullName: admin.fullName, role: admin.role };
}

export const memoryPublicBackend: PublicBackend = {
  async getPublicSettings() {
    return toPublicSettings(state().settings);
  },

  async getAvailability(service, from, to) {
    const capacity = state().settings.services[service].capacity;
    const out: DayAvailability[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, booked: bookedOn(service, d), capacity });
    return out;
  },

  // Synchronous between resolve and push, so the capacity check is atomic in a single Node process.
  async createBooking(req): Promise<CreateBookingResult> {
    const s = state();
    const resolved = resolveBooking(req, s.settings, todayInTbilisi());
    if (!resolved.ok) return resolved;
    const { quote } = resolved;
    const capacity = s.settings.services[req.service].capacity;
    const fullDays = quote.days.filter((d) => bookedOn(req.service, d) >= capacity);
    if (fullDays.length) return { ok: false, error: "full", fullDays };

    const booking: Booking = {
      id: randomUUID(),
      ref: makeRef(),
      createdAt: new Date().toISOString(),
      status: "pending",
      service: req.service,
      days: quote.days,
      checkIn: quote.days[0],
      checkOut: req.service === "HOTEL" ? req.checkOut! : quote.days[quote.days.length - 1],
      gardenPackage: req.service === "GARDEN" ? req.gardenPackage ?? "SINGLE" : null,
      arrivalTime: req.arrivalTime,
      departureTime: req.departureTime,
      dog: req.dog,
      owner: req.owner,
      walk: req.walk,
      notes: req.notes,
      photoConsent: req.photoConsent,
      locale: req.locale,
      basePrice: quote.total,
      discountPct: 0,
      total: quote.total,
      priceLines: quote.lines,
      invoiceSentAt: null,
      reviewedBy: null,
      reviewedAt: null,
      rejectReason: null,
      payments: [],
    };
    s.bookings.unshift(booking);
    return { ok: true, ref: booking.ref, total: booking.total, days: booking.days };
  },
};

export const memoryAdminBackend: AdminBackend = {
  async listBookings() {
    return structuredClone(state().bookings);
  },
  async getBooking(id) {
    const b = state().bookings.find((x) => x.id === id);
    return b ? structuredClone(b) : null;
  },
  async approveBooking(id, discountPct, admin) {
    const b = state().bookings.find((x) => x.id === id && x.status === "pending");
    if (!b) return null;
    b.status = "approved";
    b.discountPct = discountPct;
    b.total = applyDiscount(b.basePrice, discountPct);
    b.reviewedBy = admin.fullName;
    b.reviewedAt = new Date().toISOString();
    return structuredClone(b);
  },
  async rejectBooking(id, reason, admin) {
    const b = state().bookings.find((x) => x.id === id && x.status === "pending");
    if (!b) return null;
    b.status = "rejected";
    b.rejectReason = reason || null;
    b.reviewedBy = admin.fullName;
    b.reviewedAt = new Date().toISOString();
    return structuredClone(b);
  },
  async markInvoiceSent(id) {
    const b = state().bookings.find((x) => x.id === id);
    if (b) b.invoiceSentAt = new Date().toISOString();
  },
  async addPayment(input: NewPayment, admin) {
    const b = state().bookings.find((x) => x.id === input.bookingId);
    if (!b) throw new Error("Booking not found");
    b.payments.push({
      id: randomUUID(),
      bookingId: b.id,
      amount: input.amount,
      method: input.method,
      note: input.note,
      paidOn: input.paidOn,
      recordedBy: admin.fullName,
      createdAt: new Date().toISOString(),
    });
  },
  async deletePayment(paymentId) {
    for (const b of state().bookings) b.payments = b.payments.filter((p) => p.id !== paymentId);
  },
  async getSettings() {
    return structuredClone(state().settings);
  },
  async saveSettings(settings) {
    state().settings = structuredClone(settings);
  },
};
