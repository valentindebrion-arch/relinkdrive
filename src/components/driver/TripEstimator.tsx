import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Clock, Flag, Info, Loader2, LocateFixed, MapPin, Route as RouteIcon } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { estimateRoute, priceForKm, reverseGeocode } from "@/lib/route-estimate.functions";
import { supabase } from "@/integrations/supabase/client";
import { POSITIONING } from "@/lib/brand";

export type TripEstimate = {
  pickup: string;
  dropoff: string;
  distanceKm: number;
  durationMin: number;
  low: number;
  high: number;
};

function money(v: number) {
  return Math.round(v).toLocaleString("fr-FR") + " €";
}

function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

/**
 * Estimateur INDICATIF de la fiche publique.
 *
 * Il ne crée aucune demande et n'envoie rien au chauffeur : il calcule
 * seulement une fourchette à partir des informations tarifaires que le
 * chauffeur a lui-même renseignées.
 */
export function TripEstimator({
  slug,
  firstName,
  autoLocate = false,
}: {
  /** Identifiant public du chauffeur (utilisé pour lire sa grille tarifaire). */
  slug: string;
  firstName: string;
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

        // Grille tarifaire renseignée par le chauffeur ; repli sur un tarif de marché.
        let reference = priceForKm(res.distanceKm).total;
        try {
          const { data } = await supabase.rpc("get_public_driver_pricing", { _slug: slug });
          const t = data?.[0];
          if (t?.price_per_km) {
            const perKm = Number(t.price_per_km);
            const minimum = Number(t.minimum ?? 0);
            const pickupPct = Number(t.pickup_pct ?? 0);
            const raw = Math.max(minimum, res.distanceKm * perKm);
            reference = raw * (1 + pickupPct / 100);
          }
        } catch {
          /* tarif de repli conservé */
        }

        if (cancelled) return;
        setResult({
          pickup,
          dropoff,
          distanceKm: res.distanceKm,
          durationMin: res.durationMin,
          low: Math.max(5, Math.floor((reference * 0.9) / 5) * 5),
          high: Math.ceil((reference * 1.15) / 5) * 5,
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
  }, [pickup, dropoff, pickupOk, dropoffOk, slug, estimateFn]);

  async function locateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await geocodeFn({ data: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
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

  return (
    <section id="estimation" className="surface scroll-mt-4 border-primary/30 p-5 shadow-sm">
      <h2 className="text-lg font-black tracking-tight">Estimation indicative</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Indiquez un départ et une destination pour situer le positionnement tarifaire de {firstName}.
      </p>

      <div className="mt-4 space-y-2">
        <AddressAutocomplete
          value={pickup}
          confirmed={pickupOk}
          placeholder="Adresse de départ"
          ariaLabel="Adresse de départ"
          icon={<MapPin className="size-4" />}
          action={
            <button
              type="button"
              onClick={() => void locateMe()}
              disabled={locating}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground active:scale-95 disabled:opacity-60"
              aria-label="Utiliser ma position actuelle"
            >
              {locating ? (
                <Loader2 className="size-3.5 animate-spin text-primary" />
              ) : (
                <LocateFixed className="size-3.5 text-primary" />
              )}
              Position
            </button>
          }
          onChange={(v) => {
            setPickup(v);
            setPickupOk(false);
          }}
          onConfirm={(v) => {
            setPickup(v);
            setPickupOk(true);
          }}
        />
        <AddressAutocomplete
          value={dropoff}
          confirmed={dropoffOk}
          placeholder="Destination"
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
          <Loader2 className="size-4 animate-spin text-primary" /> Calcul de l'estimation…
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
              <p className="text-xs font-semibold text-muted-foreground">Estimation indicative</p>
              <p className="text-3xl font-black tracking-tight text-primary">
                {money(result.low)} – {money(result.high)}
              </p>
            </div>
          </div>

          <p className="flex gap-2 rounded-2xl bg-muted/50 px-3 py-2.5 text-[11.5px] leading-snug text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {POSITIONING.estimateDisclaimer}
          </p>
        </div>
      ) : null}
    </section>
  );
}
