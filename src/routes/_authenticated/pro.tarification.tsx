import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Moon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyTariff } from "@/lib/tax-queries";
import { formatEuro } from "@/lib/labels";
import { FREE_PRICE_PER_KM, MAX_PRICE_PER_KM, simulateTariff, useMyPlan } from "@/lib/plan";
import { ProUpsell } from "@/components/pro/ProUpsell";
import { PageHeader } from "@/components/Ui";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/pro/tarification")({
  component: PricingPage,
});

const SIM_KM = 20;

type Form = {
  price_per_km_ht: number;
  minimum_ht: number;
  pickup_pct: number;
  night_enabled: boolean;
  night_start: string;
  night_end: string;
  night_pct: number;
};

const DEFAULTS: Form = {
  price_per_km_ht: FREE_PRICE_PER_KM,
  minimum_ht: 9,
  pickup_pct: 0,
  night_enabled: false,
  night_start: "22:00",
  night_end: "06:00",
  night_pct: 15,
};

function PricingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const tariff = useMyTariff();
  const { isPro, isLoading } = useMyPlan();

  const [form, setForm] = useState<Form>(DEFAULTS);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const hydrated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tariff.data || hydrated.current) return;
    const t = tariff.data;
    hydrated.current = true;
    setForm({
      price_per_km_ht: Number(t.price_per_km_ht ?? DEFAULTS.price_per_km_ht),
      minimum_ht: Number(t.minimum_ht ?? DEFAULTS.minimum_ht),
      pickup_pct: Number(t.pickup_pct ?? 0),
      night_enabled: Boolean(t.night_enabled),
      night_start: (t.night_start ?? "22:00").slice(0, 5),
      night_end: (t.night_end ?? "06:00").slice(0, 5),
      night_pct: Number(t.night_pct ?? 15),
    });
  }, [tariff.data]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /** Enregistrement automatique : aucun bouton « Enregistrer ». */
  function update(patch: Partial<Form>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (timer.current) clearTimeout(timer.current);
      setStatus("saving");
      timer.current = setTimeout(() => void save(next), 500);
      return next;
    });
  }

  async function save(next: Form) {
    if (!user?.id) return;
    const { error } = await supabase.from("driver_tariffs").upsert(
      {
        driver_id: user.id,
        price_per_km_ht: Math.min(next.price_per_km_ht, MAX_PRICE_PER_KM),
        minimum_ht: next.minimum_ht,
        pickup_pct: next.pickup_pct,
        night_enabled: next.night_enabled,
        night_start: next.night_start,
        night_end: next.night_end,
        night_pct: next.night_enabled ? next.night_pct : 0,
      } as never,
      { onConflict: "driver_id" },
    );
    if (error) {
      setStatus("idle");
      toast.error(
        /tariff_price_above_max/.test(error.message)
          ? `Tarif refusé : maximum ${formatEuro(MAX_PRICE_PER_KM)} / km.`
          : error.message,
      );
      return;
    }
    setStatus("saved");
    // Les prochaines demandes clients utilisent immédiatement cette tarification.
    void qc.invalidateQueries({ queryKey: ["driver-tariff"] });
    void qc.invalidateQueries({ queryKey: ["ride-quote"] });
  }

  if (isLoading) return null;
  if (!isPro) return <ProUpsell feature="Tarification" />;

  const nightPct = form.night_enabled ? form.night_pct : 0;
  const sim = simulateTariff(
    { ...form, night_pct: nightPct },
    SIM_KM,
    form.night_enabled,
  );
  const standard = simulateTariff(
    {
      price_per_km_ht: FREE_PRICE_PER_KM,
      minimum_ht: form.minimum_ht,
      pickup_pct: 0,
      night_enabled: false,
      night_start: form.night_start,
      night_end: form.night_end,
      night_pct: 0,
    },
    SIM_KM,
    false,
  );
  const diff = sim.total - standard.total;

  return (
    <>
      <PageHeader
        title="Tarification"
        description="Réglez vos prix : chaque modification est enregistrée et utilisée immédiatement pour vos prochaines demandes."
      />

      <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        {status === "saving" ? (
          <>
            <Loader2 className="size-3.5 animate-spin" /> Enregistrement…
          </>
        ) : status === "saved" ? (
          <>
            <Check className="size-3.5 text-primary" /> Tarification mise à jour
          </>
        ) : null}
      </div>

      <div className="mt-3 grid gap-4">
        {/* Prix au kilomètre */}
        <section className="surface p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-extrabold tracking-tight">Prix au kilomètre</h2>
            <p className="text-[20px] font-extrabold tabular-nums">
              {form.price_per_km_ht.toFixed(2).replace(".", ",")} €/km
            </p>
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Votre tarif : {form.price_per_km_ht.toFixed(2).replace(".", ",")} €/km
          </p>
          <Slider
            className="mt-4"
            value={[form.price_per_km_ht]}
            min={0.5}
            max={MAX_PRICE_PER_KM}
            step={0.05}
            aria-label="Prix au kilomètre"
            onValueChange={([v]) =>
              update({ price_per_km_ht: Math.round(Math.min(v ?? 0, MAX_PRICE_PER_KM) * 100) / 100 })
            }
          />
          <p className="mt-2 text-[12px] text-muted-foreground">
            Maximum ReLink : {MAX_PRICE_PER_KM.toFixed(2).replace(".", ",")} €/km
          </p>
        </section>

        {/* Tarif de nuit */}
        <section className="surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-[16px] font-extrabold tracking-tight">
              <Moon className="size-4 text-primary" /> Tarif de nuit
            </h2>
            <Switch
              checked={form.night_enabled}
              aria-label="Activer le tarif de nuit"
              onCheckedChange={(v) => update({ night_enabled: v })}
            />
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {form.night_enabled
              ? `Majoration appliquée : +${form.night_pct} %`
              : "Désactivé : aucune majoration de nuit (0 %)."}
          </p>
          {form.night_enabled ? (
            <>
              <Slider
                className="mt-4"
                value={[form.night_pct]}
                min={0}
                max={50}
                step={5}
                aria-label="Majoration de nuit"
                onValueChange={([v]) => update({ night_pct: v ?? 0 })}
              />
              <p className="mt-2 text-[12px] text-muted-foreground">
                Période de nuit : {form.night_start.replace(":", "h")} →{" "}
                {form.night_end.replace(":", "h")}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[12px]">Début</Label>
                  <Input
                    type="time"
                    value={form.night_start}
                    onChange={(e) => update({ night_start: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[12px]">Fin</Label>
                  <Input
                    type="time"
                    value={form.night_end}
                    onChange={(e) => update({ night_end: e.target.value })}
                  />
                </div>
              </div>
            </>
          ) : null}
        </section>

        {/* Prise en charge */}
        <section className="surface p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-extrabold tracking-tight">Prise en charge</h2>
            <p className="text-[20px] font-extrabold tabular-nums">+{form.pickup_pct} %</p>
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Pourcentage ajouté au prix de base de la course.
          </p>
          <Slider
            className="mt-4"
            value={[form.pickup_pct]}
            min={0}
            max={50}
            step={5}
            aria-label="Majoration de prise en charge"
            onValueChange={([v]) => update({ pickup_pct: v ?? 0 })}
          />
        </section>

        {/* Simulation */}
        <section className="surface p-5">
          <h2 className="text-[16px] font-extrabold tracking-tight">Simulation de course</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Course exemple : {SIM_KM} km
          </p>
          <dl className="mt-3 space-y-1.5 text-[13.5px]">
            <Row
              label={`Prix de base (${SIM_KM} × ${form.price_per_km_ht.toFixed(2).replace(".", ",")} €)`}
              value={formatEuro(sim.base)}
            />
            <Row label={`Prise en charge +${form.pickup_pct} %`} value={`+ ${formatEuro(sim.pickupAmount)}`} />
            <Row label={`Tarif de nuit +${nightPct} %`} value={`+ ${formatEuro(sim.nightAmount)}`} />
          </dl>
          <div className="mt-4 rounded-2xl bg-primary/10 p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
              Prix estimé client
            </p>
            <p className="text-[26px] font-extrabold tabular-nums">{formatEuro(sim.total)}</p>
          </div>
          <div className="mt-3 rounded-2xl border border-border p-4 text-[13px]">
            <p className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4 text-primary" /> Comparaison
            </p>
            <p className="mt-1.5 text-muted-foreground">
              Avec ReLink Standard à {FREE_PRICE_PER_KM.toFixed(2).replace(".", ",")} €/km :{" "}
              {formatEuro(standard.total)}
            </p>
            <p className="text-muted-foreground">
              Avec votre tarification Pro : {formatEuro(sim.total)}
            </p>
            <p className="mt-1 font-bold">
              Différence : {diff >= 0 ? "+" : "−"} {formatEuro(Math.abs(diff))}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
