import type {
  AdminUser,
  Booking,
  BookingRequest,
  CreateBookingResult,
  DayAvailability,
  PaymentMethod,
  PublicSettings,
  ServiceCode,
  Settings,
} from "@/lib/domain/types";

export interface PublicBackend {
  getPublicSettings(): Promise<PublicSettings>;
  getAvailability(service: ServiceCode, from: string, to: string): Promise<DayAvailability[]>;
  /** Re-validates, prices and capacity-checks atomically; never trusts client price or status. */
  createBooking(req: BookingRequest): Promise<CreateBookingResult>;
}

export interface NewPayment {
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  note: string;
  paidOn: string;
}

export interface AdminBackend {
  listBookings(): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | null>;
  approveBooking(id: string, discountPct: number, admin: AdminUser): Promise<Booking | null>;
  rejectBooking(id: string, reason: string, admin: AdminUser): Promise<Booking | null>;
  markInvoiceSent(id: string): Promise<void>;
  addPayment(input: NewPayment, admin: AdminUser): Promise<void>;
  deletePayment(paymentId: string): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
}

export function toPublicSettings(s: Settings): PublicSettings {
  return {
    services: s.services,
    hotel: s.hotel,
    garden: s.garden,
    business: { name: s.business.name, phone: s.business.phone, termsUrl: s.business.termsUrl },
  };
}
