import { useState } from "react";
import { Car, ImageOff } from "lucide-react";

export type VehiclePhoto = {
  /** Identifiant stable de la photo (chemin de stockage ou libellé). */
  key: string;
  url: string | null;
  label: string;
};

/**
 * Galerie photos du véhicule (extérieur / intérieur).
 *
 * RÈGLE CRITIQUE ReLink : cette section est TOUJOURS rendue sur un profil
 * chauffeur, même sans photo disponible ou pendant le chargement. Elle ne doit
 * jamais être masquée par une refonte d'interface, un changement de forfait
 * (Gratuit / Pro) ou un chargement partiel des données. Si une photo échoue,
 * seule cette vignette affiche un repère : les autres restent visibles.
 */
function Slide({ photo, loading }: { photo: VehiclePhoto; loading: boolean }) {
  const [failed, setFailed] = useState(false);
  const show = !!photo.url && !failed;

  return (
    <figure className="w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-muted/30 sm:w-[calc(50%-0.375rem)]">
      <div className="relative aspect-[4/3] w-full bg-muted">
        {show ? (
          <img
            src={photo.url!}
            alt={photo.label}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailed(true)}
            className="size-full cursor-default object-cover"
          />
        ) : loading ? (
          <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
            {failed ? (
              <ImageOff className="size-6" aria-hidden />
            ) : (
              <Car className="size-6" aria-hidden />
            )}
            <p className="text-[11px] font-semibold">
              {failed ? "Photo indisponible" : "Bientôt disponible"}
            </p>
          </div>
        )}
      </div>
      <figcaption className="px-3 py-2 text-xs text-muted-foreground">{photo.label}</figcaption>
    </figure>
  );
}

export function VehicleGallery({
  photos,
  loading = false,
  title = "Photos du véhicule",
}: {
  photos: VehiclePhoto[];
  loading?: boolean;
  title?: string;
}) {
  const hasAny = photos.some((p) => !!p.url);

  return (
    <section className="surface p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div
        className="mt-3 -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
      >
        {photos.map((p) => (
          <Slide key={p.key} photo={p} loading={loading} />
        ))}
      </div>
      {!hasAny && !loading ? (
        <p className="mt-2 text-xs text-muted-foreground">Photos du véhicule bientôt disponibles</p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Faites défiler pour voir toutes les photos.
        </p>
      )}
    </section>
  );
}
