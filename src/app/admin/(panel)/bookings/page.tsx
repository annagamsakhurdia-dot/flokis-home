import { todayInTbilisi } from "@/lib/domain/dates";
import { adminBackend } from "@/lib/server/backend";
import { BookingsList } from "@/components/admin/bookings-list";

export default async function BookingsPage() {
  const bookings = await adminBackend().listBookings();
  return (
    <div>
      <h1 className="mb-3 text-lg font-extrabold text-forest">ჯავშნები და გადახდები</h1>
      <BookingsList bookings={bookings} today={todayInTbilisi()} />
    </div>
  );
}
