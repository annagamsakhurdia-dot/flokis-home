export const SERVICES = ["HOTEL", "GARDEN"] as const;
export type ServiceCode = (typeof SERVICES)[number];

export const BOOKING_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const LOCALES = ["ka", "en", "uk"] as const;
export type Locale = (typeof LOCALES)[number];

export const GARDEN_PACKAGES = ["SINGLE", "P8", "P10", "P12", "MONTH"] as const;
export type GardenPackageCode = (typeof GARDEN_PACKAGES)[number];

export const PAYMENT_METHODS = ["bank_transfer", "barter"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface ServiceSettings {
  code: ServiceCode;
  active: boolean;
  /** Places available to guests per day (permanent residents already excluded). */
  capacity: number;
  nameKa: string;
  nameEn: string;
  nameUk: string;
}

export interface HotelPricing {
  /** Nightly rate for nights 1–3 of every 30-night block. */
  tier1: number;
  /** Nightly rate for nights 4–7. */
  tier2: number;
  /** Nightly rate for night 8 onward. */
  tier3: number;
  /** Flat price for every full 30 nights. */
  month: number;
}

export interface GardenPricing {
  single: number;
  p8: number;
  p10: number;
  p12: number;
  month: number;
}

export interface BusinessSettings {
  name: string;
  phone: string;
  address: string;
  bankName: string;
  iban: string;
  /** Domestic account number, shown on the invoice next to the IBAN. */
  accountNumber: string;
  recipient: string;
  invoiceSenderEmail: string;
  termsUrl: string;
}

export interface Settings {
  services: Record<ServiceCode, ServiceSettings>;
  hotel: HotelPricing;
  garden: GardenPricing;
  business: BusinessSettings;
}

export type PublicSettings = Omit<Settings, "business"> & {
  business: Pick<BusinessSettings, "name" | "phone" | "termsUrl">;
};

export interface DogInfo {
  name: string;
  age: string;
  breed: string;
  sex: "" | "male" | "female";
  sterilized: "" | "yes" | "no";
  vaccines: string;
  deworming: string;
  vetClinic: string;
  vetPhone: string;
}

export interface OwnerInfo {
  fullName: string;
  phone: string;
  email: string;
  emergencyContact: string;
}

export interface BookingRequest {
  service: ServiceCode;
  checkIn?: string;
  checkOut?: string;
  gardenPackage?: GardenPackageCode;
  gardenDays?: string[];
  arrivalTime: string;
  departureTime: string;
  dog: DogInfo;
  owner: OwnerInfo;
  walk: boolean;
  notes: string;
  photoConsent: boolean;
  termsAccepted: boolean;
  locale: Locale;
}

export type PriceLineKind =
  | "hotel_month"
  | "hotel_tier1"
  | "hotel_tier2"
  | "hotel_tier3"
  | "garden_single"
  | "garden_package";

export interface PriceLine {
  kind: PriceLineKind;
  qty: number;
  unit: number;
  amount: number;
  packageCode?: GardenPackageCode;
}

export interface Quote {
  days: string[];
  lines: PriceLine[];
  total: number;
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  note: string;
  paidOn: string;
  recordedBy: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  ref: string;
  createdAt: string;
  status: BookingStatus;
  service: ServiceCode;
  days: string[];
  checkIn: string;
  checkOut: string;
  gardenPackage: GardenPackageCode | null;
  arrivalTime: string;
  departureTime: string;
  dog: DogInfo;
  owner: OwnerInfo;
  walk: boolean;
  notes: string;
  photoConsent: boolean;
  locale: Locale;
  basePrice: number;
  discountPct: number;
  total: number;
  priceLines: PriceLine[];
  invoiceSentAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  payments: Payment[];
}

export interface DayAvailability {
  date: string;
  booked: number;
  capacity: number;
}

export type AdminRole = "director" | "manager";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
}

export type BookingErrorCode =
  | "invalid"
  | "past_date"
  | "too_far"
  | "bad_range"
  | "bad_package_days"
  | "service_inactive"
  | "full";

export type QuoteResult =
  | { ok: true; quote: Quote; minFree: number }
  | { ok: false; error: BookingErrorCode; fullDays?: string[] };

export type CreateBookingResult =
  | { ok: true; ref: string; total: number; days: string[] }
  | { ok: false; error: BookingErrorCode; fullDays?: string[] };
