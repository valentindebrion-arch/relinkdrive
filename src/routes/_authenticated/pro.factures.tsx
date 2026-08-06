import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDriverProfile } from "@/lib/driver-queries";
import { PageHeader, EmptyState, StatCard } from "@/components/Ui";
import { StatusBadge } from "@/components/StatusBadge";
import { INVOICE_LABELS, PAYMENT_METHODS, formatDate, formatEuro } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityPage } from "@/components/pro/ActivityPage";

export const Route = createFileRoute("/_authenticated/pro/factures")({
  component: DriverInvoices,
});

type Invoice = {
  id: string;
  number: string;
  status: string;
  amount_ht: number;
  amount_ttc: number;
  vat_rate: number;
  description: string | null;
  issued_on: string;
  ride_id: string | null;
  payment_method: string | null;
  due_on: string | null;
};

function DriverInvoices() {
  const { user, profile } = useAuth();
  const driver = useDriverProfile();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [tab, setTab] = useState("toutes");

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
      return (data ?? []) as unknown as Invoice[];
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
      status: "issued",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setAmount("");
    setDescription("");
    toast.success("Facture créée");
    refresh();
  }

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["driver-invoices"] });
    void qc.invalidateQueries({ queryKey: ["driver-data"] });
  }

  async function setStatus(inv: Invoice, status: "sent" | "paid" | "cancelled" | "issued") {
    const { error } = await supabase
      .from("invoices")
      .update({ status: status as never, ...(status === "paid" ? { paid_at: new Date().toISOString() } : {}) })
      .eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (status === "paid") {
      await supabase.from("payments").insert({
        invoice_id: inv.id,
        driver_id: user!.id,
        amount: Number(inv.amount_ttc),
        method: inv.payment_method ?? "cash",
      });
    }
    refresh();
  }

  async function finalize(inv: Invoice) {
    const value = window.prompt("Montant HT définitif (€)", String(inv.amount_ht || ""));
    if (value == null) return;
    const ht = Number(value);
    if (!ht) {
      toast.error("Montant invalide");
      return;
    }
    const { error } = await supabase
      .from("invoices")
      .update({
        amount_ht: ht,
        amount_ttc: Math.round(ht * (1 + Number(inv.vat_rate) / 100) * 100) / 100,
        status: "issued" as never,
      })
      .eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Facture finalisée");
    refresh();
  }

  function download(inv: Invoice) {
    const lines = [
      `FACTURE ${inv.number}`,
      `Date : ${formatDate(inv.issued_on)}`,
      inv.due_on ? `Échéance : ${formatDate(inv.due_on)}` : "",
      "",
      `Émetteur : ${driver.data?.business_name ?? profile?.full_name ?? ""}`,
      driver.data?.siret ? `SIRET : ${driver.data.siret}` : "",
      driver.data?.professional_address ?? "",
      "",
      `Prestation : ${inv.description ?? ""}`,
      inv.payment_method ? `Moyen de paiement : ${PAYMENT_METHODS[inv.payment_method] ?? inv.payment_method}` : "",
      `Montant HT : ${formatEuro(Number(inv.amount_ht))}`,
      `TVA (${inv.vat_rate}%) : ${formatEuro(Number(inv.amount_ttc) - Number(inv.amount_ht))}`,
      `Total TTC : ${formatEuro(Number(inv.amount_ttc))}`,
      `Statut : ${INVOICE_LABELS[inv.status] ?? inv.status}`,
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

  function exportCsv(list: Invoice[]) {
    const rows = [
      ["Numero", "Date", "Description", "HT", "TVA", "TTC", "Statut"],
      ...list.map((i) => [
        i.number,
        i.issued_on,
        (i.description ?? "").replace(/;/g, ","),
        String(i.amount_ht),
        String(i.vat_rate),
        String(i.amount_ttc),
        INVOICE_LABELS[i.status] ?? i.status,
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "factures-relink.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const list = invoices.data ?? [];
  const billed = list.filter((i) => i.status !== "cancelled" && i.status !== "draft");
  const paidList = list.filter((i) => i.status === "paid");
  const toCollect = billed.filter((i) => i.status !== "paid");
  const drafts = list.filter((i) => i.status === "draft");
  const sum = (arr: Invoice[]) => arr.reduce((s, i) => s + Number(i.amount_ttc), 0);

  const shown = tab === "encaisser" ? toCollect : tab === "payees" ? paidList : list;

  return (
    <>
      <PageHeader title="Facturation" description="Vos factures se créent automatiquement à la fin de chaque course." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="CA facturé" value={formatEuro(sum(billed))} hint={`${billed.length} facture(s)`} />
        <StatCard label="CA encaissé" value={formatEuro(sum(paidList))} hint={`${paidList.length} payée(s)`} />
        <StatCard label="Reste à encaisser" value={formatEuro(sum(toCollect))} hint={`${toCollect.length} en attente`} />
      </div>

      {drafts.length ? (
        <div className="surface mb-6 border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-medium">
            {drafts.length} brouillon(s) à compléter — ces documents ne sont pas des factures définitives.
          </p>
          <p className="mt-1 text-muted-foreground">
            Renseignez le montant final pour les finaliser et les envoyer au client.
          </p>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 mb-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="toutes">Toutes les factures</TabsTrigger>
            <TabsTrigger value="encaisser">À encaisser</TabsTrigger>
            <TabsTrigger value="payees">Payées</TabsTrigger>
            <TabsTrigger value="stats">Statistiques</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="stats">
          <ActivityPage />
        </TabsContent>

        {["toutes", "encaisser", "payees"].map((key) => (
          <TabsContent key={key} value={key} className="space-y-4">
            {key === "toutes" ? (
              <div className="surface grid gap-3 p-4 sm:grid-cols-4">
                <div>
                  <Label htmlFor="am">Montant HT (€)</Label>
                  <Input id="am" type="number" min="0" step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="de">Description</Label>
                  <Input id="de" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={create}>Créer</Button>
                  <Button variant="outline" onClick={() => exportCsv(list)}>
                    Export
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-4">
                  Facture manuelle (hors course). TVA appliquée : {vatRate}% — modifiable dans « Mon profil ».
                </p>
              </div>
            ) : null}

            {shown.length === 0 ? (
              <EmptyState title="Aucune facture dans cette vue" />
            ) : (
              <div className="space-y-3">
                {shown.map((inv) => (
                  <div key={inv.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {inv.number} · {formatEuro(Number(inv.amount_ttc))}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {formatDate(inv.issued_on)} · {inv.description}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={inv.status} labels={INVOICE_LABELS} />
                      {inv.status === "draft" ? (
                        <Button size="sm" onClick={() => finalize(inv)}>
                          Compléter et finaliser
                        </Button>
                      ) : null}
                      {inv.status === "issued" ? (
                        <Button size="sm" variant="outline" onClick={() => setStatus(inv, "sent")}>
                          Marquer envoyée
                        </Button>
                      ) : null}
                      {!["paid", "cancelled", "draft"].includes(inv.status) ? (
                        <Button size="sm" onClick={() => setStatus(inv, "paid")}>
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
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
