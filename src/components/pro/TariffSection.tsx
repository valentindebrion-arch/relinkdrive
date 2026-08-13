import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyTariff, useMyTaxPeriods } from "@/lib/tax-queries";
import { formatEuro } from "@/lib/labels";
import { TARIFF_HELP, breakdownFromHt, htFromTtc } from "@/lib/tax";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULTS = { price_per_km_ht: 1.9, minimum_ht: 9 };

export function TariffSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const tariff = useMyTariff();
  const periods = useMyTaxPeriods();
  const current = periods.data?.[0] ?? null;
  const rate = current?.regime === "liable" ? Number(current.vat_rate) : null;

  const [form, setForm] = useState({ price_per_km_ht: "1.90", minimum_ht: "9" });
  const [saving, setSaving] = useState(false);
  const [choice, setChoice] = useState<"ht" | "ttc" | null>(null);

  useEffect(() => {
    const t = tariff.data;
    setForm({
      price_per_km_ht: String(t?.price_per_km_ht ?? DEFAULTS.price_per_km_ht),
      minimum_ht: String(t?.minimum_ht ?? DEFAULTS.minimum_ht),
    });
  }, [tariff.data]);

  const needsMigration = (tariff.data?.basis ?? "unqualified") === "unqualified";

  const num = (v: string) => Number(v.replace(",", "."));

  async function saveTariff() {
    const ppk = num(form.price_per_km_ht);
    const min = num(form.minimum_ht);
    if (!Number.isFinite(ppk) || ppk <= 0 || !Number.isFinite(min) || min < 0) {
      toast.error("Saisissez des montants valides.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("driver_tariffs")
      .upsert(
        { driver_id: user!.id, price_per_km_ht: ppk, minimum_ht: min } as never,
        { onConflict: "driver_id" },
      );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tarifs HT enregistrés");
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
        price_per_km_ht: newPpk,
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

  return (
    <section className="surface p-5">
      <h2 className="text-[17px] font-extrabold tracking-tight">Mes tarifs (HT)</h2>
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
              <p>TVA : {migrationPreview.vat === null ? "non applicable" : formatEuro(migrationPreview.vat)}</p>
              <p className="font-bold">Nouveau prix TTC : {formatEuro(migrationPreview.ttc)}</p>
              <Button className="mt-3" size="sm" disabled={saving} onClick={confirmBasis}>
                Confirmer et enregistrer
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ppk">Prix au kilomètre HT</Label>
          <Input
            id="ppk"
            inputMode="decimal"
            value={form.price_per_km_ht}
            onChange={(e) => setForm({ ...form, price_per_km_ht: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="min">Minimum de course HT</Label>
          <Input
            id="min"
            inputMode="decimal"
            value={form.minimum_ht}
            onChange={(e) => setForm({ ...form, minimum_ht: e.target.value })}
          />
        </div>
        <div className="rounded-2xl border border-border bg-muted/40 p-4 text-[13.5px] sm:col-span-2">
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
