import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Lock, Minus, Moon, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyTariff, useMyTaxPeriods } from "@/lib/tax-queries";
import { formatEuro } from "@/lib/labels";
import { TARIFF_HELP, breakdownFromHt, htFromTtc } from "@/lib/tax";
import {
  FREE_PRICE_PER_KM,
  MAX_PRICE_PER_KM,
  simulateTariff,
  useMyPlan,
} from "@/lib/plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const DEFAULTS = { price_per_km_ht: FREE_PRICE_PER_KM, minimum_ht: 9 };

export function TariffSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const tariff = useMyTariff();
  const periods = useMyTaxPeriods();
  const { isPro } = useMyPlan();
  const current = periods.data?.[0] ?? null;
  const rate = current?.regime === "liable" ? Number(current.vat_rate) : null;

  const [form, setForm] = useState({
    price_per_km_ht: String(FREE_PRICE_PER_KM),
    minimum_ht: "9",
    pickup_pct: "0",
    night_enabled: false,
    night_start: "22:00",
    night_end: "06:00",
    night_pct: "15",
  });
  const [saving, setSaving] = useState(false);
  const [choice, setChoice] = useState<"ht" | "ttc" | null>(null);
  const [simKm, setSimKm] = useState("20");

  useEffect(() => {
    const t = tariff.data;
    setForm({
      price_per_km_ht: String(t?.price_per_km_ht ?? DEFAULTS.price_per_km_ht),
      minimum_ht: String(t?.minimum_ht ?? DEFAULTS.minimum_ht),
      pickup_pct: String(t?.pickup_pct ?? 0),
      night_enabled: Boolean(t?.night_enabled),
      night_start: (t?.night_start ?? "22:00").slice(0, 5),
      night_end: (t?.night_end ?? "06:00").slice(0, 5),
      night_pct: String(t?.night_pct ?? 15),
    });
  }, [tariff.data]);

  const needsMigration = isPro && (tariff.data?.basis ?? "unqualified") === "unqualified";

  const num = (v: string) => Number(String(v).replace(",", "."));

  function setPricePerKm(next: number) {
    const clamped = Math.min(Math.max(Math.round(next * 100) / 100, 0.5), MAX_PRICE_PER_KM);
    setForm((f) => ({ ...f, price_per_km_ht: clamped.toFixed(2) }));
  }

  async function saveTariff() {
    const ppk = num(form.price_per_km_ht);
    const min = num(form.minimum_ht);
    const pickup = num(form.pickup_pct);
    const nightPct = num(form.night_pct);
    if (!Number.isFinite(ppk) || ppk <= 0 || !Number.isFinite(min) || min < 0) {
      toast.error("Saisissez des montants valides.");
      return;
    }
    if (ppk > MAX_PRICE_PER_KM) {
      toast.error(`Le tarif maximum autorisé par ReLink est de ${formatEuro(MAX_PRICE_PER_KM)} / km.`);
      return;
    }
    if (!Number.isFinite(pickup) || pickup < 0 || pickup > 100) {
      toast.error("La prise en charge doit être comprise entre 0 et 100 %.");
      return;
    }
    if (form.night_enabled && (!Number.isFinite(nightPct) || nightPct < 0 || nightPct > 100)) {
      toast.error("La majoration de nuit doit être comprise entre 0 et 100 %.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("driver_tariffs").upsert(
      {
        driver_id: user!.id,
        price_per_km_ht: ppk,
        minimum_ht: min,
        pickup_pct: pickup,
        night_enabled: form.night_enabled,
        night_start: form.night_start,
        night_end: form.night_end,
        night_pct: nightPct,
      } as never,
      { onConflict: "driver_id" },
    );
    setSaving(false);
    if (error) {
      toast.error(
        /tariff_price_above_max/.test(error.message)
          ? `Tarif refusé : maximum ${formatEuro(MAX_PRICE_PER_KM)} / km.`
          : error.message,
      );
      return;
    }
    toast.success("Paramètres tarifaires enregistrés");
    void qc.invalidateQueries({ queryKey: ["driver-tariff"] });
    void qc.invalidateQueries({ queryKey: ["ride-quote"] });
  }

  async function confirmBasis() {
    if (!choice) return;
    const currentPpk = tariff.data?.price_per_km_ht ?? DEFAULTS.price_per_km_ht;
    const currentMin = tariff.data?.minimum_ht ?? DEFAULTS.minimum_ht;
    const newPpk = choice === "ttc" && rate ? htFromTtc(currentPpk, rate) : currentPpk;
    const newMin = choice === "ttc" && rate ? htFromTtc(currentMin, rate) : currentMin;

    setSaving(true);
    const { error } = await supabase.from("driver_tariffs").upsert(
      {
        driver_id: user!.id,
        price_per_km_ht: Math.min(newPpk, MAX_PRICE_PER_KM),
        minimum_ht: newMin,
        basis: "ht",
        basis_confirmed_at: new Date().toISOString(),
      } as never,
      { onConflict: "driver_id" },
    );
    if (!error) {
      await supabase.from("driver_tariff_migrations").insert({
        driver_id: user!.id,
        previous_basis: choice,
        previous_price_per_km: currentPpk,
        previous_minimum: currentMin,
        new_price_per_km_ht: newPpk,
        new_minimum_ht: newMin,
        vat_rate: rate,
        decision:
          choice === "ttc"
            ? "Tarifs existants déclarés TTC — conversion en HT, prix client inchangé"
            : "Tarifs existants déclarés HT — la TVA est ajoutée pour obtenir le TTC",
      } as never);
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Nature des tarifs confirmée");
    void qc.invalidateQueries({ queryKey: ["driver-tariff"] });
    void qc.invalidateQueries({ queryKey: ["ride-quote"] });
  }

  const ppk = num(form.price_per_km_ht) || 0;
  const preview = breakdownFromHt(ppk, rate ? "liable" : "franchise", rate);
  const migrationPreview = (() => {
    const cur = tariff.data?.price_per_km_ht ?? DEFAULTS.price_per_km_ht;
    if (choice === "ttc" && rate) {
      const ht = htFromTtc(cur, rate);
      const b = breakdownFromHt(ht, "liable", rate);
      return { oldClient: cur, ht: b.ht, vat: b.vat, ttc: b.ttc };
    }
    const b = breakdownFromHt(cur, rate ? "liable" : "franchise", rate);
    return { oldClient: cur, ht: b.ht, vat: b.vat, ttc: b.ttc };
  })();

  /* ---------------------------- OFFRE GRATUITE ---------------------------- */
  if (!isPro) {
    return (
      <section className="surface p-5">
        <h2 className="text-[17px] font-extrabold tracking-tight">Mes tarifs</h2>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
          Avec ReLink Gratuit, le tarif kilométrique est fixé par ReLink. Aucune commission n'est
          prélevée sur vos courses.
        </p>

        <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
                Votre tarif ReLink
              </p>
              <p className="mt-1 text-[22px] font-extrabold tabular-nums">
                {formatEuro(FREE_PRICE_PER_KM)} / km
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Lock className="size-5" />
            </span>
          </div>
          <Input
            value={`${FREE_PRICE_PER_KM.toFixed(2).replace(".", ",")} €/km`}
            readOnly
            disabled
            aria-label="Tarif ReLink imposé"
            className="mt-3"
          />
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Ce tarif n'est pas modifiable avec l'offre Gratuite.
          </p>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-primary/30 bg-primary/8 p-4">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-[13.5px] leading-snug">
            <span className="font-bold">Passez à ReLink Pro</span> pour personnaliser vos tarifs
            (jusqu'à {formatEuro(MAX_PRICE_PER_KM)} / km), activer le tarif de nuit et la prise en
            charge.
          </p>
        </div>
      </section>
    );
  }

  /* ------------------------------ OFFRE PRO ------------------------------- */
  const settings = {
    price_per_km_ht: ppk,
    minimum_ht: num(form.minimum_ht) || 0,
    pickup_pct: num(form.pickup_pct) || 0,
    night_enabled: form.night_enabled,
    night_start: form.night_start,
    night_end: form.night_end,
    night_pct: num(form.night_pct) || 0,
  };
  const simDistance = Math.max(num(simKm) || 0, 0);
  const sim = simulateTariff(settings, simDistance, form.night_enabled);

  return (
    <section className="surface p-5">
      <h2 className="text-[17px] font-extrabold tracking-tight">Paramètres tarifaires</h2>
      <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{TARIFF_HELP}</p>

      {needsMigration ? (
        <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="flex gap-2 text-[13.5px] font-semibold">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            Les tarifs actuellement enregistrés sont-ils HT ou TTC ?
          </p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Tant que vous n'avez pas confirmé, aucune TVA n'est ajoutée automatiquement à vos
            tarifs.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(
              [
                ["ht", "Ce sont des tarifs HT", "La TVA sera ajoutée pour obtenir le prix TTC."],
                [
                  "ttc",
                  "Ce sont des tarifs TTC",
                  "Conversion en HT : votre prix client actuel reste identique.",
                ],
              ] as const
            ).map(([k, t, s]) => (
              <button
                key={k}
                type="button"
                aria-pressed={choice === k}
                onClick={() => setChoice(k)}
                className={`rounded-2xl border p-3 text-left ${
                  choice === k ? "border-primary bg-primary/8" : "border-border bg-card"
                }`}
              >
                <p className="text-[14px] font-bold">{t}</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">{s}</p>
              </button>
            ))}
          </div>
          {choice ? (
            <div className="mt-3 rounded-xl bg-card p-3 text-[13px]">
              <p className="font-bold">Aperçu (prix au kilomètre)</p>
              <p className="mt-1">Ancien prix client : {formatEuro(migrationPreview.oldClient)}</p>
              <p>Nouveau montant HT : {formatEuro(migrationPreview.ht)}</p>
              <p>
                TVA :{" "}
                {migrationPreview.vat === null ? "non applicable" : formatEuro(migrationPreview.vat)}
              </p>
              <p className="font-bold">Nouveau prix TTC : {formatEuro(migrationPreview.ttc)}</p>
              <Button className="mt-3" size="sm" disabled={saving} onClick={confirmBasis}>
                Confirmer et enregistrer
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Prix au kilomètre */}
      <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4">
        <Label htmlFor="ppk">Prix au kilomètre (HT)</Label>
        <div className="mt-2 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Diminuer le tarif"
            onClick={() => setPricePerKm(ppk - 0.05)}
          >
            <Minus className="size-4" />
          </Button>
          <Input
            id="ppk"
            inputMode="decimal"
            className="text-center text-[18px] font-extrabold tabular-nums"
            value={form.price_per_km_ht}
            onChange={(e) => setForm({ ...form, price_per_km_ht: e.target.value })}
            onBlur={() => setPricePerKm(ppk)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Augmenter le tarif"
            onClick={() => setPricePerKm(ppk + 0.05)}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <input
          type="range"
          min={0.5}
          max={MAX_PRICE_PER_KM}
          step={0.05}
          value={Math.min(ppk || 0.5, MAX_PRICE_PER_KM)}
          onChange={(e) => setPricePerKm(Number(e.target.value))}
          aria-label="Tarif kilométrique"
          className="mt-3 w-full accent-[hsl(var(--primary))]"
        />
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Maximum autorisé par ReLink : {formatEuro(MAX_PRICE_PER_KM)} / km
        </p>
      </div>

      {/* Prise en charge */}
      <div className="mt-3 rounded-2xl border border-border bg-muted/30 p-4">
        <Label htmlFor="pickup">Prise en charge</Label>
        <p className="text-[12.5px] text-muted-foreground">
          Pourcentage ajouté au tarif de base de chaque course.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Input
            id="pickup"
            inputMode="decimal"
            className="max-w-28 text-center font-bold tabular-nums"
            value={form.pickup_pct}
            onChange={(e) => setForm({ ...form, pickup_pct: e.target.value })}
          />
          <span className="text-[15px] font-bold">%</span>
          <span className="text-[13px] text-muted-foreground">
            Prise en charge : +{settings.pickup_pct} %
          </span>
        </div>
      </div>

      {/* Tarif de nuit */}
      <div className="mt-3 rounded-2xl border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Moon className="size-4 text-primary" />
            <Label htmlFor="night">Tarif de nuit</Label>
          </div>
          <Switch
            id="night"
            checked={form.night_enabled}
            onCheckedChange={(v) => setForm({ ...form, night_enabled: v })}
          />
        </div>
        {form.night_enabled ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="night-start">De</Label>
              <Input
                id="night-start"
                type="time"
                value={form.night_start}
                onChange={(e) => setForm({ ...form, night_start: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="night-end">À</Label>
              <Input
                id="night-end"
                type="time"
                value={form.night_end}
                onChange={(e) => setForm({ ...form, night_end: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="night-pct">Majoration (%)</Label>
              <Input
                id="night-pct"
                inputMode="decimal"
                value={form.night_pct}
                onChange={(e) => setForm({ ...form, night_pct: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Activez cette option pour majorer automatiquement les courses de nuit.
          </p>
        )}
      </div>

      {/* Simulateur */}
      <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
        <p className="text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
          Simulation
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Label htmlFor="sim" className="text-[13px]">
            Course de
          </Label>
          <Input
            id="sim"
            inputMode="decimal"
            className="max-w-24 text-center font-bold tabular-nums"
            value={simKm}
            onChange={(e) => setSimKm(e.target.value)}
          />
          <span className="text-[13px] font-semibold">km</span>
        </div>
        <div className="mt-3 space-y-1 text-[13.5px]">
          <p>
            Tarif chauffeur : {simDistance} km × {formatEuro(ppk)} ={" "}
            <span className="font-semibold">{formatEuro(sim.kmAmount)}</span>
          </p>
          {sim.base > sim.kmAmount ? (
            <p className="text-muted-foreground">
              Minimum de course appliqué : {formatEuro(sim.base)}
            </p>
          ) : null}
          <p>
            Prise en charge +{settings.pickup_pct} % :{" "}
            <span className="font-semibold">+{formatEuro(sim.pickupAmount)}</span>
          </p>
          {form.night_enabled ? (
            <p>
              Tarif de nuit +{settings.night_pct} % :{" "}
              <span className="font-semibold">+{formatEuro(sim.nightAmount)}</span>
            </p>
          ) : null}
        </div>
        <p className="mt-2 text-[16px] font-extrabold">
          Prix estimé : {formatEuro(sim.total)}
          {rate ? " HT" : ""}
        </p>
        {rate ? (
          <p className="text-[12.5px] text-muted-foreground">
            TVA {rate} % ajoutée au prix client : {formatEuro(breakdownFromHt(sim.total, "liable", rate).ttc)} TTC
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="min">Minimum de course HT</Label>
          <Input
            id="min"
            inputMode="decimal"
            value={form.minimum_ht}
            onChange={(e) => setForm({ ...form, minimum_ht: e.target.value })}
          />
        </div>
        <div className="rounded-2xl border border-border bg-muted/40 p-4 text-[13.5px]">
          <p className="text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
            Exemple pour 1 km
          </p>
          <p className="mt-1">Tarif HT : {formatEuro(preview.ht)}</p>
          <p>
            TVA :{" "}
            {preview.vat === null ? "non applicable" : `${formatEuro(preview.vat)} (${rate} %)`}
          </p>
          <p className="font-bold">Prix client : {formatEuro(preview.ttc)}</p>
        </div>
        <div className="sm:col-span-2">
          <Button onClick={saveTariff} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer mes tarifs"}
          </Button>
        </div>
      </div>
    </section>
  );
}
