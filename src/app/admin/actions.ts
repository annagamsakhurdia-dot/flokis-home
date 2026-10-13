"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { paymentSchema, settingsSchema } from "@/lib/domain/schemas";
import type { Settings } from "@/lib/domain/types";
import { adminBackend } from "@/lib/server/backend";
import { requireAdmin, signIn, signOut } from "@/lib/server/auth";
import { sendEmail } from "@/lib/server/email";
import { buildInvoiceEmail } from "@/lib/server/invoice";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const LOGIN_ERRORS = {
  invalid: "ელფოსტა ან პაროლი არასწორია.",
  not_admin: "ამ ანგარიშს ადმინისტრატორის წვდომა არ აქვს.",
  locked: "ძალიან ბევრი მცდელობა. სცადეთ 5 წუთში.",
} as const;

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "შეიყვანეთ ელფოსტა და პაროლი." };
  const res = await signIn(email, password);
  if (!res.ok) return { error: LOGIN_ERRORS[res.error] };
  redirect("/admin");
}

export async function logoutAction() {
  await signOut();
  redirect("/admin/login");
}

async function sendInvoice(bookingId: string): Promise<string> {
  const backend = adminBackend();
  const [booking, settings] = await Promise.all([backend.getBooking(bookingId), backend.getSettings()]);
  if (!booking) throw new Error("Booking not found");
  const sent = await sendEmail(buildInvoiceEmail(booking, settings), settings.business.invoiceSenderEmail);
  await backend.markInvoiceSent(bookingId);
  return sent.transport === "mock" ? `ინვოისი „გაიგზავნა“ (სატესტო რეჟიმი) → ${booking.owner.email}` : `ინვოისი გაიგზავნა → ${booking.owner.email}`;
}

export async function approveAction(bookingId: string, discountPct: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  const discount = z.number().int().min(0).max(50).safeParse(discountPct);
  if (!discount.success) return { ok: false, error: "ფასდაკლება უნდა იყოს 0–50%." };
  const booking = await adminBackend().approveBooking(bookingId, discount.data, admin);
  if (!booking) return { ok: false, error: "ჯავშანი ვერ მოიძებნა ან უკვე განხილულია." };
  let message = "ჯავშანი დადასტურდა.";
  try {
    message += " " + (await sendInvoice(bookingId));
  } catch (err) {
    console.error("Invoice email failed", err);
    message += " ინვოისის გაგზავნა ვერ მოხერხდა — სცადეთ ხელახლა ჯავშნების გვერდიდან.";
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message };
}

export async function rejectAction(bookingId: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const booking = await adminBackend().rejectBooking(bookingId, reason.trim().slice(0, 300), admin);
  if (!booking) return { ok: false, error: "ჯავშანი ვერ მოიძებნა ან უკვე განხილულია." };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "ჯავშანი უარყოფილია." };
}

export async function resendInvoiceAction(bookingId: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const message = await sendInvoice(bookingId);
    revalidatePath("/admin", "layout");
    return { ok: true, message };
  } catch (err) {
    console.error("Invoice email failed", err);
    return { ok: false, error: "ინვოისის გაგზავნა ვერ მოხერხდა." };
  }
}

export async function addPaymentAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "შეამოწმეთ თანხა და თარიღი." };
  if (parsed.data.method === "barter" && !parsed.data.note) return { ok: false, error: "ბარტერისთვის მიუთითეთ აღწერა." };
  await adminBackend().addPayment(parsed.data, admin);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "გადახდა დაემატა." };
}

export async function deletePaymentAction(paymentId: string): Promise<ActionResult> {
  await requireAdmin();
  await adminBackend().deletePayment(z.string().min(1).parse(paymentId));
  revalidatePath("/admin", "layout");
  return { ok: true, message: "გადახდა წაიშალა." };
}

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `შეამოწმეთ ველი: ${issue?.path.join(" → ") ?? ""}` };
  }
  const d = parsed.data;
  const settings: Settings = {
    ...d,
    services: {
      HOTEL: { code: "HOTEL", ...d.services.HOTEL },
      GARDEN: { code: "GARDEN", ...d.services.GARDEN },
    },
  };
  await adminBackend().saveSettings(settings);
  revalidatePath("/", "layout");
  return { ok: true, message: "პარამეტრები შენახულია." };
}
