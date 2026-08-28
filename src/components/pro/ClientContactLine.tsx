import { useState } from "react";
import { MessageSquare, Phone } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Nom réel du client, cliquable pour appeler ou envoyer un SMS.
 * Il n'existe pas de messagerie interne ReLink : uniquement tel: et sms:.
 * Le fallback « Client » n'est utilisé que si aucun nom n'est disponible.
 */
export function ClientContactLine({
  name,
  phone,
  compact = false,
}: {
  name: string | null;
  phone: string | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = name?.trim() || "Client";
  const tel = (phone ?? "").replace(/[^\d+]/g, "");

  if (!tel) {
    return (
      <span className="font-semibold">
        {compact ? null : <span className="font-normal text-muted-foreground">Client : </span>}
        {label}
      </span>
    );
  }

  return (
    <>
      <span>
        {compact ? null : <span className="text-muted-foreground">Client : </span>}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap-active font-semibold text-primary underline underline-offset-4"
        >
          {label}
        </button>
      </span>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="space-y-3">
          <SheetHeader>
            <SheetTitle className="text-base">{label}</SheetTitle>
          </SheetHeader>
          <a
            href={`tel:${tel}`}
            className="tap-active flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            <Phone className="mr-2 size-4" /> Appeler le client
          </a>
          <a
            href={`sms:${tel}`}
            className="tap-active flex w-full items-center justify-center rounded-lg border border-border px-4 py-3 text-sm font-semibold"
          >
            <MessageSquare className="mr-2 size-4" /> Envoyer un SMS
          </a>
        </SheetContent>
      </Sheet>
    </>
  );
}
