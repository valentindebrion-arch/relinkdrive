import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDriverSchedule } from "@/lib/schedule-slots.functions";
import {
  formatSlotTime,
  parisDay,
  type DriverSchedule,
  type ScheduleDay,
} from "@/lib/schedule-slots";

const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

const DAY_STATUS_LABEL: Record<ScheduleDay["status"], string> = {
  free: "disponible",
  partial: "partiellement disponible",
  full: "complet",
  closed: "non travaillé",
  past: "passé",
};

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })
    .replace(/^./, (c) => c.toUpperCase());
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Agenda numérique synchronisé avec le planning réel du chauffeur.
 * Les créneaux proviennent du serveur : aucune disponibilité n'est inventée.
 */
export function ScheduleSheet({
  open,
  driverId,
  driverName,
  pickup,
  dropoff,
  roundTrip,
  valueIso,
  onClose,
  onConfirm,
  onChangeDriver,
}: {
  open: boolean;
  driverId: string;
  driverName: string;
  pickup: string;
  dropoff: string;
  roundTrip: boolean;
  valueIso: string | null;
  onClose: () => void;
  onConfirm: (iso: string) => void;
  onChangeDriver: () => void;
}) {
  const scheduleFn = useServerFn(getDriverSchedule);
  const [month, setMonth] = useState(() => (valueIso ?? new Date().toISOString()).slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<string | null>(
    valueIso ? parisDay(new Date(valueIso)) : null,
  );
  const [selectedSlot, setSelectedSlot] = useState<string | null>(valueIso);

  const query = useQuery({
    queryKey: ["driver-schedule", driverId, pickup, dropoff, roundTrip, month],
    enabled: open && !!driverId && pickup.length > 2 && dropoff.length > 2,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async () =>
      (await scheduleFn({
        data: { driverId, pickup, dropoff, month, roundTrip },
      })) as DriverSchedule,
  });

  const days = query.data?.days ?? [];
  const dayMap = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  // Le jour retenu doit rester réservable après chaque actualisation.
  useEffect(() => {
    if (!selectedDay) return;
    const day = dayMap.get(selectedDay);
    if (day && day.slots.length === 0) setSelectedSlot(null);
    if (selectedSlot && day && !day.slots.includes(selectedSlot)) setSelectedSlot(null);
  }, [dayMap, selectedDay, selectedSlot]);

  useEffect(() => {
    if (!open) return;
    const first = days.find((d) => d.slots.length > 0);
    if (!selectedDay && first) setSelectedDay(first.date);
  }, [open, days, selectedDay]);

  if (!open) return null;

  const firstOfMonth = new Date(`${month}-01T00:00:00Z`);
  const leading = (firstOfMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(
    Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const activeDay = selectedDay ? dayMap.get(selectedDay) : undefined;
  const nextAvailable = days.find((d) => d.date > (selectedDay ?? "") && d.slots.length > 0);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/40">
      <div
        className="flex max-h-[92dvh] min-h-[70dvh] flex-col rounded-t-[28px] bg-background"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        role="dialog"
        aria-label="Agenda du chauffeur"
      >
        <div className="relative flex shrink-0 items-center justify-center px-2 py-3">
          <button
            type="button"
            aria-label="Fermer l'agenda"
            className="absolute right-2 flex size-10 items-center justify-center rounded-full hover:bg-accent"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
          <div className="text-center">
            <p className="text-[15px] font-bold">Disponibilités de {driverName}</p>
            <p className="text-[12px] text-muted-foreground">Heure de Paris (Europe/Paris)</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Mois précédent"
              className="flex size-10 items-center justify-center rounded-full hover:bg-accent disabled:opacity-40"
              disabled={month <= new Date().toISOString().slice(0, 7)}
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft className="size-5" />
            </button>
            <p className="text-[15px] font-bold">{monthLabel(month)}</p>
            <button
              type="button"
              aria-label="Mois suivant"
              className="flex size-10 items-center justify-center rounded-full hover:bg-accent"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight className="size-5" />
            </button>
          </div>

          {query.isError ? (
            <div className="rounded-2xl bg-destructive/10 p-4 text-[13.5px]">
              <p className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Les disponibilités de ce chauffeur ne peuvent pas être vérifiées pour le moment.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 rounded-xl"
                onClick={() => void query.refetch()}
              >
                Réessayer
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEK_LABELS.map((l, i) => (
                  <span key={i} className="py-1 text-[11px] font-bold text-muted-foreground">
                    {l}
                  </span>
                ))}
                {Array.from({ length: leading }, (_, i) => (
                  <span key={`e${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const date = `${month}-${String(i + 1).padStart(2, "0")}`;
                  const day = dayMap.get(date);
                  const status = day?.status ?? "closed";
                  const selectable = !!day && day.slots.length > 0;
                  const on = selectedDay === date;
                  return (
                    <button
                      key={date}
                      type="button"
                      disabled={!selectable || query.isFetching}
                      aria-label={`${i + 1} ${monthLabel(month)} — ${DAY_STATUS_LABEL[status]}`}
                      aria-pressed={on}
                      onClick={() => {
                        setSelectedDay(date);
                        setSelectedSlot(null);
                        void query.refetch();
                      }}
                      className={cn(
                        "relative flex h-11 flex-col items-center justify-center rounded-2xl text-[14px] font-semibold",
                        on
                          ? "bg-primary text-primary-foreground"
                          : selectable
                            ? "bg-primary/8 text-foreground"
                            : "text-muted-foreground/50 line-through",
                      )}
                    >
                      {i + 1}
                      {selectable && status === "partial" && !on ? (
                        <span className="absolute bottom-1 size-1 rounded-full bg-primary" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <p className="mt-2 text-[11.5px] text-muted-foreground">
                Les jours barrés sont complets, non travaillés ou hors période de réservation.
              </p>

              <div className="mt-4">
                {query.isPending || query.isFetching ? (
                  <p className="flex items-center gap-2 text-[13.5px] text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Actualisation des disponibilités…
                  </p>
                ) : !selectedDay ? (
                  <p className="text-[13.5px] text-muted-foreground">
                    Choisissez un jour pour voir les créneaux.
                  </p>
                ) : activeDay && activeDay.slots.length > 0 ? (
                  <>
                    <p className="mb-2 text-[13px] font-bold">Créneaux disponibles</p>
                    <div className="grid grid-cols-4 gap-2">
                      {activeDay.slots.map((iso) => {
                        const on = selectedSlot === iso;
                        return (
                          <button
                            key={iso}
                            type="button"
                            onClick={() => setSelectedSlot(iso)}
                            aria-pressed={on}
                            className={cn(
                              "flex h-11 items-center justify-center rounded-2xl text-[14px] font-semibold",
                              on
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground",
                            )}
                          >
                            {formatSlotTime(iso)}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <Clock className="size-3.5" />
                      Durée estimée de la course : ~{query.data?.tripMin ?? "?"} min
                    </p>
                  </>
                ) : (
                  <div className="rounded-2xl bg-muted/70 p-4 text-[13.5px]">
                    <p className="font-semibold">Aucun créneau disponible ce jour-là.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {nextAvailable ? (
                        <Button
                          size="sm"
                          className="rounded-xl"
                          onClick={() => {
                            setSelectedDay(nextAvailable.date);
                            setSelectedSlot(null);
                          }}
                        >
                          Voir le prochain jour disponible
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => setSelectedDay(null)}
                      >
                        Choisir une autre date
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={onChangeDriver}
                      >
                        Choisir un autre chauffeur
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-border/60 px-4 py-3">
          <Button
            size="lg"
            className="h-13 w-full rounded-2xl text-[15px] font-bold"
            disabled={!selectedSlot || query.isFetching || query.isError}
            onClick={async () => {
              if (!selectedSlot) return;
              // Dernière actualisation avant de figer le choix.
              const fresh = await query.refetch();
              const day = fresh.data?.days.find((d) => d.date === selectedDay);
              if (!day || !day.slots.includes(selectedSlot)) {
                setSelectedSlot(null);
                return;
              }
              onConfirm(selectedSlot);
            }}
          >
            {query.isFetching ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Confirmer ce créneau
          </Button>
        </div>
      </div>
    </div>
  );
}
