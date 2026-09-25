import { useRef, useState } from "react";
import { Car, ChevronLeft, ChevronRight } from "lucide-react";
import type { VehiclePhoto } from "@/components/VehicleGallery";

/**
 * Galerie véhicule immersive de la fiche publique.
 *
 * RÈGLE CRITIQUE ReLink : les photos du véhicule restent toujours rendues,
 * même sans photo disponible (emplacement neutre, jamais d'image générique).
 * Le bloc est volontairement sans titre : la photo est l'élément principal.
 */
function Frame({
  photo,
  loading,
  overlay,
}: {
  photo: VehiclePhoto;
  loading: boolean;
  overlay?: string | null | undefined;
}) {
  const [failed, setFailed] = useState(false);
  const show = !!photo.url && !failed;

  return (
    <div className="relative aspect-[16/10] w-full shrink-0 snap-center bg-muted">
      {show ? (
        <img
          src={photo.url!}
          alt={photo.label}
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="size-full cursor-default object-cover"
        />
      ) : loading ? (
        <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
          <Car className="size-7" aria-hidden />
          <p className="text-[11px] font-semibold">Photo bientôt disponible</p>
        </div>
      )}
      {show && overlay ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-4 pt-10 pb-2.5 text-[12px] font-semibold text-white">
          {overlay}
        </span>
      ) : null}
    </div>
  );
}

export function VehicleShowcase({
  photos,
  loading = false,
  overlay,
}: {
  photos: VehiclePhoto[];
  loading?: boolean;
  overlay?: string | null | undefined;
}) {
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const list = photos.filter((p) => !!p.url);
  const slides = list.length ? list : photos.slice(0, 1);

  const goTo = (i: number) => {
    const el = ref.current;
    if (!el || slides.length < 2) return;
    const next = (i + slides.length) % slides.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setIndex(next);
  };

  const arrowClass =
    "absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/35 text-white shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-white [@media(hover:hover)_and_(pointer:fine)]:grid";

  return (
    <section
      aria-label="Photos du véhicule"
      aria-roledescription="carrousel"
      tabIndex={slides.length > 1 ? 0 : undefined}
      onKeyDown={(e) => {
        if (slides.length < 2) return;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          goTo(index + 1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          goTo(index - 1);
        }
      }}
      className="relative overflow-hidden rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (i !== index) setIndex(i);
        }}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((p) => (
          <Frame key={p.key} photo={p} loading={loading} overlay={overlay} />
        ))}
      </div>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Photo précédente"
            onClick={() => goTo(index - 1)}
            className={`${arrowClass} left-3`}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Photo suivante"
            onClick={() => goTo(index + 1)}
            className={`${arrowClass} right-3`}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>

          <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
            {Math.min(index + 1, slides.length)} / {slides.length}
          </span>
          <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex items-center justify-center gap-1.5">
            {slides.map((p, i) => (
              <span
                key={p.key}
                className={`size-1.5 rounded-full transition-all ${
                  i === index ? "w-4 bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
