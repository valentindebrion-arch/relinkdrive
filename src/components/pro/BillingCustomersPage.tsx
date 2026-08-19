import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Plus, Archive, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/Ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CUSTOMER_KIND_LABELS,
  PAYMENT_TERMS_LABELS,
  isValidSiren,
  useBillingCustomers,
  type BillingCustomer,
  type BillingCustomerKind,
  type PaymentTerms,
} from "@/lib/billing-customers";

type FormState = {
  kind: BillingCustomerKind;
  display_name: string;
  legal_name: string;
  siren: string;
  vat_number: string;
  billing_address: string;
  billing_postal_code: string;
  billing_city: string;
  billing_email: string;
  contact_name: string;
  contact_phone: string;
  po_number: string;
  payment_terms: PaymentTerms;
  payment_terms_days: string;
};

const EMPTY: FormState = {
  kind: "individual",
  display_name: "",
  legal_name: "",
  siren: "",
  vat_number: "",
  billing_address: "",
  billing_postal_code: "",
  billing_city: "",
  billing_email: "",
  contact_name: "",
  contact_phone: "",
  po_number: "",
  payment_terms: "immediate",
  payment_terms_days: "",
};

function toForm(c: BillingCustomer): FormState {
  return {
    kind: c.kind,
    display_name: c.display_name,
    legal_name: c.legal_name ?? "",
    siren: c.siren ?? "",
    vat_number: c.vat_number ?? "",
    billing_address: c.billing_address ?? "",
    billing_postal_code: c.billing_postal_code ?? "",
    billing_city: c.billing_city ?? "",
    billing_email: c.billing_email ?? "",
    contact_name: c.contact_name ?? "",
    contact_phone: c.contact_phone ?? "",
    po_number: c.po_number ?? "",
    payment_terms: c.payment_terms,
    payment_terms_days: c.payment_terms_days ? String(c.payment_terms_days) : "",
  };
}

export function BillingCustomersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const customers = useBillingCustomers(user?.id, true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BillingCustomer | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(c: BillingCustomer) {
    setEditing(c);
    setForm(toForm(c));
    setOpen(true);
  }

  async function save() {
    if (!form.display_name.trim()) {
      toast.error("Indiquez le nom affiché du client");
      return;
    }
    if (form.kind === "company_fr" && !isValidSiren(form.siren)) {
      toast.error("SIREN invalide (9 chiffres)");
      return;
    }
    if (form.payment_terms === "net_days" && !Number(form.payment_terms_days)) {
      toast.error("Indiquez le nombre de jours de règlement");
      return;
    }
    setBusy(true);
    const payload = {
      driver_id: user!.id,
      kind: form.kind,
      display_name: form.display_name.trim(),
      legal_name: form.legal_name.trim() || null,
      siren: form.kind === "company_fr" ? form.siren.replace(/\s/g, "") : null,
      vat_number: form.vat_number.trim() || null,
      billing_address: form.billing_address.trim() || null,
      billing_postal_code: form.billing_postal_code.trim() || null,
      billing_city: form.billing_city.trim() || null,
      billing_email: form.billing_email.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      po_number: form.po_number.trim() || null,
      payment_terms: form.payment_terms,
      payment_terms_days: form.payment_terms === "net_days" ? Number(form.payment_terms_days) : null,
    };
    const { error } = editing
      ? await supabase.from("billing_customers").update(payload).eq("id", editing.id)
      : await supabase.from("billing_customers").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Client mis à jour" : "Client créé");
    setOpen(false);
    void qc.invalidateQueries({ queryKey: ["billing-customers"] });
  }

  async function toggleArchive(c: BillingCustomer) {
    const { error } = await supabase
      .from("billing_customers")
      .update({ archived_at: c.archived_at ? null : new Date().toISOString() })
      .eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["billing-customers"] });
  }

  const list = customers.data ?? [];
  const active = list.filter((c) => !c.archived_at);
  const archived = list.filter((c) => c.archived_at);

  const field = (key: keyof FormState, label: string, type = "text") => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        value={form[key]}
        maxLength={140}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  const row = (c: BillingCustomer) => (
    <div key={c.id} className="surface flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate font-semibold">{c.display_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {CUSTOMER_KIND_LABELS[c.kind]}
          {c.siren ? ` · SIREN ${c.siren}` : ""}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {PAYMENT_TERMS_LABELS[c.payment_terms]}
          {c.payment_terms === "net_days" && c.payment_terms_days ? ` (${c.payment_terms_days} j)` : ""}
          {c.billing_email ? ` · ${c.billing_email}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="icon" variant="ghost" aria-label="Modifier" onClick={() => openEdit(c)}>
          <Pencil className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={c.archived_at ? "Réactiver" : "Archiver"}
          onClick={() => void toggleArchive(c)}
        >
          <Archive className="size-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Clients facturés"
        description="Le client facturé peut être différent du passager : particulier, société française ou étrangère."
      />

      <Button className="mb-4" onClick={openNew}>
        <Plus className="mr-1 size-4" /> Nouveau client facturé
      </Button>

      {active.length === 0 ? (
        <EmptyState
          title="Aucun client facturé"
          description="Créez une fiche pour facturer une entreprise (SIREN obligatoire en France)."
        />
      ) : (
        <div className="space-y-3">{active.map(row)}</div>
      )}

      {archived.length ? (
        <div className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Building2 className="size-4" /> Archivés
          </h2>
          <div className="space-y-3 opacity-70">{archived.map(row)}</div>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le client facturé" : "Nouveau client facturé"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Type de client</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm({ ...form, kind: v as BillingCustomerKind })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CUSTOMER_KIND_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">{field("display_name", "Nom affiché")}</div>
            {form.kind !== "individual" ? (
              <>
                {field("legal_name", "Raison sociale")}
                {form.kind === "company_fr" ? field("siren", "SIREN (9 chiffres)") : null}
                {field("vat_number", "N° TVA intracommunautaire")}
                {field("po_number", "Référence / bon de commande")}
              </>
            ) : null}
            <div className="sm:col-span-2">{field("billing_address", "Adresse de facturation")}</div>
            {field("billing_postal_code", "Code postal")}
            {field("billing_city", "Ville")}
            {field("billing_email", "E-mail de facturation", "email")}
            {field("contact_phone", "Téléphone", "tel")}
            <div>
              <Label>Conditions de règlement</Label>
              <Select
                value={form.payment_terms}
                onValueChange={(v) => setForm({ ...form, payment_terms: v as PaymentTerms })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_TERMS_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.payment_terms === "net_days" ? field("payment_terms_days", "Jours", "number") : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button disabled={busy} onClick={() => void save()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
