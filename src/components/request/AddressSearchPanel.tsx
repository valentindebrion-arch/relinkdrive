import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Clock3, Loader2, Map as MapIcon, MapPin, LocateFixed, X } from "lucide-react";
import { suggestAddresses } from "@/lib/route-estimate.functions";
import { MapPointPicker } from "@/components/request/MapPointPicker";

const RECENTS_KEY = "relink:recent-addresses";

export function readRecentAddresses(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list.filter((v) => typeof v === "string") as string[]) : [];
  } catch {
    return [];
  }
}

export function pushRecentAddress(address: string) {
  if (typeof window === "undefined" || !address.trim()) return;
  const next = [address, ...readRecentAddresses().filter((a) => a !== address)].slice(0, 5);
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}

type Suggestion = { full: string; main: string; secondary: string };

/**
 * Panneau de recherche d'adresse dédié (plein écran mobile, feuille sur grand écran).
 * Utilise le fournisseur d'adresses existant (Places via la passerelle).
 */
export function AddressSearchPanel({
  field,
  initialValue,
  locating,
  onUseMyLocation,
  onClose,
  onSelect,
}: {
  field: "pickup" | "dropoff";
  initialValue: string;
  locating: boolean;
  onUseMyLocation?: () => void;
  onClose: () => void;
  onSelect: (address: string) => void;
}) {
  const suggestFn = useServerFn(suggestAddresses);
  const [query, setQuery] = useState(initialValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pickingOnMap, setPickingOnMap] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recents = useRef<string[]>(readRecentAddresses()).current;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setItems([]);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await suggestFn({ data: { query: q } });
        if (!cancelled) {
          setItems(res.items);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, suggestFn]);

  const isPickup = field === "pickup";
  const title = isPickup ? "Lieu de départ" : "Destination";

  function choose(address: string) {
    pushRecentAddress(address);
    onSelect(address);
  }

  if (pickingOnMap) {
    return (
      <MapPointPicker
        title={title}
        onClose={() => setPickingOnMap(false)}
        onConfirm={(address) => choose(address)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-background sm:items-center sm:justify-end sm:bg-foreground/30">
      <div className="flex min-h-0 w-full flex-1 flex-col bg-background sm:max-h-[85dvh] sm:max-w-lg sm:flex-none sm:rounded-t-3xl">
        <div
          className="flex shrink-0 items-center gap-2 px-3 pb-3 sm:pt-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <button
            type="button"
            aria-label="Retour"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"
          >
            <ArrowLeft className="size-5" />
          </button>
          <p className="text-[15px] font-bold">{title}</p>
        </div>

        <div className="shrink-0 px-4">
          <div className="flex items-center gap-3 rounded-2xl bg-muted px-4">
            <span
              className={
                isPickup
                  ? "size-3 shrink-0 rounded-full bg-primary"
                  : "size-3 shrink-0 rounded-[4px] bg-foreground"
              }
            />
            <input
              ref={inputRef}
              aria-label={isPickup ? "Rechercher un lieu de départ" : "Rechercher une destination"}
              className="h-13 w-full bg-transparent text-[15px] font-medium outline-none placeholder:text-muted-foreground"
              placeholder={isPickup ? "Votre position ou une adresse" : "Rechercher une destination"}
              maxLength={160}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {loading ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : query ? (
              <button
                type="button"
                aria-label="Effacer"
                onClick={() => setQuery("")}
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          <div className="space-y-1">
            {isPickup && onUseMyLocation ? (
              <button
                type="button"
                onClick={onUseMyLocation}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors active:bg-muted"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {locating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LocateFixed className="size-4" />
                  )}
                </span>
                <span className="text-[15px] font-semibold text-primary">Utiliser ma position</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPickingOnMap(true)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors active:bg-muted"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <MapIcon className="size-4" />
              </span>
              <span className="text-[15px] font-semibold">Choisir sur la carte</span>
            </button>
          </div>

          {items.length > 0 ? (
            <ul className="mt-2 border-t border-border/60 pt-2">
              {items.map((s) => (
                <li key={s.full}>
                  <button
                    type="button"
                    onClick={() => choose(s.full)}
                    className="flex w-full items-start gap-3 rounded-2xl px-2 py-3 text-left transition-colors active:bg-muted"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold">
                        {s.main || s.full}
                      </span>
                      {s.secondary ? (
                        <span className="block truncate text-[13px] text-muted-foreground">
                          {s.secondary}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {!loading && query.trim().length >= 3 && items.length === 0 ? (
            <p className="mt-6 px-2 text-center text-[13px] text-muted-foreground">
              {failed
                ? "La recherche d'adresse est momentanément indisponible. Réessayez dans un instant."
                : "Aucune adresse trouvée. Vérifiez l'orthographe ou choisissez le point sur la carte."}
            </p>
          ) : null}

          {query.trim().length < 3 && recents.length > 0 ? (
            <div className="mt-2 border-t border-border/60 pt-3">
              <p className="px-2 pb-1 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
                Adresses récentes
              </p>
              <ul>
                {recents.map((r) => (
                  <li key={r}>
                    <button
                      type="button"
                      onClick={() => choose(r)}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors active:bg-muted"
                    >
                      <Clock3 className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-[15px] font-medium">{r}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
