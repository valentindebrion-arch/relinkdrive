import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, LogOut, Send, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile, useMyDocuments } from "@/lib/driver-queries";
import { DOSSIER_STATUS_LABELS, useDossierState } from "@/lib/driver-dossier";
import {
  APPLICATION_DOCS,
  APPLICATION_DOC_LABELS,
  type DriverKind,
} from "@/lib/driver-application";
import { DocumentUploader, type DriverDocument } from "@/components/pro/DocumentUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const READ_ONLY = ["pending", "under_review", "verified"];

/** Bloc « Informations professionnelles » : statut VTC ou Taxi et numéro correspondant. */
function ProfessionalInfo({
  kind,
  number,
  readOnly,
  onSaved,
}: {
  kind: DriverKind;
  number: string;
  readOnly: boolean;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [localKind, setLocalKind] = useState<DriverKind>(kind);
  const [localNumber, setLocalNumber] = useState(number);
  const [busy, setBusy] = useState(false);

  useEffect(() => setLocalKind(kind), [kind]);
  useEffect(() => setLocalNumber(number), [number]);

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("driver_profiles")
      .update({
        driver_kind: localKind,
        vtc_card_number: localKind === "vtc" ? localNumber.trim() : null,
        taxi_license_number: localKind === "taxi" ? localNumber.trim() : null,
      })
      .eq("user_id", user!.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Informations professionnelles enregistrées.");
    onSaved();
  }

  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-sm font-medium">
        Informations professionnelles <span className="text-destructive">*</span>
      </p>
      <div className="mt-3 flex gap-2">
        {(["vtc", "taxi"] as DriverKind[]).map((k) => (
          <button
            key={k}
            type="button"
            disabled={readOnly}
            onClick={() => setLocalKind(k)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              localKind === k
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {k === "vtc" ? "VTC" : "Taxi"}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <Label htmlFor="pro-number" className="text-xs">
          {localKind === "vtc" ? "Numéro de carte VTC" : "Numéro / licence Taxi"}
        </Label>
        <Input
          id="pro-number"
          value={localNumber}
          disabled={readOnly}
          placeholder={localKind === "vtc" ? "Ex. 075 1234567" : "Ex. ADS 4521"}
          onChange={(e) => setLocalNumber(e.target.value)}
        />
      </div>
      {readOnly ? null : (
        <Button
          type="button"
          size="sm"
          className="mt-3"
          disabled={busy || !localNumber.trim()}
          onClick={() => void save()}
        >
          Enregistrer
        </Button>
      )}
    </div>
  );
}

export function DossierPage() {
  const { signOut } = useAuth();
  const driver = useDriverProfile();
  const docs = useMyDocuments();
  const dossier = useDossierState();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const status = driver.data?.verification_status ?? "incomplete";
  const state = dossier.data;
  const readOnly = READ_ONLY.includes(status);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["my-documents"] });
    void qc.invalidateQueries({ queryKey: ["dossier-state"] });
    void qc.invalidateQueries({ queryKey: ["driver-profile"] });
  }

  async function handleSignOut() {
    setSignOutOpen(false);
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    void navigate({ to: "/auth", replace: true });
  }

  async function submitDossier() {
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_driver_dossier");
    setSubmitting(false);
    setConfirmOpen(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Demande envoyée ✓", {
      description:
        "Vous pouvez compléter votre profil pendant que notre équipe vérifie vos documents.",
    });
    refresh();
    void navigate({ to: "/pro" });
  }

  const missingLabels = (state?.sections ?? []).flatMap((s) =>
    s.missing.map((m) =>
      m === "fields"
        ? "Statut professionnel (VTC ou Taxi) et numéro correspondant"
        : (APPLICATION_DOC_LABELS[m] ?? m),
    ),
  );

  const canSubmit =
    missingLabels.length === 0 &&
    !!state &&
    ["incomplete", "changes_requested", "expired_documents", "rejected"].includes(status);

  const documents = (docs.data ?? []) as DriverDocument[];
  const kind = ((driver.data as { driver_kind?: string } | null)?.driver_kind ??
    "vtc") as DriverKind;
  const proNumber =
    (kind === "taxi"
      ? (driver.data as { taxi_license_number?: string } | null)?.taxi_license_number
      : driver.data?.vtc_card_number) ?? "";

  return (
    <div className="space-y-5">
      <header className="surface p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-primary/10 p-2 text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">
              {status === "verified"
                ? "Votre compte professionnel est actif"
                : "Activez votre compte professionnel"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {status === "verified"
                ? "Votre compte a été validé par ReLink. Vous pouvez utiliser toutes les fonctionnalités."
                : "Fournissez uniquement les éléments ci-dessous pour envoyer votre demande. Le reste de votre profil pourra être complété ensuite."}
            </p>
            <p className="mt-3 inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium">
              {DOSSIER_STATUS_LABELS[status] ?? status}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Éléments obligatoires</span>
            <span className="font-semibold text-foreground">{state?.percent ?? 0} %</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${state?.percent ?? 0}%` }}
            />
          </div>
        </div>

        {status === "pending" || status === "under_review" ? (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <Clock className="mt-0.5 size-4 shrink-0" />
            Demande envoyée ✓ Votre dossier est maintenant en cours de vérification par ReLink.
          </p>
        ) : null}

        {status === "changes_requested" && driver.data?.rejection_reason ? (
          <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Corrections demandées : {driver.data.rejection_reason}
          </p>
        ) : null}
        {status === "rejected" && driver.data?.rejection_reason ? (
          <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Motif du refus : {driver.data.rejection_reason}
          </p>
        ) : null}

        {status === "verified" ? (
          <Button
            type="button"
            size="lg"
            className="mt-4 h-12 w-full text-base"
            onClick={() => void navigate({ to: "/pro" })}
          >
            Accéder à mon espace professionnel
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="mt-3 h-12 w-full text-base"
          onClick={() => setSignOutOpen(true)}
        >
          <LogOut className="size-4" /> Se déconnecter
        </Button>
      </header>

      <section className="surface space-y-3 p-4">
        <h2 className="text-sm font-semibold">Éléments obligatoires</h2>
        {APPLICATION_DOCS.map((item) => (
          <DocumentUploader
            key={item.docType}
            docType={item.docType}
            label={item.label}
            required
            withExpiry={item.docType === "insurance"}
            readOnly={readOnly}
            doc={documents.find((d) => d.doc_type === item.docType) ?? null}
          />
        ))}
        <ProfessionalInfo kind={kind} number={proNumber} readOnly={readOnly} onSaved={refresh} />
      </section>

      {status !== "verified" && !readOnly ? (
        <div className="surface space-y-3 p-4">
          {missingLabels.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-primary" /> Tous les éléments obligatoires sont
              fournis.
            </p>
          ) : (
            <div className="text-sm text-muted-foreground">
              <p>Il manque :</p>
              <ul className="mt-1 list-disc pl-5">
                {missingLabels.map((label) => (
                  <li key={label} className="text-destructive">
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button
            className="w-full"
            disabled={!canSubmit || submitting}
            onClick={() => setConfirmOpen(true)}
          >
            <Send className="size-4" /> Envoyer ma demande
          </Button>
        </div>
      ) : null}

      <div className="surface p-4">
        <p className="text-sm font-medium">Compléter le reste de mon profil</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Entreprise, véhicule, fiscalité : facultatif pour envoyer votre demande, utile ensuite.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full"
          onClick={() => void navigate({ to: "/pro/dossier/completer" })}
        >
          Ouvrir mon profil complet
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Envoyer ma demande de vérification ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vos documents et vos informations professionnelles seront transmis à l'équipe ReLink.
              Vous serez informé dès qu'une décision sera prise.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void submitDossier()}>
              Confirmer l'envoi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Souhaitez-vous vous déconnecter ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vos informations et documents déjà enregistrés seront conservés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Rester connecté</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleSignOut()}>
              Se déconnecter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
