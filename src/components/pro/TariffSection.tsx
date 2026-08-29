import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULTS = { price_per_km: "1.90", minimum: "9", pickup_pct: "0" };

/**
 * « Mes tarifs » — informations tarifaires renseignées par le chauffeur.
 *
 * Elles servent uniquement à alimenter l'estimation indicative affichée sur la
 * vitrine publique. Aucune facturation, aucun encaissement.
 */
export function TariffSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const tariff = useQuery({
    queryKey: ["my-tariff", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_tariffs")
        .select("*")
        .eq("driver_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const t = tariff.data;
    if (!t) return;
    setForm({
      price_per_km: String(t.price_per_km_ht ?? DEFAULTS.price_per_km),
      minimum: String(t.minimum_ht ?? DEFAULTS.minimum),
      pickup_pct: String(t.pickup_pct ?? 0),
    });
  }, [tariff.data]);

  async function save() {
    if (!user?.id) return;
    const perKm = Number(form.price_per_km.replace(",", "."));
    const minimum = Number(form.minimum.replace(",", "."));
    const pickup = Number(form.pickup_pct.replace(",", "."));
    if (!Number.isFinite(perKm) || perKm <= 0) {
      toast.error("Indiquez un prix au kilomètre valide.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("driver_tariffs").upsert(
      {
        driver_id: user.id,
        price_per_km_ht: perKm,
        minimum_ht: Number.isFinite(minimum) ? minimum : 0,
        pickup_pct: Number.isFinite(pickup) ? pickup : 0,
      },
      { onConflict: "driver_id" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tarifs enregistrés");
    void qc.invalidateQueries({ queryKey: ["my-tariff"] });
  }

  return (
    <section className="surface p-5">
      <h2 className="text-base font-semibold">Mes tarifs</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Ces informations permettent au visiteur de comprendre votre positionnement tarifaire. Elles
        alimentent l'estimation indicative de votre vitrine et n'engagent pas de prix définitif.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="ppk">Prix au kilomètre (€)</Label>
          <Input
            id="ppk"
            inputMode="decimal"
            value={form.price_per_km}
            onChange={(e) => setForm({ ...form, price_per_km: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="min">Course minimum (€)</Label>
          <Input
            id="min"
            inputMode="decimal"
            value={form.minimum}
            onChange={(e) => setForm({ ...form, minimum: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="pu">Prise en charge (%)</Label>
          <Input
            id="pu"
            inputMode="decimal"
            value={form.pickup_pct}
            onChange={(e) => setForm({ ...form, pickup_pct: e.target.value })}
          />
        </div>
      </div>

      <p className="mt-3 flex gap-2 rounded-xl bg-muted/50 px-3 py-2 text-[11.5px] leading-snug text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        L'estimation affichée au client est une fourchette autour de ce calcul. Le tarif définitif
        reste convenu directement entre vous et votre client.
      </p>

      <Button className="mt-4" onClick={() => void save()} disabled={saving}>
        Enregistrer mes tarifs
      </Button>
    </section>
  );
}
