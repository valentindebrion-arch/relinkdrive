import { Link } from "@tanstack/react-router";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, INVOICE_LABELS, formatDateTime, formatEuro } from "@/lib/labels";

export type RideRow = {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  scheduled_at: string;
  price: number | string | null;
  status: string;
};

export type InvoiceRow = { ride_id: string | null; number: string; status: string };

export function RideCard({ ride, invoice }: { ride: RideRow; invoice?: InvoiceRow | undefined }) {
  return (
    <Link
      to="/espace/suivi/$id"
      params={{ id: ride.id }}
      className="surface flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="min-w-0">
        <p className="font-medium break-words">
          {ride.pickup_address} → {ride.dropoff_address}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatDateTime(ride.scheduled_at)}
          {ride.price ? ` · ${formatEuro(Number(ride.price))}` : ""}
        </p>
        {invoice ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Facture {invoice.number} — <StatusBadge status={invoice.status} labels={INVOICE_LABELS} />
          </p>
        ) : null}
      </div>
      <StatusBadge status={ride.status} labels={RIDE_STATUS_LABELS} />
    </Link>
  );
}
