import { MapPin } from "lucide-react";

/** Carte trajet : départ et arrivée toujours entièrement lisibles. */
export function TrackingRouteCard({ pickup, dropoff }: { pickup: string; dropoff: string }) {
  return (
    <section className="motion-safe:animate-fade-in rounded-3xl border border-border bg-card p-[clamp(1rem,4vw,1.35rem)]">
      <h2 className="text-sm font-semibold">Votre trajet</h2>

      <div className="mt-3 flex items-start gap-3">
        <span className="mt-1.5 block size-3 shrink-0 rounded-full bg-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Départ</p>
          <p className="text-sm leading-snug font-medium [overflow-wrap:anywhere]">{pickup}</p>
        </div>
      </div>

      <div aria-hidden className="my-1 ml-[6px] h-5 border-l border-dashed border-border" />

      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Arrivée</p>
          <p className="text-sm leading-snug font-medium [overflow-wrap:anywhere]">{dropoff}</p>
        </div>
      </div>
    </section>
  );
}
