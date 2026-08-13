import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, History, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyTaxPeriods } from "@/lib/tax-queries";
import { formatDate, formatEuro } from "@/lib/labels";
import {
  DEFAULT_FRANCHISE_MENTION,
  DEFAULT_TRANSPORT_RATE,
  DEFAULT_TRANSPORT_RATE_LABEL,
  RATE_WARNING,
  TAX_HELP,
  breakdownFromHt,
  isVatNumberFormatValid,
  normalizeVatNumber,
  validateRate,
  type TaxRegime,
} from "@/lib/tax";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function Choice({
  active,
  title,
  sub,
  onClick,
}: {
  active: boolean;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl border p-4 text-left transition ${
        active ? "border-primary bg-primary/8" : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <p className="text-[15px] font-bold">{title}</p>
      <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{sub}</p>
    </button>
  );
}

export function TaxSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const periods = useMyTaxPeriods();
  const current = periods.data?.[0] ?? null;

  const [regime, setRegime] = useState<TaxRegime | null>(null);
  const [vatNumber, setVatNumber] = useState("");
  const [ratePreset, setRatePreset] = useState<"transport" | "other">("transport");
  const [customRate, setCustomRate] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customAck, setCustomAck] = useState(false);
  const [mention, setMention] = useState(DEFAULT_FRANCHISE_MENTION);
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!current) return;
    setRegime(current.regime);
    setVatNumber(current.vat_number ?? "");
    setMention(current.legal_mention ?? DEFAULT_FRANCHISE_MENTION);
    if (current.regime === "liable") {
      const isDefault = Number(current.vat_rate) === DEFAULT_TRANSPORT_RATE;
      setRatePreset(isDefault ? "transport" : "other");
      setCustomRate(isDefault ? "" : String(current.vat_rate ?? ""));
      setCustomLabel(isDefault ? "" : (current.rate_label ?? ""));
      setCustomAck(!isDefault);
    }
  }, [current]);

  const rateValue = useMemo(() => {
    if (regime !== "liable") return null;
    if (ratePreset === "transport") return DEFAULT_TRANSPORT_RATE;
    const parsed = validateRate(customRate);
    return parsed.ok ? parsed.value : null;
  }, [regime, ratePreset, customRate]);

  const example = breakdownFromHt(20, regime ?? "franchise", rateValue);

  async function save() {
    if (!regime) {
      toast.error("Sélectionnez votre régime de TVA.");
      return;
    }
    if (!effectiveFrom) {
      toast.error("Indiquez la date de prise d'effet.");
      return;
    }
    if (!confirmed) {
      toast.error("Confirmez l'exactitude des informations fiscales.");
      return;
    }

    let rate: number | null = null;
    let label: string | null = null;
    let number: string | null = null;

    if (regime === "liable") {
      if (ratePreset === "transport") {
        rate = DEFAULT_TRANSPORT_RATE;
        label = DEFAULT_TRANSPORT_RATE_LABEL;
      } else {
        const parsed = validateRate(customRate);
        if (!parsed.ok) {
          toast.error(parsed.error);
          return;
        }
        if (!customLabel.trim()) {
          toast.error("Indiquez le libellé ou le motif fiscal de ce taux.");
          return;
        }
        if (!customAck) {
          toast.error("Confirmez explicitement l'usage d'un taux différent de 10 %.");
          return;
        }
        rate = parsed.value;
        label = customLabel.trim();
      }
      number = normalizeVatNumber(vatNumber);
      if (!number) {
        toast.error("Indiquez votre numéro de TVA intracommunautaire.");
        return;
      }
      if (!isVatNumberFormatValid(number)) {
        toast.error("Format de numéro de TVA invalide (ex. : FR40123456789).");
        return;
      }
    }

    setSaving(true);
    // Insert-only : chaque changement crée une nouvelle période fiscale,
    // les anciennes demandes et factures conservent leur instantané.
    const { error } = await supabase.from("driver_tax_profiles").insert({
      driver_id: user!.id,
      regime,
      vat_rate: rate,
      rate_label: label,
      vat_number: number,
      legal_mention: regime === "franchise" ? mention.trim() || DEFAULT_FRANCHISE_MENTION : null,
      effective_from: effectiveFrom,
      created_by: user!.id,
    } as never);
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }
    // Synchronisation des champs historiques utilisés par le modèle de facture.
    await supabase
      .from("driver_profiles")
      .update({
        vat_applicable: regime === "liable",
        billing_legal_info:
          regime === "franchise" ? mention.trim() || DEFAULT_FRANCHISE_MENTION : null,
      })
      .eq("user_id", user!.id);
    setSaving(false);
    toast.success("Régime de TVA enregistré");
    void qc.invalidateQueries({ queryKey: ["tax-periods"] });
    void qc.invalidateQueries({ queryKey: ["driver-profile"] });
    void qc.invalidateQueries({ queryKey: ["ride-quote"] });
  }

  return (
    <section className="surface p-5">
      <h2 className="text-[17px] font-extrabold tracking-tight">Fiscalité</h2>
      <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{TAX_HELP}</p>

      {!current ? (
        <div className="mt-4 flex gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-[13px]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p>Complétez votre régime de TVA pour générer des estimations et des factures correctes.</p>
        </div>
      ) : null}

      <p className="mt-5 text-[15px] font-bold">Êtes-vous assujetti et redevable de la TVA ?</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Choice
          active={regime === "franchise"}
          onClick={() => setRegime("franchise")}
          title="Non — Je bénéficie de la franchise en base de TVA"
          sub="Vos prix sont facturés sans TVA, avec la mention légale correspondante."
        />
        <Choice
          active={regime === "liable"}
          onClick={() => setRegime("liable")}
          title="Oui — Je facture la TVA"
          sub="ReLink ajoute la TVA à vos tarifs HT pour afficher le prix TTC au client."
        />
      </div>

      {regime === "franchise" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="mention">Mention légale figurant sur vos factures</Label>
            <Textarea
              id="mention"
              rows={2}
              maxLength={400}
              value={mention}
              placeholder={DEFAULT_FRANCHISE_MENTION}
              onChange={(e) => setMention(e.target.value)}
            />
            <p className="mt-1 text-[12px] text-muted-foreground">
              Référence modifiable sans changer le modèle de facture.
            </p>
          </div>
        </div>
      ) : null}

      {regime === "liable" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="vatnum">Numéro de TVA intracommunautaire</Label>
            <Input
              id="vatnum"
              value={vatNumber}
              maxLength={20}
              placeholder="Ex. : FR40123456789"
              onChange={(e) => setVatNumber(e.target.value)}
              onBlur={() => setVatNumber((v) => normalizeVatNumber(v))}
            />
            <p className="mt-1 text-[12px] text-muted-foreground">
              Format vérifié uniquement : cette vérification ne confirme pas votre situation fiscale.
            </p>
          </div>
          <div>
            <Label>Taux de TVA appliqué aux courses</Label>
            <div className="mt-1 grid gap-2">
              <Choice
                active={ratePreset === "transport"}
                onClick={() => setRatePreset("transport")}
                title="10 % — Transport de voyageurs"
                sub="Taux usuel d'une course VTC classique en France métropolitaine."
              />
              <Choice
                active={ratePreset === "other"}
                onClick={() => setRatePreset("other")}
                title="Autre taux — Situation particulière"
                sub="À utiliser uniquement si votre situation fiscale le justifie."
              />
            </div>
          </div>

          {ratePreset === "other" ? (
            <div className="grid gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:col-span-2">
              <p className="flex gap-2 text-[13px] leading-snug">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                {RATE_WARNING}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="rate">Taux appliqué (%)</Label>
                  <Input
                    id="rate"
                    inputMode="decimal"
                    value={customRate}
                    maxLength={6}
                    placeholder="20"
                    onChange={(e) => setCustomRate(e.target.value)}
                  />
                  {customRate && !validateRate(customRate).ok ? (
                    <p className="mt-1 text-[12px] font-semibold text-destructive">
                      {(validateRate(customRate) as { error: string }).error}
                    </p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="ratelabel">Libellé ou motif fiscal</Label>
                  <Input
                    id="ratelabel"
                    value={customLabel}
                    maxLength={80}
                    onChange={(e) => setCustomLabel(e.target.value)}
                  />
                </div>
              </div>
              <label className="flex items-start gap-2 text-[13px]">
                <Checkbox checked={customAck} onCheckedChange={(v) => setCustomAck(v === true)} />
                <span>Je confirme que ma situation fiscale justifie ce taux.</span>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {regime ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="eff">Date de prise d'effet</Label>
            <Input
              id="eff"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
            <p className="mt-1 text-[12px] text-muted-foreground">
              Un changement crée une nouvelle période : les factures antérieures ne sont jamais
              recalculées.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <p className="text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
              Aperçu du calcul
            </p>
            {regime === "liable" && rateValue ? (
              <ul className="mt-2 space-y-1 text-[13.5px]">
                <li>Tarif HT : {formatEuro(20)}</li>
                <li>
                  TVA à {rateValue} % : {formatEuro(example.vat ?? 0)}
                </li>
                <li className="font-bold">Prix client TTC : {formatEuro(example.ttc)}</li>
              </ul>
            ) : (
              <ul className="mt-2 space-y-1 text-[13.5px]">
                <li>Tarif : {formatEuro(20)}</li>
                <li>TVA : non applicable</li>
                <li className="font-bold">Prix client : {formatEuro(20)}</li>
              </ul>
            )}
          </div>

          <label className="flex items-start gap-2 text-[13px] sm:col-span-2">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
            <span>
              Je confirme l'exactitude de ces informations fiscales, sous ma seule responsabilité.
            </span>
          </label>

          <div className="sm:col-span-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer le régime de TVA"}
            </Button>
          </div>
        </div>
      ) : null}

      {periods.data?.length ? (
        <div className="mt-6 border-t border-border pt-4">
          <p className="flex items-center gap-2 text-[13px] font-bold">
            <History className="size-4" /> Historique des changements
          </p>
          <ul className="mt-2 space-y-2">
            {periods.data.map((p, i) => (
              <li key={p.id} className="rounded-xl border border-border p-3 text-[13px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {p.regime === "liable"
                      ? `TVA ${Number(p.vat_rate)} %${p.rate_label ? ` — ${p.rate_label}` : ""}`
                      : "Franchise en base — TVA non applicable"}
                    {i === 0 ? " · en vigueur" : ""}
                  </span>
                  <span className="text-muted-foreground">
                    Effet le {formatDate(p.effective_from)} · saisi le {formatDate(p.created_at)}
                  </span>
                </div>
                {p.vat_number ? (
                  <p className="mt-1 text-muted-foreground">N° TVA : {p.vat_number}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 flex gap-2 text-[12px] text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        ReLink ne prélève aucune commission et n'est pas l'émetteur de vos factures : elles sont
        éditées à votre nom.
      </p>
    </section>
  );
}
