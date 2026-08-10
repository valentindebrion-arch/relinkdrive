import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CalendarOff, Clock, Copy, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  WEEKDAYS,
  formatAbsenceRange,
  formatTime,
  timeToMinutes,
  type Absence,
  type WorkingHour,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pro/disponibilites")({
  head: () => ({
    meta: [
      { title: "Mes disponibilités — Relink Chauffeur" },
      {
        name: "description",
        content:
          "Définissez vos horaires habituels du lundi au dimanche et déclarez vos absences : Relink bloque automatiquement les réservations hors de vos disponibilités.",
      },
      { property: "og:title", content: "Mes disponibilités — Relink Chauffeur" },
      { property: "og:description", content: "Horaires hebdomadaires et indisponibilités exceptionnelles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AvailabilityPage,
});

const DEFAULT_HOURS: WorkingHour[] = WEEKDAYS.map((d) => ({
  weekday: d.value,
  active: d.value <= 5,
  start_time: "08:00",
  end_time: "19:00",
}));

const REASONS = ["Congés", "Entretien du véhicule", "Indisponibilité personnelle", "Autre"];

const ACTIVE_RIDE_STATUSES = [
  "confirmed",
  "driver_enroute",
  "driver_arrived",
  "client_onboard",
  "in_progress",
] as const;


function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function AvailabilityPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const hoursQuery = useQuery({
    queryKey: ["driver-working-hours", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_working_hours")
        .select("weekday, active, start_time, end_time")
        .eq("driver_id", user!.id);
      if (error) throw error;
      return (data ?? []) as WorkingHour[];
    },
  });

  const absencesQuery = useQuery({
    queryKey: ["driver-absences", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_absences")
        .select("id, starts_on, ends_on, reason")
        .eq("driver_id", user!.id)
        .order("starts_on");
      if (error) throw error;
      return (data ?? []) as Absence[];
    },
  });

  const [hours, setHours] = useState<WorkingHour[]>(DEFAULT_HOURS);

  useEffect(() => {
    if (!hoursQuery.data) return;
    setHours(
      WEEKDAYS.map((d) => {
        const row = hoursQuery.data.find((h) => h.weekday === d.value);
        return row
          ? {
              weekday: d.value,
              active: row.active,
              start_time: formatTime(row.start_time),
              end_time: formatTime(row.end_time),
            }
          : { weekday: d.value, active: false, start_time: "08:00", end_time: "19:00" };
      }),
    );
  }, [hoursQuery.data]);

  const saveHours = useMutation({
    mutationFn: async () => {
      for (const h of hours) {
        if (!h.active) continue;
        const day = WEEKDAYS.find((d) => d.value === h.weekday)!.label;
        const s = timeToMinutes(h.start_time);
        const e = timeToMinutes(h.end_time);
        if (s === null || e === null) throw new Error(`${day} : horaires incomplets ou invalides.`);
        if (s >= e) throw new Error(`${day} : l'heure de début doit précéder l'heure de fin.`);
      }
      const { error } = await supabase.from("driver_working_hours").upsert(
        hours.map((h) => ({
          driver_id: user!.id,
          weekday: h.weekday,
          active: h.active,
          // Une journée désactivée ne doit créer aucun créneau réservable.
          start_time: h.active ? h.start_time : "08:00",
          end_time: h.active ? h.end_time : "19:00",
        })),
        { onConflict: "driver_id,weekday" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vos disponibilités ont été mises à jour.");
      void qc.invalidateQueries({ queryKey: ["driver-working-hours"] });
      void qc.invalidateQueries({ queryKey: ["driver-availability-summary"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Enregistrement impossible"),
  });

  function update(weekday: number, patch: Partial<WorkingHour>) {
    setHours((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)));
  }

  function copyToAll(weekday: number) {
    const src = hours.find((h) => h.weekday === weekday);
    if (!src) return;
    setHours((prev) => prev.map((h) => (h.active ? { ...h, start_time: src.start_time, end_time: src.end_time } : h)));
    toast.success("Horaires copiés sur les jours actifs");
  }

  return (
    <div className="space-y-5 overflow-x-hidden pb-8">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Retour au planning">
          <Link to="/pro/planning">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">Mes disponibilités</h1>
          <p className="truncate text-sm text-muted-foreground">
            Définissez vos horaires habituels et vos absences.
          </p>
        </div>
      </header>

      <section className="surface p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Clock className="size-4 text-primary" /> Horaires hebdomadaires
        </h2>
        <div className="space-y-2">
          {hours.map((h) => {
            const day = WEEKDAYS.find((d) => d.value === h.weekday)!;
            return (
              <div
                key={h.weekday}
                className={cn(
                  "rounded-xl border border-border p-3 transition-colors",
                  h.active ? "bg-primary/5" : "bg-muted/40",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{day.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{h.active ? "Disponible" : "Indisponible"}</span>
                    <Switch
                      checked={h.active}
                      aria-label={`Disponibilité ${day.label}`}
                      onCheckedChange={(v) => update(h.weekday, { active: v })}
                    />
                  </div>
                </div>
                {h.active ? (
                  <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <div>
                      <Label className="text-[11px]" htmlFor={`s-${h.weekday}`}>
                        Début
                      </Label>
                      <Input
                        id={`s-${h.weekday}`}
                        type="time"
                        value={h.start_time}
                        onChange={(e) => update(h.weekday, { start_time: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]" htmlFor={`e-${h.weekday}`}>
                        Fin
                      </Label>
                      <Input
                        id={`e-${h.weekday}`}
                        type="time"
                        value={h.end_time}
                        onChange={(e) => update(h.weekday, { end_time: e.target.value })}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Copier les horaires de ${day.label} sur les autres jours`}
                      onClick={() => copyToAll(h.weekday)}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <Button className="mt-3 w-full" disabled={saveHours.isPending} onClick={() => saveHours.mutate()}>
          {saveHours.isPending ? "Enregistrement…" : "Enregistrer mes horaires"}
        </Button>
      </section>

      <AbsencesSection absences={absencesQuery.data ?? []} />
    </div>
  );
}

function AbsencesSection({ absences }: { absences: Absence[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ starts_on: todayIso(), ends_on: todayIso(), reason: "" });
  const [conflicts, setConflicts] = useState<{ id: string; scheduled_at: string; pickup_address: string }[]>([]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.starts_on || !form.ends_on) throw new Error("Renseignez une date de début et une date de fin.");
      if (form.ends_on < form.starts_on) throw new Error("La date de fin doit suivre la date de début.");

      // Les courses déjà confirmées ne sont jamais annulées automatiquement.
      const { data: rides } = await supabase
        .from("rides")
        .select("id, scheduled_at, pickup_address")
        .eq("driver_id", user!.id)
        .eq("is_block", false)
        .in("status", ACTIVE_RIDE_STATUSES)
        .gte("scheduled_at", `${form.starts_on}T00:00:00`)
        .lte("scheduled_at", `${form.ends_on}T23:59:59`)
        .order("scheduled_at");
      setConflicts(rides ?? []);

      const payload = {
        driver_id: user!.id,
        starts_on: form.starts_on,
        ends_on: form.ends_on,
        reason: form.reason.trim() || null,
      };
      const { error } = editing
        ? await supabase.from("driver_absences").update(payload).eq("id", editing)
        : await supabase.from("driver_absences").insert(payload);
      if (error) throw error;
      return rides ?? [];
    },
    onSuccess: (rides) => {
      toast.success("Vos disponibilités ont été mises à jour.");
      if (rides.length) {
        toast.warning(
          "Cette indisponibilité entre en conflit avec une ou plusieurs courses déjà confirmées. Les courses existantes ne seront pas annulées automatiquement.",
        );
      }
      setEditing(null);
      setForm({ starts_on: todayIso(), ends_on: todayIso(), reason: "" });
      void qc.invalidateQueries({ queryKey: ["driver-absences"] });
      void qc.invalidateQueries({ queryKey: ["driver-availability-summary"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Enregistrement impossible"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("driver_absences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Indisponibilité supprimée");
      setConfirmDelete(null);
      void qc.invalidateQueries({ queryKey: ["driver-absences"] });
      void qc.invalidateQueries({ queryKey: ["driver-availability-summary"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Suppression impossible"),
  });

  return (
    <section className="surface p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <CalendarOff className="size-4 text-primary" /> Mes indisponibilités
      </h2>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-[11px]" htmlFor="abs-start">
            Date de début
          </Label>
          <Input
            id="abs-start"
            type="date"
            value={form.starts_on}
            onChange={(e) => setForm((f) => ({ ...f, starts_on: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-[11px]" htmlFor="abs-end">
            Date de fin
          </Label>
          <Input
            id="abs-end"
            type="date"
            value={form.ends_on}
            onChange={(e) => setForm((f) => ({ ...f, ends_on: e.target.value }))}
          />
        </div>
      </div>
      <div className="mt-2">
        <Label className="text-[11px]" htmlFor="abs-reason">
          Motif (facultatif, privé)
        </Label>
        <Input
          id="abs-reason"
          maxLength={80}
          value={form.reason}
          placeholder="Congés, entretien du véhicule…"
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
        />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setForm((f) => ({ ...f, reason: r }))}
              className="tap-active rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}>
          {editing ? "Enregistrer les modifications" : "Ajouter l'indisponibilité"}
        </Button>
        {editing ? (
          <Button
            variant="outline"
            onClick={() => {
              setEditing(null);
              setForm({ starts_on: todayIso(), ends_on: todayIso(), reason: "" });
            }}
          >
            Annuler
          </Button>
        ) : null}
      </div>

      {conflicts.length ? (
        <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <p className="flex items-start gap-2 text-xs font-semibold text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Cette indisponibilité entre en conflit avec une ou plusieurs courses déjà confirmées. Les courses
            existantes ne seront pas annulées automatiquement.
          </p>
          <div className="mt-2 space-y-1">
            {conflicts.map((r) => (
              <Link
                key={r.id}
                to="/pro/courses/$rideId"
                params={{ rideId: r.id }}
                className="block truncate text-xs text-foreground underline underline-offset-2"
              >
                {new Date(r.scheduled_at).toLocaleString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · {r.pickup_address}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {absences.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune indisponibilité enregistrée.</p>
        ) : (
          absences.map((a) => (
            <div key={a.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{formatAbsenceRange(a)}</p>
                  {a.reason ? <p className="truncate text-xs text-muted-foreground">{a.reason}</p> : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Modifier l'indisponibilité"
                    onClick={() => {
                      setEditing(a.id!);
                      setForm({ starts_on: a.starts_on, ends_on: a.ends_on, reason: a.reason ?? "" });
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Supprimer l'indisponibilité"
                    onClick={() => setConfirmDelete(a.id!)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {confirmDelete === a.id ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted p-2">
                  <p className="flex-1 text-xs">Supprimer cette indisponibilité ?</p>
                  <Button size="sm" variant="destructive" onClick={() => remove.mutate(a.id!)}>
                    Supprimer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                    Annuler
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
