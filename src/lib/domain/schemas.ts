import { z } from "zod";
import { GARDEN_PACKAGES, LOCALES, PAYMENT_METHODS, SERVICES } from "./types";

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);

export const serviceSelectionSchema = z.object({
  service: z.enum(SERVICES),
  checkIn: isoDate.optional(),
  checkOut: isoDate.optional(),
  gardenPackage: z.enum(GARDEN_PACKAGES).optional(),
  gardenDays: z.array(isoDate).max(31).optional(),
});

export const bookingRequestSchema = serviceSelectionSchema
  .extend({
    arrivalTime: time,
    departureTime: time,
    dog: z.object({
      name: required(80),
      age: text(40),
      breed: text(80),
      sex: z.enum(["", "male", "female"]),
      sterilized: z.enum(["", "yes", "no"]),
      vaccines: text(500),
      deworming: text(500),
      vetClinic: required(120),
      vetPhone: required(40),
    }),
    owner: z.object({
      fullName: required(120),
      phone: required(40),
      email: z.string().trim().max(160).pipe(z.email()),
      emergencyContact: text(160),
    }),
    walk: z.boolean(),
    notes: text(1500),
    photoConsent: z.boolean(),
    termsAccepted: z.literal(true),
    locale: z.enum(LOCALES),
  });

export const paymentSchema = z.object({
  bookingId: z.string().min(1),
  amount: z.coerce.number().positive().max(100_000),
  method: z.enum(PAYMENT_METHODS),
  note: text(300),
  paidOn: isoDate,
});

const money = z.coerce.number().min(0).max(100_000);
const capacity = z.coerce.number().int().min(0).max(500);
const serviceSettings = z.object({
  active: z.boolean(),
  capacity,
  nameKa: required(40),
  nameEn: required(40),
  nameUk: required(40),
});

export const settingsSchema = z.object({
  services: z.object({ HOTEL: serviceSettings, GARDEN: serviceSettings }),
  hotel: z.object({ tier1: money, tier2: money, tier3: money, month: money }),
  garden: z.object({ single: money, p8: money, p10: money, p12: money, month: money }),
  business: z.object({
    name: required(80),
    phone: text(40),
    address: text(200),
    bankName: text(80),
    iban: text(40),
    accountNumber: text(40),
    recipient: text(120),
    invoiceSenderEmail: z.union([z.literal(""), z.email()]),
    termsUrl: z.union([z.literal(""), z.url()]),
  }),
});
