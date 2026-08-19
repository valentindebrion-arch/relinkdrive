import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileCode2, FileText, Send, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatEuro } from "@/lib/labels";
import {
  ENTITY_CATEGORY_LABELS,
  FACTURX_PROFILE,
  FACTURX_SPEC_VERSION,
  obligationState,
  type EntityCategory,
} from "@/lib/einvoicing/spec";

function obligationText(date: string | null, due: boolean) {
  if (!date) return "à préciser (catégorie d'entreprise non renseignée)";
  return `${formatDate(date)}${due ? " — en vigueur" : ""}`;
}
import {
  useCompanyEinvoicing,
  useEinvoices,
  useInvoiceDocuments,
  useInvoiceTransmissions,
  type EinvoiceRow,
} from "@/lib/einvoicing/queries";
import { openStoredDocument } from "@/lib/einvoicing/documents";
import { useEinvoicingConnection } from "@/lib/einvoicing/connections";
import { PlatformConnectionPanel } from "@/components/pro/PlatformConnectionPanel";
import { SubmitInvoiceDialog } from "@/components/pro/SubmitInvoiceDialog";
import { EreportingPanel } from "@/components/pro/EreportingPanel";
import { SupplierInvoicesPanel } from "@/components/pro/SupplierInvoicesPanel";
import {
  LIFECYCLE_ORDER,
  TRANSMISSION_STATUS_LABELS,
  queueEreporting,
  recordTransmission,
  resolveConnector,
  type TransmissionStatus,
} from "@/lib/einvoicing/platform";

const CATEGORIES: EntityCategory[] = ["micro", "tpe", "pme", "eti", "ge"];

function statusLabel(value: string) {
  return TRANSMISSION_STATUS_LABELS[value as TransmissionStatus] ?? value;
}

