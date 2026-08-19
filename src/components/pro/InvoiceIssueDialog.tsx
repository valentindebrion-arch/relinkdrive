import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatEuro } from "@/lib/labels";
import { useBillingCustomers } from "@/lib/billing-customers";
import { fetchInvoiceIssuer } from "@/lib/invoice-archive";
import { generateAndArchiveInvoiceDocuments } from "@/lib/einvoicing/documents";
import type { InvoiceRow } from "@/lib/einvoicing/model";

export type DraftInvoice = {
  id: string;
  amount_ht: number;
  amount_ttc: number;
  vat_rate: number;
  description: string | null;
  issued_on: string;
  ride_id: string | null;
  customer_id?: string | null;
  passenger_name?: string | null;
  service_date?: string | null;
  quantity?: number | null;
  unit_price_ht?: number | null;
  tax_regime?: string | null;
  status: string;
  number: string | null;
};

function toLocalInput(value?: string | null) {
  const d = value ? new Date(value) : new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function InvoiceIssueDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: DraftInvoice | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const customers = useBillingCustomers(user?.id);
  const [customerId, setCustomerId] = useState("");
  const [passenger, setPassenger] = useState("");
  const [serviceDate, setServiceDate] = useState(toLocalInput());
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    if (!invoice) return;
    setCustomerId(invoice.customer_id ?? "");
    setPassenger(invoice.passenger_name ?? "");
    setServiceDate(toLocalInput(invoice.service_date ?? invoice.issued_on));
    setQuantity(String(invoice.quantity ?? 1));
    setUnitPrice(
      String(invoice.unit_price_ht ?? (invoice.amount_ht ? Number(invoice.amount_ht) : "") ?? ""),
    );
    setDescription(invoice.description ?? "");
  }, [invoice]);

  const vatRate = Number(invoice?.vat_rate ?? 0);
  const liable = invoice?.tax_regime === "liable" && vatRate > 0;
  const amountHt = useMemo(
    () => Math.round(Number(quantity || 0) * Number(unitPrice || 0) * 100) / 100,
    [quantity, unitPrice],
  );
  const amountTtc = useMemo(
    () => (liable ? Math.round(amountHt * (1 + vatRate / 100) * 100) / 100 : amountHt),
    [amountHt, liable, vatRate],
  );

  async function submit() {
    if (!invoice) return;
    if (!customerId) {
      toast.error("Sélectionnez le client à facturer");
      return;
    }
    if (!amountHt) {
      toast.error("Indiquez un montant supérieur à zéro");
      return;
    }
    setBusy(true);
    try {
      const { error: upErr } = await supabase
        .from("invoices")
        .update({
          customer_id: customerId,
          passenger_name: passenger.trim() || null,
          service_date: new Date(serviceDate).toISOString(),
          quantity: Number(quantity || 1),
          unit_price_ht: Number(unitPrice || 0),
          amount_ht: amountHt,
          amount_ttc: amountTtc,
          description: description.trim() || null,
        })
        .eq("id", invoice.id);
      if (upErr) throw upErr;

      const { data, error } = await (
        supabase as unknown as {
          rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
        }
      ).rpc("issue_invoice", { _invoice_id: invoice.id });
      if (error) throw error;

      const issued = data as {
        number: string | null;
        issued_on: string;
        amount_ht: number;
        amount_ttc: number;
        vat_rate: number;
        status: string;
        due_on: string | null;
        description: string | null;
        document_type: string;
        tax_regime: string | null;
        tax_legal_mention: string | null;
        tax_vat_number: string | null;
        customer_snapshot: Record<string, string | null> | null;
      };

      // Conservation légale : PDF lisible, Factur-X et XML issus de la même source.
      const issuer = await fetchInvoiceIssuer(user!.id);
      let ride = null as
        | null
        | {
            pickup_address?: string | null;
            dropoff_address?: string | null;
            scheduled_at?: string | null;
            completed_at?: string | null;
            passengers?: number | null;
            mileage_km?: number | string | null;
          };
      if (invoice.ride_id) {
        const { data: r } = await supabase
          .from("rides")
          .select("pickup_address, dropoff_address, scheduled_at, completed_at, passengers, mileage_km")
          .eq("id", invoice.ride_id)
          .maybeSingle();
        ride = r ?? null;
      }
      const snap = issued.customer_snapshot ?? {};
      const client = {
        full_name: snap["display_name"] ?? snap["legal_name"] ?? passenger ?? null,
        email: snap["billing_email"] ?? null,
        phone: snap["contact_phone"] ?? null,
      };

      const result = await generateAndArchiveInvoiceDocuments({
        invoice: { ...(issued as never as InvoiceRow), id: invoice.id },
        issuer,
        client,
        ride,
        driverId: user!.id,
      });

      if (!result.validation.valid) {
        // La facture reste émise (numérotation irréversible) : on signale les
        // anomalies bloquant la production du format structuré.
        setIssues(result.validation.errors.map((e) => e.message));
        toast.warning("Facture émise, mais le format Factur-X n'a pas pu être généré");
      } else {
        toast.success(`Facture ${issued.number ?? ""} émise au format Factur-X`);
        onOpenChange(false);
      }
      void qc.invalidateQueries({ queryKey: ["driver-invoices"] });
      void qc.invalidateQueries({ queryKey: ["einvoices"] });
    } catch (e) {
      toast.error((e as { message?: string }).message ?? "Émission impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Émettre la facture</DialogTitle>
          <DialogDescription>
            Une fois émise, la facture est numérotée définitivement et ne peut plus être modifiée (seul un avoir la
            corrige).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <Label>Client facturé</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un client" />
              </SelectTrigger>
              <SelectContent>
                {(customers.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Aucun client adapté ?{" "}
              <Link to="/pro/clients-factures" className="underline">
                Gérer les clients facturés
              </Link>
            </p>
          </div>

          <div>
            <Label htmlFor="passenger">Passager transporté (si différent)</Label>
            <Input id="passenger" value={passenger} onChange={(e) => setPassenger(e.target.value)} maxLength={120} />
          </div>

          <div>
            <Label htmlFor="service-date">Date de la prestation</Label>
            <Input
              id="service-date"
              type="datetime-local"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qty">Quantité</Label>
              <Input id="qty" type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pu">Prix unitaire HT (€)</Label>
              <Input id="pu" type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="desc">Désignation</Label>
            <Input
              id="desc"
              value={description}
              maxLength={200}
              placeholder="Prestation de transport de personnes (VTC)"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="surface p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total HT</span>
              <span className="font-medium tabular-nums">{formatEuro(amountHt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TVA {liable ? `(${vatRate} %)` : ""}</span>
              <span className="font-medium tabular-nums">
                {liable ? formatEuro(amountTtc - amountHt) : "Non applicable"}
              </span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-1">
              <span className="font-semibold">Total à payer</span>
              <span className="font-semibold tabular-nums">{formatEuro(amountTtc)}</span>
            </div>
          </div>

          {issues.length ? (
            <div className="surface border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-medium">Le format Factur-X n'a pas pu être produit :</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                {issues.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">
                Corrigez ces informations puis relancez la génération depuis « Facturation électronique ».
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={busy} onClick={() => void submit()}>
            Émettre définitivement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
