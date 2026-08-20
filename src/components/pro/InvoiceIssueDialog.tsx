import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  client_id?: string | null;
  customer_id?: string | null;
  passenger_name?: string | null;
  service_date?: string | null;
  quantity?: number | null;
  unit_price_ht?: number | null;
  tax_regime?: string | null;
  status: string;
  number: string | null;
};

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`max-w-[60%] text-right text-sm ${strong ? "font-semibold" : "font-medium"}`}>{value}</span>
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

  const list = useMemo(() => customers.data ?? [], [customers.data]);

  // Pré-sélection automatique : fiche déjà rattachée, sinon le client de la course.
  useEffect(() => {
    if (!invoice) return;
    if (invoice.customer_id) {
      setCustomerId(invoice.customer_id);
      return;
    }
    const fromRide = invoice.client_id ? list.find((c) => c.client_id === invoice.client_id) : null;
    setCustomerId(fromRide?.id ?? "");
  }, [invoice, list]);

  const vatRate = Number(invoice?.vat_rate ?? 0);
  const liable = invoice?.tax_regime === "liable" && vatRate > 0;
  const amountHt = Number(invoice?.amount_ht ?? 0);
  const amountTtc = Number(invoice?.amount_ttc ?? 0);
  const selected = list.find((c) => c.id === customerId) ?? null;

  async function submit() {
    if (!invoice || busy) return;
    if (invoice.status !== "draft") {
      toast.error("Cette facture a déjà été émise.");
      return;
    }
    if (!customerId) {
      toast.error("Sélectionnez le client facturé");
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
        customer_snapshot: Record<string, string | null> | null;
      } & Record<string, unknown>;

      // Conservation légale des documents (invisible pour le chauffeur).
      try {
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
        await generateAndArchiveInvoiceDocuments({
          invoice: { ...(issued as never as InvoiceRow), id: invoice.id },
          issuer,
          client,
          ride,
          driverId: user!.id,
        });
      } catch (archiveError) {
        console.error(archiveError);
      }

      toast.success(`Facture ${issued.number ?? ""} émise`.trim());
      onOpenChange(false);
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
            Une fois émise, la facture est numérotée définitivement. Une correction se fait ensuite par un avoir.
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
                  className="h-11 w-full justify-between font-normal"
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
                className="z-[60] w-[--radix-popover-trigger-width] p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Command>
                  <CommandInput placeholder="Rechercher un client" />
                  <CommandList className="max-h-64">
                    <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                    <CommandGroup>
                      {list.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.display_name} ${c.billing_email ?? ""} ${c.contact_phone ?? ""}`}
                          onSelect={() => {
                            setCustomerId(c.id);
                            setPickerOpen(false);
                          }}
                        >
                          <Check className={`mr-2 size-4 ${c.id === customerId ? "opacity-100" : "opacity-0"}`} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{c.display_name}</span>
                            {c.billing_email ? (
                              <span className="block truncate text-xs text-muted-foreground">{c.billing_email}</span>
                            ) : null}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="surface p-3">
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Détails de la prestation
            </p>
            <Row label="Passager" value={invoice?.passenger_name || "—"} />
            <Row label="Date" value={formatDateTime(invoice?.service_date ?? invoice?.issued_on ?? null)} />
            <Row label="Prestation" value={invoice?.description || "Transport VTC"} />
            <Row label="Quantité" value={String(invoice?.quantity ?? 1)} />
            <Row label="Montant HT" value={formatEuro(amountHt)} />
            <Row
              label={liable ? `TVA (${vatRate} %)` : "TVA"}
              value={liable ? formatEuro(amountTtc - amountHt) : "Non applicable"}
            />
            <Row label="Total" value={formatEuro(amountTtc)} strong />
          </div>

          <p className="text-xs text-muted-foreground">
            Les informations de la course sont automatiquement reprises. Vérifiez uniquement le client facturé avant
            d'émettre la facture.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={busy || !customerId} onClick={() => void submit()}>
            {busy ? "Émission…" : "Émettre la facture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
