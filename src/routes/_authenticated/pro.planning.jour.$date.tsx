import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Coffee,
  CornerUpLeft,
  Plus,
  Trash2,
} from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { RIDE_STATUS_LABELS, formatEuro } from "@/lib/labels";
import { getDriverDayPlan } from "@/lib/day-planning.functions";
import {
  BUFFER_OPTIONS,
  buildTimeline,
  formatDuration,
  formatLongDate,
  minutesToTime,
  shiftDate,
  timeToMin,
  type DayEvent,
  type DayPlan,
} from "@/lib/day-planning";
import { cn } from "@/lib/utils";
import { RELINK_TZ } from "@/lib/schedule";

const searchSchema = z.object({
  view: z.enum(["week", "month", "year"]).optional(),
  cursor: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/pro/planning/jour/$date")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Journée — Planning Relink Chauffeur" },
      {
        name: "description",
        content:
          "Vue journalière complète de votre planning Relink : prise de poste, courses, pauses théoriques et temps disponibles.",
      },
      { property: "og:title", content: "Journée — Planning Relink Chauffeur" },
      { property: "og:description", content: "Votre journée heure par heure : courses, pauses et temps libres." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DayPage,
});

function todayParis() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RELINK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const HOUR_PX = 68;

function DayPage() {
  const { date } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getDriverDayPlan);

  const [selected, setSelected] = useState<DayEvent | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [breakOpen, setBreakOpen] = useState(false);

  const today = todayParis();

  const plan = useQuery({
    queryKey: ["driver-day-plan", user?.id, date],
    enabled: !!user?.id,
    queryFn: () => fetchPlan({ data: { date } }),
  });

  const backSearch = { view: search.view, cursor: search.cursor };

  function goto(next: string) {
    void navigate({
      to: "/pro/planning/jour/$date",
      params: { date: next },
      search: backSearch,
      replace: true,
    });
  }

  const data = plan.data;

  return (
    <div className="client-page-enter space-y-4 pb-28">
      <header className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            to="/pro/planning"
            search={backSearch}
            aria-label="Retour au planning"
            className="tap-active grid size-9 shrink-0 place-items-center rounded-full bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">{formatLongDate(date)}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {data
                ? `${data.events.filter((e) => e.kind !== "block").length} course${data.events.filter((e) => e.kind !== "block").length > 1 ? "s" : ""} prévue${data.events.filter((e) => e.kind !== "block").length > 1 ? "s" : ""}`
                : "Chargement…"}
              {data ? ` · ${dayStatusLabel(data, today)}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Jour précédent" onClick={() => goto(shiftDate(date, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" aria-label="Jour suivant" onClick={() => goto(shiftDate(date, 1))}>
              <ChevronRight className="size-4" />
            </Button>
            {date !== today ? (
              <Button variant="ghost" size="sm" onClick={() => goto(today)}>
                Aujourd'hui
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {plan.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="surface h-24 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : plan.isError || !data ? (
        <div className="surface p-4 text-sm text-muted-foreground">
          Impossible de charger cette journée pour le moment.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:items-start">
          <div className="space-y-3">
            <Summary plan={data} onEditHours={() => setHoursOpen(true)} />
            <Button variant="outline" className="w-full" onClick={() => setBreakOpen(true)}>
              <Plus className="mr-1 size-4" /> Ajouter une pause
            </Button>
          </div>

          <Timeline plan={data} onPick={setSelected} />
        </div>
      )}

      <HoursSheet
        open={hoursOpen}
        onOpenChange={setHoursOpen}
        plan={data ?? null}
        date={date}
        driverId={user?.id ?? ""}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["driver-day-plan"] })}
      />
      <BreakSheet
        open={breakOpen}
        onOpenChange={setBreakOpen}
        date={date}
        driverId={user?.id ?? ""}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["driver-day-plan"] })}
      />

      {selected ? <EventPanel event={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function dayStatusLabel(plan: DayPlan, today: string) {
  if (plan.absent) return "Absent";
  if (!plan.available) return "Indisponible";
  if (plan.date === today && !plan.onDuty) return "Partiellement disponible";
  return "Disponible";
}

function Summary({ plan, onEditHours }: { plan: DayPlan; onEditHours: () => void }) {
  const { conflicts, busyMin } = useMemo(() => buildTimeline(plan), [plan]);
  const amplitude = Math.max(0, plan.endMin - plan.startMin);
  const rides = plan.events.filter((e) => e.kind !== "block");
  const drivingKnown = rides.filter((r) => r.durationMin !== null);
  const drivingMin = drivingKnown.reduce((a, r) => a + (r.durationMin ?? 0), 0);
  const breaksMin = plan.breaks.reduce((a, b) => a + (b.endMin - b.startMin), 0);
  const free = Math.max(0, amplitude - busyMin);

  if (!plan.defined) {
    return (
      <div className="surface space-y-3 p-4">
        <p className="text-sm font-semibold">Horaires de travail non définis</p>
        <p className="text-xs text-muted-foreground">
          Définissez votre prise de poste et votre fin de poste pour que vos clients puissent réserver.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onEditHours}>
            Définir mes horaires
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/pro/disponibilites">Horaires habituels</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="surface space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Item label="Prise de poste" value={minutesToTime(plan.startMin)} />
        <Item label="Fin de poste" value={minutesToTime(plan.endMin)} />
        <Item label="Amplitude prévue" value={formatDuration(amplitude)} />
        <Item label="Courses prévues" value={String(rides.length)} />
        <Item
          label="Conduite estimée"
          value={
            rides.length === 0
              ? "—"
              : drivingKnown.length === 0
                ? "Durée non estimée"
                : `${formatDuration(drivingMin)}${drivingKnown.length < rides.length ? " (partiel)" : ""}`
          }
        />
        <Item label="Pauses prévues" value={breaksMin ? formatDuration(breaksMin) : "Aucune"} />
        <Item label="Temps encore disponible" value={formatDuration(free)} />
        <Item label="Temps tampon" value={plan.bufferMin ? `${plan.bufferMin} min` : "Aucun"} />
        {plan.returnLeg ? (
          <Item
            label="Retour à vide"
            value={`${minutesToTime(plan.returnLeg.startMin)} → ${minutesToTime(plan.returnLeg.endMin)} · ${plan.returnLeg.destination}`}
          />
        ) : null}
        {plan.returnLeg && plan.bufferMin ? (
          <Item
            label="Disponibilité sûre"
            value={minutesToTime(plan.returnLeg.endMin + plan.bufferMin)}
          />
        ) : null}
      </div>

      {!plan.available ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          Journée déclarée indisponible : aucune réservation possible.
        </p>
      ) : null}
      {conflicts > 0 ? (
        <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {conflicts} risque{conflicts > 1 ? "s" : ""} de conflit horaire sur cette journée.
        </p>
      ) : null}

      <Button variant="outline" size="sm" className="w-full" onClick={onEditHours}>
        <CalendarClock className="mr-1 size-4" /> Modifier mes horaires
      </Button>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="truncate font-semibold">{value}</p>
    </div>
  );
}

/** Minutes depuis minuit (Europe/Paris) de l'instant courant. */
function nowMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: RELINK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  return timeToMin(parts);
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RELINK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function Timeline({ plan, onPick }: { plan: DayPlan; onPick: (e: DayEvent) => void }) {
  const { slices } = useMemo(() => buildTimeline(plan), [plan]);
  const [nowMin, setNowMin] = useState(() => nowMinutes());
  useEffect(() => {
    const id = setInterval(() => setNowMin(nowMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);
  const isToday = plan.date === todayKey();
  const startHour = Math.floor(plan.startMin / 60);
  const lastMin = Math.max(
    plan.endMin,
    plan.returnLeg ? plan.returnLeg.endMin + plan.bufferMin : 0,
  );
  const endHour = Math.ceil(lastMin / 60);
  const hours = Array.from({ length: Math.max(1, endHour - startHour) + 1 }, (_, i) => startHour + i);
  const top = (min: number) => ((min - startHour * 60) / 60) * HOUR_PX;
  const height = (a: number, b: number) => Math.max(26, ((b - a) / 60) * HOUR_PX);

  return (
    <div className="surface p-3">
      <div className="relative" style={{ height: hours.length * HOUR_PX }}>
        {hours.map((h, i) => (
          <div key={h} className="absolute right-0 left-0 flex items-start gap-2" style={{ top: i * HOUR_PX }}>
            <span className="w-12 shrink-0 text-[11px] font-medium text-muted-foreground">
              {String(h).padStart(2, "0")}:00
            </span>
            <span className="mt-2 h-px flex-1 bg-border" />
          </div>
        ))}

        <div className="absolute top-0 right-0 bottom-0 left-14">
          {!plan.available ? (
            <div className="absolute inset-0 rounded-lg bg-destructive/5" />
          ) : null}

          {slices.map((s, i) => {
            const style = { top: top(s.startMin), height: height(s.startMin, s.endMin) } as const;
            if (s.type === "gap") {
              const mins = s.endMin - s.startMin;
              if (mins < 5) return null;
              return (
                <div
                  key={`gap-${i}`}
                  className="absolute right-0 left-0 flex items-center rounded-lg border border-dashed border-border bg-muted/40 px-3 text-xs text-muted-foreground"
                  style={style}
                >
                  {formatDuration(mins)} disponibles
                </div>
              );
            }
            if (s.type === "return") {
              const r = s.item;
              const total = Math.max(1, r.endMin - r.startMin);
              const inProgress = isToday && nowMin >= r.startMin && nowMin < r.endMin;
              const remaining = Math.max(0, r.endMin - nowMin);
              const progress = inProgress ? Math.round(((nowMin - r.startMin) / total) * 100) : 0;
              return (
                <div
                  key={`ret-${i}`}
                  className="absolute right-0 left-0 min-w-0 overflow-hidden rounded-lg border-[1.5px] px-3 py-2 text-xs [overflow-wrap:anywhere]"
                  style={{
                    ...style,
                    background: "#FEF2F2",
                    borderColor: "#DC2626",
                    color: "#991B1B",
                  }}
                >
                  <p className="flex items-center gap-1.5 font-semibold">
                    <CornerUpLeft className="size-3.5 shrink-0" aria-hidden />
                    Retour à vide · {minutesToTime(r.startMin)} → {minutesToTime(r.endMin)}
                  </p>
                  <p className="truncate">
                    Retour vers {r.destination} · durée estimée {formatDuration(r.durationMin)}
                  </p>
                  <p className="truncate font-medium">
                    {inProgress
                      ? `Retour en cours · ${formatDuration(remaining)} restantes · disponibilité estimée à ${minutesToTime(r.endMin)}`
                      : r.interrupted
                        ? "Retour interrompu — nouvelle prise en charge compatible"
                        : `Indisponible sauf trajet compatible · disponibilité proche à ${minutesToTime(r.endMin)}`}
                  </p>
                  {inProgress ? (
                    <div
                      className="mt-1 h-1 rounded-full"
                      style={{ background: "#FCA5A5" }}
                      role="progressbar"
                      aria-label="Progression du retour à vide"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-1 rounded-full" style={{ width: `${progress}%`, background: "#DC2626" }} />
                    </div>
                  ) : null}
                </div>
              );
            }
            if (s.type === "buffer") {
              return (
                <div
                  key={`buf-${i}`}
                  className="absolute right-0 left-0 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 text-xs text-primary"
                  style={style}
                >
                  <Coffee className="size-3.5 shrink-0" />
                  Pause théorique · {plan.bufferMin} min
                  {s.unknownEnd ? <span className="text-muted-foreground">· horaire à vérifier</span> : null}
                </div>
              );
            }
            if (s.type === "break") {
              return (
                <div
                  key={s.item.id}
                  className="absolute right-0 left-0 flex items-center justify-between gap-2 rounded-lg border border-info/30 bg-info/10 px-3 text-xs"
                  style={style}
                >
                  <span className="min-w-0 truncate font-medium">
                    {minutesToTime(s.item.startMin)}–{minutesToTime(s.item.endMin)} ·{" "}
                    {s.item.reason || "Pause"}
                    {s.item.recurring ? " (habituelle)" : ""}
                  </span>
                  <DeleteBreak id={s.item.id} />
                </div>
              );
            }
            const ev = s.event;
            return (
              <button
                key={ev.id}
                onClick={() => onPick(ev)}
                title={`${minutesToTime(ev.startMin)} — ${ev.clientLabel ?? "Client non renseigné"}`}
                className={cn(
                  "tap-active absolute right-0 left-0 min-w-0 max-w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                  ev.kind === "request"
                    ? "border-warning/40 bg-warning/10"
                    : ev.kind === "block"
                      ? "border-border bg-muted"
                      : ev.flash
                        ? "border-primary bg-primary/20"
                        : "border-primary/40 bg-primary/10",
                  s.conflict && "ring-2 ring-destructive",
                )}
                style={style}
              >
                {/* Heure puis nom du client : identification immédiate sans ouvrir le détail. */}
                <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                  {minutesToTime(ev.startMin)}
                  {s.estimated ? "" : ` – ${minutesToTime(s.endMin)}`}
                  {" — "}
                  {ev.clientLabel ?? "Client non renseigné"}
                </p>
                <p className="truncate text-muted-foreground">
                  {ev.pickup} → {ev.dropoff}
                </p>
                <p className="truncate text-muted-foreground">
                  {ev.kind === "request" ? "Demande en attente" : ev.flash ? "Flash" : "Planifiée"}
                  {s.estimated ? " · fin non estimée" : ""}
                  {ev.durationMin !== null ? ` · ${formatDuration(ev.durationMin)}` : " · Durée non estimée"}
                  {ev.price !== null ? ` · ${formatEuro(ev.price)}` : ""}
                </p>
                {s.conflict ? (
                  <p className="truncate font-medium text-destructive">Risque de conflit entre ces deux courses</p>
                ) : null}
                {s.estimated && ev.kind !== "block" ? (
                  <p className="truncate text-muted-foreground">Temps de liaison à vérifier</p>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DeleteBreak({ id }: { id: string }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("driver_breaks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pause supprimée");
      void qc.invalidateQueries({ queryKey: ["driver-day-plan"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <button
      aria-label="Supprimer la pause"
      onClick={() => remove.mutate()}
      className="tap-active shrink-0 text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}

function HoursSheet({
  open,
  onOpenChange,
  plan,
  date,
  driverId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: DayPlan | null;
  date: string;
  driverId: string;
  onSaved: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [available, setAvailable] = useState(true);
  const [buffer, setBuffer] = useState(15);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (open && plan) {
      setStart(minutesToTime(plan.startMin));
      setEnd(minutesToTime(plan.endMin));
      setAvailable(plan.available);
      setBuffer(plan.bufferMin);
      setCustom(BUFFER_OPTIONS.includes(plan.bufferMin as never) ? "" : String(plan.bufferMin));
    }
  }, [open, plan]);

  const save = useMutation({
    mutationFn: async () => {
      const s = timeToMin(start);
      const e = timeToMin(end);
      if (e <= s) throw new Error("La fin de poste doit suivre la prise de poste.");
      const buf = custom ? Number(custom) : buffer;
      if (!Number.isFinite(buf) || buf < 0 || buf > 240) throw new Error("Temps tampon invalide (0 à 240 min).");
      const { error } = await supabase.from("driver_day_overrides").upsert(
        {
          driver_id: driverId,
          day: date,
          available,
          start_time: minutesToTime(s),
          end_time: minutesToTime(e),
        },
        { onConflict: "driver_id,day" },
      );
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("driver_schedule_settings")
        .upsert({ driver_id: driverId, buffer_min: Math.round(buf) }, { onConflict: "driver_id" });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Horaires mis à jour");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="space-y-4">
        <SheetHeader>
          <SheetTitle>Modifier mes horaires</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ds">Prise de poste</Label>
            <Input id="ds" type="time" value={start} onChange={(ev) => setStart(ev.target.value)} />
          </div>
          <div>
            <Label htmlFor="de">Fin de poste</Label>
            <Input id="de" type="time" value={end} onChange={(ev) => setEnd(ev.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Disponible ce jour</p>
            <p className="text-xs text-muted-foreground">Désactivez pour bloquer toute réservation.</p>
          </div>
          <Switch checked={available} onCheckedChange={setAvailable} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Temps de repos entre deux courses</p>
          <div className="flex flex-wrap gap-2">
            {BUFFER_OPTIONS.map((o) => (
              <button
                key={o}
                onClick={() => {
                  setBuffer(o);
                  setCustom("");
                }}
                className={cn(
                  "tap-active rounded-full border px-3 py-1.5 text-xs font-medium",
                  !custom && buffer === o ? "border-primary bg-primary/10 text-primary" : "border-border",
                )}
              >
                {o === 0 ? "Aucun" : `${o} min`}
              </button>
            ))}
            <Input
              className="h-8 w-28"
              type="number"
              min={0}
              max={240}
              placeholder="Perso. (min)"
              value={custom}
              onChange={(ev) => setCustom(ev.target.value)}
            />
          </div>
        </div>
        <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
          Enregistrer
        </Button>
      </SheetContent>
    </Sheet>
  );
}

function BreakSheet({
  open,
  onOpenChange,
  date,
  driverId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
  driverId: string;
  onSaved: () => void;
}) {
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("12:45");
  const [reason, setReason] = useState("");
  const [recurring, setRecurring] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (timeToMin(end) <= timeToMin(start)) throw new Error("La fin de la pause doit suivre son début.");
      const weekday = ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
      const { error } = await supabase.from("driver_breaks").insert({
        driver_id: driverId,
        day: recurring ? null : date,
        weekday: recurring ? weekday : null,
        start_time: start,
        end_time: end,
        reason: reason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pause ajoutée");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="space-y-4">
        <SheetHeader>
          <SheetTitle>Ajouter une pause</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="bs">Début</Label>
            <Input id="bs" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="be">Fin</Label>
            <Input id="be" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="br">Motif (facultatif)</Label>
          <Input id="br" maxLength={80} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Déjeuner…" />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Répéter chaque semaine</p>
            <p className="text-xs text-muted-foreground">Ajoute la pause à vos disponibilités habituelles.</p>
          </div>
          <Switch checked={recurring} onCheckedChange={setRecurring} />
        </div>
        <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
          Ajouter
        </Button>
      </SheetContent>
    </Sheet>
  );
}

function EventPanel({ event, onClose }: { event: DayEvent; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(v) => (!v ? onClose() : null)}>
      <SheetContent side="right" className="w-full space-y-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-base">
            {minutesToTime(event.startMin)} · {event.clientLabel ?? "Client"}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">{event.pickup}</p>
          <p className="text-muted-foreground">→ {event.dropoff}</p>
          <p>
            {event.kind === "request" ? "Demande en attente" : event.flash ? "Course flash" : "Course planifiée"} ·{" "}
            {event.durationMin !== null ? formatDuration(event.durationMin) : "Durée non estimée"}
          </p>
          {event.price !== null ? <p className="font-semibold text-primary">{formatEuro(event.price)}</p> : null}
          <StatusBadge status={event.status} labels={RIDE_STATUS_LABELS} />
        </div>
        {event.kind === "ride" ? (
          <Button asChild className="w-full">
            <Link to="/pro/courses/$rideId" params={{ rideId: event.id }}>
              Voir la course
            </Link>
          </Button>
        ) : event.kind === "request" ? (
          <Button asChild className="w-full">
            <Link to="/pro/demandes">Voir la demande</Link>
          </Button>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
