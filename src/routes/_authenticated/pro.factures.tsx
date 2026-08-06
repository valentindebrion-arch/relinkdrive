import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile } from "@/lib/driver-queries";
import { PageHeader, EmptyState, StatCard } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { INVOICE_LABELS, formatDate, formatEuro } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/pro/factures")({
  component: DriverInvoices,
});

function DriverInvoices() {
  const { user, profile } = useAuth();
  const driver = useDriverProfile();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const invoices = useQuery({
    queryKey: ["driver-invoices", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("driver_id", user!.id)
        .order("issued_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const vatRate = driver.data?.vat_applicable ? 10 : 0;

  async function create() {
    const ht = Number(amount);
    if (!ht) {
      toast.error("Indiquez un montant");
      return;
    }
    const { error } = await supabase.from("invoices").insert({
      driver_id: user!.id,
      number: `F-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000 + 100000)}`,
      amount_ht: ht,
      amount_ttc: Math.round(ht * (1 + vatRate / 100) * 100) / 100,
      vat_rate: vatRate,
      description: description || "Prestation de transport",
      status: "draft",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setAmount("");
    setDescription("");
    toast.success("Facture créée");
    void qc.invalidateQueries({ queryKey: ["driver-invoices"] });
  }

  async function setStatus(id: string, status: "sent" | "paid" | "cancelled") {
    await supabase.from("invoices").update({ status }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["driver-invoices"] });
  }

  function download(inv: { number: string; amount_ht: number; amount_ttc: number; vat_rate: number; description: string | null; issued_on: string }) {
    const lines = [
      `FACTURE ${inv.number}`,
      `Date : ${formatDate(inv.issued_on)}`,
      "",
      `Émetteur : ${driver.data?.business_name ?? profile?.full_name ?? ""}`,
      driver.data?.siret ? `SIRET : ${driver.data.siret}` : "",
      driver.data?.professional_address ?? "",
      "",
      `Prestation : ${inv.description ?? ""}`,
      `Montant HT : ${formatEuro(Number(inv.amount_ht))}`,
      `TVA (${inv.vat_rate}%) : ${formatEuro(Number(inv.amount_ttc) - Number(inv.amount_ht))}`,
      `Total TTC : ${formatEuro(Number(inv.amount_ttc))}`,
      "",
      driver.data?.billing_legal_info ?? "TVA non applicable, art. 293 B du CGI",
    ].filter(Boolean);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const list = invoices.data ?? [];
  const paid = list.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount_ttc), 0);
  const pending = list.filter((i) => i.status === "sent" || i.status === "draft").reduce((s, i) => s + Number(i.amount_ttc), 0);

  return (
    <>
      <PageHeader title="Factures" description="Générez et suivez vos factures." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Encaissé" value={formatEuro(paid)} />
        <StatCard label="En attente" value={formatEuro(pending)} />
        <StatCard label="Factures" value={list.length} />
      </div>

      <div className="surface mb-6 grid gap-3 p-4 sm:grid-cols-4">
        <div>
          <Label htmlFor="am">Montant HT (€)</Label>
          <Input id="am" type="number" min="0" step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="de">Description</Label>
          <Input id="de" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button onClick={create}>Créer une facture</Button>
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-4">
          TVA appliquée : {vatRate}% (modifiable dans « Mon entreprise »).
        </p>
      </div>

      {list.length === 0 ? (
        <EmptyState title="Aucune facture" />
      ) : (
        <div className="space-y-3">
          {list.map((inv) => (
            <div key={inv.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">
                  {inv.number} · {formatEuro(Number(inv.amount_ttc))}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(inv.issued_on)} · {inv.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={inv.status} labels={INVOICE_LABELS} />
                {inv.status === "draft" ? (
                  <Button size="sm" variant="outline" onClick={() => setStatus(inv.id, "sent")}>
                    Marquer envoyée
                  </Button>
                ) : null}
                {inv.status !== "paid" && inv.status !== "cancelled" ? (
                  <Button size="sm" onClick={() => setStatus(inv.id, "paid")}>
                    Marquer payée
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => download(inv)}>
                  Télécharger
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
