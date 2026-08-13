import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile, useMyDocuments, useMyVehicle } from "@/lib/driver-queries";
import {
  SIREN_RE,
  SIRET_RE,
  VTC_LICENSE_CATEGORIES,
  digitsOnly,
  saveDossierDetails,
  splitName,
  useDossierDetails,
  useMyCompany,
  useMyProfile,
} from "@/lib/dossier-form";
import { useDossierState } from "@/lib/driver-dossier";
import { DocumentUploader, type DriverDocument } from "@/components/pro/DocumentUploader";
import { TaxSection } from "@/components/pro/TaxSection";
import { TariffSection } from "@/components/pro/TariffSection";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export const WIZARD_STEPS = [
  { key: "identity", label: "Identité" },
  { key: "license", label: "Permis" },
  { key: "vtc", label: "Carte VTC" },
  { key: "company", label: "Entreprise" },
  { key: "insurance", label: "Assurances" },
  { key: "vehicle", label: "Véhicule" },
  { key: "tax", label: "Fiscalité" },
  { key: "review", label: "Vérification et envoi" },
] as const;

type StepKey = (typeof WIZARD_STEPS)[number]["key"];

const READ_ONLY_STATUS = ["pending", "under_review"];

function Field({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function DossierWizard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/pro/dossier/completer" }) as {
    section?: string;
  };

  const profile = useMyProfile();
  const driver = useDriverProfile();
  const company = useMyCompany();
  const vehicle = useMyVehicle();
  const details = useDossierDetails();
  const docs = useMyDocuments();
  const dossier = useDossierState();

  const status = driver.data?.verification_status ?? "incomplete";
  const readOnly = READ_ONLY_STATUS.includes(status);
  const loading =
    profile.isLoading ||
    driver.isLoading ||
    company.isLoading ||
    vehicle.isLoading ||
    details.isLoading;

  const step = (WIZARD_STEPS.find((s) => s.key === search.section)?.key ?? "identity") as StepKey;
  const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === step);

  const [form, setForm] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [certified, setCertified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hydrated = useRef(false);
  const initialized = useRef(false);

  // Une seule ligne par chauffeur (clé primaire driver_id) : l'upsert est idempotent.
  useEffect(() => {
    if (!user?.id || details.isLoading || details.data || initialized.current) return;
    initialized.current = true;
    void saveDossierDetails(user.id, {}).then(
      () => void qc.invalidateQueries({ queryKey: ["dossier-details", user.id] }),
      () => toast.error("Impossible de préparer votre dossier. Réessayez."),
    );
  }, [details.data, details.isLoading, qc, user?.id]);

  // Une ouverture directe reprend la première correction ou section incomplète.
  useEffect(() => {
    if (search.section || !dossier.data?.sections.length) return;
    const sections = dossier.data.sections;
    const target =
      sections.find((section) => section.state === "changes" || section.state === "expired") ??
      sections.find((section) => section.state === "todo");
    if (!target || target.key === "identity") return;
    void navigate({
      to: "/pro/dossier/completer",
      search: { section: target.key },
      replace: true,
    });
  }, [dossier.data?.sections, navigate, search.section]);

  // Préremplissage : les données déjà connues ne sont jamais effacées.
  useEffect(() => {
    if (loading || hydrated.current) return;
    const n = splitName(profile.data?.full_name);
    const d = details.data;
    const c = company.data;
    const v = vehicle.data;
    setForm({
      first_name: n.first,
      last_name: n.last,
      phone: profile.data?.phone ?? "",
      birth_date: d?.birth_date ?? "",
      postal_address: d?.postal_address ?? "",
      id_doc_type: d?.id_doc_type ?? "carte_identite",
      id_doc_expires_on: d?.id_doc_expires_on ?? "",
      license_number: d?.license_number ?? "",
      license_categories: d?.license_categories ?? "B",
      license_issued_on: d?.license_issued_on ?? "",
      license_expires_on: d?.license_expires_on ?? "",
      vtc_card_number: driver.data?.vtc_card_number ?? "",
      vtc_issued_on: d?.vtc_issued_on ?? "",
      vtc_expires_on: d?.vtc_expires_on ?? "",
      vtc_authority: d?.vtc_authority ?? "",
      trade_name: d?.trade_name ?? driver.data?.business_name ?? "",
      legal_name: c?.legal_name ?? "",
      legal_form: c?.legal_form ?? "",
      siren: d?.siren ?? "",
      siret: c?.siret ?? "",
      company_address: c?.address ?? "",
      revtc_number: d?.revtc_number ?? "",
      rc_company: d?.rc_company ?? "",
      rc_contract: d?.rc_contract ?? "",
      rc_starts_on: d?.rc_starts_on ?? "",
      rc_expires_on: d?.rc_expires_on ?? "",
      auto_company: d?.auto_company ?? v?.insurance_provider ?? "",
      auto_contract: d?.auto_contract ?? "",
      auto_plate: d?.auto_plate ?? v?.plate ?? "",
      auto_starts_on: d?.auto_starts_on ?? "",
      auto_expires_on: d?.auto_expires_on ?? v?.insurance_expires_at ?? "",
      brand: v?.brand ?? "",
      model: v?.model ?? "",
      year: v?.year ? String(v.year) : "",
      color: v?.color ?? "",
      plate: v?.plate ?? "",
      max_passengers: v?.max_passengers ? String(v.max_passengers) : "4",
      registration_holder: d?.registration_holder ?? "",
      inspection_expires_at: v?.inspection_expires_at ?? "",
    });
    hydrated.current = true;
  }, [loading, profile.data, driver.data, company.data, vehicle.data, details.data]);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  const docFor = (type: string) =>
    ((docs.data ?? []) as DriverDocument[]).find((d) => d.doc_type === type) ?? null;

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["dossier-state"] });
    void qc.invalidateQueries({ queryKey: ["dossier-details"] });
    void qc.invalidateQueries({ queryKey: ["driver-profile"] });
    void qc.invalidateQueries({ queryKey: ["my-company"] });
    void qc.invalidateQueries({ queryKey: ["my-profile"] });
    void qc.invalidateQueries({ queryKey: ["my-vehicle"] });
  }

  /** Validation par section. Retourne un message d'erreur ou null. */
  function validate(target: StepKey): string | null {
    const f = form;
    if (target === "identity") {
      if (!f["first_name"]?.trim() || !f["last_name"]?.trim())
        return "Indiquez votre prénom et votre nom.";
      if (!f["birth_date"]) return "Indiquez votre date de naissance.";
      if (!f["postal_address"]?.trim()) return "Indiquez votre adresse postale.";
      if (!/^[+\d][\d\s.-]{7,}$/.test(f["phone"] ?? ""))
        return "Indiquez un numéro de téléphone valide.";
    }
    if (target === "license") {
      if (!f["license_number"]?.trim()) return "Indiquez le numéro de votre permis.";
      if (!f["license_categories"]?.trim()) return "Indiquez la catégorie du permis.";
      if (
        !VTC_LICENSE_CATEGORIES.some((c) =>
          (f["license_categories"] ?? "").toUpperCase().includes(c.split(" ")[0]!),
        )
      )
        return "La catégorie déclarée n'est pas compatible avec l'activité VTC (catégorie B requise).";
      if (!f["license_issued_on"]) return "Indiquez la date d'obtention du permis.";
    }
    if (target === "vtc") {
      if (!f["vtc_card_number"]?.trim())
        return "Indiquez le numéro de votre carte professionnelle VTC.";
      if (!f["vtc_expires_on"]) return "Indiquez la date d'expiration de la carte VTC.";
    }
    if (target === "company") {
      if (!f["legal_name"]?.trim()) return "Indiquez la raison sociale de votre entreprise.";
      if (!f["legal_form"]?.trim()) return "Indiquez la forme juridique.";
      if (!SIREN_RE.test(digitsOnly(f["siren"] ?? "")))
        return "Le SIREN doit comporter 9 chiffres.";
      if (!SIRET_RE.test(digitsOnly(f["siret"] ?? "")))
        return "Le SIRET doit comporter 14 chiffres.";
      if (!digitsOnly(f["siret"] ?? "").startsWith(digitsOnly(f["siren"] ?? "")))
        return "Le SIRET doit commencer par le SIREN.";
      if (!f["company_address"]?.trim()) return "Indiquez l'adresse professionnelle.";
    }
    if (target === "insurance") {
      if (!f["rc_company"]?.trim() || !f["rc_contract"]?.trim())
        return "Complétez la compagnie et le numéro de contrat de la RC professionnelle.";
      if (!f["rc_expires_on"]) return "Indiquez la date d'expiration de la RC professionnelle.";
      if (!f["auto_company"]?.trim() || !f["auto_contract"]?.trim())
        return "Complétez l'assurance automobile professionnelle.";
      if (!f["auto_expires_on"]) return "Indiquez la date d'expiration de l'assurance automobile.";
    }
    if (target === "vehicle") {
      if (!f["brand"]?.trim() || !f["model"]?.trim())
        return "Indiquez la marque et le modèle du véhicule.";
      if (!f["plate"]?.trim()) return "Indiquez l'immatriculation.";
      if (!f["registration_holder"]?.trim()) return "Indiquez le titulaire de la carte grise.";
      if (!f["year"] || Number(f["year"]) < 1990)
        return "Indiquez l'année de première mise en circulation.";
    }
    return null;
  }

  /** Enregistre la section courante côté serveur. */
  async function persist(target: StepKey): Promise<boolean> {
    if (readOnly || target === "tax" || target === "review") return true;
    const err = validate(target);
    if (err) {
      toast.error(err);
      return false;
    }
    setSaving(true);
    try {
      const f = form;
      if (target === "identity") {
        const full = `${f["first_name"]!.trim()} ${f["last_name"]!.trim()}`.trim();
        const { error } = await supabase
          .from("profiles")
          .update({ full_name: full, phone: f["phone"]!.trim() })
          .eq("id", user!.id);
        if (error) throw error;
        await saveDossierDetails(user!.id, {
          birth_date: f["birth_date"] || null,
          postal_address: f["postal_address"] || null,
          id_doc_type: f["id_doc_type"] || null,
          id_doc_expires_on: f["id_doc_expires_on"] || null,
        });
      }
      if (target === "license") {
        await saveDossierDetails(user!.id, {
          license_number: f["license_number"] || null,
          license_categories: f["license_categories"] || null,
          license_issued_on: f["license_issued_on"] || null,
          license_expires_on: f["license_expires_on"] || null,
        });
      }
      if (target === "vtc") {
        const { error } = await supabase
          .from("driver_profiles")
          .update({ vtc_card_number: f["vtc_card_number"]!.trim() })
          .eq("user_id", user!.id);
        if (error) throw error;
        await saveDossierDetails(user!.id, {
          vtc_issued_on: f["vtc_issued_on"] || null,
          vtc_expires_on: f["vtc_expires_on"] || null,
          vtc_authority: f["vtc_authority"] || null,
        });
      }
      if (target === "company") {
        const payload = {
          driver_id: user!.id,
          legal_name: f["legal_name"]!.trim(),
          legal_form: f["legal_form"]!.trim(),
          siret: digitsOnly(f["siret"] ?? ""),
          address: f["company_address"]!.trim(),
        };
        const { error } = company.data?.id
          ? await supabase.from("companies").update(payload).eq("id", company.data.id)
          : await supabase.from("companies").insert(payload);
        if (error) throw error;
        const { error: dpErr } = await supabase
          .from("driver_profiles")
          .update({
            siret: digitsOnly(f["siret"] ?? ""),
            ...(f["trade_name"]?.trim() ? { business_name: f["trade_name"]!.trim() } : {}),
          })
          .eq("user_id", user!.id);
        if (dpErr) throw dpErr;
        await saveDossierDetails(user!.id, {
          trade_name: f["trade_name"] || null,
          siren: digitsOnly(f["siren"] ?? "") || null,
          revtc_number: f["revtc_number"] || null,
        });
      }
      if (target === "insurance") {
        await saveDossierDetails(user!.id, {
          rc_company: f["rc_company"] || null,
          rc_contract: f["rc_contract"] || null,
          rc_starts_on: f["rc_starts_on"] || null,
          rc_expires_on: f["rc_expires_on"] || null,
          auto_company: f["auto_company"] || null,
          auto_contract: f["auto_contract"] || null,
          auto_plate: f["auto_plate"] || null,
          auto_starts_on: f["auto_starts_on"] || null,
          auto_expires_on: f["auto_expires_on"] || null,
        });
        if (vehicle.data?.id) {
          const { error } = await supabase
            .from("vehicles")
            .update({
              insurance_provider: f["auto_company"] || null,
              insurance_expires_at: f["auto_expires_on"] || null,
            })
            .eq("id", vehicle.data.id);
          if (error) throw error;
        }
      }
      if (target === "vehicle") {
        const payload = {
          driver_id: user!.id,
          brand: f["brand"]!.trim(),
          model: f["model"]!.trim(),
          year: Number(f["year"]) || null,
          color: f["color"] || null,
          plate: f["plate"]!.trim().toUpperCase(),
          max_passengers: Number(f["max_passengers"]) || 4,
          inspection_expires_at: f["inspection_expires_at"] || null,
          is_primary: true,
        };
        const { error } = vehicle.data?.id
          ? await supabase.from("vehicles").update(payload).eq("id", vehicle.data.id)
          : await supabase.from("vehicles").insert(payload);
        if (error) throw error;
        await saveDossierDetails(user!.id, {
          registration_holder: f["registration_holder"] || null,
        });
        if (f["auto_plate"] && f["auto_plate"].toUpperCase() !== payload.plate) {
          toast.warning(
            "L'immatriculation assurée diffère de celle du véhicule : vérifiez la cohérence.",
          );
        }
      }
      refresh();
      toast.success("Modifications enregistrées.");
      setDirty(false);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible. Réessayez.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function goStep(key: StepKey) {
    void navigate({ to: "/pro/dossier/completer", search: { section: key } });
    if (typeof window !== "undefined") {
      window.localStorage.setItem("relink:dossier:last-section", key);
      window.scrollTo({ top: 0 });
    }
  }

  async function saveAndContinue() {
    const ok = await persist(step);
    if (!ok) return;
    const next = WIZARD_STEPS[stepIndex + 1];
    if (next) goStep(next.key);
    else void navigate({ to: "/pro/dossier" });
  }

  async function saveAndQuit() {
    const ok = await persist(step);
    if (!ok) return;
    void navigate({ to: "/pro/dossier" });
  }

  function back() {
    if (dirty) {
      setLeaveOpen(true);
      return;
    }
    void navigate({ to: "/pro/dossier" });
  }

  async function submitDossier() {
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_driver_dossier");
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await saveDossierDetails(user!.id, { certified_at: new Date().toISOString() });
    refresh();
    toast.success("Votre dossier a bien été transmis. Il est en cours de vérification.");
    void navigate({ to: "/pro/dossier" });
  }

  const state = dossier.data;
  const sectionState = useMemo(() => {
    const map: Record<string, string> = {};
    (state?.sections ?? []).forEach((s) => (map[s.key] = s.state));
    return map;
  }, [state]);

  const missingForSubmit = !state?.complete;

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Chargement de votre dossier…
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={back} aria-label="Retour au statut du compte">
          <ArrowLeft className="size-4" /> Statut du compte
        </Button>
      </div>

      <header className="surface p-4">
        <h1 className="text-lg font-semibold">Compléter mon dossier</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Renseignez vos informations et transmettez les justificatifs nécessaires à la vérification
          de votre compte professionnel.
        </p>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Étape {stepIndex + 1} sur {WIZARD_STEPS.length} · {WIZARD_STEPS[stepIndex]!.label}
            </span>
            <span className="font-semibold text-foreground">{state?.percent ?? 0} %</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${state?.percent ?? 0}%` }}
            />
          </div>
        </div>
        <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {WIZARD_STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => goStep(s.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                s.key === step
                  ? "bg-primary text-primary-foreground"
                  : sectionState[s.key] === "changes" || sectionState[s.key] === "expired"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}. {s.label}
            </button>
          ))}
        </div>
      </header>

      {readOnly ? (
        <p className="surface flex items-start gap-2 p-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Votre dossier est en cours de vérification : les modifications sont temporairement
          bloquées.
        </p>
      ) : null}

      {status === "changes_requested" && driver.data?.rejection_reason ? (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          Corrections demandées : {driver.data.rejection_reason}
        </p>
      ) : null}

      <section className="surface space-y-4 p-4">
        {step === "identity" ? (
          <>
            <h2 className="text-base font-semibold">Identité</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="first_name" label="Prénom">
                <Input
                  id="first_name"
                  value={form["first_name"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("first_name", e.target.value)}
                />
              </Field>
              <Field id="last_name" label="Nom">
                <Input
                  id="last_name"
                  value={form["last_name"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("last_name", e.target.value)}
                />
              </Field>
              <Field id="birth_date" label="Date de naissance">
                <Input
                  id="birth_date"
                  type="date"
                  value={form["birth_date"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("birth_date", e.target.value)}
                />
              </Field>
              <Field id="phone" label="Téléphone">
                <Input
                  id="phone"
                  type="tel"
                  value={form["phone"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
              <Field
                id="postal_address"
                label="Adresse postale"
                hint="Adresse figurant sur votre pièce d'identité."
              >
                <Input
                  id="postal_address"
                  value={form["postal_address"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("postal_address", e.target.value)}
                />
              </Field>
              <Field id="id_doc_type" label="Type de pièce">
                <select
                  id="id_doc_type"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form["id_doc_type"] ?? "carte_identite"}
                  disabled={readOnly}
                  onChange={(e) => set("id_doc_type", e.target.value)}
                >
                  <option value="carte_identite">Carte nationale d'identité</option>
                  <option value="passeport">Passeport</option>
                  <option value="titre_sejour">Titre de séjour</option>
                </select>
              </Field>
              <Field id="id_doc_expires_on" label="Date d'expiration de la pièce">
                <Input
                  id="id_doc_expires_on"
                  type="date"
                  value={form["id_doc_expires_on"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("id_doc_expires_on", e.target.value)}
                />
              </Field>
            </div>
            <div className="space-y-3">
              <DocumentUploader
                docType="driver_photo"
                label="Photo récente du chauffeur"
                doc={docFor("driver_photo")}
                withExpiry={false}
                readOnly={readOnly}
              />
              <DocumentUploader
                docType="identity"
                label="Pièce d'identité (recto)"
                doc={docFor("identity")}
                required
                readOnly={readOnly}
              />
              <DocumentUploader
                docType="identity_back"
                label="Pièce d'identité (verso)"
                doc={docFor("identity_back")}
                withExpiry={false}
                readOnly={readOnly}
                help="Si votre pièce comporte un verso."
              />
            </div>
          </>
        ) : null}

        {step === "license" ? (
          <>
            <h2 className="text-base font-semibold">Permis de conduire</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="license_number" label="Numéro du permis">
                <Input
                  id="license_number"
                  value={form["license_number"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("license_number", e.target.value)}
                />
              </Field>
              <Field
                id="license_categories"
                label="Catégorie"
                hint="La catégorie B est requise pour l'activité VTC."
              >
                <Input
                  id="license_categories"
                  value={form["license_categories"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("license_categories", e.target.value)}
                />
              </Field>
              <Field id="license_issued_on" label="Date d'obtention">
                <Input
                  id="license_issued_on"
                  type="date"
                  value={form["license_issued_on"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("license_issued_on", e.target.value)}
                />
              </Field>
              <Field id="license_expires_on" label="Date d'expiration (si applicable)">
                <Input
                  id="license_expires_on"
                  type="date"
                  value={form["license_expires_on"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("license_expires_on", e.target.value)}
                />
              </Field>
            </div>
            <div className="space-y-3">
              <DocumentUploader
                docType="driving_license"
                label="Permis (recto)"
                doc={docFor("driving_license")}
                required
                readOnly={readOnly}
              />
              <DocumentUploader
                docType="driving_license_back"
                label="Permis (verso)"
                doc={docFor("driving_license_back")}
                withExpiry={false}
                readOnly={readOnly}
              />
              <DocumentUploader
                docType="adcs"
                label="Attestation ADCS récente"
                doc={docFor("adcs")}
                readOnly={readOnly}
                help="Si elle est exigée dans votre parcours de vérification."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Le dépôt d'un fichier ne vaut pas validation : chaque pièce est contrôlée par l'équipe
              ReLink.
            </p>
          </>
        ) : null}

        {step === "vtc" ? (
          <>
            <h2 className="text-base font-semibold">Carte professionnelle VTC</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="vtc_card_number" label="Numéro de carte professionnelle">
                <Input
                  id="vtc_card_number"
                  value={form["vtc_card_number"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("vtc_card_number", e.target.value)}
                />
              </Field>
              <Field id="vtc_authority" label="Autorité ou préfecture de délivrance">
                <Input
                  id="vtc_authority"
                  value={form["vtc_authority"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("vtc_authority", e.target.value)}
                />
              </Field>
              <Field id="vtc_issued_on" label="Date de délivrance">
                <Input
                  id="vtc_issued_on"
                  type="date"
                  value={form["vtc_issued_on"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("vtc_issued_on", e.target.value)}
                />
              </Field>
              <Field id="vtc_expires_on" label="Date d'expiration">
                <Input
                  id="vtc_expires_on"
                  type="date"
                  value={form["vtc_expires_on"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("vtc_expires_on", e.target.value)}
                />
              </Field>
            </div>
            <div className="space-y-3">
              <DocumentUploader
                docType="vtc_card"
                label="Carte VTC (recto)"
                doc={docFor("vtc_card")}
                required
                readOnly={readOnly}
              />
              <DocumentUploader
                docType="vtc_card_back"
                label="Carte VTC (verso)"
                doc={docFor("vtc_card_back")}
                withExpiry={false}
                readOnly={readOnly}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Ces informations sont comparées au reste de votre dossier (identité, entreprise,
              véhicule).
            </p>
          </>
        ) : null}

        {step === "company" ? (
          <>
            <h2 className="text-base font-semibold">Entreprise</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="trade_name" label="Nom commercial (facultatif)">
                <Input
                  id="trade_name"
                  value={form["trade_name"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("trade_name", e.target.value)}
                />
              </Field>
              <Field id="legal_name" label="Raison sociale">
                <Input
                  id="legal_name"
                  value={form["legal_name"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("legal_name", e.target.value)}
                />
              </Field>
              <Field id="legal_form" label="Forme juridique" hint="Par exemple : EI, EURL, SASU.">
                <Input
                  id="legal_form"
                  value={form["legal_form"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("legal_form", e.target.value)}
                />
              </Field>
              <Field id="siren" label="SIREN (9 chiffres)">
                <Input
                  id="siren"
                  inputMode="numeric"
                  value={form["siren"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("siren", e.target.value)}
                />
              </Field>
              <Field id="siret" label="SIRET (14 chiffres)">
                <Input
                  id="siret"
                  inputMode="numeric"
                  value={form["siret"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("siret", e.target.value)}
                />
              </Field>
              <Field id="revtc_number" label="Numéro d'inscription REVTC">
                <Input
                  id="revtc_number"
                  value={form["revtc_number"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("revtc_number", e.target.value)}
                />
              </Field>
              <Field id="company_address" label="Adresse professionnelle">
                <Input
                  id="company_address"
                  value={form["company_address"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("company_address", e.target.value)}
                />
              </Field>
            </div>
            <div className="space-y-3">
              <DocumentUploader
                docType="company_proof"
                label="Justificatif d'entreprise (SIRET)"
                doc={docFor("company_proof")}
                required
                readOnly={readOnly}
              />
              <DocumentUploader
                docType="revtc_proof"
                label="Justificatif d'inscription REVTC"
                doc={docFor("revtc_proof")}
                readOnly={readOnly}
              />
              <DocumentUploader
                docType="rne_kbis"
                label="Extrait RNE ou Kbis"
                doc={docFor("rne_kbis")}
                readOnly={readOnly}
              />
            </div>
          </>
        ) : null}

        {step === "insurance" ? (
          <>
            <h2 className="text-base font-semibold">Assurances</h2>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Responsabilité civile professionnelle</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="rc_company" label="Compagnie d'assurance">
                  <Input
                    id="rc_company"
                    value={form["rc_company"] ?? ""}
                    disabled={readOnly}
                    onChange={(e) => set("rc_company", e.target.value)}
                  />
                </Field>
                <Field id="rc_contract" label="Numéro de contrat">
                  <Input
                    id="rc_contract"
                    value={form["rc_contract"] ?? ""}
                    disabled={readOnly}
                    onChange={(e) => set("rc_contract", e.target.value)}
                  />
                </Field>
                <Field id="rc_starts_on" label="Date de début">
                  <Input
                    id="rc_starts_on"
                    type="date"
                    value={form["rc_starts_on"] ?? ""}
                    disabled={readOnly}
                    onChange={(e) => set("rc_starts_on", e.target.value)}
                  />
                </Field>
                <Field id="rc_expires_on" label="Date d'expiration">
                  <Input
                    id="rc_expires_on"
                    type="date"
                    value={form["rc_expires_on"] ?? ""}
                    disabled={readOnly}
                    onChange={(e) => set("rc_expires_on", e.target.value)}
                  />
                </Field>
              </div>
              <DocumentUploader
                docType="insurance_rc"
                label="Attestation RC professionnelle"
                doc={docFor("insurance_rc")}
                readOnly={readOnly}
              />
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Assurance automobile professionnelle</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="auto_company" label="Compagnie">
                  <Input
                    id="auto_company"
                    value={form["auto_company"] ?? ""}
                    disabled={readOnly}
                    onChange={(e) => set("auto_company", e.target.value)}
                  />
                </Field>
                <Field id="auto_contract" label="Numéro de contrat">
                  <Input
                    id="auto_contract"
                    value={form["auto_contract"] ?? ""}
                    disabled={readOnly}
                    onChange={(e) => set("auto_contract", e.target.value)}
                  />
                </Field>
                <Field id="auto_plate" label="Immatriculation couverte">
                  <Input
                    id="auto_plate"
                    value={form["auto_plate"] ?? ""}
                    disabled={readOnly}
                    onChange={(e) => set("auto_plate", e.target.value)}
                  />
                </Field>
                <Field id="auto_starts_on" label="Date de début">
                  <Input
                    id="auto_starts_on"
                    type="date"
                    value={form["auto_starts_on"] ?? ""}
                    disabled={readOnly}
                    onChange={(e) => set("auto_starts_on", e.target.value)}
                  />
                </Field>
                <Field id="auto_expires_on" label="Date d'expiration">
                  <Input
                    id="auto_expires_on"
                    type="date"
                    value={form["auto_expires_on"] ?? ""}
                    disabled={readOnly}
                    onChange={(e) => set("auto_expires_on", e.target.value)}
                  />
                </Field>
              </div>
              <DocumentUploader
                docType="insurance"
                label="Attestation d'assurance avec usage professionnel (VTC)"
                doc={docFor("insurance")}
                required
                readOnly={readOnly}
                help="Une assurance automobile ordinaire ne suffit pas : l'usage VTC doit être mentionné."
              />
            </div>
          </>
        ) : null}

        {step === "vehicle" ? (
          <>
            <h2 className="text-base font-semibold">Véhicule</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="brand" label="Marque">
                <Input
                  id="brand"
                  value={form["brand"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("brand", e.target.value)}
                />
              </Field>
              <Field id="model" label="Modèle">
                <Input
                  id="model"
                  value={form["model"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("model", e.target.value)}
                />
              </Field>
              <Field id="year" label="Année de première mise en circulation">
                <Input
                  id="year"
                  inputMode="numeric"
                  value={form["year"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("year", e.target.value)}
                />
              </Field>
              <Field id="color" label="Couleur">
                <Input
                  id="color"
                  value={form["color"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("color", e.target.value)}
                />
              </Field>
              <Field id="plate" label="Immatriculation">
                <Input
                  id="plate"
                  value={form["plate"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("plate", e.target.value)}
                />
              </Field>
              <Field id="max_passengers" label="Nombre de places passagers">
                <Input
                  id="max_passengers"
                  inputMode="numeric"
                  value={form["max_passengers"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("max_passengers", e.target.value)}
                />
              </Field>
              <Field id="registration_holder" label="Titulaire de la carte grise">
                <Input
                  id="registration_holder"
                  value={form["registration_holder"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("registration_holder", e.target.value)}
                />
              </Field>
              <Field id="inspection_expires_at" label="Expiration du contrôle technique">
                <Input
                  id="inspection_expires_at"
                  type="date"
                  value={form["inspection_expires_at"] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => set("inspection_expires_at", e.target.value)}
                />
              </Field>
            </div>
            {form["auto_plate"] &&
            form["plate"] &&
            form["auto_plate"].toUpperCase() !== form["plate"].toUpperCase() ? (
              <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                L'immatriculation assurée ({form["auto_plate"]}) diffère de celle du véhicule.
              </p>
            ) : null}
            <div className="space-y-3">
              <DocumentUploader
                docType="registration"
                label="Carte grise"
                doc={docFor("registration")}
                required
                readOnly={readOnly}
              />
              <DocumentUploader
                docType="inspection"
                label="Contrôle technique"
                doc={docFor("inspection")}
                required
                readOnly={readOnly}
              />
              <DocumentUploader
                docType="vehicle_ownership"
                label="Justificatif d'utilisation du véhicule"
                doc={docFor("vehicle_ownership")}
                readOnly={readOnly}
                help="Si le véhicule n'appartient pas au chauffeur (location, LLD, prêt)."
              />
            </div>
          </>
        ) : null}

        {step === "tax" ? (
          <>
            <h2 className="text-base font-semibold">Fiscalité</h2>
            <TaxSection />
            <TariffSection />
          </>
        ) : null}

        {step === "review" ? (
          <>
            <h2 className="text-base font-semibold">Vérifier mon dossier</h2>
            <div className="space-y-2">
              {(state?.sections ?? []).map((s) => (
                <div key={s.key} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{s.label}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {s.missing.length
                          ? `${s.missing.length} élément(s) manquant(s)`
                          : "Complète"}
                      </span>
                      {WIZARD_STEPS.some((w) => w.key === s.key) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => goStep(s.key as StepKey)}
                        >
                          Modifier
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Documents :{" "}
                    {s.docs.length ? s.docs.filter((d) => docFor(d)?.file_path).length : 0}/
                    {s.docs.length}
                  </p>
                </div>
              ))}
            </div>

            {readOnly ? (
              <p className="text-sm text-muted-foreground">
                Votre dossier est déjà en cours de vérification.
              </p>
            ) : (
              <>
                <label className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm">
                  <Checkbox
                    checked={certified}
                    onCheckedChange={(v) => setCertified(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    Je certifie que les informations et documents transmis sont exacts, complets et
                    à jour.
                  </span>
                </label>
                <Button
                  className="w-full"
                  size="lg"
                  disabled={missingForSubmit || !certified || submitting}
                  onClick={() => void submitDossier()}
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Envoyer mon dossier pour vérification
                </Button>
                {missingForSubmit ? (
                  <p className="text-xs text-muted-foreground">
                    Certaines informations ou pièces obligatoires manquent encore.
                  </p>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </section>

      {step === "review" || readOnly ? null : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" disabled={saving} onClick={() => void saveAndContinue()}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            Enregistrer et continuer
          </Button>
          <Button size="lg" variant="outline" disabled={saving} onClick={() => void saveAndQuit()}>
            <Save className="size-4" /> Enregistrer et quitter
          </Button>
        </div>
      )}

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitter sans enregistrer les modifications ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les informations saisies dans cette section ne seront pas conservées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuer</AlertDialogCancel>
            <AlertDialogAction onClick={() => void navigate({ to: "/pro/dossier" })}>
              Quitter sans enregistrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
