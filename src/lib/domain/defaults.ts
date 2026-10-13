import type { Settings } from "./types";

// Starting values come from the prototypes; staff edit them in /admin/settings.
export const DEFAULT_SETTINGS: Settings = {
  services: {
    HOTEL: { code: "HOTEL", active: true, capacity: 18, nameKa: "სასტუმრო", nameEn: "Hotel", nameUk: "Готель" },
    GARDEN: { code: "GARDEN", active: true, capacity: 5, nameKa: "ბაღი", nameEn: "Garden", nameUk: "Сад" },
  },
  hotel: { tier1: 65, tier2: 60, tier3: 50, month: 1200 },
  garden: { single: 45, p8: 320, p10: 375, p12: 420, month: 600 },
  business: {
    name: "ფლოკის სახლი",
    phone: "",
    address: "Tbilisi",
    bankName: "საქართველოს ბანკი (Bank of Georgia)",
    iban: "GE44BG0000000612766478",
    accountNumber: "510001200",
    recipient: "მიშა კაჭკაჭიშვილი",
    invoiceSenderEmail: "mikheilkachkachishvili@gmail.com",
    termsUrl: "",
  },
};
