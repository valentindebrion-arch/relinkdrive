import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Clock,
  Flag,
  Loader2,
  LocateFixed,
  MapPin,
  Route as RouteIcon,
} from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";
import { estimateRoute, priceForKm, reverseGeocode } from "@/lib/route-estimate.functions";
import { fetchRideQuote } from "@/lib/tax-queries";

export type TripEstimate = {
  pickup: string;
  dropoff: string;
  distanceKm: number;
  durationMin: number;
  priceTtc: number;
};

function money(v: number) {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

/**
 * Estimateur de trajet de la fiche publique : le client saisit départ et
 * destination, le tarif du chauffeur concerné est calculé automatiquement.
 */
export function TripEstimator({
  driverId,
  firstName,
  onRequest,
  autoLocate = false,
}: {
  driverId: string;
  firstName: string;
  onRequest: (estimate: TripEstimate) => void;
  /** Renseigne automatiquement le départ si la géolocalisation est déjà autorisée. */
  autoLocate?: boolean;
}) {
  const estimateFn = useServerFn(estimateRoute);
  const geocodeFn = useServerFn(reverseGeocode);

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupOk, setPickupOk] = useState(false);
  const [dropoffOk, setDropoffOk] = useState(false);
  const [locating, setLocating] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<TripEstimate | null>(null);

  useEffect(() => {
    if (!pickupOk || !dropoffOk || !pickup || !dropoff) {
      setResult(null);
      setState("idle");
      return;
    }
    let cancelled = false;
    setState("loading");
    void (async () => {
      try {
        const res = await estimateFn({ data: { origin: pickup, destination: dropoff } });
        let ttc = priceForKm(res.distanceKm).total;
        try {
          const quote = await fetchRideQuote({
            driverId,
            distanceKm: res.distanceKm,
            roundTrip: false,
          });
          if (quote) ttc = quote.amount_ttc;
        } catch {
          /* tarif public de repli */
        }
        if (cancelled) return;
        setResult({
          pickup,
          dropoff,
          distanceKm: res.distanceKm,
          durationMin: res.durationMin,
          priceTtc: ttc,
        });
        setState("idle");
      } catch {
        if (cancelled) return;
        setResult(null);
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, pickupOk, dropoffOk, driverId, estimateFn]);

  async function locateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await geocodeFn({
            data: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
          setPickup(res.address);
          setPickupOk(true);
        } catch {
          /* position non résolue */
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // Départ pré-rempli avec la position lorsque l'autorisation est déjà accordée.
  useEffect(() => {
    if (!autoLocate || pickup || typeof navigator === "undefined") return;
    const perms = navigator.permissions;
    if (!perms?.query) return;
    let cancelled = false;
    void perms
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (!cancelled && status.state === "granted") void locateMe();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLocate]);

  const ready = pickupOk && dropoffOk && !!pickup && !!dropoff;

  return (
    <section id="estimation" className="surface scroll-mt-4 border-primary/30 p-5 shadow-sm">
      <h2 className="text-lg font-black tracking-tight">Estimer mon trajet</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Indiquez votre départ et votre destination pour connaître le tarif de {firstName}.
      </p>


      <div className="mt-4 space-y-2">
        <AddressAutocomplete
          value={pickup}
          confirmed={pickupOk}
          placeholder="Adresse de départ"
          ariaLabel="Adresse de départ"
          icon={<MapPin className="size-4" />}
          onChange={(v) => {
            setPickup(v);
            setPickupOk(false);
          }}
          onConfirm={(v) => {
            setPickup(v);
            setPickupOk(true);
          }}
        />
        <button
          type="button"
          onClick={() => void locateMe()}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition active:scale-95"
        >
          {locating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <LocateFixed className="size-3.5 text-primary" />
          )}
          Ma position actuelle
        </button>
        <AddressAutocomplete
          value={dropoff}
          confirmed={dropoffOk}
          placeholder="Où souhaitez-vous aller ?"
          ariaLabel="Destination"
          icon={<Flag className="size-4" />}
          onChange={(v) => {
            setDropoff(v);
            setDropoffOk(false);
          }}
          onConfirm={(v) => {
            setDropoff(v);
            setDropoffOk(true);
          }}
        />
      </div>

      {state === "loading" ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> Calcul de votre trajet…
        </div>
      ) : state === "error" ? (
        <p className="mt-4 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Impossible de calculer ce trajet. Vérifiez les adresses saisies.
        </p>
      ) : result ? (
        <div className="animate-fade-in mt-4 space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <span className="truncate">{result.pickup.split(",")[0]}</span>
              <ArrowRight className="size-4 shrink-0 text-primary" />
              <span className="truncate">{result.dropoff.split(",")[0]}</span>
            </p>
            <p className="mt-1.5 flex items-center gap-3 text-[13px] font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <RouteIcon className="size-3.5" /> {Math.round(result.distanceKm)} km
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" /> {duration(result.durationMin)}
              </span>
            </p>
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Prix estimé pour ce trajet avec {firstName}
              </p>
              <p className="text-3xl font-black tracking-tight text-primary">
                {money(result.priceTtc)}
                <span className="ml-1 text-sm font-bold text-muted-foreground">TTC</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Estimation basée sur le tarif de {firstName}. Le montant définitif est confirmé lors
                de l'acceptation de la course.
              </p>
            </div>
          </div>

          <Button className="h-13 w-full text-base" onClick={() => onRequest(result)}>
            Demander ce trajet · {money(result.priceTtc)} TTC
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : (
        <Button className="mt-4 h-12 w-full text-base" disabled={!ready}>
          Estimer mon trajet
          <ArrowRight className="size-4" />
        </Button>
      )}
    </section>
  );
}
