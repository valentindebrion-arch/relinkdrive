/**
 * Champ « Sexe » commun au client et au chauffeur.
 *
 * Règle unique (frontend + base) : 1 choix initial + 1 correction autonome.
 * Au-delà, seule l'équipe ReLink (SAV) peut intervenir. La valeur est
 * strictement déclarative : elle n'est jamais déduite d'une autre donnée.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GENDER_HELP, GENDER_OPTIONS, genderLabel, type GenderValue } from "@/lib/woman-for-woman";

export const SAV_EMAIL = "support@relink.app";

const CORRECTION_WARNING =
  "Vous pouvez corriger cette information une seule fois. Après cette modification, tout nouveau changement devra être effectué avec l'aide du SAV ReLink.";

const CONFIRM_WARNING =
  "Après cette correction, vous ne pourrez plus modifier vous-même cette information.";

const WFW_LEAVE_WARNING =
  "Votre profil utilise actuellement Woman for Woman. En modifiant cette information, votre vitrine repassera automatiquement au thème ReLink classique et le mode Woman for Woman sera désactivé.";

/** Message serveur → message lisible. */
function readable(message: string) {
  if (/gender_correction_used/i.test(message))
    return "Cette information a déjà été corrigée. Contactez le SAV ReLink.";
  if (/invalid_gender/i.test(message)) return "Valeur invalide.";
  return message;
}

export function GenderField({
  gender,
  correctionUsed,
  womanForWomanActive = false,
  onSaved,
}: {
  gender: string | null | undefined;
  correctionUsed: boolean;
  /** Chauffeuse actuellement en mode Woman for Woman. */
  womanForWomanActive?: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const [step, setStep] = useState<"idle" | "notice" | "choose" | "confirm">("idle");
  const [value, setValue] = useState<GenderValue | "">((gender as GenderValue | null) ?? "");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const declared = !!gender;
  const canEdit = !declared || !correctionUsed;
  const leavingWfw = womanForWomanActive && value !== "female";

  async function persist() {
    if (!value) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("set_my_gender", { _gender: value });
      if (error) throw new Error(error.message);
      setStep("idle");
      toast.success("Sexe mis à jour");
      // Les droits Woman for Woman changent immédiatement, sans reconnexion.
      await queryClient.invalidateQueries();
      await onSaved();
    } catch (err) {
      toast.error(readable(err instanceof Error ? err.message : "Enregistrement impossible"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Sexe</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{genderLabel(gender)}</p>
        </div>
        {canEdit && declared ? (
          <Button
            size="sm"
            variant="outline"
            className="min-h-10 shrink-0"
            onClick={() => {
              setValue((gender as GenderValue | null) ?? "");
              setStep("notice");
            }}
          >
            <Pencil className="size-3.5" /> Modifier
          </Button>
        ) : null}
      </div>

      {/* Déclaration initiale : elle ne consomme pas la correction autorisée. */}
      {!declared ? (
        <div className="mt-2">
          <select
            aria-label="Sexe"
            value={value}
            onChange={(e) => setValue(e.target.value as GenderValue | "")}
            className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="">Non renseigné</option>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">{GENDER_HELP}</p>
          <Button
            className="mt-2 min-h-11 w-full"
            disabled={!value || busy}
            onClick={() => void persist()}
          >
            {busy ? "Enregistrement…" : "Enregistrer mon sexe"}
          </Button>
        </div>
      ) : null}

      {declared && !canEdit ? (
        <div className="mt-2">
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Cette information a déjà été modifiée. Pour effectuer une nouvelle correction, contactez
            le SAV ReLink.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2 min-h-10">
            <Link
              to="/support/nouveau"
              search={{ motif: "Modifier mes informations personnelles" }}
            >
              Contacter le SAV ReLink
            </Link>
          </Button>
        </div>
      ) : null}

      {/* Étape 1 — information avant correction */}
      <AlertDialog open={step === "notice"} onOpenChange={(o) => !o && setStep("idle")}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifier votre sexe</AlertDialogTitle>
            <AlertDialogDescription>{CORRECTION_WARNING}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => setStep("choose")}>Continuer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Étape 2 — nouvelle valeur */}
      <AlertDialog open={step === "choose"} onOpenChange={(o) => !o && setStep("idle")}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nouvelle valeur</AlertDialogTitle>
            <AlertDialogDescription>{GENDER_HELP}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            {GENDER_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setValue(o.value)}
                aria-pressed={value === o.value}
                className={`min-h-11 rounded-xl border px-3 text-left text-sm font-medium transition ${
                  value === o.value ? "border-primary bg-accent/60" : "border-border"
                }`}
              >
                {o.label}
              </button>
            ))}
            {leavingWfw ? (
              <p className="rounded-xl border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                {WFW_LEAVE_WARNING}
              </p>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={!value || value === gender}
              onClick={(e) => {
                e.preventDefault();
                setStep("confirm");
              }}
            >
              Continuer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Étape 3 — confirmation finale */}
      <AlertDialog open={step === "confirm"} onOpenChange={(o) => !o && setStep("idle")}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer cette modification ?</AlertDialogTitle>
            <AlertDialogDescription>
              {genderLabel(gender)} → {genderLabel(value)}. {CONFIRM_WARNING}
              {leavingWfw ? ` ${WFW_LEAVE_WARNING}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void persist();
              }}
            >
              {busy ? "Enregistrement…" : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
