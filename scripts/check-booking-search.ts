import assert from "node:assert/strict";
import type { Booking } from "../src/lib/domain/types";
import { matchesBookingQuery, tabForBooking, unpaidBookings, visibleBookings } from "../src/lib/admin/booking-search";

const today = "2026-10-15";

function booking(partial: Partial<Booking> & Pick<Booking, "id" | "status" | "service" | "owner" | "dog">): Booking {
  return {
    ref: "GR-TEST",
    createdAt: "2026-10-01T00:00:00.000Z",
    days: partial.days ?? ["2026-10-10"],
    checkIn: partial.checkIn ?? partial.days?.[0] ?? "2026-10-10",
    checkOut: partial.checkOut ?? partial.days?.[partial.days.length - 1] ?? "2026-10-10",
    gardenPackage: partial.service === "GARDEN" ? "SINGLE" : null,
    arrivalTime: "09:00",
    departureTime: "18:00",
    walk: false,
    notes: "",
    photoConsent: false,
    locale: "ka",
    basePrice: 45,
    discountPct: 0,
    total: 45,
    priceLines: [],
    invoiceSentAt: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectReason: null,
    payments: [],
    ...partial,
  };
}

const nanuka = booking({
  id: "nanuka",
  status: "approved",
  service: "GARDEN",
  days: ["2026-10-10"],
  dog: { name: "ჩარო", age: "", breed: "კორგი", sex: "female", sterilized: "", vaccines: "", deworming: "", vetClinic: "ვეტ", vetPhone: "599" },
  owner: { fullName: "ნანუკა ჟორჟოკუანი", phone: "555 98 76 54", email: "nanuka@example.com", emergencyContact: "" },
});

const current = booking({
  id: "current",
  status: "approved",
  service: "HOTEL",
  days: ["2026-10-15"],
  checkIn: "2026-10-15",
  checkOut: "2026-10-16",
  dog: { name: "ბეთა", age: "", breed: "", sex: "", sterilized: "", vaccines: "", deworming: "", vetClinic: "", vetPhone: "" },
  owner: { fullName: "ნინო კვარაცხელია", phone: "555 12 34 56", email: "nino@example.com", emergencyContact: "" },
  total: 65,
  payments: [{ id: "p", bookingId: "current", amount: 65, method: "bank_transfer", note: "", paidOn: "2026-10-15", recordedBy: "", createdAt: "" }],
});

assert.equal(tabForBooking(nanuka, today), "past");
assert.equal(matchesBookingQuery(nanuka, "ნანუკა"), true);
assert.equal(matchesBookingQuery(nanuka, "ჟორჟოკუანი"), true);
assert.equal(matchesBookingQuery(nanuka, "555987654"), true);
assert.equal(matchesBookingQuery(nanuka, "ჩარო"), true);
assert.equal(matchesBookingQuery(nanuka, "ბეთა"), false);

const onActive = visibleBookings([nanuka, current], { today, status: "active", service: "ALL", pay: "any", query: "" });
assert.deepEqual(onActive.map((b) => b.id), ["nanuka", "current"]);

const byOwner = visibleBookings([nanuka, current], { today, status: "pending", service: "HOTEL", pay: "paid", query: "ნანუკა" });
assert.deepEqual(byOwner.map((b) => b.id), ["nanuka"]);

const byPhone = visibleBookings([nanuka, current], { today, status: "active", service: "ALL", pay: "any", query: "555 98 76" });
assert.deepEqual(byPhone.map((b) => b.id), ["nanuka"]);

const opened = visibleBookings([nanuka, current], { today, status: "active", service: "ALL", pay: "any", query: "", openId: "nanuka" });
assert.ok(opened.some((b) => b.id === "nanuka"));

const paidPast = booking({
  id: "paid-past",
  status: "approved",
  service: "GARDEN",
  days: ["2026-10-01"],
  dog: { name: "მაქსი", age: "", breed: "", sex: "", sterilized: "", vaccines: "", deworming: "", vetClinic: "", vetPhone: "" },
  owner: { fullName: "გიორგი", phone: "555 00 00 00", email: "g@example.com", emergencyContact: "" },
  payments: [{ id: "p2", bookingId: "paid-past", amount: 45, method: "bank_transfer", note: "", paidOn: "2026-10-01", recordedBy: "", createdAt: "" }],
});
const withPaidPast = visibleBookings([nanuka, current, paidPast], { today, status: "active", service: "ALL", pay: "any", query: "" });
assert.deepEqual(withPaidPast.map((b) => b.id), ["nanuka", "current"]);

const owing = unpaidBookings([nanuka, current, paidPast]);
assert.deepEqual(owing.map((b) => b.id), ["nanuka"]);

console.log("booking-search checks ok");
