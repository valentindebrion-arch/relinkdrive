import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Armchair, Briefcase, Car, Dog, Luggage, Users } from "lucide-react";

/**
 * Caractéristiques du véhicule du chauffeur sélectionné.
 * Source de vérité unique : la ligne `vehicles` du véhicule actif, exactement
 * celle utilisée par la fiche publique et par le moteur de compatibilité.
 * Aucune valeur n'est déduite : une donnée absente affiche « Non renseigné ».
 */
export type VehicleFactsData = {
  vehicleId: string | null;
  exteriorPhotoPath: string | null;
  exteriorPhotoUrl: string | null;
  interiorPhotoPath: string | null;
  interiorPhotoUrl: string | null;
  maxPassengers: number | null;
  largeLuggage: number | null;
  cabinLuggage: number | null;
  petsPolicy: "accepted" | "refused" | "conditional" | null;
  equipment: string[];
};

const UNKNOWN = "Non renseigné";

function petsLabel(policy: VehicleFactsData["petsPolicy"]) {
  if (policy === "accepted") return "Animaux acceptés";
  if (policy === "conditional") return "Animaux sous conditions";
  if (policy === "refused") return "Animaux non acceptés";
  return `Animaux : ${UNKNOWN.toLowerCase()}`;
}

function ExteriorPhoto({
  imageKey,
  url,
  alt,
  loading,
}: {
  imageKey: string;
  url: string | null;
  alt: string;
  loading: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setReady(!!(ref.current?.complete && ref.current.naturalWidth > 0));
    setFailed(false);
  }, [imageKey, url]);

  const show = !!url && !failed;

  return (
    <div className="vehicle-media bg-muted shadow-[0_6px_18px_-16px_rgba(0,0,0,0.5)]">
      {loading && !ready ? (
        <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
      ) : show ? (
        <>
          {!ready ? <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden /> : null}
          <img
            key={imageKey}
            ref={(el) => {
              ref.current = el;
              if (el?.complete && el.naturalWidth > 0) setReady(true);
            }}
            src={url}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setReady(true)}
            onError={() => setFailed(true)}
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-3 pt-6 pb-1.5 text-[11px] font-semibold text-white">
            Extérieur du véhicule
          </span>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center text-muted-foreground">
          <Car className="size-6" aria-hidden />
          <p className="text-[11px] leading-tight font-semibold">Extérieur non renseigné</p>
        </div>
      )}
    </div>
  );
}

function InteriorPhoto({
  imageKey,
  url,
  alt,
  loading,
}: {
  imageKey: string;
  url: string | null;
  alt: string;
  loading: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setReady(!!(ref.current?.complete && ref.current.naturalWidth > 0));
    setFailed(false);
  }, [imageKey, url]);

  const show = !!url && !failed;

  return (
    <div className="vehicle-media bg-muted shadow-[0_6px_18px_-16px_rgba(0,0,0,0.5)]">
      {loading && !ready ? (
        <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
      ) : show ? (
        <>
          {!ready ? <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden /> : null}
          <img
            key={imageKey}
            ref={(el) => {
              ref.current = el;
              if (el?.complete && el.naturalWidth > 0) setReady(true);
            }}
            src={url}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setReady(true)}
            onError={() => setFailed(true)}
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-3 pt-6 pb-1.5 text-[11px] font-semibold text-white">
            Intérieur du véhicule
          </span>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center text-muted-foreground">
          <Armchair className="size-6" aria-hidden />
          <p className="text-[11px] leading-tight font-semibold">Intérieur non renseigné</p>
        </div>
      )}
    </div>
  );
}


function Fact({ icon: Icon, main, sub }: { icon: typeof Users; main: string; sub?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className="size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <p className="text-[12px] leading-tight font-bold break-words">{main}</p>
        {sub ? (
          <p className="text-[11px] leading-tight break-words text-muted-foreground">{sub}</p>
        ) : null}
      </div>
    </div>
  );
}

