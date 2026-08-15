import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, MapPin, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, formatEuro } from "@/lib/labels";
import { CONFLICT_MESSAGE, parisDate, parisTime, relativeStart, type BoardRide } from "@/lib/driver-board";

function UpcomingCard({ ride, now }: { ride: BoardRide; now: Date }) {
  return (
    <Link
      to="/pro/courses/$rideId"
      params={{ rideId: ride.id }}
      className="surface tap-active block p-3 transition-colors hover:border-primary/40"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">
            {parisDate(ride.scheduled_at)} · {parisTime(ride.scheduled_at)}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold">{relativeStart(ride.scheduled_at, now)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          Programmée
        </span>
      </div>

      <p className="mt-2 truncate text-xs font-medium">{ride.client_label ?? "Client"}</p>
      <div className="mt-1 space-y-1 text-xs">
        <p className="flex items-start gap-1.5">
          <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
          <span className="min-w-0 flex-1 truncate">{ride.pickup_address}</span>
        </p>
        <p className="flex items-start gap-1.5">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">{ride.dropoff_address}</span>
        </p>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <StatusBadge status={ride.status} labels={RIDE_STATUS_LABELS} />
        <span className="flex items-center gap-1 text-xs font-semibold">
          {ride.price != null ? formatEuro(Number(ride.price)) : "Prix à définir"}
          <ChevronRight className="size-3.5 text-muted-foreground" />
        </span>
      </div>
    </Link>
  );
}

/** Section « Prochainement » : uniquement les courses programmées à plus d'une heure. */
export function UpcomingRides({
  rides,
  now,
  conflict = false,
}: {
  rides: BoardRide[];
  now: Date;
  conflict?: boolean;
}) {
  return (
    <section className="space-y-2">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold">Prochainement</h2>
        <p className="truncate text-[11px] text-muted-foreground">Vos prochaines courses programmées</p>
      </div>

      {conflict ? (
        <p className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs font-medium">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {CONFLICT_MESSAGE}
        </p>
      ) : null}

      {rides.length === 0 ? (
        <div className="surface grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3">
          <p className="truncate text-sm text-muted-foreground">Aucune course programmée prochainement.</p>
          <Link
            to="/pro/planning"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium"
          >
            <CalendarDays className="size-4" />
            Voir mon planning
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rides.map((r) => (
            <UpcomingCard key={r.id} ride={r} now={now} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Courses programmées imminentes masquées par une course flash active. */
export function FollowUpRides({ rides, now }: { rides: BoardRide[]; now: Date }) {
  if (rides.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">À suivre</h2>
      <p className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs font-medium">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        {CONFLICT_MESSAGE}
      </p>
      {rides.map((r) => (
        <UpcomingCard key={r.id} ride={r} now={now} />
      ))}
    </section>
  );
}
