import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { formatDateTime, formatEuro } from "@/lib/labels";
import { useBillingCustomers, CUSTOMER_KIND_LABELS } from "@/lib/billing-customers";
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

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    if (!invoice) return;
    setCustomerId(invoice.customer_id ?? "");
    setIssues([]);
  }, [invoice]);

  const vatRate = Number(invoice?.vat_rate ?? 0);
  const liable = invoice?.tax_regime === "liable" && vatRate > 0;
  const amountHt = Number(invoice?.amount_ht ?? 0);
  const amountTtc = Number(invoice?.amount_ttc ?? 0);
  const list = useMemo(() => customers.data ?? [], [customers.data]);
  const selected = list.find((c) => c.id === customerId) ?? null;

  async function submit() {
    if (!invoice || busy) return;
    if (invoice.status !== "draft") {
      toast.error("Cette facture a déjà été émise.");
      return;
    }
    if (!customerId) {
      toast.error("Sélectionnez le client à facturer");
      return;
    }
    setBusy(true);
    try {
      if (customerId !== (invoice.customer_id ?? "")) {
        const { error: upErr } = await supabase
          .from("invoices")
          .update({ customer_id: customerId })
          .eq("id", invoice.id)
          .eq("status", "draft" as never);
        if (upErr) throw upErr;
      }

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
        full_name: snap["display_name"] ?? snap["legal_name"] ?? invoice.passenger_name ?? null,
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
        toast.success(`Facture ${issued.number ?? ""} émise`);
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
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {selected
                      ? selected.display_name
                      : customers.isLoading
                        ? "Chargement…"
                        : "Sélectionner un client"}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[--radix-popover-trigger-width] p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Command>
                  <CommandInput placeholder="Rechercher (nom, entreprise, email…)" />
                  <CommandList>
                    <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                    <CommandGroup>
                      {list.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={[c.display_name, c.legal_name, c.billing_email, c.contact_phone, c.contact_name]
                            .filter(Boolean)
                            .join(" ")}
                          onSelect={() => {
                            setCustomerId(c.id);
                            setPickerOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 size-4 ${c.id === customerId ? "opacity-100" : "opacity-0"}`}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{c.display_name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {[CUSTOMER_KIND_LABELS[c.kind], c.billing_email].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="mt-1 text-xs text-muted-foreground">
              Aucun client adapté ?{" "}
              <Link to="/pro/clients-factures" className="underline">
                Gérer les clients facturés
              </Link>
            </p>
          </div>

          <div className="surface p-3">
            <ReadOnlyRow label="Passager transporté" value={invoice?.passenger_name || "—"} />
            <ReadOnlyRow
              label="Date de la prestation"
              value={formatDateTime(invoice?.service_date ?? invoice?.issued_on ?? null)}
            />
            <ReadOnlyRow label="Quantité" value={String(invoice?.quantity ?? 1)} />
            <ReadOnlyRow
              label="Prix unitaire HT"
              value={formatEuro(Number(invoice?.unit_price_ht ?? amountHt))}
            />
            <ReadOnlyRow
              label="Désignation"
              value={invoice?.description || "Prestation de transport de personnes (VTC)"}
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

          <p className="text-xs text-muted-foreground">
            Les informations de la course sont automatiquement reprises. Vérifiez uniquement le client facturé avant
            d'émettre la facture.
          </p>

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
          <Button disabled={busy || !customerId} onClick={() => void submit()}>
            {busy ? "Émission…" : "Émettre définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