export function VehicleFacts({
  facts,
  driverSlug,
  driverKey,
  anim,
  loading,
}: {
  facts: VehicleFactsData | null;
  driverSlug: string | null;
  driverKey: string;
  anim: string;
  loading: boolean;
}) {
  const badges = facts?.equipment ?? [];
  const visible = badges.slice(0, 3);
  const extra = badges.length - visible.length;

  return (
    <section className="home-rise min-w-0" style={{ animationDelay: "140ms" }}>
      <p className="mb-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
        Le véhicule
      </p>
      <div key={driverKey} className={`flex min-w-0 max-w-full flex-col gap-2 ${anim}`}>
        <ExteriorPhoto
          imageKey={`${driverKey}:${facts?.vehicleId ?? "no-vehicle"}:${facts?.exteriorPhotoPath ?? "no-photo"}`}
          url={facts?.exteriorPhotoUrl ?? null}
          alt="Extérieur du véhicule"
          loading={loading}
        />
        <InteriorPhoto
          imageKey={`${driverKey}:${facts?.vehicleId ?? "no-vehicle"}:${facts?.interiorPhotoPath ?? "no-photo"}`}
          url={facts?.interiorPhotoUrl ?? null}
          alt="Intérieur du véhicule"
          loading={loading}
        />

        <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-primary/25 bg-card p-3 shadow-[0_6px_18px_-16px_rgba(0,0,0,0.5)]">

            <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 [overflow-wrap:anywhere] max-[300px]:grid-cols-1">
              <Fact
                icon={Users}
                main={facts?.maxPassengers != null ? `${facts.maxPassengers} places` : UNKNOWN}
                sub={facts?.maxPassengers != null ? "maximum" : "Passagers"}
              />
              <Fact
                icon={Luggage}
                main={facts?.largeLuggage != null ? `${facts.largeLuggage} grands` : UNKNOWN}
                sub="bagages"
              />
              <Fact
                icon={Briefcase}
                main={facts?.cabinLuggage != null ? `${facts.cabinLuggage} bagages` : UNKNOWN}
                sub="cabine"
              />
              <Fact icon={Dog} main={petsLabel(facts?.petsPolicy ?? null)} />
            </div>

            {visible.length ? (
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                {visible.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[11px] leading-tight font-semibold text-primary"
                  >
                    {label}
                  </span>
                ))}
                {extra > 0 ? (
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    + {extra} équipement{extra > 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="flex min-w-0 flex-wrap items-center justify-between gap-1">
              {facts && facts.maxPassengers == null ? (
                <p className="min-w-0 text-[11px] leading-tight text-muted-foreground">
                  Fiche véhicule à compléter par le chauffeur.
                </p>
              ) : (
                <span />
              )}
              {driverSlug ? (
                <Link
                  to="/chauffeur/$slug"
                  params={{ slug: driverSlug }}
                  className="shrink-0 text-[12px] font-bold text-primary underline underline-offset-2"
                >
                  Voir les détails
                </Link>
              ) : null}
            </div>
        </div>
      </div>

    </section>
  );

}

/** Libellés d'équipements réellement renseignés sur le véhicule actif. */
export const EQUIPMENT_LABELS: { key: string; label: string }[] = [
  { key: "child_seat", label: "Siège bébé" },
  { key: "booster_seat", label: "Rehausseur" },
  { key: "stroller_space", label: "Poussette" },
  { key: "accessible", label: "Accessible PMR" },
  { key: "chargers", label: "Chargeurs" },
  { key: "air_conditioning", label: "Climatisation" },
  { key: "water", label: "Bouteilles d'eau" },
  { key: "card_payment", label: "Paiement carte" },
  { key: "quiet_ride", label: "Trajet silencieux" },
  { key: "luggage_help", label: "Aide aux bagages" },
  { key: "large_trunk", label: "Grand coffre" },
];
