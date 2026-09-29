import { useRef, useState } from "react";
import { Car, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import type { VehiclePhoto } from "@/components/VehicleGallery";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

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
  onOpen,
}: {
  photo: VehiclePhoto;
  loading: boolean;
  overlay?: string | null | undefined;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const show = !!photo.url && !failed;

  return (
    <div className="relative aspect-[16/10] w-full shrink-0 snap-center bg-muted">
      {show ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Agrandir : ${photo.label}`}
          className="group/photo relative block size-full cursor-zoom-in"
        >
          <img
            src={photo.url!}
            alt={photo.label}
            decoding="async"
            draggable={false}
            onError={() => setFailed(true)}
            className="size-full object-cover"
          />
          <span className="pointer-events-none absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white opacity-90 backdrop-blur-sm transition group-hover/photo:bg-black/70">
            <Maximize2 className="size-3" aria-hidden /> Agrandir
          </span>
          {overlay ? (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-4 pt-10 pb-2.5 text-left text-[12px] font-semibold text-white">
              {overlay}
            </span>
          ) : null}
        </button>
      ) : loading ? (
        <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
          <Car className="size-7" aria-hidden />
          <p className="text-[11px] font-semibold">Photo bientôt disponible</p>
        </div>
      )}
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
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
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

  const moveLightbox = (offset: number) =>
    setLightboxIndex((current) => (current + offset + slides.length) % slides.length);

  return (
    <>
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
          {slides.map((p, photoIndex) => (
            <Frame
              key={p.key}
              photo={p}
              loading={loading}
              overlay={overlay}
              onOpen={() => {
                setLightboxIndex(photoIndex);
                setLightboxOpen(true);
              }}
            />
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

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          onKeyDown={(event) => {
            if (slides.length < 2) return;
            if (event.key === "ArrowRight") moveLightbox(1);
            if (event.key === "ArrowLeft") moveLightbox(-1);
          }}
          className="!top-0 !left-0 h-[100dvh] w-screen !max-w-none !translate-x-0 !translate-y-0 border-0 bg-black p-0 text-white sm:rounded-none [&>button]:top-[max(1rem,env(safe-area-inset-top))] [&>button]:right-4 [&>button]:z-20 [&>button]:grid [&>button]:size-11 [&>button]:place-items-center [&>button]:rounded-full [&>button]:bg-white/15 [&>button]:text-white [&>button]:opacity-100 [&>button_svg]:size-5"
        >
          <DialogTitle className="sr-only">{slides[lightboxIndex]?.label}</DialogTitle>
          <div className="relative flex size-full items-center justify-center px-3 py-16 sm:px-16">
            {slides[lightboxIndex]?.url ? (
              <img
                src={slides[lightboxIndex].url!}
                alt={slides[lightboxIndex].label}
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            ) : null}

            {slides.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Photo précédente"
                  onClick={() => moveLightbox(-1)}
                  className="absolute left-3 grid size-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25 sm:left-6"
                >
                  <ChevronLeft className="size-6" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Photo suivante"
                  onClick={() => moveLightbox(1)}
                  className="absolute right-3 grid size-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25 sm:right-6"
                >
                  <ChevronRight className="size-6" aria-hidden />
                </button>
              </>
            ) : null}

            <div className="absolute inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] text-center">
              <p className="text-sm font-semibold">{slides[lightboxIndex]?.label}</p>
              {slides.length > 1 ? (
                <p className="mt-1 text-xs text-white/65">
                  {lightboxIndex + 1} / {slides.length}
                </p>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
