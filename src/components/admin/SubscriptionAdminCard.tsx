/**
 * Fiche chauffeur — pilotage de l'abonnement ReLink par l'administration :
 * plan en cours, changement Gratuit ↔ Pro avec confirmation, accès Pro
 * temporaire, statut de facturation et historique des décisions.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Crown, History, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatEuro } from "@/lib/labels";
import { PLAN_LABELS, PRO_PRICE_PER_MONTH, type DriverPlan } from "@/lib/plan";
import {
  BILLING_STATUS_LABELS,
  PLAN_REASONS,
  PRO_BILLING_CHOICES,
  daysFromNowIso,
  formatPlanDateTime,
  useChangeDriverPlan,
  useDriverSubscription,
  useSubscriptionHistory,
  type BillingStatus,
} from "@/lib/subscription";

const DURATIONS = [
  { key: "none", label: "Sans limite" },
  { key: "7", label: "7 jours" },
  { key: "30", label: "30 jours" },
  { key: "custom", label: "Date précise" },
] as const;

export function PlanBadge({ plan }: { plan: DriverPlan }) {
  return plan === "pro" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-primary uppercase">
      <Crown className="size-3" /> Pro
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
      Standard
    </span>
  );
}

export function SubscriptionAdminCard({ driverId }: { driverId: string }) {
  const sub = useDriverSubscription(driverId);
  const history = useSubscriptionHistory(driverId);
  const change = useChangeDriverPlan();

  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<DriverPlan>("pro");
  const [billing, setBilling] = useState<BillingStatus>("active");
  const [reason, setReason] = useState(PLAN_REASONS[0]!);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]["key"]>("none");
  const [customDate, setCustomDate] = useState("");

  const current = sub.data;
  const isPro = current?.plan === "pro";

  function openDialog(next: DriverPlan) {
    setTarget(next);
    setBilling(next === "pro" ? "active" : "free");
    setReason(next === "pro" ? PLAN_REASONS[0]! : "Retour à ReLink Gratuit");
    setDuration("none");
    setCustomDate("");
    setOpen(true);
  }

  function resolveExpiry(): string | null {
    if (target !== "pro") return null;
    if (duration === "7") return daysFromNowIso(7);
    if (duration === "30") return daysFromNowIso(30);
    if (duration === "custom" && customDate) return new Date(`${customDate}T23:59:00`).toISOString();
    return null;
  }

  async function confirm() {
    try {
      await change.mutateAsync({
        driverId,
        plan: target,
        billingStatus: billing,
        reason,
        expiresAt: resolveExpiry(),
      });
      setOpen(false);
      toast.success(
        target === "pro"
          ? "Le chauffeur bénéficie immédiatement de ReLink Pro."
          : "Le chauffeur est repassé à ReLink Gratuit (1,85 €/km).",
      );
      void sub.refetch();
      void history.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Changement impossible");
    }
  }

  return (
    <section className="surface mb-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
            Forfait du chauffeur
          </p>
          <p className="mt-1 flex items-center gap-2 text-[19px] font-extrabold tracking-tight">
            {isPro ? <Crown className="size-5 text-primary" /> : null}
            {sub.isLoading
              ? "Chargement…"
              : isPro
                ? `${PLAN_LABELS.pro} — ${formatEuro(PRO_PRICE_PER_MONTH)}/mois`
                : "Standard / Gratuit — 1,85 €/km imposé"}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Facturation : {BILLING_STATUS_LABELS[current?.billing_status ?? "free"]}
            {current?.plan_reason ? ` · ${current.plan_reason}` : ""}
          </p>
          {current?.plan_expires_at ? (
            <p className="mt-1 text-[12.5px] font-medium text-primary">
              Accès Pro jusqu'au {formatPlanDateTime(current.plan_expires_at)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <PlanBadge plan={current?.plan ?? "free"} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant={isPro ? "outline" : "secondary"}
              disabled={!isPro || sub.isLoading}
              onClick={() => openDialog("free")}
            >
              Standard / Gratuit
            </Button>
            <Button
              size="sm"
              variant={isPro ? "secondary" : "default"}
              disabled={isPro || sub.isLoading}
              onClick={() => openDialog("pro")}
            >
              <Sparkles className="size-4" /> Pro
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Modifier le forfait — effet immédiat</p>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <History className="size-4 text-muted-foreground" /> Historique de l'abonnement
        </p>
        {history.isLoading ? (
          <p className="mt-2 text-xs text-muted-foreground">Chargement…</p>
        ) : !history.data?.length ? (
          <p className="mt-2 text-xs text-muted-foreground">Aucun changement enregistré.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.data.map((h) => (
              <li key={h.id} className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <p className="font-medium">{formatPlanDateTime(h.created_at)}</p>
                <p className="mt-0.5">
                  {h.old_plan === "pro" ? "Pro" : "Gratuit"} → {h.new_plan === "pro" ? "Pro" : "Gratuit"}
                  {h.new_billing_status
                    ? ` · ${BILLING_STATUS_LABELS[h.new_billing_status as BillingStatus] ?? h.new_billing_status}`
                    : ""}
                </p>
                <p className="text-muted-foreground">
                  Motif : {h.reason || "Non précisé"} · Effectué par : {h.actor_name ?? "Administrateur"}
                  {h.expires_at ? ` · Expire le ${formatPlanDateTime(h.expires_at)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {target === "pro"
                ? "Passer ce chauffeur à ReLink Pro ?"
                : "Repasser ce chauffeur à ReLink Gratuit ?"}
            </DialogTitle>
            <DialogDescription>
              {target === "pro"
                ? "Ce changement donnera immédiatement accès aux fonctionnalités Pro : tarifs personnalisés jusqu'à 3,00 €/km, majorations de nuit et de prise en charge, courses planifiées, planning, clientèle, statistiques, analyse IA et suivi véhicule."
                : "Les fonctionnalités Pro seront désactivées et le tarif reviendra à 1,85 €/km. Les réglages tarifaires Pro sont conservés et pourront être restaurés lors d'un futur passage en Pro."}
            </DialogDescription>
          </DialogHeader>

          {target === "pro" ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Nature du passage en Pro</Label>
                <RadioGroup
                  value={billing}
                  onValueChange={(v) => setBilling(v as BillingStatus)}
                  className="mt-2 gap-2"
                >
                  {PRO_BILLING_CHOICES.map((c) => (
                    <label
                      key={c.value}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <RadioGroupItem value={c.value} className="mt-1" />
                      <span className="text-sm">
                        {c.label}
                        <span className="block text-xs text-muted-foreground">{c.hint}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label className="text-xs">Durée de l'accès Pro</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setDuration(d.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${duration === d.key ? "border-primary bg-accent" : "border-border text-muted-foreground"}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                {duration === "custom" ? (
                  <Input
                    type="date"
                    className="mt-2 max-w-[200px]"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                  />
                ) : null}
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs">Statut de facturation</Label>
              <RadioGroup
                value={billing}
                onValueChange={(v) => setBilling(v as BillingStatus)}
                className="mt-2 gap-2"
              >
                {(["free", "canceled", "past_due"] as BillingStatus[]).map((s) => (
                  <label
                    key={s}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <RadioGroupItem value={s} />
                    {BILLING_STATUS_LABELS[s]}
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          <div>
            <Label className="text-xs" htmlFor="plan-reason">
              Motif du changement
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLAN_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${reason === r ? "border-primary bg-accent" : "border-border text-muted-foreground"}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Input
              id="plan-reason"
              className="mt-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motif enregistré dans l'historique"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button disabled={change.isPending} onClick={() => void confirm()}>
              {change.isPending
                ? "Application…"
                : target === "pro"
                  ? "Confirmer le passage en Pro"
                  : "Confirmer le passage en Gratuit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