function Lifecycle({ status }: { status: string }) {
  const index = LIFECYCLE_ORDER.indexOf(status as TransmissionStatus);
  const failed = status === "rejected" || status === "failed";
  return (
    <div className="mt-2 flex items-center gap-1" aria-label={`Statut : ${statusLabel(status)}`}>
      {LIFECYCLE_ORDER.map((s, i) => (
        <span
          key={s}
          className={`h-1.5 flex-1 rounded-full ${
            failed ? "bg-destructive/60" : i <= index ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

function InvoiceRowCard({ invoice }: { invoice: EinvoiceRow }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const docs = useInvoiceDocuments(open ? invoice.id : null);
  const events = useInvoiceTransmissions(open ? invoice.id : null);
  const company = useCompanyEinvoicing(useAuth().user?.id);
  const connector = resolveConnector(company.data);
  const facturx = (docs.data ?? []).find((d) => d.kind === "facturx");
  const xml = (docs.data ?? []).find((d) => d.kind === "xml");
  const pdf = (docs.data ?? []).find((d) => d.kind === "pdf") ?? null;

  async function transmit() {
    try {
      await connector.send({ invoiceId: invoice.id, facturxPath: facturx?.path ?? null });
      if (invoice.customer_kind === "individual") await queueEreporting(invoice.id, "b2c");
      toast.success("Transmission enregistrée");
      void qc.invalidateQueries({ queryKey: ["einvoices"] });
      void qc.invalidateQueries({ queryKey: ["invoice-transmissions", invoice.id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function setStatus(status: TransmissionStatus) {
    try {
      await recordTransmission({ invoiceId: invoice.id, channel: "manual_file", status });
      void qc.invalidateQueries({ queryKey: ["einvoices"] });
      void qc.invalidateQueries({ queryKey: ["invoice-transmissions", invoice.id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="surface p-4">
      <button type="button" className="w-full text-left" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {invoice.document_type === "credit_note" ? "Avoir" : "Facture"} n° {invoice.number}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {formatDate(invoice.issued_on)} · {formatEuro(Number(invoice.amount_ttc))} TTC ·{" "}
              {String((invoice.customer_snapshot?.["display_name"] as string) ?? "Client")}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">
            {invoice.legacy_pre_reform ? "Hors réforme" : statusLabel(invoice.transmission_status)}
          </span>
        </div>
        <Lifecycle status={invoice.transmission_status} />
      </button>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3 text-sm">
          {invoice.legacy_pre_reform ? (
            <p className="text-muted-foreground">
              Facture antérieure à la réforme : elle est conservée telle quelle, sans format structuré.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!pdf && !invoice.pdf_path}
              onClick={() => void openStoredDocument(pdf?.path ?? invoice.pdf_path!)}>
              <FileText className="mr-1 size-4" /> PDF lisible
            </Button>
            <Button size="sm" variant="outline" disabled={!facturx} onClick={() => void openStoredDocument(facturx!.path)}>
              <ShieldCheck className="mr-1 size-4" /> Factur-X
            </Button>
            <Button size="sm" variant="outline" disabled={!xml} onClick={() => void openStoredDocument(xml!.path)}>
              <FileCode2 className="mr-1 size-4" /> XML CII
            </Button>
          </div>

          {facturx ? (
            <p className="text-xs text-muted-foreground">
              {facturx.spec_version} · profil {facturx.profile} · empreinte SHA-256 {facturx.sha256.slice(0, 16)}…
            </p>
          ) : (
            <p className="text-xs text-warning">
              Aucun format structuré conservé pour cette facture.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void transmit()} disabled={!facturx}>
              <Send className="mr-1 size-4" /> {connector.label}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void setStatus("accepted")}>
              Marquer acceptée
            </Button>
            <Button size="sm" variant="outline" onClick={() => void setStatus("rejected")}>
              Marquer refusée
            </Button>
            <Button size="sm" variant="outline" onClick={() => void setStatus("cashed")}>
              Marquer encaissée
            </Button>
          </div>

          {invoice.transmission_error ? (
            <p className="text-xs text-destructive">{invoice.transmission_error}</p>
          ) : null}

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase">Journal des échanges</p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {(events.data ?? []).map((e) => (
                <li key={e.id}>
                  {formatDate(e.occurred_at)} · {statusLabel(e.status)} · {e.channel}
                  {e.ack_message ? ` — ${e.ack_message}` : ""}
                </li>
              ))}
              {(events.data ?? []).length === 0 ? <li>Aucun échange enregistré.</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function EinvoicingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const company = useCompanyEinvoicing(user?.id);
  const invoices = useEinvoices(user?.id);
  const [address, setAddress] = useState<string | null>(null);

  const state = useMemo(
    () => obligationState(company.data?.entity_category ?? "unknown", company.data?.anticipation_opt_in ?? false),
    [company.data],
  );

  async function patch(values: Record<string, unknown>) {
    if (!company.data) {
      toast.error("Complétez d'abord votre fiche entreprise");
      return;
    }
    const { error } = await supabase.from("companies").update(values as never).eq("id", company.data.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["company-einvoicing"] });
    toast.success("Paramètres enregistrés");
  }

  const pending = (invoices.data ?? []).filter(
    (i) => !i.legacy_pre_reform && ["pending", "ready"].includes(i.transmission_status),
  );
  const missingStructured = (invoices.data ?? []).filter((i) => !i.legacy_pre_reform && !i.documents_generated_at);

  return (
    <>
      <PageHeader
        title="Facturation électronique"
        description="Pilotez vos obligations, vos formats structurés et le suivi de vos factures."
      />

      <div className="surface mb-4 p-5">
        <h2 className="text-sm font-semibold">Mes obligations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Réception des factures électroniques :{" "}
          <strong>{obligationText(state.receptionDate, state.receptionDue)}</strong> · Émission et e-reporting :{" "}
          <strong>{obligationText(state.issuanceDate, state.issuanceDue)}</strong>
          {state.anticipation ? " · anticipation volontaire activée" : ""}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Catégorie d'entreprise</Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => void patch({ entity_category: c, entity_category_source: "declared" })}
                  className={`tap-active rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    company.data?.entity_category === c ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {ENTITY_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="einv-address">Mon adresse de facturation électronique</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="einv-address"
                value={address ?? company.data?.einvoicing_address ?? ""}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="SIREN, identifiant de routage ou email"
                maxLength={160}
              />
              <Button variant="outline" onClick={() => void patch({ einvoicing_address: (address ?? "").trim() || null })}>
                Enregistrer
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {(
            [
              ["receive_enabled", "Recevoir des factures électroniques"],
              ["issue_enabled", "Émettre au format structuré"],
              ["ereporting_enabled", "Transmettre l'e-reporting (particuliers, encaissements)"],
              ["anticipation_opt_in", "Anticiper mes obligations avant l'échéance"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-sm">{label}</span>
              <Switch
                checked={!!company.data?.[key]}
                onCheckedChange={(v) => void patch({ [key]: v })}
                aria-label={label}
              />
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Format généré : {FACTURX_SPEC_VERSION}, profil {FACTURX_PROFILE}. La transmission passe obligatoirement par une
          plateforme agréée : ReLink prépare et conserve les fichiers, journalise chaque échange et suit les statuts.
        </p>
      </div>

      {missingStructured.length ? (
        <div className="surface mb-4 flex items-start gap-3 border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            {missingStructured.length} facture(s) émise(s) sans format structuré conservé. Émettez vos prochaines factures
            depuis l'espace <Link to="/pro/factures" className="underline">Facturation</Link> pour générer le Factur-X.
          </p>
        </div>
      ) : null}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Suivi des factures</h2>
        <span className="text-xs text-muted-foreground">
          {pending.length ? `${pending.length} à transmettre` : (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="size-3.5" /> Tout est transmis
            </span>
          )}
        </span>
      </div>

      {invoices.isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="surface h-20 animate-pulse" />)}</div>
      ) : (invoices.data ?? []).length === 0 ? (
        <EmptyState title="Aucune facture émise pour le moment." />
      ) : (
        <div className="space-y-3">
          {(invoices.data ?? []).map((inv) => (
            <InvoiceRowCard key={inv.id} invoice={inv} />
          ))}
        </div>
      )}
    </>
  );
}
