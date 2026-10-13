import { adminBackend } from "@/lib/server/backend";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function SettingsPage() {
  const settings = await adminBackend().getSettings();
  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold text-forest">პარამეტრები</h1>
      <p className="mb-4 text-xs text-muted-foreground">სერვისები, ფასები, ადგილები და ინვოისის მონაცემები. ცვლილება მაშინვე აისახება ჯავშნის გვერდზე; არსებული ჯავშნების ფასი არ იცვლება.</p>
      <SettingsForm initial={settings} />
    </div>
  );
}
