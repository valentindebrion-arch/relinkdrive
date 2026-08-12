import { useMemo, useState } from "react";
import { Car, Check, MapPin, QrCode, Search, Star, UserPlus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type DriverOption = {
  id: string;
  name: string;
  available: boolean;
  vehicle: string | null;
  zone: string | null;
  favorite: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drivers: DriverOption[];
  loading: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onScanQr: () => void;
  onAddDriver: () => void;
};

type Filter = "all" | "available" | "favorite";

export function DriverPickerSheet({
  open,
  onOpenChange,
  drivers,
  loading,
  selectedId,
  onSelect,
  onScanQr,
  onAddDriver,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drivers.filter((d) => {
      if (filter === "available" && !d.available) return false;
      if (filter === "favorite" && !d.favorite) return false;
      if (!q) return true;
      return [d.name, d.vehicle, d.zone].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [drivers, filter, query]);

  const showTools = drivers.length > 3;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] flex-col rounded-t-[28px] p-0 sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader className="px-5 pt-5 pb-3">
          <SheetTitle className="text-[19px] font-extrabold tracking-tight">
            Votre chauffeur
          </SheetTitle>
          <p className="text-[13px] text-muted-foreground">
            Choisissez un chauffeur de votre carnet Relink.
          </p>
        </SheetHeader>

        {showTools ? (
          <div className="space-y-2.5 px-5 pb-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Rechercher un chauffeur"
                placeholder="Rechercher un chauffeur"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-11 rounded-2xl border-0 bg-muted pl-10 text-[15px]"
              />
            </div>
            <div className="flex gap-2">
              {(
                [
                  { key: "all", label: "Tous" },
                  { key: "available", label: "Disponibles" },
                  { key: "favorite", label: "Favoris" },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "h-9 rounded-full px-3.5 text-[13px] font-bold transition-colors",
                    filter === f.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
        >
          {loading ? (
            <div className="space-y-2.5 py-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[76px] animate-pulse rounded-3xl bg-muted" />
              ))}
            </div>
          ) : drivers.length === 0 ? (
            <div className="py-4 text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="size-7" />
              </span>
              <p className="mt-3 text-[17px] font-extrabold">Aucun chauffeur enregistré</p>
              <p className="mx-auto mt-1 max-w-xs text-[13.5px] leading-snug text-muted-foreground">
                Ajoutez un chauffeur grâce à son QR code ou à son lien personnel avant de demander
                une course.
              </p>
              <div className="mt-4 space-y-2.5">
                <Button className="h-12 w-full rounded-2xl font-bold" onClick={onScanQr}>
                  <QrCode className="size-4" /> Scanner un QR code
                </Button>
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-2xl font-bold"
                  onClick={onAddDriver}
                >
                  <UserPlus className="size-4" /> Ajouter un chauffeur
                </Button>
              </div>
            </div>
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-[13.5px] text-muted-foreground">
              Aucun chauffeur ne correspond à cette recherche.
            </p>
          ) : (
            <ul className="space-y-2.5 pb-2">
              {list.map((d) => {
                const active = d.id === selectedId;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(d.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-3xl p-3.5 text-left transition-all",
                        active
                          ? "bg-primary/8 ring-2 ring-primary"
                          : "bg-card shadow-[0_10px_30px_-26px_rgba(0,0,0,0.5)]",
                      )}
                    >
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[15px] font-bold text-primary">
                        {d.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[15.5px] font-bold">{d.name}</span>
                          {d.favorite ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                              <Star className="size-3" /> Favori
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block text-[12.5px] font-bold",
                            d.available ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {d.available ? "Disponible maintenant" : "Hors service actuellement"}
                        </span>
                        {d.vehicle ? (
                          <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                            <Car className="size-3.5 shrink-0" />
                            <span className="truncate">{d.vehicle}</span>
                          </span>
                        ) : null}
                        {d.zone ? (
                          <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                            <MapPin className="size-3.5 shrink-0" />
                            <span className="truncate">{d.zone}</span>
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                          active ? "bg-primary text-primary-foreground" : "bg-muted text-primary",
                        )}
                        aria-hidden
                      >
                        {active ? <Check className="size-4" /> : "→"}
                      </span>
                      <span className="sr-only">Choisir {d.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
