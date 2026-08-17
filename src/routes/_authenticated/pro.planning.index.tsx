import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WEEKDAYS } from "@/lib/schedule";

type View = "week" | "month" | "year";
type PlanningSearch = { view?: View | undefined; cursor?: string | undefined };

export const Route = createFileRoute("/_authenticated/pro/planning/")({
  validateSearch: (search: Record<string, unknown>): PlanningSearch => ({
    view: (["week", "month", "year"] as const).includes(search["view"] as never)
      ? (search["view"] as View)
      : undefined,
    cursor: typeof search["cursor"] === "string" ? (search["cursor"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Planning — Relink Chauffeur" },
      {
        name: "description",
        content:
          "Consultez et organisez vos courses Relink à venir en vue semaine, mois ou année, avec le détail de chaque journée.",
      },
      { property: "og:title", content: "Planning — Relink Chauffeur" },
      { property: "og:description", content: "Vos courses à venir en vue semaine, mois ou année." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanningPage,
});

type Ride = {
  id: string;
  client_id: string | null;
  client_label: string | null;
  pickup_address: string;
  dropoff_address: string;
  scheduled_at: string;
  created_at: string;
  price: number | string | null;
  status: string;
  is_block: boolean;
};

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const DOW = ["L", "M", "M", "J", "V", "S", "D"];

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function key(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isFlash(r: Ride) {
  return new Date(r.scheduled_at).getTime() - new Date(r.created_at).getTime() <= 20 * 60 * 1000;
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const dotFor: Record<string, string> = {
  completed: "bg-muted-foreground",
  cancelled: "bg-destructive",
  refused: "bg-destructive",
  in_progress: "bg-info",
  driver_enroute: "bg-info",
  driver_arrived: "bg-info",
  client_onboard: "bg-info",
};

function StatusDot({ status }: { status: string }) {
  return <span className={cn("size-2 shrink-0 rounded-full", dotFor[status] ?? "bg-primary")} />;
}

function PlanningPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [view, setView] = useState<View>(search.view ?? "week");
  const [cursor, setCursor] = useState(() => (search.cursor ? new Date(`${search.cursor}T12:00:00`) : new Date()));

  const today = new Date();

  function ymd(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Ouvre la vue journalière plein écran en conservant la période consultée. */
  const openDay = (d: Date) => {
    void navigate({
      to: "/pro/planning/jour/$date",
      params: { date: ymd(d) },
      search: { view, cursor: ymd(cursor) },
    });
  };

  const rides = useQuery({
    queryKey: ["driver-planning", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user!.id)
        .eq("is_block", false)
        .order("scheduled_at");
      if (error) throw error;
      const list = (data ?? []) as Ride[];
      // Nom réel du client : lisible uniquement par le chauffeur connecté (RLS).
      const ids = Array.from(new Set(list.map((r) => r.client_id).filter((id): id is string => !!id)));
      if (ids.length) {
        const { data: clients } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        const names = new Map((clients ?? []).map((c) => [c.id, (c.full_name ?? "").trim()]));
        return list.map((r) => ({
          ...r,
          client_label: (r.client_id ? names.get(r.client_id) : "") || r.client_label?.trim() || null,
        }));
      }
      return list;
    },
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Ride[]>();
    for (const r of rides.data ?? []) {
      const k = key(new Date(r.scheduled_at));
      const list = map.get(k) ?? [];
      list.push(r);
      map.set(k, list);
    }
    for (const list of map.values())
      list.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    return map;
  }, [rides.data]);

  const dayRides = (d: Date) => byDay.get(key(d)) ?? [];

  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000));

  function shift(dir: number) {
    const d = new Date(cursor);
    if (view === "week") d.setDate(d.getDate() + dir * 7);
    else if (view === "month") d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    setCursor(d);
  }

  const label =
    view === "week"
      ? `Du ${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]!.toLowerCase()} au ${weekDays[6]!.getDate()} ${MONTHS[weekDays[6]!.getMonth()]!.toLowerCase()} ${weekDays[6]!.getFullYear()}`
      : view === "month"
        ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
        : `Année ${cursor.getFullYear()}`;

  return (
    <div className="space-y-4 overflow-x-hidden pb-6">
      <PageHeader title="Planning" description="Consultez et organisez vos courses à venir." />

      <AvailabilityCard />


      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {(["week", "month", "year"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "tap-active rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {v === "week" ? "Semaine" : v === "month" ? "Mois" : "Année"}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" aria-label="Période précédente" onClick={() => shift(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">{label}</p>
        <Button variant="outline" size="icon" aria-label="Période suivante" onClick={() => shift(1)}>
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
          Aujourd'hui
        </Button>
      </div>

      {rides.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="surface h-20 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : view === "week" ? (
        <div className="space-y-3">
          {weekDays.map((d) => {
            const items = dayRides(d);
            const isToday = key(d) === key(today);
            return (
              <button
                key={key(d)}
                onClick={() => openDay(d)}
                className={cn(
                  "surface tap-active w-full p-3 text-left transition-colors hover:border-primary/40",
                  isToday && "border-primary/60 bg-primary/5",
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className={cn("text-sm font-semibold capitalize", isToday && "text-primary")}>
                    {d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {items.length > 0 ? `${items.length} course${items.length > 1 ? "s" : ""}` : "—"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {items.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-xs">
                      <StatusDot status={r.status} />
                      <span className="font-medium">{timeOf(r.scheduled_at)}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {r.client_label ?? "Client non renseigné"}
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                        {isFlash(r) ? "Flash" : "Planifiée"}
                      </span>
                    </div>
                  ))}
                  {items.length === 0 ? <p className="text-xs text-muted-foreground">Aucune course</p> : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : view === "month" ? (
        <MonthGrid
          year={cursor.getFullYear()}
          month={cursor.getMonth()}
          countFor={(d) => dayRides(d).length}
          onPick={openDay}
          today={today}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MONTHS.map((m, i) => (
            <div key={m} className="surface p-2">
              <button
                onClick={() => {
                  setCursor(new Date(cursor.getFullYear(), i, 1));
                  setView("month");
                }}
                className="mb-1 w-full text-left text-xs font-semibold"
              >
                {m}
              </button>
              <MonthGrid
                compact
                year={cursor.getFullYear()}
                month={i}
                countFor={(d) => dayRides(d).length}
                onPick={openDay}
                today={today}
              />
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

function MonthGrid({
  year,
  month,
  countFor,
  onPick,
  today,
  compact = false,
}: {
  year: number;
  month: number;
  countFor: (d: Date) => number;
  onPick: (d: Date) => void;
  today: Date;
  compact?: boolean;
}) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1)),
  ];

  return (
    <div className={cn(!compact && "surface p-3")}>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {DOW.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) =>
          d ? (
            <button
              key={i}
              onClick={() => onPick(d)}
              className={cn(
                "tap-active flex flex-col items-center justify-center rounded-md border border-transparent",
                compact ? "h-6 text-[9px]" : "h-11 text-xs",
                key(d) === key(today) ? "border-primary bg-primary/10 font-bold text-primary" : "hover:bg-accent",
                countFor(d) > 0 && key(d) !== key(today) && "bg-primary/5",
              )}
            >
              <span>{d.getDate()}</span>
              {countFor(d) > 0 ? (
                compact ? (
                  <span className="size-1 rounded-full bg-primary" />
                ) : countFor(d) > 1 ? (
                  <span className="rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                    {countFor(d)}
                  </span>
                ) : (
                  <span className="size-1.5 rounded-full bg-primary" />
                )
              ) : null}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  );
}

function AvailabilityCard() {
  const { user } = useAuth();

  const summary = useQuery({
    queryKey: ["driver-availability-summary", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [{ data: hours }, { data: absences }] = await Promise.all([
        supabase.from("driver_working_hours").select("weekday, active, start_time, end_time").eq("driver_id", user!.id),
        supabase
          .from("driver_absences")
          .select("id, starts_on, ends_on")
          .eq("driver_id", user!.id)
          .gte("ends_on", new Date().toISOString().slice(0, 10)),
      ]);
      return { hours: hours ?? [], absences: absences ?? [] };
    },
  });

  const hours = summary.data?.hours ?? [];
  const activeDays = WEEKDAYS.filter((d) => hours.find((h) => h.weekday === d.value)?.active);
  const upcoming = summary.data?.absences.length ?? 0;

  return (
    <Link
      to="/pro/disponibilites"
      className="surface tap-active flex items-center gap-3 p-4 transition-colors hover:border-primary/40"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <CalendarClock className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">Mes disponibilités</span>
        <span className="block truncate text-xs text-muted-foreground">
          {hours.length === 0
            ? "Définissez vos horaires habituels et vos absences."
            : activeDays.length === 0
              ? "Aucun jour de travail déclaré."
              : `${activeDays.map((d) => d.short).join(", ")}${upcoming ? ` · ${upcoming} absence${upcoming > 1 ? "s" : ""} à venir` : ""}`}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
